'use strict';

const { execFile, execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const { getWhisperModel, modelFilePath } = require('./whisper-models');
const { temporaryWavName, isOverlayTempName } = require('./temp-files');

const MAX_REDIRECTS = 5;
const TRANSCRIBE_TIMEOUT_MS = 120000;

let cachedBinary = null;
const liveFiles = new Set();
const liveProcesses = new Set();

function whisperBinary() {
    if (cachedBinary) {
        return cachedBinary;
    }
    const candidates = [process.env.WHISPER_CLI, '/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli'];
    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            cachedBinary = candidate;
            return cachedBinary;
        }
    }
    try {
        cachedBinary = execFileSync('/usr/bin/which', ['whisper-cli'], { encoding: 'utf8' }).trim();
    } catch {
        throw new Error('whisper-cli не найден. Установи: brew install whisper-cpp');
    }
    return cachedBinary;
}

function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        fs.createReadStream(filePath)
            .on('data', chunk => hash.update(chunk))
            .on('error', reject)
            .on('end', () => resolve(hash.digest('hex')));
    });
}

async function modelState(modelsDir, id) {
    const model = getWhisperModel(id);
    const filePath = modelFilePath(modelsDir, id);
    if (!fs.existsSync(filePath)) {
        return { id, ready: false, reason: 'missing' };
    }
    if (fs.statSync(filePath).size !== model.sizeBytes) {
        return { id, ready: false, reason: 'size-mismatch' };
    }
    return { id, ready: true, path: filePath };
}

function download(url, destination, onProgress, redirectsLeft = MAX_REDIRECTS) {
    return new Promise((resolve, reject) => {
        https
            .get(url, response => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    response.resume();
                    if (redirectsLeft === 0) {
                        reject(new Error('Слишком много перенаправлений при скачивании модели'));
                        return;
                    }
                    resolve(download(new URL(response.headers.location, url).toString(), destination, onProgress, redirectsLeft - 1));
                    return;
                }
                if (response.statusCode !== 200) {
                    response.resume();
                    reject(new Error(`Не удалось скачать модель: HTTP ${response.statusCode}`));
                    return;
                }

                const total = Number(response.headers['content-length']) || 0;
                let received = 0;
                const file = fs.createWriteStream(destination);
                response.on('data', chunk => {
                    received += chunk.length;
                    if (onProgress) onProgress(received, total);
                });
                response.pipe(file);
                file.on('finish', () => file.close(() => resolve()));
                file.on('error', reject);
            })
            .on('error', reject);
    });
}

async function downloadModel(modelsDir, id, onProgress) {
    const model = getWhisperModel(id);
    const target = modelFilePath(modelsDir, id);
    const temporary = `${target}.part`;

    fs.mkdirSync(modelsDir, { recursive: true, mode: 0o700 });
    await download(model.url, temporary, onProgress);

    const digest = await sha256File(temporary);
    if (digest !== model.sha256) {
        fs.rmSync(temporary, { force: true });
        throw new Error(`Контрольная сумма модели ${id} не совпала — файл отброшен`);
    }

    fs.renameSync(temporary, target);
    return target;
}

function transcribe(wavPath, { modelPath, language = 'ru', threads = 4 }) {
    return new Promise((resolve, reject) => {
        const args = [
            '-m',
            modelPath,
            '-f',
            wavPath,
            '-l',
            language,
            '-t',
            String(threads),
            '-nt', // без таймкодов
            '-np', // без служебного вывода
            '-sns', // глушит токены неречевых звуков: в звонках их много
        ];
        const child = execFile(whisperBinary(), args, { timeout: TRANSCRIBE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
            liveProcesses.delete(child);
            if (error) {
                reject(new Error(`whisper-cli завершился с ошибкой: ${error.message}`));
                return;
            }
            resolve(stdout.replace(/\s+/g, ' ').trim());
        });
        liveProcesses.add(child);
    });
}

function temporaryWavPath() {
    const filePath = path.join(os.tmpdir(), temporaryWavName());
    liveFiles.add(filePath);
    return filePath;
}

function releaseTemporaryFile(filePath) {
    fs.rmSync(filePath, { force: true });
    liveFiles.delete(filePath);
}

// Вызывается при панике и перед выходом: обычный finally не успевает
// отработать, если процесс убивают прямо во время расшифровки.
function purgeNow() {
    for (const child of liveProcesses) {
        try {
            child.kill('SIGKILL');
        } catch {
            // процесс мог завершиться сам
        }
    }
    liveProcesses.clear();

    for (const filePath of liveFiles) {
        try {
            fs.rmSync(filePath, { force: true });
        } catch {
            // файл мог быть уже удалён
        }
    }
    liveFiles.clear();
}

// Чужие файлы в /tmp не трогаем: признак узкий и проверен тестами.
function purgeOrphans() {
    const directory = os.tmpdir();
    let removed = 0;
    try {
        for (const name of fs.readdirSync(directory)) {
            if (isOverlayTempName(name)) {
                fs.rmSync(path.join(directory, name), { force: true });
                removed += 1;
            }
        }
    } catch (error) {
        console.warn('Не удалось подчистить временные файлы:', error.message);
    }
    return removed;
}

module.exports = {
    whisperBinary,
    releaseTemporaryFile,
    purgeNow,
    purgeOrphans,
    modelState,
    downloadModel,
    transcribe,
    temporaryWavPath,
    sha256File,
};

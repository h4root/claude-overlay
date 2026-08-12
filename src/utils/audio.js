'use strict';

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const storage = require('../storage');
const { encodeWav, isSilent } = require('./audio-buffer');
const { RollingTranscript } = require('./transcript');
const { WHISPER_MODELS } = require('./whisper-models');
const { modelState, transcribe, temporaryWavPath, releaseTemporaryFile, downloadModel } = require('./whisper');

const transcriptBuffer = new RollingTranscript();

let mainWindow = null;
let currentRun = null;
let pendingChunk = null;
let lastError = '';

function setMainWindow(window) {
    mainWindow = window;
}

function send(channel, payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
    }
}

function modelsDir() {
    return path.join(storage.getConfigDir(), 'models');
}

function getTranscript() {
    return transcriptBuffer.text();
}

function clearTranscript() {
    transcriptBuffer.clear();
    send('transcript:update', { text: '' });
}

async function runWhisper(samples, sampleRate) {
    const preferences = storage.getPreferences();
    const state = await modelState(modelsDir(), preferences.whisperModel);
    if (!state.ready) {
        throw new Error(`Модель ${preferences.whisperModel} не скачана. Открой настройки и скачай её.`);
    }

    const wavPath = temporaryWavPath();
    try {
        fs.writeFileSync(wavPath, encodeWav(samples, sampleRate), { mode: 0o600 });
        return await transcribe(wavPath, {
            modelPath: state.path,
            language: preferences.whisperLanguage || 'ru',
        });
    } finally {
        // Во временном файле лежит звук чужого разговора — удаляем сразу, в любом исходе.
        releaseTemporaryFile(wavPath);
    }
}

async function runChunk(samples, sampleRate) {
    try {
        const text = await runWhisper(samples, sampleRate);
        if (text) {
            transcriptBuffer.add(text);
            send('transcript:update', { text: transcriptBuffer.text() });
        }
        if (lastError) {
            lastError = '';
            send('transcript:error', { message: '' });
        }
    } catch (error) {
        if (error.message !== lastError) {
            lastError = error.message;
            console.error('Расшифровка не удалась:', error.message);
            send('transcript:error', { message: error.message });
        }
    }
}

function startRun(samples, sampleRate) {
    currentRun = runChunk(samples, sampleRate).finally(() => {
        currentRun = null;
        const queued = pendingChunk;
        pendingChunk = null;
        if (queued) {
            startRun(queued.samples, queued.sampleRate);
        }
    });
    return currentRun;
}

function acceptChunk(samples, sampleRate) {
    // Пульс шлём до отсечения тишины: он показывает, что жив захват, а не что есть речь.
    send('audio:tick', { at: Date.now() });

    if (isSilent(samples)) {
        return;
    }
    if (currentRun) {
        // Держим только самое свежее окно: отставать от разговора хуже, чем потерять кусок.
        pendingChunk = { samples, sampleRate };
        return;
    }
    startRun(samples, sampleRate);
}

// В отличие от обычного окна, этот кусок ждём: без него в запрос уйдёт
// расшифровка без последней реплики.
async function flushChunk(samples, sampleRate) {
    if (currentRun) {
        await currentRun.catch(() => {});
    }
    if (samples.length && !isSilent(samples)) {
        await runChunk(samples, sampleRate);
    }
}

function setupAudioIpcHandlers() {
    ipcMain.on('audio:chunk', (event, { samples, sampleRate }) => {
        acceptChunk(new Float32Array(samples), sampleRate);
    });

    ipcMain.handle('audio:transcript', async () => ({ text: getTranscript() }));

    ipcMain.handle('audio:flush', async (event, payload) => {
        if (payload) {
            await flushChunk(new Float32Array(payload.samples), payload.sampleRate);
        }
        return { text: getTranscript() };
    });

    ipcMain.handle('audio:clear-transcript', async () => {
        clearTranscript();
        return { success: true };
    });

    ipcMain.handle('whisper:models', async () => {
        const directory = modelsDir();
        return Promise.all(
            WHISPER_MODELS.map(async model => ({
                id: model.id,
                label: model.label,
                hint: model.hint,
                sizeBytes: model.sizeBytes,
                ramMb: model.ramMb,
                dominated: model.dominated,
                ready: (await modelState(directory, model.id)).ready,
            }))
        );
    });

    ipcMain.handle('whisper:download', async (event, id) => {
        try {
            let lastPercent = -1;
            await downloadModel(modelsDir(), id, (received, total) => {
                const percent = total ? Math.floor((received / total) * 100) : 0;
                if (percent !== lastPercent) {
                    lastPercent = percent;
                    send('whisper:download-progress', { id, percent });
                }
            });
            return { success: true };
        } catch (error) {
            console.error('Скачивание модели не удалось:', error.message);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    setMainWindow,
    setupAudioIpcHandlers,
    getTranscript,
    clearTranscript,
};

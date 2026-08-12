'use strict';

const { ipcRenderer } = require('electron');
const { ChunkAccumulator } = require('./audio-chunker');

const SAMPLE_RATE = 16000;
const MAX_RESTART_ATTEMPTS = 3;

let context = null;
let stream = null;
let accumulator = null;
let statusHandler = null;
let restartTimer = null;
let restartAttempts = 0;
let stopping = false;

function notify(state, detail = '') {
    if (statusHandler) {
        statusHandler({ state, detail });
    }
}

async function open() {
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (error) {
        if (error.name === 'NotAllowedError') {
            throw new Error('Нет доступа к экрану и звуку. Разреши «Запись экрана» в настройках системы и перезапусти приложение.');
        }
        throw new Error(`Не удалось начать захват звука: ${error.message}`);
    }

    // Видео нужно только чтобы macOS отдал системный звук; дальше оно лишний расход.
    stream.getVideoTracks().forEach(track => track.stop());

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
        teardown();
        throw new Error('Система не отдала звук. Проверь разрешение «Запись экрана».');
    }

    context = new AudioContext({ sampleRate: SAMPLE_RATE });
    await context.audioWorklet.addModule('audio/pcm-worklet.js');

    accumulator = new ChunkAccumulator({ sampleRate: SAMPLE_RATE });
    const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
    const collector = new AudioWorkletNode(context, 'pcm-collector');

    collector.port.onmessage = event => {
        const chunk = accumulator.push(event.data);
        if (chunk) {
            ipcRenderer.send('audio:chunk', { samples: chunk.buffer, sampleRate: SAMPLE_RATE });
        }
    };

    source.connect(collector);

    // Поток обрывается сам при смене устройства вывода или засыпании машины.
    // Закрепить устройство нельзя: loopback снимает системный микс целиком,
    // он выше конкретного устройства и выбора там нет.
    audioTrack.addEventListener('ended', () => {
        teardown();
        if (!stopping) {
            scheduleRestart();
        }
    });
}

function scheduleRestart() {
    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
        notify('failed', 'Захват звука оборвался и не восстановился. Включи прослушивание заново.');
        return;
    }

    const delayMs = 1000 * 2 ** restartAttempts;
    restartAttempts += 1;
    notify('restarting', `Захват звука оборвался, восстанавливаю (попытка ${restartAttempts})`);

    restartTimer = setTimeout(async () => {
        restartTimer = null;
        try {
            await open();
            restartAttempts = 0;
            notify('active', '');
        } catch {
            scheduleRestart();
        }
    }, delayMs);
}

function teardown() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (context) {
        context.close();
        context = null;
    }
    accumulator = null;
}

async function start(onStatus) {
    if (context) {
        return { active: true };
    }
    if (onStatus) {
        statusHandler = onStatus;
    }
    stopping = false;
    restartAttempts = 0;
    await open();
    notify('active', '');
    return { active: true };
}

function stop() {
    stopping = true;
    if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
    }
    restartAttempts = 0;
    teardown();
    return { active: false };
}

function isActive() {
    return Boolean(context);
}

// Забирает недобранное окно, чтобы расшифровать самое свежее прямо сейчас.
function takePending() {
    if (!accumulator) {
        return null;
    }
    const chunk = accumulator.flush();
    return chunk ? { samples: chunk.buffer, sampleRate: SAMPLE_RATE } : null;
}

module.exports = { start, stop, isActive, takePending };

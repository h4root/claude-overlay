'use strict';

// Окна приходят раз в ~9 секунд; если их нет заметно дольше, захват отвалился.
const CHUNK_STALE_MS = 25000;

const SEVERITY = { ok: 0, off: 0, warn: 1, fail: 2 };

function keyEntry({ hasKey, keyVerified }) {
    if (keyVerified) {
        return { state: 'ok', detail: 'Ключ принят, тестовый запрос прошёл' };
    }
    if (hasKey) {
        return { state: 'warn', detail: 'Ключ сохранён, но не проверен' };
    }
    return { state: 'fail', detail: 'Ключ не задан' };
}

function screenEntry({ screenOk }) {
    if (screenOk === true) {
        return { state: 'ok', detail: 'Снимок экрана получается' };
    }
    if (screenOk === false) {
        return { state: 'fail', detail: 'Снять экран не удалось — проверь разрешение «Запись экрана»' };
    }
    return { state: 'warn', detail: 'Снимок экрана ещё не проверяли' };
}

function soundEntry({ wantsAudio, listening, lastChunkAt, now }) {
    if (!wantsAudio) {
        return { state: 'off', detail: 'Звук выключен для этой сессии' };
    }
    if (!listening) {
        return { state: 'fail', detail: 'Захват звука не запустился' };
    }
    if (!lastChunkAt) {
        return { state: 'warn', detail: 'Звук включён, первое окно ещё не пришло' };
    }
    if (now - lastChunkAt > CHUNK_STALE_MS) {
        return { state: 'fail', detail: 'Звук перестал поступать — переключи прослушивание' };
    }
    return { state: 'ok', detail: 'Звук поступает, расшифровка идёт' };
}

function privacyEntry({ contentProtected }) {
    return contentProtected
        ? { state: 'ok', detail: 'Окно не попадает в демонстрацию экрана и скриншоты' }
        : { state: 'fail', detail: 'Защита выключена — окно видно в демонстрации экрана' };
}

function buildHealth(input) {
    return [
        { id: 'key', label: 'Ключ Claude', ...keyEntry(input) },
        { id: 'screen', label: 'Экран', ...screenEntry(input) },
        { id: 'sound', label: 'Звук', ...soundEntry(input) },
        { id: 'privacy', label: 'Невидимость', ...privacyEntry(input) },
    ];
}

function overallState(report) {
    return report.reduce((worst, entry) => (SEVERITY[entry.state] > SEVERITY[worst] ? entry.state : worst), 'ok');
}

module.exports = {
    CHUNK_STALE_MS,
    buildHealth,
    overallState,
};

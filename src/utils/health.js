'use strict';

// Окна приходят раз в ~9 секунд; если их нет заметно дольше, захват отвалился.
const CHUNK_STALE_MS = 25000;

const SEVERITY = { ok: 0, off: 0, warn: 1, fail: 2 };

function keyEntry({ hasKey, keyVerified }) {
    if (keyVerified) {
        return { state: 'ok', detail: 'Ключ работает' };
    }
    if (hasKey) {
        return { state: 'warn', detail: 'Сохранён, но не проверен — нажми «Проверить»' };
    }
    return { state: 'fail', detail: 'Не задан — вкладка «Настройки»' };
}

function screenEntry({ screenOk }) {
    if (screenOk === true) {
        return { state: 'ok', detail: 'Экран снимается' };
    }
    if (screenOk === false) {
        return { state: 'fail', detail: 'Не снимается — разреши «Запись экрана» в настройках системы' };
    }
    return { state: 'warn', detail: 'Ещё не снимали' };
}

function soundEntry({ wantsAudio, listening, lastChunkAt, now }) {
    if (!wantsAudio) {
        return { state: 'off', detail: 'Выключен для этой сессии' };
    }
    if (!listening) {
        return { state: 'fail', detail: 'Захват не запустился — включи заново' };
    }
    if (!lastChunkAt) {
        return { state: 'warn', detail: 'Включён, первые секунды ещё не обработаны' };
    }
    if (now - lastChunkAt > CHUNK_STALE_MS) {
        return { state: 'fail', detail: 'Перестал поступать — выключи и включи заново' };
    }
    return { state: 'ok', detail: 'Идёт расшифровка' };
}

function privacyEntry({ contentProtected }) {
    return contentProtected
        ? { state: 'ok', detail: 'Окна не видно в демонстрации экрана и на скриншотах' }
        : { state: 'fail', detail: 'Выключена — окно попадёт в демонстрацию экрана' };
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

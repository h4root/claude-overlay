'use strict';

const { ipcMain, net } = require('electron');
const Anthropic = require('@anthropic-ai/sdk');
const storage = require('../storage');
const { buildRequest, normalizeApiError, maskKey, MODELS } = require('./claude-client');
const { buildSystemPrompt } = require('./prompts');
const { RequestGate } = require('./request-gate');
const { getTranscriptForRequest, clearTranscript } = require('./audio');

const HISTORY_LIMIT = 12;

let mainWindow = null;
let client = null;
let clientKey = null;
let history = [];
let activeStream = null;
const gate = new RequestGate();

function setMainWindow(window) {
    mainWindow = window;
}

function send(channel, payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
    }
}

function getClient() {
    const apiKey = storage.getApiKey();
    if (!apiKey) {
        const error = new Error('API-ключ не задан');
        error.status = 401;
        throw error;
    }
    if (!client || clientKey !== apiKey) {
        // net.fetch идёт через сетевой стек Chromium и потому уважает
        // прокси сессии; обычный fetch Node его игнорирует.
        client = new Anthropic({ apiKey, maxRetries: 2, fetch: (url, init) => net.fetch(url, init) });
        clientKey = apiKey;
        console.log(`Claude client готов, ключ ${maskKey(apiKey)}`);
    }
    return client;
}

function rememberTurn(userContent, answer) {
    history.push({ role: 'user', content: userContent });
    history.push({ role: 'assistant', content: [{ type: 'text', text: answer }] });
    if (history.length > HISTORY_LIMIT) {
        history = history.slice(-HISTORY_LIMIT);
    }
}

function resetHistory() {
    history = [];
}

// История хранится с картинками только для последнего хода: изображения
// в предыдущих ходах раздувают запрос, а ценность несут редко.
function historyWithoutImages() {
    return history.map(message => ({
        role: message.role,
        content: message.content.filter(block => block.type !== 'image'),
    }));
}

async function ask({ images = [], prompt = '', useTranscript = false }) {
    const id = gate.begin();
    // Событие уходит в интерфейс, только если запрос ещё актуален: иначе
    // ошибка прерывания и куски текста вытесненного запроса смешаются с новым.
    const emit = (channel, payload) => {
        if (gate.isCurrent(id)) {
            send(channel, payload);
        }
    };

    if (activeStream) {
        activeStream.abort();
        activeStream = null;
    }

    const preferences = storage.getPreferences();
    const config = storage.getConfig();

    let request;
    try {
        request = buildRequest({
            model: config.model,
            effort: config.effort,
            systemPrompt: buildSystemPrompt(preferences.profile, preferences.customPrompt),
            prompt: prompt || preferences.defaultPrompt,
            images,
            transcript: useTranscript ? getTranscriptForRequest() : '',
            history: historyWithoutImages(),
        });
    } catch (error) {
        emit('claude:error', { message: error.message, retryable: false });
        return { success: false };
    }

    emit('claude:start', {});

    try {
        const stream = getClient().messages.stream(request);
        activeStream = stream;

        stream.on('text', delta => emit('claude:delta', delta));

        const message = await stream.finalMessage();
        if (!gate.isCurrent(id)) {
            return { success: false };
        }
        activeStream = null;

        if (message.stop_reason === 'refusal') {
            const category = (message.stop_details && message.stop_details.category) || 'без категории';
            emit('claude:error', { message: `Модель отклонила запрос (${category}).`, retryable: false });
            return { success: false };
        }

        const answer = message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');

        rememberTurn(request.messages.at(-1).content, answer);
        emit('claude:done', { text: answer, usage: message.usage, model: message.model });
        return { success: true };
    } catch (error) {
        if (!gate.isCurrent(id)) {
            // Запрос вытеснен новым — его падение ожидаемо и никого не касается.
            return { success: false };
        }
        activeStream = null;
        const normalized = normalizeApiError(error);
        console.error('Claude request failed:', normalized.kind, normalized.message);
        emit('claude:error', normalized);
        return { success: false };
    }
}

function setupClaudeIpcHandlers() {
    ipcMain.handle('claude:ask', async (event, payload) => ask(payload || {}));

    ipcMain.handle('claude:cancel', async () => {
        gate.cancel();
        if (activeStream) {
            activeStream.abort();
            activeStream = null;
        }
        return { success: true };
    });

    ipcMain.handle('claude:reset', async () => {
        resetHistory();
        clearTranscript();
        return { success: true };
    });

    // Живой запрос дешевле любой валидации формата: сразу видно и неверный ключ,
    // и отсутствие доступа к выбранной модели, и обрыв сети.
    ipcMain.handle('claude:test-key', async () => {
        try {
            const message = await getClient().messages.create({
                model: storage.getConfig().model,
                max_tokens: 64,
                messages: [{ role: 'user', content: 'Ответь одним словом: готов' }],
            });
            return { success: true, model: message.model };
        } catch (error) {
            return { success: false, ...normalizeApiError(error) };
        }
    });

    ipcMain.handle('claude:models', async () =>
        MODELS.map(({ id, label, hint, efforts, defaultEffort }) => ({ id, label, hint, efforts, defaultEffort }))
    );
}

module.exports = {
    setMainWindow,
    setupClaudeIpcHandlers,
    resetHistory,
    ask,
};

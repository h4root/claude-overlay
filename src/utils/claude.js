'use strict';

const { ipcMain, net } = require('electron');
const Anthropic = require('@anthropic-ai/sdk');
const storage = require('../storage');
const { buildRequest, normalizeApiError, maskKey, MODELS } = require('./claude-client');
const { buildSystemPrompt, buildVoiceSystemPrompt } = require('./prompts');
const { RequestGate } = require('./request-gate');
const { getTranscriptForRequest, clearTranscript } = require('./audio');

const HISTORY_LIMIT = 12;

let client = null;
let clientKey = null;

// Два независимых диалога: разбор экрана не должен перемешиваться с репликами
// совещания, и сбрасываются они по отдельности.
const conversations = {
    main: { window: null, history: [], gate: new RequestGate(), activeStream: null },
    voice: { window: null, history: [], gate: new RequestGate(), activeStream: null },
};

function conversation(id) {
    const found = conversations[id];
    if (!found) {
        throw new Error(`Неизвестный диалог: ${id}`);
    }
    return found;
}

function setWindow(id, window) {
    conversation(id).window = window;
}

function send(id, channel, payload) {
    const target = conversations[id] && conversations[id].window;
    if (target && !target.isDestroyed()) {
        target.webContents.send(channel, payload);
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

function rememberTurn(chat, userContent, answer) {
    chat.history.push({ role: 'user', content: userContent });
    chat.history.push({ role: 'assistant', content: [{ type: 'text', text: answer }] });
    if (chat.history.length > HISTORY_LIMIT) {
        chat.history = chat.history.slice(-HISTORY_LIMIT);
    }
}

function resetHistory(id) {
    conversation(id).history = [];
}

const VOICE_WINDOW_MS = 20000;

function requestFor(conversationId, { images, prompt, useTranscript }) {
    const preferences = storage.getPreferences();
    const config = storage.getConfig();
    const chat = conversation(conversationId);
    const voice = conversationId === 'voice';

    return buildRequest({
        model: voice ? config.voiceModel : config.model,
        effort: voice ? config.voiceEffort : config.effort,
        systemPrompt: voice ? buildVoiceSystemPrompt(preferences.customPrompt) : buildSystemPrompt(preferences.profile, preferences.customPrompt),
        prompt: prompt || (voice ? preferences.voicePrompt : preferences.defaultPrompt),
        images,
        // Голосовое окно отвечает по последним секундам: длинный контекст
        // уводит модель к прошлой теме вместо только что прозвучавшего вопроса.
        transcript: useTranscript ? getTranscriptForRequest(voice ? VOICE_WINDOW_MS : undefined) : '',
        history: chat.history,
    });
}

async function ask({ images = [], prompt = '', useTranscript = false, conversation: conversationId = 'main' }) {
    const chat = conversation(conversationId);
    const id = chat.gate.begin();
    // Событие уходит в интерфейс, только если запрос ещё актуален: иначе
    // ошибка прерывания и куски текста вытесненного запроса смешаются с новым.
    const emit = (channel, payload) => {
        if (chat.gate.isCurrent(id)) {
            send(conversationId, channel, payload);
        }
    };

    if (chat.activeStream) {
        chat.activeStream.abort();
        chat.activeStream = null;
    }

    let request;
    try {
        request = requestFor(conversationId, { images, prompt, useTranscript });
    } catch (error) {
        emit('claude:error', { message: error.message, retryable: false });
        return { success: false };
    }

    emit('claude:start', {});

    try {
        const stream = getClient().messages.stream(request);
        chat.activeStream = stream;

        stream.on('text', delta => emit('claude:delta', delta));

        const message = await stream.finalMessage();
        if (!chat.gate.isCurrent(id)) {
            return { success: false };
        }
        chat.activeStream = null;

        if (message.stop_reason === 'refusal') {
            const category = (message.stop_details && message.stop_details.category) || 'без категории';
            emit('claude:error', { message: `Модель отклонила запрос (${category}).`, retryable: false });
            return { success: false };
        }

        const answer = message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');

        rememberTurn(chat, request.messages.at(-1).content, answer);
        emit('claude:done', { text: answer, usage: message.usage, model: message.model });
        return { success: true };
    } catch (error) {
        if (!chat.gate.isCurrent(id)) {
            // Запрос вытеснен новым — его падение ожидаемо и никого не касается.
            return { success: false };
        }
        chat.activeStream = null;
        const normalized = normalizeApiError(error);
        console.error(`Claude request failed (${conversationId}):`, normalized.kind, normalized.message);
        emit('claude:error', normalized);
        return { success: false };
    }
}

function setupClaudeIpcHandlers() {
    ipcMain.handle('claude:ask', async (event, payload) => ask(payload || {}));

    ipcMain.handle('claude:cancel', async (event, conversationId = 'main') => {
        const chat = conversation(conversationId);
        chat.gate.cancel();
        if (chat.activeStream) {
            chat.activeStream.abort();
            chat.activeStream = null;
        }
        return { success: true };
    });

    ipcMain.handle('claude:reset', async (event, conversationId = 'main') => {
        resetHistory(conversationId);
        if (conversationId === 'main') {
            clearTranscript();
        }
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
    VOICE_WINDOW_MS,
    setWindow,
    setupClaudeIpcHandlers,
    resetHistory,
    ask,
};

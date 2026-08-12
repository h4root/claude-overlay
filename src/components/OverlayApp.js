import { LitElement, html, css } from '../assets/lit-core-2.7.4.min.js';

const PROFILES = [
    { id: 'meeting', label: 'Совещание' },
    { id: 'interview', label: 'Собеседование' },
    { id: 'freeform', label: 'Свободный' },
];

const QUALITIES = [
    { id: 'low', label: 'Низкое (дешевле)' },
    { id: 'medium', label: 'Среднее' },
    { id: 'high', label: 'Высокое (мелкий текст)' },
];

const LANGUAGES = [
    ['ru', 'Русский'],
    ['en', 'Английский'],
    ['auto', 'Определять автоматически'],
];

const FONT_SIZES = [
    ['small', 'Мелкий'],
    ['medium', 'Обычный'],
    ['large', 'Крупный'],
];

export class OverlayApp extends LitElement {
    static properties = {
        view: { state: true },
        loaded: { state: true },
        models: { state: true },
        config: { state: true },
        preferences: { state: true },
        keybinds: { state: true },
        hasApiKey: { state: true },
        apiKeyDraft: { state: true },
        keyCheck: { state: true },
        answer: { state: true },
        status: { state: true },
        error: { state: true },
        listening: { state: true },
        transcriptText: { state: true },
        transcriptError: { state: true },
        whisperModels: { state: true },
        downloading: { state: true },
        clickThrough: { state: true },
        screenOk: { state: true },
        lastChunkAt: { state: true },
        contentProtected: { state: true },
        healthOpen: { state: true },
        starting: { state: true },
        cost: { state: true },
        proxyDraft: { state: true },
        proxyError: { state: true },
        keybindFailed: { state: true },
        recordingAction: { state: true },
        displays: { state: true },
    };

    static externalStyles = html`
        <link rel="stylesheet" href="assets/highlight-vscode-dark.min.css" />
        <link rel="stylesheet" href="assets/katex/katex.min.css" />
    `;

    static styles = css`
        :host {
            position: relative;
            display: flex;
            flex-direction: column;
            height: 100%;
            font-family: var(--font);
            font-size: var(--font-size-base);
            color: var(--text-primary);
            border-radius: 12px;
            overflow: hidden;
            background: rgba(10, 10, 10, var(--overlay-alpha, 0.75));
            backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* При click-through окно не принимает клики — без метки это выглядит поломкой. */
        :host(.click-through) {
            border-style: dashed;
            border-color: var(--warning);
        }

        header {
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            flex: 0 0 auto;
        }
        header select,
        header button,
        header .dot {
            -webkit-app-region: no-drag;
        }

        .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--text-muted);
            flex: 0 0 auto;
            cursor: help;
        }
        .dot.ok {
            background: var(--success);
        }
        .dot.warn {
            background: var(--warning);
        }
        .dot.fail {
            background: var(--danger);
        }
        .dot.busy {
            background: var(--warning);
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            50% {
                opacity: 0.3;
            }
        }

        select,
        input,
        textarea,
        button {
            font-family: inherit;
            font-size: var(--font-size-xs);
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            padding: 4px 6px;
        }
        button {
            cursor: pointer;
        }
        button:hover {
            background: rgba(255, 255, 255, 0.12);
        }
        button[disabled] {
            opacity: 0.4;
            cursor: default;
        }
        button.primary {
            background: var(--accent);
            border-color: var(--accent);
            color: #fff;
        }
        button.primary:hover {
            background: var(--accent-hover);
        }
        button.big {
            padding: 8px;
            font-size: var(--font-size-sm);
        }

        .spacer {
            flex: 1;
        }

        main {
            flex: 1;
            overflow-y: auto;
            padding: 12px 14px;
            line-height: 1.55;
        }
        main.small {
            font-size: 12px;
        }
        main.large {
            font-size: 16px;
        }
        main :first-child {
            margin-top: 0;
        }
        main pre {
            background: rgba(0, 0, 0, 0.5);
            padding: 10px;
            border-radius: 8px;
            overflow-x: auto;
        }
        main code {
            font-family: var(--font-mono);
            font-size: 0.9em;
        }
        main :not(pre) > code {
            background: rgba(255, 255, 255, 0.1);
            padding: 1px 4px;
            border-radius: 4px;
        }
        main table {
            border-collapse: collapse;
            width: 100%;
            margin: 8px 0;
            font-size: 0.92em;
        }
        main th,
        main td {
            border: 1px solid rgba(255, 255, 255, 0.14);
            padding: 4px 7px;
            text-align: left;
        }
        main th {
            background: rgba(255, 255, 255, 0.07);
            font-weight: 600;
        }
        main blockquote {
            margin: 8px 0;
            padding-left: 10px;
            border-left: 2px solid rgba(255, 255, 255, 0.2);
            color: var(--text-secondary);
        }
        main h1,
        main h2,
        main h3 {
            font-size: 1.05em;
            margin: 10px 0 4px;
        }
        main ul,
        main ol {
            margin: 6px 0;
            padding-left: 20px;
        }
        main hr {
            border: none;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            margin: 10px 0;
        }
        /* Длинная выключная формула не должна распирать окно по горизонтали. */
        main .katex-display {
            overflow-x: auto;
            overflow-y: hidden;
            padding: 2px 0;
        }

        .error {
            color: var(--danger);
            font-size: var(--font-size-sm);
        }
        .cost {
            flex: 0 0 auto;
            color: var(--text-muted);
            font-size: var(--font-size-xs);
            font-family: var(--font-mono);
        }

        .ghost {
            flex: 0 0 auto;
            color: var(--warning);
            font-size: var(--font-size-xs);
        }

        footer {
            flex: 0 0 auto;
            display: flex;
            gap: 6px;
            padding: 8px 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.07);
        }
        footer input {
            flex: 1;
        }

        .hints {
            flex: 0 0 auto;
            padding: 5px 12px 8px;
            color: var(--text-muted);
            font-size: 10.5px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px 12px;
        }
        .hints kbd {
            font-family: var(--font-mono);
            color: var(--text-secondary);
        }

        .transcript {
            flex: 0 0 auto;
            padding: 6px 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.07);
            color: var(--text-secondary);
            font-size: var(--font-size-xs);
            line-height: 1.4;
            display: flex;
            gap: 6px;
        }
        .transcript .tag {
            color: var(--danger);
            flex: 0 0 auto;
        }
        .transcript .body {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .popover {
            position: absolute;
            top: 30px;
            left: 8px;
            z-index: 10;
            width: 270px;
            padding: 8px 10px;
            border-radius: 8px;
            background: rgba(20, 20, 20, 0.97);
            border: 1px solid rgba(255, 255, 255, 0.12);
            font-size: var(--font-size-xs);
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .popover .line {
            display: flex;
            gap: 6px;
            align-items: flex-start;
        }
        .popover .mark {
            flex: 0 0 auto;
            width: 14px;
        }
        .popover .mark.ok {
            color: var(--success);
        }
        .popover .mark.warn {
            color: var(--warning);
        }
        .popover .mark.fail {
            color: var(--danger);
        }
        .popover .mark.off {
            color: var(--text-muted);
        }
        .popover .name {
            color: var(--text-primary);
        }
        .popover .detail {
            color: var(--text-secondary);
        }

        .setup {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .field {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .field label {
            font-size: var(--font-size-xs);
            color: var(--text-secondary);
        }
        .field textarea {
            min-height: 56px;
            resize: vertical;
        }
        .row {
            display: flex;
            gap: 8px;
        }
        .row > * {
            flex: 1;
        }
        .checkbox {
            flex-direction: row;
            align-items: center;
            gap: 6px;
        }
        .checkbox input {
            flex: 0 0 auto;
        }
        .inline {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        .inline input {
            flex: 1;
        }
        .note {
            font-size: 10.5px;
            color: var(--text-muted);
        }
        .note.ok {
            color: var(--success);
        }
        .note.fail {
            color: var(--danger);
        }

        .model-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .model-row .grow {
            flex: 1;
        }
        button.broken {
            border-color: var(--danger);
            color: var(--danger);
        }
        .model-row small {
            color: var(--text-muted);
            font-size: 10px;
        }
    `;

    constructor() {
        super();
        this.view = 'setup';
        this.loaded = false;
        this.models = [];
        this.config = { model: 'claude-sonnet-5', effort: 'medium' };
        this.preferences = {};
        this.keybinds = {};
        this.hasApiKey = false;
        this.apiKeyDraft = '';
        this.keyCheck = null;
        this.answer = '';
        this.status = 'idle';
        this.error = '';
        this.listening = false;
        this.transcriptText = '';
        this.transcriptError = '';
        this.whisperModels = [];
        this.downloading = {};
        this.clickThrough = false;
        this.screenOk = null;
        this.lastChunkAt = null;
        this.contentProtected = false;
        this.healthOpen = false;
        this.starting = false;
        this.cost = { requests: 0, dollars: 0 };
        this.proxyDraft = null;
        this.proxyError = '';
        this.keybindFailed = [];
        this.recordingAction = '';
        this.displays = 1;
        this.unsubscribes = [];
        // Перетаскивание ползунка даёт десятки событий — на диск должно уйти одно.
        this.savePreferenceSoon = null;
    }

    async connectedCallback() {
        super.connectedCallback();

        this.models = await window.overlay.models();
        this.config = await window.overlay.storage.getConfig();
        this.proxyDraft = { ...this.config.proxy };
        this.preferences = await window.overlay.storage.getPreferences();
        const loaded = await window.overlay.keybinds.load();
        this.keybinds = loaded.keybinds;
        this.keybindFailed = loaded.failed || [];
        this.hasApiKey = await window.overlay.storage.hasApiKey();
        this.whisperModels = await window.overlay.whisper.models();
        this.displays = await window.overlay.displays();
        this.contentProtected = await window.overlay.window.isContentProtected();
        this.applyTransparency();

        // Форму рендерим только после загрузки состояния: если отрисовать её
        // раньше, Lit больше не переустановит .value у select и range.
        this.loaded = true;

        const on = window.overlay.on;
        this.unsubscribes = [
            on('shortcut:capture', () => this.capture()),
            on('shortcut:ask-voice', () => this.askVoice()),
            on('shortcut:new-session', () => this.newSession()),
            on('shortcut:scroll-up', () => this.scrollAnswer(-120)),
            on('shortcut:scroll-down', () => this.scrollAnswer(120)),
            on('shortcut:panic', () => this.wipe()),
            on('power:suspend', () => {
                if (this.listening) {
                    window.overlay.listen.stop();
                    this.listening = false;
                }
            }),
            on('power:resume', async () => {
                window.overlay.listen.stop();
                this.listening = false;
                await this.openSetup();
                this.error = 'Компьютер уходил в сон — начни сессию заново.';
            }),
            on('shortcut:listen', () => this.toggleListening()),
            on('click-through-toggled', enabled => {
                this.clickThrough = enabled;
            }),
            on('audio:tick', payload => {
                this.lastChunkAt = payload.at;
            }),
            on('transcript:update', payload => {
                this.transcriptText = payload.text;
            }),
            on('transcript:error', payload => {
                this.transcriptError = payload.message;
            }),
            on('whisper:download-progress', payload => {
                this.downloading = { ...this.downloading, [payload.id]: payload.percent };
            }),
            on('claude:start', () => {
                this.answer = '';
                this.error = '';
                this.status = 'busy';
            }),
            on('claude:delta', delta => {
                this.answer += delta;
                this.scrollToBottom();
            }),
            on('claude:done', payload => {
                this.status = 'idle';
                window.overlay.cost.add(payload.usage, payload.model);
                this.cost = { ...window.overlay.cost.total() };
            }),
            on('claude:error', payload => {
                this.status = 'idle';
                this.error = payload.message;
            }),
        ];

        // Индикатор должен темнеть сам, когда звук перестал поступать.
        this.healthTimer = setInterval(() => this.requestUpdate(), 5000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this.healthTimer);
        this.unsubscribes.forEach(off => off());
    }

    applyTransparency() {
        const alpha = this.preferences.backgroundTransparency;
        this.style.setProperty('--overlay-alpha', alpha === undefined ? 0.75 : alpha);
    }

    get healthReport() {
        return window.overlay.health.build({
            hasKey: this.hasApiKey,
            keyVerified: Boolean(this.keyCheck && this.keyCheck.ok),
            screenOk: this.screenOk,
            contentProtected: this.contentProtected,
            wantsAudio: Boolean(this.preferences.listenInSession),
            listening: this.listening,
            lastChunkAt: this.lastChunkAt,
            now: Date.now(),
        });
    }

    get currentModel() {
        return this.models.find(model => model.id === this.config.model) || { efforts: [] };
    }

    scrollAnswer(delta) {
        const main = this.renderRoot.querySelector('main');
        if (main) main.scrollBy({ top: delta, behavior: 'smooth' });
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            const main = this.renderRoot.querySelector('main');
            if (main) main.scrollTop = main.scrollHeight;
        });
    }

    async setConfig(key, value) {
        this.config = { ...this.config, [key]: value };
        await window.overlay.storage.updateConfig(key, value);
    }

    async setPreference(key, value) {
        this.preferences = { ...this.preferences, [key]: value };
        await window.overlay.storage.updatePreference(key, value);
        if (key === 'backgroundTransparency') this.applyTransparency();
    }

    setPreferenceSmooth(key, value) {
        this.preferences = { ...this.preferences, [key]: value };
        if (key === 'backgroundTransparency') this.applyTransparency();
        if (!this.savePreferenceSoon) {
            this.savePreferenceSoon = window.overlay.debounce((name, saved) => window.overlay.storage.updatePreference(name, saved), 300);
        }
        this.savePreferenceSoon(key, value);
    }

    async onModelChange(event) {
        const model = this.models.find(candidate => candidate.id === event.target.value);
        await this.setConfig('model', model.id);
        // Уровень эффорта у моделей разный: несовместимый выбор отвергается API.
        if (!model.efforts.includes(this.config.effort)) {
            await this.setConfig('effort', model.defaultEffort || '');
        }
        this.keyCheck = null;
    }

    async saveApiKey() {
        await window.overlay.storage.setApiKey(this.apiKeyDraft);
        this.hasApiKey = await window.overlay.storage.hasApiKey();
        this.apiKeyDraft = '';
        this.keyCheck = null;
    }

    startRecording(action) {
        this.recordingAction = action;
        this.keyListener = event => {
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Escape') {
                this.stopRecording();
                return;
            }
            const accelerator = window.overlay.keybinds.fromEvent(event);
            if (accelerator) {
                this.applyKeybind(action, accelerator);
            }
        };
        window.addEventListener('keydown', this.keyListener, true);
    }

    stopRecording() {
        if (this.keyListener) {
            window.removeEventListener('keydown', this.keyListener, true);
            this.keyListener = null;
        }
        this.recordingAction = '';
        this.displays = 1;
    }

    async applyKeybind(action, accelerator) {
        this.stopRecording();
        const result = await window.overlay.keybinds.save({ ...this.keybinds, [action]: accelerator });
        this.keybinds = result.keybinds;
        this.keybindFailed = result.failed || [];
    }

    async resetKeybinds() {
        const result = await window.overlay.keybinds.save({});
        this.keybinds = result.keybinds;
        this.keybindFailed = result.failed || [];
    }

    async saveProxy() {
        this.proxyError = '';
        this.keybindFailed = [];
        this.recordingAction = '';
        this.displays = 1;
        try {
            await window.overlay.storage.setProxy(this.proxyDraft);
            this.config = await window.overlay.storage.getConfig();
            this.keyCheck = null;
        } catch (error) {
            this.proxyError = error.message;
        }
    }

    async testKey() {
        this.keyCheck = { pending: true };
        const result = await window.overlay.testKey();
        this.keyCheck = result.success ? { ok: true, model: result.model } : { ok: false, message: result.message };
    }

    async downloadWhisper(id) {
        this.downloading = { ...this.downloading, [id]: 0 };
        const result = await window.overlay.whisper.download(id);
        const { [id]: finished, ...rest } = this.downloading;
        this.downloading = rest;
        if (!result.success) {
            this.transcriptError = result.error;
            return;
        }
        this.whisperModels = await window.overlay.whisper.models();
        this.displays = await window.overlay.displays();
    }

    async startSession() {
        this.starting = true;
        this.error = '';
        try {
            // Права на запись экрана лучше выяснить сейчас, а не в середине встречи.
            await window.overlay.captureScreen();
            this.screenOk = true;
        } catch (error) {
            this.screenOk = false;
            this.error = error.message;
        }

        if (this.preferences.listenInSession && !this.listening) {
            await this.toggleListening();
        }

        await window.overlay.window.setMode('session');
        this.view = 'session';
        this.starting = false;
    }

    async openSetup() {
        await window.overlay.window.setMode('setup');
        this.view = 'setup';
    }

    async capture() {
        if (!this.hasApiKey) {
            this.error = 'Сначала укажи API-ключ.';
            return;
        }
        this.status = 'busy';
        this.error = '';
        try {
            const image = await window.overlay.captureScreen();
            this.screenOk = true;
            await window.overlay.ask({ images: [image], useTranscript: Boolean(this.preferences.transcriptWithScreenshot) });
        } catch (error) {
            this.screenOk = false;
            this.status = 'idle';
            this.error = error.message;
        }
    }

    async askVoice() {
        this.status = 'busy';
        this.error = '';

        // Дожидаемся расшифровки последних секунд: иначе в запрос уйдёт всё,
        // кроме только что прозвучавшего вопроса.
        const { text } = await window.overlay.listen.flush();
        this.transcriptText = text;

        if (!text) {
            this.status = 'idle';
            this.error = 'Расшифровка пуста — пока нечего разбирать.';
            return;
        }
        await window.overlay.ask({ prompt: this.preferences.voicePrompt, useTranscript: true });
    }

    async askFollowUp(event) {
        const input = event.target;
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        this.status = 'busy';
        await window.overlay.ask({ prompt: text });
    }

    async newSession() {
        await window.overlay.resetConversation();
        window.overlay.cost.reset();
        this.cost = { ...window.overlay.cost.total() };
        this.answer = '';
        this.error = '';
        this.transcriptText = '';
        this.status = 'idle';
    }

    async wipe() {
        await window.overlay.resetConversation();
        this.answer = '';
        this.transcriptText = '';
    }

    async toggleListening() {
        this.transcriptError = '';
        try {
            if (this.listening) {
                window.overlay.listen.stop();
                this.listening = false;
                this.lastChunkAt = null;
                return;
            }
            await window.overlay.listen.start(status => {
                this.listening = status.state !== 'failed';
                this.transcriptError = status.state === 'active' ? '' : status.detail;
            });
            this.listening = true;
        } catch (error) {
            this.listening = false;
            this.transcriptError = error.message;
        }
    }

    renderMarkdown(text) {
        const container = document.createElement('div');
        container.innerHTML = window.marked.parse(text, { breaks: true, gfm: true });
        container.querySelectorAll('pre code').forEach(block => window.hljs.highlightElement(block));
        window.renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
            ],
            // Кривая формула не должна ронять весь ответ — показываем исходный текст.
            throwOnError: false,
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        });
        return container;
    }

    renderHealthPopover() {
        const marks = { ok: '✓', warn: '!', fail: '✕', off: '–' };
        return html`<div class="popover">
            ${this.healthReport.map(
                entry =>
                    html`<div class="line">
                        <span class="mark ${entry.state}">${marks[entry.state]}</span>
                        <span><span class="name">${entry.label}</span> — <span class="detail">${entry.detail}</span></span>
                    </div>`
            )}
        </div>`;
    }

    renderHealthDot() {
        const state = this.status === 'busy' ? 'busy' : window.overlay.health.overall(this.healthReport);
        return html`<span
            class="dot ${state}"
            title="Состояние сессии"
            @mouseenter=${() => (this.healthOpen = true)}
            @mouseleave=${() => (this.healthOpen = false)}
        ></span>`;
    }

    renderHints() {
        const keys = this.keybinds;
        return html`<div class="hints">
            <span><kbd>${keys.capture}</kbd> снять экран</span>
            <span><kbd>${keys.askVoice}</kbd> по услышанному</span>
            <span><kbd>${keys.toggleClickThrough}</kbd> насквозь</span>
            <span><kbd>${keys.toggleVisibility}</kbd> скрыть</span>
            <span><kbd>${keys.newSession}</kbd> сброс</span>
        </div>`;
    }

    renderTranscriptStrip() {
        if (this.transcriptError) {
            return html`<div class="transcript"><span class="tag">звук:</span><span class="body">${this.transcriptError}</span></div>`;
        }
        if (!this.listening) {
            return '';
        }
        return html`<div class="transcript">
            <span class="tag">●</span>
            <span class="body">${this.transcriptText || 'слушаю, речи пока нет…'}</span>
        </div>`;
    }

    renderSession() {
        const model = this.currentModel;
        return html`
            <header>
                ${this.renderHealthDot()}
                ${
                    this.clickThrough
                        ? html`<span class="ghost" title="Кнопки не нажимаются, работают только хоткеи">
                              сквозь · ${this.keybinds.toggleClickThrough}
                          </span>`
                        : ''
                }
                <select @change=${this.onModelChange} title="Модель">
                    ${this.models.map(item => html`<option value=${item.id} ?selected=${item.id === this.config.model}>${item.label}</option>`)}
                </select>
                <select @change=${e => this.setConfig('effort', e.target.value)} ?disabled=${model.efforts.length === 0} title="Глубина рассуждения">
                    ${
                        model.efforts.length === 0
                            ? html`<option value="">—</option>`
                            : model.efforts.map(level => html`<option value=${level} ?selected=${level === this.config.effort}>${level}</option>`)
                    }
                </select>
                <span class="spacer"></span>
                <span class="cost" title="Потрачено за сессию: ${this.cost.requests} запрос(ов)">
                    ${window.overlay.cost.format(this.cost.dollars)}
                </span>
                <button @click=${this.openSetup} title="Настройки">⚙</button>
                <button @click=${() => window.overlay.window.hide()} title="Спрятать">✕</button>
            </header>

            ${this.healthOpen ? this.renderHealthPopover() : ''}

            <main class=${this.preferences.fontSize || 'medium'}>
                ${this.error ? html`<div class="error">${this.error}</div>` : ''}
                ${this.answer ? this.renderMarkdown(this.answer) : html`<div class="note">Жду вопроса. ${this.keybinds.capture} — снять экран.</div>`}
            </main>

            ${this.renderTranscriptStrip()}

            <footer>
                <input type="text" placeholder="Уточняющий вопрос…" @keydown=${e => e.key === 'Enter' && this.askFollowUp(e)} />
                <button class="primary" @click=${this.capture} ?disabled=${this.status === 'busy'}>Снять экран</button>
            </footer>

            ${this.renderHints()}
        `;
    }

    renderKeyField() {
        const check = this.keyCheck;
        return html`<div class="field">
            <label>API-ключ Anthropic ${this.hasApiKey ? '— сохранён' : '— не задан'}</label>
            <div class="inline">
                <input
                    type="password"
                    placeholder=${this.hasApiKey ? 'заменить ключ…' : 'sk-ant-...'}
                    .value=${this.apiKeyDraft}
                    @input=${e => (this.apiKeyDraft = e.target.value)}
                />
                <button @click=${this.saveApiKey} ?disabled=${!this.apiKeyDraft}>Сохранить</button>
                <button @click=${this.testKey} ?disabled=${!this.hasApiKey || (check && check.pending)}>
                    ${check && check.pending ? 'Проверяю…' : 'Проверить'}
                </button>
            </div>
            ${check && check.ok ? html`<span class="note ok">Ключ работает, ответила ${check.model}</span>` : ''}
            ${check && check.ok === false ? html`<span class="note fail">${check.message}</span>` : ''}
        </div>`;
    }

    renderKeybindsField() {
        const failedIds = this.keybindFailed.map(entry => entry.action);
        const conflicts = window.overlay.keybinds.conflicts(this.keybinds);
        const conflicting = new Set(conflicts.flatMap(group => group.actions));

        return html`<div class="field">
            <label>Горячие клавиши</label>
            ${window.overlay.keybinds.actions().map(action => {
                const recording = this.recordingAction === action.id;
                const broken = failedIds.includes(action.id);
                const clashes = conflicting.has(action.id);
                return html`<div class="model-row">
                    <span class="grow">${action.label}</span>
                    <button
                        class=${broken || clashes ? 'broken' : ''}
                        title=${broken ? 'Сочетание занято другим приложением' : clashes ? 'Дублируется внутри приложения' : ''}
                        @click=${() => (recording ? this.stopRecording() : this.startRecording(action.id))}
                    >
                        ${recording ? 'жми сочетание…' : this.keybinds[action.id]}
                    </button>
                </div>`;
            })}
            ${
                this.keybindFailed.length
                    ? html`<span class="note fail">Занято другим приложением: ${this.keybindFailed.map(e => e.accelerator).join(', ')}</span>`
                    : ''
            }
            ${conflicts.length ? html`<span class="note fail">Одно сочетание на несколько действий</span>` : ''}
            <button @click=${this.resetKeybinds} style="align-self:flex-start">Вернуть умолчания</button>
        </div>`;
    }

    renderProxyField() {
        const draft = this.proxyDraft || {};
        const update = (key, value) => {
            this.proxyDraft = { ...this.proxyDraft, [key]: value };
        };
        return html`<div class="field">
            <div class="checkbox" style="display:flex">
                <input type="checkbox" id="proxy-enabled" .checked=${Boolean(draft.enabled)} @change=${e => update('enabled', e.target.checked)} />
                <label for="proxy-enabled">Пускать запросы к API через прокси</label>
            </div>
            ${
                draft.enabled
                    ? html`<div class="inline">
                              <select @change=${e => update('scheme', e.target.value)}>
                                  ${['socks5', 'socks4', 'http', 'https'].map(
                                      scheme => html`<option value=${scheme} ?selected=${scheme === draft.scheme}>${scheme}</option>`
                                  )}
                              </select>
                              <input type="text" .value=${draft.host || ''} placeholder="127.0.0.1" @input=${e => update('host', e.target.value)} />
                              <input
                                  type="number"
                                  style="max-width:80px"
                                  .value=${String(draft.port || '')}
                                  placeholder="1080"
                                  @input=${e => update('port', Number(e.target.value))}
                              />
                              <button @click=${this.saveProxy}>Применить</button>
                          </div>
                          <span class="note">Системный ВПН при этом не нужен: через прокси идёт только это приложение.</span>`
                    : html`<button @click=${this.saveProxy} style="align-self:flex-start">Применить</button>`
            }
            ${this.proxyError ? html`<span class="note fail">${this.proxyError}</span>` : ''}
            ${
                this.config.proxy && this.config.proxy.enabled
                    ? html`<span class="note ok">Активен: ${this.config.proxy.scheme}://${this.config.proxy.host}:${this.config.proxy.port}</span>`
                    : ''
            }
        </div>`;
    }

    renderWhisperField() {
        const current = this.preferences.whisperModel;
        return html`<div class="field">
            <label>Модель распознавания речи</label>
            ${this.whisperModels.map(model => {
                const percent = this.downloading[model.id];
                return html`<div class="model-row">
                    <input
                        type="radio"
                        name="whisper"
                        ?checked=${model.id === current}
                        ?disabled=${!model.ready}
                        @change=${() => this.setPreference('whisperModel', model.id)}
                    />
                    <span class="grow">
                        ${model.label}${model.dominated ? ' (вытеснен turbo)' : ''}
                        <small> · ${Math.round(model.sizeBytes / 1048576)} МБ · ~${model.ramMb} МБ RAM</small>
                    </span>
                    ${
                        model.ready
                            ? html`<small>на диске</small>`
                            : percent === undefined
                              ? html`<button @click=${() => this.downloadWhisper(model.id)}>Скачать</button>`
                              : html`<small>${percent}%</small>`
                    }
                </div>`;
            })}
        </div>`;
    }

    renderSetup() {
        const model = this.currentModel;
        return html`
            <header>
                ${this.renderHealthDot()}
                <span class="spacer"></span>
                <button @click=${() => window.overlay.window.hide()} title="Спрятать">✕</button>
            </header>

            ${this.healthOpen ? this.renderHealthPopover() : ''}

            <main>
                <div class="setup">
                    ${this.renderKeyField()} ${this.renderProxyField()}

                    <div class="row">
                        <div class="field">
                            <label>Модель Claude</label>
                            <select @change=${this.onModelChange}>
                                ${this.models.map(
                                    item => html`<option value=${item.id} ?selected=${item.id === this.config.model}>${item.label}</option>`
                                )}
                            </select>
                        </div>
                        <div class="field">
                            <label>Глубина рассуждения</label>
                            <select @change=${e => this.setConfig('effort', e.target.value)} ?disabled=${model.efforts.length === 0}>
                                ${
                                    model.efforts.length === 0
                                        ? html`<option value="">—</option>`
                                        : model.efforts.map(
                                              level => html`<option value=${level} ?selected=${level === this.config.effort}>${level}</option>`
                                          )
                                }
                            </select>
                        </div>
                    </div>

                    <div class="field">
                        <label>Профиль</label>
                        <select @change=${e => this.setPreference('profile', e.target.value)}>
                            ${PROFILES.map(
                                profile =>
                                    html`<option value=${profile.id} ?selected=${profile.id === this.preferences.profile}>${profile.label}</option>`
                            )}
                        </select>
                    </div>

                    <div class="field">
                        <label>Свой контекст (роль, стек, о чём встреча)</label>
                        <textarea
                            .value=${this.preferences.customPrompt || ''}
                            @change=${e => this.setPreference('customPrompt', e.target.value)}
                        ></textarea>
                    </div>

                    <div class="field checkbox">
                        <input
                            type="checkbox"
                            id="listen-in-session"
                            .checked=${Boolean(this.preferences.listenInSession)}
                            @change=${e => this.setPreference('listenInSession', e.target.checked)}
                        />
                        <label for="listen-in-session">Слушать звук встречи и расшифровывать локально</label>
                    </div>

                    ${
                        this.preferences.listenInSession
                            ? html`<div class="field checkbox">
                                  <input
                                      type="checkbox"
                                      id="transcript-with-screenshot"
                                      .checked=${Boolean(this.preferences.transcriptWithScreenshot)}
                                      @change=${e => this.setPreference('transcriptWithScreenshot', e.target.checked)}
                                  />
                                  <label for="transcript-with-screenshot">Прикладывать расшифровку и к запросам по экрану</label>
                              </div>`
                            : ''
                    }
                    ${
                        this.displays > 1
                            ? html`<div class="field checkbox">
                                  <input
                                      type="checkbox"
                                      id="capture-cursor"
                                      .checked=${this.preferences.captureDisplay === 'cursor'}
                                      @change=${e => this.setPreference('captureDisplay', e.target.checked ? 'cursor' : 'primary')}
                                  />
                                  <label for="capture-cursor">Снимать монитор под курсором (мониторов: ${this.displays})</label>
                              </div>`
                            : ''
                    }
                    ${this.preferences.listenInSession ? this.renderWhisperField() : ''}

                    <div class="row">
                        <div class="field">
                            <label>Язык разговора</label>
                            <select @change=${e => this.setPreference('whisperLanguage', e.target.value)}>
                                ${LANGUAGES.map(
                                    ([code, title]) =>
                                        html`<option value=${code} ?selected=${code === this.preferences.whisperLanguage}>${title}</option>`
                                )}
                            </select>
                        </div>
                        <div class="field">
                            <label>Качество скриншота</label>
                            <select @change=${e => this.setPreference('imageQuality', e.target.value)}>
                                ${QUALITIES.map(
                                    quality =>
                                        html`<option value=${quality.id} ?selected=${quality.id === this.preferences.imageQuality}>
                                            ${quality.label}
                                        </option>`
                                )}
                            </select>
                        </div>
                    </div>

                    <div class="row">
                        <div class="field">
                            <label>Размер шрифта</label>
                            <select @change=${e => this.setPreference('fontSize', e.target.value)}>
                                ${FONT_SIZES.map(
                                    ([size, title]) => html`<option value=${size} ?selected=${size === this.preferences.fontSize}>${title}</option>`
                                )}
                            </select>
                        </div>
                        <div class="field">
                            <label>Прозрачность: ${Math.round((this.preferences.backgroundTransparency ?? 0.75) * 100)}%</label>
                            <input
                                type="range"
                                min="0.2"
                                max="1"
                                step="0.05"
                                .value=${String(this.preferences.backgroundTransparency ?? 0.75)}
                                @input=${e => this.setPreferenceSmooth('backgroundTransparency', Number(e.target.value))}
                            />
                        </div>
                    </div>

                    ${this.renderKeybindsField()} ${this.error ? html`<div class="error">${this.error}</div>` : ''}

                    <button class="primary big" @click=${this.startSession} ?disabled=${!this.hasApiKey || this.starting}>
                        ${this.starting ? 'Проверяю экран и звук…' : 'Начать сессию'}
                    </button>
                </div>
            </main>
        `;
    }

    render() {
        if (!this.loaded) {
            return html``;
        }
        this.classList.toggle('click-through', this.clickThrough);
        return html` ${OverlayApp.externalStyles} ${this.view === 'session' ? this.renderSession() : this.renderSetup()} `;
    }
}

customElements.define('overlay-app', OverlayApp);

import { LitElement, html, css } from '../assets/lit-core-2.7.4.min.js';
import { icon, controlStyles, switchRow, selectRow } from './ui.js';

const TABS = [
    { id: 'session', icon: 'session', label: 'Сессия' },
    { id: 'hotkeys', icon: 'hotkeys', label: 'Хоткеи' },
    { id: 'settings', icon: 'settings', label: 'Настройки' },
    { id: 'history', icon: 'history', label: 'История' },
];

const PROFILES = [
    ['meeting', 'Совещание'],
    ['interview', 'Собеседование'],
    ['freeform', 'Свободный'],
];

const QUALITIES = [
    ['low', 'Низкое — дешевле в токенах'],
    ['medium', 'Среднее'],
    ['high', 'Высокое — читает мелкий текст'],
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

const MEMORY_MINUTES = [
    ['2', '2 минуты'],
    ['5', '5 минут'],
    ['10', '10 минут'],
    ['30', '30 минут'],
];

const CORNERS = [
    ['bottom-right', 'Снизу справа'],
    ['bottom-left', 'Снизу слева'],
    ['top-right', 'Сверху справа'],
    ['top-left', 'Сверху слева'],
];

const PROXY_SCHEMES = [
    ['socks5', 'socks5'],
    ['socks4', 'socks4'],
    ['http', 'http'],
    ['https', 'https'],
];

export class OverlayApp extends LitElement {
    static properties = {
        view: { state: true },
        tab: { state: true },
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
        baseUrlDraft: { state: true },
        baseUrlError: { state: true },
        keybindFailed: { state: true },
        recordingAction: { state: true },
        displays: { state: true },
        pastSessions: { state: true },
    };

    static externalStyles = html`
        <link rel="stylesheet" href="assets/highlight-vscode-dark.min.css" />
        <link rel="stylesheet" href="assets/katex/katex.min.css" />
    `;

    static styles = [
        controlStyles,
        css`
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
                padding: 9px 11px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07);
                flex: 0 0 auto;
            }
            header select,
            header button,
            header .dot {
                -webkit-app-region: no-drag;
            }
            header .title {
                font-size: var(--font-size-sm);
                color: var(--text-secondary);
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
                padding: 5px 7px;
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
                padding: 9px;
                font-size: var(--font-size-sm);
            }

            .spacer {
                flex: 1;
            }

            /* ── экран подготовки ─────────────────────────────────────── */

            .body {
                flex: 1;
                display: flex;
                min-height: 0;
            }

            nav {
                flex: 0 0 auto;
                width: 152px;
                padding: 10px 8px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                border-right: 1px solid rgba(255, 255, 255, 0.07);
                overflow-y: auto;
            }
            nav button {
                display: flex;
                align-items: center;
                gap: 9px;
                width: 100%;
                padding: 7px 9px;
                background: transparent;
                border: none;
                border-radius: 7px;
                color: var(--text-secondary);
                font-size: var(--font-size-sm);
                text-align: left;
            }
            nav button:hover {
                background: rgba(255, 255, 255, 0.06);
                color: var(--text-primary);
            }
            nav button[aria-current='true'] {
                background: rgba(255, 255, 255, 0.1);
                color: var(--text-primary);
            }

            .pane {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
            }
            .pane .scroll {
                flex: 1;
                overflow-y: auto;
                padding: 14px 16px;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .pane .actions {
                flex: 0 0 auto;
                padding: 10px 16px 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.07);
                display: flex;
                gap: 8px;
            }
            .pane .actions > * {
                flex: 1;
            }

            .group {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .group > .head {
                font-size: 10.5px;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--text-muted);
            }
            .card {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 11px 12px;
                border-radius: 9px;
                background: rgba(255, 255, 255, 0.035);
                border: 1px solid rgba(255, 255, 255, 0.05);
            }

            .list-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .list-row .grow {
                flex: 1;
                min-width: 0;
                font-size: var(--font-size-sm);
            }
            .list-row small {
                color: var(--text-muted);
                font-size: 10px;
            }
            .list-row button.broken {
                border-color: var(--danger);
                color: var(--danger);
            }

            .empty {
                color: var(--text-muted);
                font-size: var(--font-size-sm);
            }

            /* Окно тянут за угол: узкая ширина не должна ломать раскладку. */
            @media (max-width: 620px) {
                nav {
                    width: 46px;
                    align-items: center;
                }
                nav button {
                    justify-content: center;
                    padding: 8px;
                }
                nav button span {
                    display: none;
                }
            }
            @media (max-width: 460px) {
                .row {
                    flex-direction: column;
                }
                .pane .scroll {
                    padding: 12px;
                }
            }

            /* ── окно сессии ──────────────────────────────────────────── */

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
                min-width: 0;
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
                top: 32px;
                left: 10px;
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
            .popover .detail {
                color: var(--text-secondary);
            }
        `,
    ];

    constructor() {
        super();
        this.view = 'setup';
        this.tab = 'session';
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
        this.baseUrlDraft = '';
        this.baseUrlError = '';
        this.keybindFailed = [];
        this.recordingAction = '';
        this.displays = 1;
        this.pastSessions = [];
        this.unsubscribes = [];
        this.savePreferenceSoon = null;
    }

    async connectedCallback() {
        super.connectedCallback();

        this.models = await window.overlay.models();
        this.config = await window.overlay.storage.getConfig();
        this.proxyDraft = { ...this.config.proxy };
        this.baseUrlDraft = this.config.baseUrl || '';
        this.preferences = await window.overlay.storage.getPreferences();
        const loadedKeys = await window.overlay.keybinds.load();
        this.keybinds = loadedKeys.keybinds;
        this.keybindFailed = loadedKeys.failed || [];
        this.hasApiKey = await window.overlay.storage.hasApiKey();
        this.whisperModels = await window.overlay.whisper.models();
        this.displays = await window.overlay.displays();
        this.pastSessions = await window.overlay.session.list(5);
        this.contentProtected = await window.overlay.window.isContentProtected();
        this.applyTransparency();

        // Форму рендерим только после загрузки состояния: если отрисовать её
        // раньше, Lit больше не переустановит значения полей.
        this.loaded = true;

        const on = window.overlay.on;
        this.unsubscribes = [
            on('shortcut:capture', () => this.capture()),
            on('shortcut:ask-voice', () => this.askVoice()),
            on('shortcut:new-session', () => this.newSession()),
            on('shortcut:scroll-up', () => this.scrollAnswer(-120)),
            on('shortcut:scroll-down', () => this.scrollAnswer(120)),
            on('shortcut:panic', () => this.wipe()),
            on('shortcut:listen', () => this.toggleListening()),
            on('shortcut:toggle-hints', () => this.toggleHints()),
            on('click-through-toggled', enabled => {
                this.clickThrough = enabled;
            }),
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

    get voiceModel() {
        return this.models.find(model => model.id === this.config.voiceModel) || { efforts: [] };
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

    async onModelChange(value) {
        const model = this.models.find(candidate => candidate.id === value);
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

    async testKey() {
        this.keyCheck = { pending: true };
        const result = await window.overlay.testKey();
        this.keyCheck = result.success ? { ok: true, model: result.model } : { ok: false, message: result.message };
    }

    async saveBaseUrl() {
        this.baseUrlError = '';
        try {
            await window.overlay.storage.setBaseUrl(this.baseUrlDraft);
            this.config = await window.overlay.storage.getConfig();
            // Адрес сменился — прошлая проверка ключа больше ничего не значит.
            this.keyCheck = null;
        } catch (error) {
            this.baseUrlError = error.message;
        }
    }

    async saveProxy() {
        this.proxyError = '';
        try {
            await window.overlay.storage.setProxy(this.proxyDraft);
            this.config = await window.overlay.storage.getConfig();
            this.keyCheck = null;
        } catch (error) {
            this.proxyError = error.message;
        }
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
            await window.overlay.voice.show();
        }

        await window.overlay.session.start({
            model: this.config.model,
            effort: this.config.effort,
            profile: this.preferences.profile,
            voiceModel: this.preferences.listenInSession ? this.config.voiceModel : null,
            whisperModel: this.preferences.listenInSession ? this.preferences.whisperModel : null,
            imageQuality: this.preferences.imageQuality,
        });

        if (this.preferences.hintsVisible) {
            await window.overlay.hints.show();
        }

        await window.overlay.window.setMode('session');
        this.view = 'session';
        this.starting = false;
    }

    async openSetup() {
        await window.overlay.session.finish();
        this.pastSessions = await window.overlay.session.list(5);
        await window.overlay.hints.hide();
        await window.overlay.voice.hide();
        await window.overlay.window.setMode('setup');
        this.view = 'setup';
    }

    async toggleHints() {
        const visible = !this.preferences.hintsVisible;
        await this.setPreference('hintsVisible', visible);
        if (visible && this.view === 'session') {
            await window.overlay.hints.show();
        } else {
            await window.overlay.hints.hide();
        }
    }

    // Текст из поля уходит вместе со скриншотом: «объясни этот запрос» и
    // «реши эту задачу» — разные вопросы к одной и той же картинке.
    async capture() {
        if (!this.hasApiKey) {
            this.error = 'Ключ не задан. Вставь его во вкладке «Настройки».';
            return;
        }
        this.status = 'busy';
        this.error = '';

        const field = this.renderRoot.querySelector('footer input');
        const prompt = field ? field.value.trim() : '';
        if (field) {
            field.value = '';
        }

        try {
            const image = await window.overlay.captureScreen();
            this.screenOk = true;
            await window.overlay.ask({
                images: [image],
                prompt,
                useTranscript: Boolean(this.preferences.transcriptWithScreenshot),
            });
        } catch (error) {
            this.screenOk = false;
            this.status = 'idle';
            this.error = error.message;
        }
    }

    // Ответ по речи уходит в отдельное окно: основной чат по экрану он не
    // трогает. Захват живёт здесь, поэтому сброс буфера тоже отсюда.
    async askVoice() {
        await window.overlay.voice.show();
        await window.overlay.listen.flush();
        await window.overlay.ask({ useTranscript: true, conversation: 'voice' });
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
                <select @change=${event => this.onModelChange(event.target.value)} title="Модель">
                    ${this.models.map(item => html`<option value=${item.id} ?selected=${item.id === this.config.model}>${item.label}</option>`)}
                </select>
                <select
                    @change=${event => this.setConfig('effort', event.target.value)}
                    ?disabled=${model.efforts.length === 0}
                    title="Глубина рассуждения"
                >
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
                <button @click=${this.openSetup} title="К настройкам">⚙</button>
                <button @click=${() => window.overlay.window.hide()} title="Спрятать">✕</button>
            </header>

            ${this.healthOpen ? this.renderHealthPopover() : ''}

            <main class=${this.preferences.fontSize || 'medium'}>
                ${this.error ? html`<div class="error">${this.error}</div>` : ''}
                ${
                    this.answer
                        ? this.renderMarkdown(this.answer)
                        : html`<div class="empty">Пусто. ${this.keybinds.capture} снимет экран и спросит Claude.</div>`
                }
            </main>

            ${this.renderTranscriptStrip()}

            <footer>
                <input
                    type="text"
                    placeholder="Свой вопрос — Enter отправит без экрана"
                    @keydown=${event => event.key === 'Enter' && this.askFollowUp(event)}
                />
                <button class="primary" @click=${this.capture} ?disabled=${this.status === 'busy'}>Снять экран</button>
            </footer>
        `;
    }

    /* ── вкладки экрана подготовки ─────────────────────────────────── */

    renderSessionTab() {
        const model = this.currentModel;
        const voice = this.voiceModel;
        const sound = Boolean(this.preferences.listenInSession);

        return html`
            <div class="group">
                <div class="head">Ответы по экрану</div>
                <div class="card">
                    <div class="row">
                        ${selectRow(
                            'Модель',
                            this.models.map(item => [item.id, item.label]),
                            this.config.model,
                            value => this.onModelChange(value)
                        )}
                        ${
                            model.efforts.length
                                ? selectRow(
                                      'Глубина рассуждения',
                                      model.efforts.map(level => [level, level]),
                                      this.config.effort,
                                      value => this.setConfig('effort', value)
                                  )
                                : selectRow('Глубина рассуждения', [['', 'не поддерживается']], '', () => {})
                        }
                    </div>
                    ${selectRow('Профиль', PROFILES, this.preferences.profile, value => this.setPreference('profile', value))}
                    <div class="field">
                        <label>Свой контекст — роль, стек, о чём встреча</label>
                        <textarea
                            .value=${this.preferences.customPrompt || ''}
                            @change=${event => this.setPreference('customPrompt', event.target.value)}
                        ></textarea>
                    </div>
                    ${selectRow('Качество скриншота', QUALITIES, this.preferences.imageQuality, value => this.setPreference('imageQuality', value))}
                </div>
            </div>

            <div class="group">
                <div class="head">Звук встречи</div>
                <div class="card">
                    ${switchRow('Слушать встречу', 'распознавание идёт на этой машине, аудио никуда не уходит', sound, value =>
                        this.setPreference('listenInSession', value)
                    )}
                    ${
                        sound
                            ? html`
                                  ${switchRow(
                                      'Добавлять расшифровку к вопросам по экрану',
                                      'без неё Claude отвечает только про то, что видит',
                                      this.preferences.transcriptWithScreenshot,
                                      value => this.setPreference('transcriptWithScreenshot', value)
                                  )}
                                  <div class="row">
                                      ${selectRow(
                                          'Модель распознавания',
                                          this.whisperModels.map(item => [
                                              item.id,
                                              `${item.label}${item.ready ? '' : ' — не скачана'} · ~${(item.ramMb / 1024).toFixed(1).replace('.', ',')} ГБ памяти`,
                                          ]),
                                          this.preferences.whisperModel,
                                          value => this.setPreference('whisperModel', value)
                                      )}
                                      ${selectRow('Язык разговора', LANGUAGES, this.preferences.whisperLanguage, value =>
                                          this.setPreference('whisperLanguage', value)
                                      )}
                                  </div>
                                  ${this.whisperModels
                                      .filter(item => !item.ready)
                                      .map(item => {
                                          const percent = this.downloading[item.id];
                                          return html`<div class="list-row">
                                              <span class="grow">${item.label} <small>· ${Math.round(item.sizeBytes / 1048576)} МБ</small></span>
                                              ${
                                                  percent === undefined
                                                      ? html`<button @click=${() => this.downloadWhisper(item.id)}>Скачать</button>`
                                                      : html`<small>${percent}%</small>`
                                              }
                                          </div>`;
                                      })}
                                  <div class="row">
                                      ${selectRow(
                                          'Модель для голоса',
                                          this.models.map(item => [item.id, item.label]),
                                          this.config.voiceModel,
                                          value => this.setConfig('voiceModel', value)
                                      )}
                                      ${
                                          voice.efforts.length
                                              ? selectRow(
                                                    'Глубина для голоса',
                                                    voice.efforts.map(level => [level, level]),
                                                    this.config.voiceEffort,
                                                    value => this.setConfig('voiceEffort', value)
                                                )
                                              : selectRow('Глубина для голоса', [['', 'не поддерживается']], '', () => {})
                                      }
                                  </div>
                                  ${selectRow('Помнить разговор', MEMORY_MINUTES, this.preferences.transcriptWindowMinutes, value =>
                                      this.setPreference('transcriptWindowMinutes', Number(value))
                                  )}
                              `
                            : ''
                    }
                </div>
            </div>

            ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        `;
    }

    renderHotkeysTab() {
        const failedIds = this.keybindFailed.map(entry => entry.action);
        const conflicts = window.overlay.keybinds.conflicts(this.keybinds);
        const conflicting = new Set(conflicts.flatMap(group => group.actions));

        return html`
            <div class="group">
                <div class="head">Сочетания клавиш</div>
                <div class="card">
                    ${window.overlay.keybinds.actions().map(action => {
                        const recording = this.recordingAction === action.id;
                        const broken = failedIds.includes(action.id);
                        const clashes = conflicting.has(action.id);
                        return html`<div class="list-row">
                            <span class="grow">${action.label}</span>
                            <button
                                class=${broken || clashes ? 'broken' : ''}
                                title=${broken ? 'Занято другим приложением' : clashes ? 'Дублируется внутри приложения' : ''}
                                @click=${() => (recording ? this.stopRecording() : this.startRecording(action.id))}
                            >
                                ${recording ? 'жми клавиши…' : this.keybinds[action.id]}
                            </button>
                        </div>`;
                    })}
                </div>
                ${
                    this.keybindFailed.length
                        ? html`<span class="note fail">
                              Уже занято другой программой: ${this.keybindFailed.map(item => item.accelerator).join(', ')}
                          </span>`
                        : ''
                }
                ${conflicts.length ? html`<span class="note fail">Одно сочетание назначено на несколько действий</span>` : ''}
                <div class="list-row">
                    <span class="grow note">
                        Сочетание перехватывается во всей системе, поэтому база на Alt: Cmd+M и Cmd+Enter заняты в macOS повсеместно.
                    </span>
                    <button @click=${this.resetKeybinds}>Вернуть умолчания</button>
                </div>
            </div>

            <div class="group">
                <div class="head">Подсказки поверх экрана</div>
                <div class="card">
                    ${switchRow(
                        'Показывать во время встречи',
                        'полупрозрачная плашка у края экрана, клики проходят насквозь',
                        this.preferences.hintsVisible,
                        value => this.setPreference('hintsVisible', value)
                    )}
                    ${selectRow('Где показывать', CORNERS, this.preferences.hintsCorner, value => window.overlay.hints.setCorner(value))}
                </div>
            </div>
        `;
    }

    renderSettingsTab() {
        const check = this.keyCheck;
        const activeBase = (this.config.baseUrl || '').trim();
        const proxy = this.proxyDraft || {};

        return html`
            <div class="group">
                <div class="head">Доступ к API</div>
                <div class="card">
                    <div class="field">
                        <label>Ключ Anthropic ${this.hasApiKey ? '— сохранён' : '— не задан'}</label>
                        <div class="inline">
                            <input
                                type="password"
                                placeholder=${this.hasApiKey ? 'заменить ключ…' : 'sk-ant-...'}
                                .value=${this.apiKeyDraft}
                                @input=${event => (this.apiKeyDraft = event.target.value)}
                            />
                            <button @click=${this.saveApiKey} ?disabled=${!this.apiKeyDraft}>Сохранить</button>
                            <button @click=${this.testKey} ?disabled=${!this.hasApiKey || (check && check.pending)}>
                                ${check && check.pending ? 'Проверяю…' : 'Проверить'}
                            </button>
                        </div>
                        ${check && check.ok ? html`<span class="note ok">Ключ работает, ответила ${check.model}</span>` : ''}
                        ${check && check.ok === false ? html`<span class="note fail">${check.message}</span>` : ''}
                    </div>

                    <div class="field">
                        <label>Свой адрес API — если ключ идёт через шлюз</label>
                        <div class="inline">
                            <input
                                type="text"
                                placeholder="пусто — напрямую в Anthropic"
                                .value=${this.baseUrlDraft}
                                @input=${event => (this.baseUrlDraft = event.target.value)}
                            />
                            <button @click=${this.saveBaseUrl}>Применить</button>
                        </div>
                        ${activeBase ? html`<span class="note fail">Ключ уходит на ${activeBase}, а не в Anthropic напрямую.</span>` : ''}
                        ${this.baseUrlError ? html`<span class="note fail">${this.baseUrlError}</span>` : ''}
                    </div>

                    ${switchRow(
                        'Пускать запросы через прокси',
                        'через него пойдёт только это приложение, системный ВПН не нужен',
                        proxy.enabled,
                        value => {
                            this.proxyDraft = { ...this.proxyDraft, enabled: value };
                            this.saveProxy();
                        }
                    )}
                    ${
                        proxy.enabled
                            ? html`<div class="inline">
                                  <select @change=${event => (this.proxyDraft = { ...this.proxyDraft, scheme: event.target.value })}>
                                      ${PROXY_SCHEMES.map(
                                          ([id, title]) => html`<option value=${id} ?selected=${id === proxy.scheme}>${title}</option>`
                                      )}
                                  </select>
                                  <input
                                      type="text"
                                      .value=${proxy.host || ''}
                                      placeholder="127.0.0.1"
                                      @input=${event => (this.proxyDraft = { ...this.proxyDraft, host: event.target.value })}
                                  />
                                  <input
                                      type="number"
                                      style="max-width:82px"
                                      .value=${String(proxy.port || '')}
                                      placeholder="1080"
                                      @input=${event => (this.proxyDraft = { ...this.proxyDraft, port: Number(event.target.value) })}
                                  />
                                  <button @click=${this.saveProxy}>Применить</button>
                              </div>`
                            : ''
                    }
                    ${this.proxyError ? html`<span class="note fail">${this.proxyError}</span>` : ''}
                </div>
            </div>

            <div class="group">
                <div class="head">Вид окна</div>
                <div class="card">
                    <div class="row">
                        ${selectRow('Размер шрифта', FONT_SIZES, this.preferences.fontSize, value => this.setPreference('fontSize', value))}
                        <div class="field">
                            <label>Непрозрачность: ${Math.round((this.preferences.backgroundTransparency ?? 0.75) * 100)}%</label>
                            <input
                                type="range"
                                min="0.2"
                                max="1"
                                step="0.05"
                                .value=${String(this.preferences.backgroundTransparency ?? 0.75)}
                                @input=${event => this.setPreferenceSmooth('backgroundTransparency', Number(event.target.value))}
                            />
                        </div>
                    </div>
                    ${
                        this.displays > 1
                            ? switchRow(
                                  'Снимать монитор под курсором',
                                  `сейчас подключено: ${this.displays}. Иначе снимается основной`,
                                  this.preferences.captureDisplay === 'cursor',
                                  value => this.setPreference('captureDisplay', value ? 'cursor' : 'primary')
                              )
                            : ''
                    }
                </div>
            </div>
        `;
    }

    renderHistoryTab() {
        if (!this.pastSessions.length) {
            return html`<div class="group">
                <div class="head">Прошлые сессии</div>
                <div class="empty">Здесь появятся прошлые встречи. Каждая сохраняет кадры и лог в отдельный каталог.</div>
            </div>`;
        }

        return html`<div class="group">
            <div class="head">Прошлые сессии</div>
            <div class="card">
                ${this.pastSessions.map(item => {
                    const totals = item.totals || {};
                    const when = String(item.startedAt || item.id)
                        .replace('T', ' ')
                        .slice(0, 16);
                    return html`<div class="list-row">
                        <span class="grow">
                            ${when}
                            <small>
                                · ${totals.requests || 0} запр. · ${totals.shots || 0} кадр.
                                ${totals.dollars ? ' · ' + window.overlay.cost.format(totals.dollars) : ''}
                            </small>
                        </span>
                        <button @click=${() => window.overlay.session.open(item.id)}>Открыть</button>
                    </div>`;
                })}
            </div>
            <span class="note">Каталоги не подчищаются сами: кадры встреч — твои данные.</span>
        </div>`;
    }

    renderSetup() {
        const panes = {
            session: () => this.renderSessionTab(),
            hotkeys: () => this.renderHotkeysTab(),
            settings: () => this.renderSettingsTab(),
            history: () => this.renderHistoryTab(),
        };

        return html`
            <header>
                ${this.renderHealthDot()}
                <span class="title">Claude Overlay</span>
                <span class="spacer"></span>
                <button @click=${() => window.overlay.window.hide()} title="Спрятать">✕</button>
            </header>

            ${this.healthOpen ? this.renderHealthPopover() : ''}

            <div class="body">
                <nav>
                    ${TABS.map(
                        tab =>
                            html`<button aria-current=${this.tab === tab.id} @click=${() => (this.tab = tab.id)} title=${tab.label}>
                                ${icon(tab.icon)}<span>${tab.label}</span>
                            </button>`
                    )}
                </nav>

                <div class="pane">
                    <div class="scroll">${panes[this.tab]()}</div>
                    ${
                        this.tab === 'session'
                            ? html`<div class="actions">
                                  <button class="primary big" @click=${this.startSession} ?disabled=${!this.hasApiKey || this.starting}>
                                      ${this.starting ? 'Проверяю экран и звук…' : 'Начать сессию'}
                                  </button>
                              </div>`
                            : ''
                    }
                </div>
            </div>
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

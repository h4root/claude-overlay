import { LitElement, html, css } from '../assets/lit-core-2.7.4.min.js';

const { ipcRenderer } = require('electron');

export class VoicePopup extends LitElement {
    static properties = {
        transcript: { state: true },
        answer: { state: true },
        status: { state: true },
        error: { state: true },
        keybind: { state: true },
    };

    static externalStyles = html`<link rel="stylesheet" href="assets/katex/katex.min.css" />`;

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            font-family: var(--font);
            color: var(--text-primary);
            border-radius: 10px;
            overflow: hidden;
            background: rgba(10, 10, 10, 0.82);
            backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }

        header {
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 9px;
            flex: 0 0 auto;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            font-size: var(--font-size-xs);
            color: var(--text-secondary);
        }
        header button {
            -webkit-app-region: no-drag;
            font-family: inherit;
            font-size: var(--font-size-xs);
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            padding: 2px 6px;
            cursor: pointer;
        }
        header button:hover {
            background: rgba(255, 255, 255, 0.12);
        }
        .spacer {
            flex: 1;
        }
        .dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--success);
            flex: 0 0 auto;
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

        main {
            flex: 1;
            overflow-y: auto;
            padding: 9px 11px;
            font-size: var(--font-size-sm);
            line-height: 1.5;
        }
        main :first-child {
            margin-top: 0;
        }
        main :last-child {
            margin-bottom: 0;
        }
        main pre {
            background: rgba(0, 0, 0, 0.5);
            padding: 8px;
            border-radius: 6px;
            overflow-x: auto;
        }
        main code {
            font-family: var(--font-mono);
            font-size: 0.9em;
        }
        main ul,
        main ol {
            margin: 5px 0;
            padding-left: 18px;
        }
        main .katex-display {
            overflow-x: auto;
            overflow-y: hidden;
        }

        /* Расшифровка — фон: она нужна, чтобы видеть, что система слышит,
           но ответ должен читаться первым. */
        .listening {
            color: var(--text-muted);
            font-size: var(--font-size-xs);
            line-height: 1.45;
        }
        .error {
            color: var(--danger);
            font-size: var(--font-size-xs);
        }
        .hint {
            flex: 0 0 auto;
            padding: 4px 11px 7px;
            color: var(--text-muted);
            font-size: 10.5px;
        }
        .hint kbd {
            font-family: var(--font-mono);
            color: var(--text-secondary);
        }
    `;

    constructor() {
        super();
        this.transcript = '';
        this.answer = '';
        this.status = 'idle';
        this.error = '';
        this.keybind = '';
        this.offs = [];
    }

    connectedCallback() {
        super.connectedCallback();

        const on = (channel, handler) => {
            const listener = (event, payload) => handler(payload);
            ipcRenderer.on(channel, listener);
            this.offs.push(() => ipcRenderer.removeListener(channel, listener));
        };

        on('transcript:update', payload => {
            this.transcript = payload.text;
        });
        on('transcript:error', payload => {
            this.error = payload.message;
        });
        on('claude:start', () => {
            this.answer = '';
            this.error = '';
            this.status = 'busy';
        });
        on('claude:delta', delta => {
            this.answer += delta;
            this.scrollToBottom();
        });
        on('claude:done', () => {
            this.status = 'idle';
        });
        on('claude:error', payload => {
            this.status = 'idle';
            this.error = payload.message;
        });
        on('voice:keybind', payload => {
            this.keybind = payload.accelerator;
        });

        ipcRenderer.invoke('keybinds:get').then(loaded => {
            this.keybind = loaded.keybinds.askVoice;
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.offs.forEach(off => off());
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            const main = this.renderRoot.querySelector('main');
            if (main) main.scrollTop = main.scrollHeight;
        });
    }

    async reset() {
        this.answer = '';
        this.error = '';
        await ipcRenderer.invoke('claude:reset', 'voice');
    }

    renderMarkdown(text) {
        const container = document.createElement('div');
        container.innerHTML = window.marked.parse(text, { breaks: true, gfm: true });
        window.renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
            ],
            throwOnError: false,
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        });
        return container;
    }

    renderBody() {
        if (this.error) {
            return html`<div class="error">${this.error}</div>`;
        }
        if (this.answer) {
            return this.renderMarkdown(this.answer);
        }
        if (this.transcript) {
            return html`<div class="listening">${this.transcript}</div>`;
        }
        return html`<div class="listening">Слушаю. Речи пока нет.</div>`;
    }

    render() {
        return html`
            ${VoicePopup.externalStyles}
            <header>
                <span class="dot ${this.status}"></span>
                <span>Голос</span>
                <span class="spacer"></span>
                <button @click=${this.reset} title="Очистить">⟲</button>
                <button @click=${() => ipcRenderer.invoke('voice:hide')} title="Спрятать">✕</button>
            </header>

            <main>${this.renderBody()}</main>

            <div class="hint"><kbd>${this.keybind}</kbd> — ответить по последним 20 секундам</div>
        `;
    }
}

customElements.define('voice-popup', VoicePopup);

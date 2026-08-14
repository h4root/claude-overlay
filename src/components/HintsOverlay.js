import { LitElement, html, css } from '../assets/lit-core-2.7.4.min.js';

const { ipcRenderer } = require('electron');

// Показываем только то, что жмут во время встречи. Полный список живёт
// на экране подготовки — здесь он был бы шумом поверх чужого окна.
const SHOWN = ['capture', 'askVoice', 'toggleVisibility', 'toggleClickThrough', 'toggleHints'];

const SHORT_LABELS = {
    capture: 'снять экран',
    askVoice: 'по речи',
    toggleVisibility: 'спрятать окно',
    toggleClickThrough: 'клики насквозь',
    toggleHints: 'убрать подсказки',
};

export class HintsOverlay extends LitElement {
    static properties = {
        keybinds: { state: true },
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            justify-content: center;
            height: 100%;
            padding: 8px 10px;
            gap: 3px;
            border-radius: 10px;
            background: rgba(10, 10, 10, 0.62);
            backdrop-filter: blur(14px);
            border: 1px solid rgba(255, 255, 255, 0.06);
            font-family: var(--font);
            color: var(--text-secondary);
            font-size: 11px;
            /* Окно кликов не принимает, но перетащить его за собой полезно. */
            -webkit-app-region: drag;
        }

        .row {
            display: flex;
            align-items: baseline;
            gap: 6px;
            line-height: 1.35;
        }

        kbd {
            font-family: var(--font-mono);
            font-size: 10.5px;
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            padding: 0 4px;
            flex: 0 0 auto;
        }

        .label {
            color: var(--text-muted);
        }
    `;

    constructor() {
        super();
        this.keybinds = {};
    }

    connectedCallback() {
        super.connectedCallback();
        ipcRenderer.invoke('keybinds:get').then(loaded => {
            this.keybinds = loaded.keybinds;
        });
        this.listener = () => {
            ipcRenderer.invoke('keybinds:get').then(loaded => {
                this.keybinds = loaded.keybinds;
            });
        };
        ipcRenderer.on('keybinds:changed', this.listener);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        ipcRenderer.removeListener('keybinds:changed', this.listener);
    }

    render() {
        return html`${SHOWN.filter(id => this.keybinds[id]).map(
            id =>
                html`<div class="row">
                    <kbd>${this.keybinds[id]}</kbd>
                    <span class="label">${SHORT_LABELS[id]}</span>
                </div>`
        )}`;
    }
}

customElements.define('hints-overlay', HintsOverlay);

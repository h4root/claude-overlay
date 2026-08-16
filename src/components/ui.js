import { html, css } from '../assets/lit-core-2.7.4.min.js';

// Иконки нарисованы здесь, а не подключены шрифтом: CSP запрещает внешние
// ресурсы, а один SVG на вкладку дешевле любого набора.
const PATHS = {
    session: 'M4 5h16v11H4zM9 20h6M12 16v4',
    hotkeys: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
    settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM4 12H2m20 0h-2M12 4V2m0 20v-2M6 6L4.5 4.5M19.5 19.5L18 18M18 6l1.5-1.5M4.5 19.5L6 18',
    history: 'M12 7v5l3 2M3 12a9 9 0 109-9 9 9 0 00-7 3.3M3 4v3.5h3.5',
    camera: 'M3 8.5A1.5 1.5 0 014.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0121 8.5v9A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5zM12 15.5a3 3 0 100-6 3 3 0 000 6z',
    send: 'M12 19V5M6 11l6-6 6 6',
    stop: 'M7 7h10v10H7z',
    copy: 'M9 9h10v10H9zM5 15V5h10',
    retry: 'M20 12a8 8 0 11-2.3-5.6M20 4v4h-4',
    down: 'M12 5v14M6 13l6 6 6-6',
    check: 'M5 13l4 4L19 7',
};

function icon(name) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]}" /></svg>`;
}

const controlStyles = css`
    svg {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .field > label {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
    }
    .field textarea {
        min-height: 58px;
        resize: vertical;
    }

    .row {
        display: flex;
        gap: 10px;
    }
    .row > * {
        flex: 1;
        min-width: 0;
    }

    .inline {
        display: flex;
        gap: 6px;
        align-items: center;
    }
    .inline input[type='text'],
    .inline input[type='password'] {
        flex: 1;
        min-width: 0;
    }

    /* Переключатель вместо галочки: состояние читается издалека и не
       требует прицеливаться в квадрат 13 на 13 пикселей. */
    .switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        cursor: pointer;
        user-select: none;
    }
    .switch .text {
        font-size: var(--font-size-sm);
        color: var(--text-primary);
    }
    .switch .text small {
        display: block;
        font-size: var(--font-size-xs);
        color: var(--text-muted);
    }
    .switch input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }
    .track {
        flex: 0 0 auto;
        width: 34px;
        height: 20px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.1);
        position: relative;
        transition: background var(--transition, 150ms ease);
    }
    .track::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--text-secondary);
        transition:
            transform 150ms ease,
            background 150ms ease;
    }
    .switch input:checked + .track {
        background: var(--accent);
        border-color: var(--accent);
    }
    .switch input:checked + .track::after {
        transform: translateX(14px);
        background: #fff;
    }
    .switch input:focus-visible + .track {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
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
`;

function switchRow(label, hint, checked, onChange) {
    return html`<label class="switch">
        <span class="text">${label}${hint ? html`<small>${hint}</small>` : ''}</span>
        <input type="checkbox" .checked=${Boolean(checked)} @change=${event => onChange(event.target.checked)} />
        <span class="track"></span>
    </label>`;
}

function selectRow(label, options, value, onChange) {
    return html`<div class="field">
        <label>${label}</label>
        <select @change=${event => onChange(event.target.value)}>
            ${options.map(([id, title]) => html`<option value=${id} ?selected=${String(id) === String(value)}>${title}</option>`)}
        </select>
    </div>`;
}

export { icon, controlStyles, switchRow, selectRow };

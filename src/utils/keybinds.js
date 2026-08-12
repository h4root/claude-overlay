'use strict';

// База на Alt: сочетания с Cmd (Cmd+M, Cmd+Enter, Cmd+H) заняты в macOS
// повсеместно, а глобальная регистрация отбирает их у всех приложений сразу.
const ACTIONS = [
    { id: 'capture', label: 'Снять экран и спросить', default: 'Alt+Space' },
    { id: 'askVoice', label: 'Ответить по услышанному', default: 'Alt+Shift+Space' },
    { id: 'toggleVisibility', label: 'Спрятать / показать окно', default: 'Alt+\\' },
    { id: 'toggleClickThrough', label: 'Клики сквозь окно', default: 'Alt+M' },
    { id: 'listen', label: 'Слушать звук встречи', default: 'Alt+L' },
    { id: 'newSession', label: 'Сбросить диалог', default: 'Alt+N' },
    { id: 'scrollUp', label: 'Прокрутить ответ вверх', default: 'Alt+Shift+Up' },
    { id: 'scrollDown', label: 'Прокрутить ответ вниз', default: 'Alt+Shift+Down' },
    { id: 'moveUp', label: 'Двигать окно вверх', default: 'Alt+Up' },
    { id: 'moveDown', label: 'Двигать окно вниз', default: 'Alt+Down' },
    { id: 'moveLeft', label: 'Двигать окно влево', default: 'Alt+Left' },
    { id: 'moveRight', label: 'Двигать окно вправо', default: 'Alt+Right' },
    { id: 'panic', label: 'Стереть ответ и выйти', default: 'Alt+Shift+E' },
];

const MODIFIERS = ['Cmd', 'Command', 'CmdOrCtrl', 'Ctrl', 'Control', 'Alt', 'Option', 'AltGr', 'Shift', 'Super', 'Meta'];

const NAMED_KEYS = [
    'Space',
    'Enter',
    'Return',
    'Tab',
    'Esc',
    'Escape',
    'Backspace',
    'Delete',
    'Insert',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Up',
    'Down',
    'Left',
    'Right',
    'Plus',
];

const PUNCTUATION = ['\\', '-', '=', '[', ']', ';', "'", ',', '.', '/', '`'];

const CODE_TO_KEY = {
    Space: 'Space',
    Enter: 'Enter',
    NumpadEnter: 'Enter',
    Tab: 'Tab',
    Escape: 'Esc',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
    Backslash: '\\',
};

function isModifier(token) {
    return MODIFIERS.some(modifier => modifier.toLowerCase() === String(token).toLowerCase());
}

function isKeyToken(token) {
    if (!token) return false;
    if (/^[A-Za-z0-9]$/.test(token)) return true;
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(token)) return true;
    if (PUNCTUATION.includes(token)) return true;
    return NAMED_KEYS.some(named => named.toLowerCase() === token.toLowerCase());
}

function isValidAccelerator(accelerator) {
    if (!accelerator || typeof accelerator !== 'string') {
        return false;
    }
    const parts = accelerator.split('+');
    const key = parts.pop();
    if (parts.length === 0 || !parts.every(isModifier)) {
        return false;
    }
    return !isModifier(key) && isKeyToken(key);
}

function keyFromCode(code) {
    if (CODE_TO_KEY[code]) {
        return CODE_TO_KEY[code];
    }
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter) {
        return letter[1];
    }
    const digit = /^Digit([0-9])$/.exec(code);
    if (digit) {
        return digit[1];
    }
    const functionKey = /^F([1-9]|1[0-9]|2[0-4])$/.exec(code);
    if (functionKey) {
        return code;
    }
    return null;
}

// Опираемся на физическую клавишу: Option+буква даёт в event.key спецсимвол,
// и по нему сочетание собрать нельзя.
function acceleratorFromEvent(event) {
    const key = keyFromCode(event.code);
    if (!key) {
        return null;
    }

    const parts = [];
    if (event.metaKey) parts.push('Cmd');
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');

    if (parts.length === 0) {
        return null;
    }

    parts.push(key);
    return parts.join('+');
}

function defaultKeybinds() {
    return Object.fromEntries(ACTIONS.map(action => [action.id, action.default]));
}

function mergeKeybinds(saved) {
    const result = defaultKeybinds();
    if (!saved) {
        return result;
    }
    for (const action of ACTIONS) {
        const value = saved[action.id];
        if (isValidAccelerator(value)) {
            result[action.id] = value;
        }
    }
    return result;
}

function findConflicts(keybinds) {
    const groups = new Map();
    for (const [action, accelerator] of Object.entries(keybinds)) {
        const key = String(accelerator).toLowerCase();
        if (!groups.has(key)) {
            groups.set(key, { accelerator, actions: [] });
        }
        groups.get(key).actions.push(action);
    }
    return [...groups.values()].filter(group => group.actions.length > 1);
}

module.exports = {
    ACTIONS,
    defaultKeybinds,
    mergeKeybinds,
    isValidAccelerator,
    acceleratorFromEvent,
    findConflicts,
};

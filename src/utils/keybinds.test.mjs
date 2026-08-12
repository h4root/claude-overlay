import { describe, it, expect } from 'vitest';
import keybinds from './keybinds.js';

const { ACTIONS, defaultKeybinds, mergeKeybinds, isValidAccelerator, acceleratorFromEvent, findConflicts } = keybinds;

function event(overrides = {}) {
    return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, code: 'KeyM', ...overrides };
}

describe('каталог действий', () => {
    it('у каждого действия есть название и сочетание по умолчанию', () => {
        for (const action of ACTIONS) {
            expect(action.id.length).toBeGreaterThan(0);
            expect(action.label.length).toBeGreaterThan(0);
            expect(isValidAccelerator(action.default)).toBe(true);
        }
    });

    // Cmd+M сворачивает окна, Cmd+Enter отправляет сообщения — забирать их
    // у всей системы слишком дорого, поэтому база на Alt.
    it('по умолчанию не занимает сочетания с Cmd', () => {
        for (const action of ACTIONS) {
            expect(action.default).not.toMatch(/Cmd|Ctrl/);
        }
    });

    it('в наборе по умолчанию нет столкновений', () => {
        expect(findConflicts(defaultKeybinds())).toEqual([]);
    });

    it('defaultKeybinds отдаёт сочетание для каждого действия', () => {
        expect(Object.keys(defaultKeybinds()).sort()).toEqual(ACTIONS.map(action => action.id).sort());
    });
});

describe('mergeKeybinds', () => {
    it('пустые настройки дают набор по умолчанию', () => {
        expect(mergeKeybinds(null)).toEqual(defaultKeybinds());
    });

    it('сохранённое сочетание перекрывает умолчание', () => {
        expect(mergeKeybinds({ capture: 'Cmd+7' }).capture).toBe('Cmd+7');
    });

    it('недостающие действия добираются из умолчаний', () => {
        expect(mergeKeybinds({ capture: 'Cmd+7' }).panic).toBe(defaultKeybinds().panic);
    });

    it('неизвестные действия отбрасываются', () => {
        expect(mergeKeybinds({ выдумка: 'Cmd+9' }).выдумка).toBeUndefined();
    });

    it('мусорное сочетание заменяется умолчанием', () => {
        expect(mergeKeybinds({ capture: 'ЖЖЖ' }).capture).toBe(defaultKeybinds().capture);
        expect(mergeKeybinds({ capture: '' }).capture).toBe(defaultKeybinds().capture);
    });
});

describe('isValidAccelerator', () => {
    it('модификатор с клавишей проходит', () => {
        expect(isValidAccelerator('Alt+Space')).toBe(true);
        expect(isValidAccelerator('Cmd+Shift+E')).toBe(true);
        expect(isValidAccelerator('Alt+Up')).toBe(true);
    });

    it('без модификатора не проходит: перехватит клавишу у всей системы', () => {
        expect(isValidAccelerator('Space')).toBe(false);
        expect(isValidAccelerator('E')).toBe(false);
    });

    it('один модификатор без клавиши не проходит', () => {
        expect(isValidAccelerator('Alt')).toBe(false);
        expect(isValidAccelerator('Cmd+Shift')).toBe(false);
    });

    it('пустое значение не проходит', () => {
        expect(isValidAccelerator('')).toBe(false);
        expect(isValidAccelerator(null)).toBe(false);
    });
});

describe('acceleratorFromEvent', () => {
    // Option+буква даёт в event.key спецсимвол (ø, å), поэтому опираемся на code.
    it('строит сочетание по физической клавише, а не по символу', () => {
        expect(acceleratorFromEvent(event({ altKey: true, code: 'KeyM', key: 'µ' }))).toBe('Alt+M');
    });

    it('порядок модификаторов постоянный', () => {
        const accelerator = acceleratorFromEvent(event({ metaKey: true, ctrlKey: true, altKey: true, shiftKey: true }));
        expect(accelerator).toBe('Cmd+Ctrl+Alt+Shift+M');
    });

    it('понимает стрелки, пробел и цифры', () => {
        expect(acceleratorFromEvent(event({ altKey: true, code: 'ArrowUp' }))).toBe('Alt+Up');
        expect(acceleratorFromEvent(event({ altKey: true, code: 'Space' }))).toBe('Alt+Space');
        expect(acceleratorFromEvent(event({ altKey: true, code: 'Digit3' }))).toBe('Alt+3');
    });

    it('нажатие одних модификаторов сочетанием не считает', () => {
        expect(acceleratorFromEvent(event({ altKey: true, code: 'AltLeft' }))).toBeNull();
        expect(acceleratorFromEvent(event({ metaKey: true, code: 'MetaRight' }))).toBeNull();
        expect(acceleratorFromEvent(event({ shiftKey: true, code: 'ShiftLeft' }))).toBeNull();
    });

    it('клавиша без модификаторов отклоняется', () => {
        expect(acceleratorFromEvent(event({ code: 'KeyM' }))).toBeNull();
    });

    it('незнакомую клавишу не выдумывает', () => {
        expect(acceleratorFromEvent(event({ altKey: true, code: 'Lang1' }))).toBeNull();
    });
});

describe('findConflicts', () => {
    it('без столкновений отдаёт пустой список', () => {
        expect(findConflicts({ capture: 'Alt+Space', panic: 'Alt+E' })).toEqual([]);
    });

    it('находит два действия на одном сочетании', () => {
        const conflicts = findConflicts({ capture: 'Alt+Space', listen: 'Alt+Space', panic: 'Alt+E' });
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].accelerator).toBe('Alt+Space');
        expect(conflicts[0].actions.sort()).toEqual(['capture', 'listen']);
    });

    it('сравнивает без учёта регистра', () => {
        expect(findConflicts({ capture: 'Alt+Space', listen: 'alt+space' })).toHaveLength(1);
    });
});

import { describe, it, expect } from 'vitest';
import health from './health.js';

const { buildHealth, overallState, CHUNK_STALE_MS } = health;

const NOW = 1_000_000;

function build(overrides = {}) {
    return buildHealth({
        keyVerified: true,
        hasKey: true,
        screenOk: true,
        contentProtected: true,
        wantsAudio: true,
        listening: true,
        lastChunkAt: NOW - 1000,
        now: NOW,
        ...overrides,
    });
}

function item(report, id) {
    return report.find(entry => entry.id === id);
}

describe('buildHealth: ключ', () => {
    it('проверенный ключ — норма', () => {
        expect(item(build(), 'key').state).toBe('ok');
    });

    it('ключ есть, но не проверен — предупреждение', () => {
        expect(item(build({ keyVerified: false }), 'key').state).toBe('warn');
    });

    it('ключа нет — отказ', () => {
        expect(item(build({ hasKey: false, keyVerified: false }), 'key').state).toBe('fail');
    });
});

describe('buildHealth: экран', () => {
    it('снимок получался — норма', () => {
        expect(item(build(), 'screen').state).toBe('ok');
    });

    it('снимок не получался — отказ', () => {
        expect(item(build({ screenOk: false }), 'screen').state).toBe('fail');
    });

    it('снимок ещё не пробовали — предупреждение', () => {
        expect(item(build({ screenOk: null }), 'screen').state).toBe('warn');
    });
});

describe('buildHealth: звук', () => {
    it('слушаем и данные идут — норма', () => {
        expect(item(build(), 'sound').state).toBe('ok');
    });

    // Тишина в переговорке — это норма. А вот молчание самого захвата — поломка.
    it('слушаем, но окна перестали приходить — отказ', () => {
        expect(item(build({ lastChunkAt: NOW - CHUNK_STALE_MS - 1 }), 'sound').state).toBe('fail');
    });

    it('только включили, окон ещё не было — предупреждение', () => {
        expect(item(build({ lastChunkAt: null }), 'sound').state).toBe('warn');
    });

    it('звук не запрашивали — пункт выключен и на общий итог не влияет', () => {
        const report = build({ wantsAudio: false, listening: false, lastChunkAt: null });
        expect(item(report, 'sound').state).toBe('off');
        expect(overallState(report)).toBe('ok');
    });

    it('звук запрашивали, но захват не поднялся — отказ', () => {
        expect(item(build({ listening: false, lastChunkAt: null }), 'sound').state).toBe('fail');
    });
});

describe('buildHealth: невидимость окна', () => {
    it('защита включена — норма', () => {
        expect(item(build(), 'privacy').state).toBe('ok');
    });

    it('защита выключена — отказ, окно попадёт в демонстрацию', () => {
        const entry = item(build({ contentProtected: false }), 'privacy');
        expect(entry.state).toBe('fail');
        expect(entry.detail).toMatch(/демонстрац|видно/i);
    });
});

describe('buildHealth: состав отчёта', () => {
    it('всегда четыре пункта в понятном порядке', () => {
        expect(build().map(entry => entry.id)).toEqual(['key', 'screen', 'sound', 'privacy']);
    });

    it('у каждого пункта есть название и пояснение', () => {
        for (const entry of build()) {
            expect(entry.label.length).toBeGreaterThan(0);
            expect(entry.detail.length).toBeGreaterThan(0);
        }
    });
});

describe('overallState', () => {
    it('всё в норме — норма', () => {
        expect(overallState(build())).toBe('ok');
    });

    it('одно предупреждение опускает итог до предупреждения', () => {
        expect(overallState(build({ keyVerified: false }))).toBe('warn');
    });

    it('отказ важнее предупреждения', () => {
        expect(overallState(build({ keyVerified: false, screenOk: false }))).toBe('fail');
    });

    it('пустой отчёт считается нормой', () => {
        expect(overallState([])).toBe('ok');
    });
});

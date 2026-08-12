import { describe, it, expect } from 'vitest';
import pricing from './pricing.js';

const { priceFor, costOf, SessionCost, formatUsd } = pricing;

const BEFORE_INTRO_END = Date.parse('2026-08-11T00:00:00Z');
const AFTER_INTRO_END = Date.parse('2026-09-01T00:00:00Z');

describe('priceFor', () => {
    it('знает цены Opus 5', () => {
        expect(priceFor('claude-opus-5', AFTER_INTRO_END)).toMatchObject({ input: 5, output: 25 });
    });

    it('пока действует вводная цена, отдаёт её', () => {
        expect(priceFor('claude-sonnet-5', BEFORE_INTRO_END)).toMatchObject({ input: 2, output: 10 });
    });

    it('после окончания вводной цены возвращается к обычной', () => {
        expect(priceFor('claude-sonnet-5', AFTER_INTRO_END)).toMatchObject({ input: 3, output: 15 });
    });

    it('бросает ошибку на неизвестной модели, а не считает по нулям', () => {
        expect(() => priceFor('gpt-4')).toThrow(/неизвестная модель/i);
    });
});

describe('costOf', () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 0 };

    it('считает вход по цене за миллион', () => {
        expect(costOf(usage, 'claude-opus-5', AFTER_INTRO_END)).toBeCloseTo(5, 6);
    });

    it('считает выход', () => {
        expect(costOf({ input_tokens: 0, output_tokens: 1_000_000 }, 'claude-opus-5', AFTER_INTRO_END)).toBeCloseTo(25, 6);
    });

    it('запись в кеш дороже обычного входа в 1,25 раза', () => {
        const cost = costOf({ cache_creation_input_tokens: 1_000_000 }, 'claude-opus-5', AFTER_INTRO_END);
        expect(cost).toBeCloseTo(6.25, 6);
    });

    it('чтение из кеша дешевле обычного входа в десять раз', () => {
        const cost = costOf({ cache_read_input_tokens: 1_000_000 }, 'claude-opus-5', AFTER_INTRO_END);
        expect(cost).toBeCloseTo(0.5, 6);
    });

    it('складывает все четыре составляющие', () => {
        const cost = costOf(
            {
                input_tokens: 1_000_000,
                output_tokens: 1_000_000,
                cache_creation_input_tokens: 1_000_000,
                cache_read_input_tokens: 1_000_000,
            },
            'claude-opus-5',
            AFTER_INTRO_END
        );
        expect(cost).toBeCloseTo(5 + 25 + 6.25 + 0.5, 6);
    });

    it('переживает отсутствие полей в usage', () => {
        expect(costOf({}, 'claude-opus-5', AFTER_INTRO_END)).toBe(0);
        expect(costOf(null, 'claude-opus-5', AFTER_INTRO_END)).toBe(0);
    });
});

describe('SessionCost', () => {
    it('пустой счётчик — нули', () => {
        const session = new SessionCost();
        expect(session.total).toEqual({ requests: 0, inputTokens: 0, outputTokens: 0, dollars: 0 });
    });

    it('накапливает запросы и токены', () => {
        const session = new SessionCost();
        session.add({ input_tokens: 1000, output_tokens: 500 }, 'claude-opus-5', AFTER_INTRO_END);
        session.add({ input_tokens: 2000, output_tokens: 700 }, 'claude-opus-5', AFTER_INTRO_END);
        expect(session.total.requests).toBe(2);
        expect(session.total.inputTokens).toBe(3000);
        expect(session.total.outputTokens).toBe(1200);
    });

    it('считает деньги нарастающим итогом', () => {
        const session = new SessionCost();
        session.add({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, 'claude-opus-5', AFTER_INTRO_END);
        expect(session.total.dollars).toBeCloseTo(30, 6);
    });

    // Модель можно переключить посреди сессии — каждый запрос считается по своей цене.
    it('считает каждый запрос по цене его модели', () => {
        const session = new SessionCost();
        session.add({ input_tokens: 1_000_000 }, 'claude-opus-5', AFTER_INTRO_END);
        session.add({ input_tokens: 1_000_000 }, 'claude-haiku-4-5', AFTER_INTRO_END);
        expect(session.total.dollars).toBeCloseTo(6, 6);
    });

    it('неизвестная модель не роняет счётчик и не портит сумму', () => {
        const session = new SessionCost();
        session.add({ input_tokens: 1_000_000 }, 'claude-opus-5', AFTER_INTRO_END);
        session.add({ input_tokens: 1_000_000 }, 'какая-то-новая-модель', AFTER_INTRO_END);
        expect(session.total.requests).toBe(2);
        expect(session.total.dollars).toBeCloseTo(5, 6);
    });

    it('reset обнуляет', () => {
        const session = new SessionCost();
        session.add({ input_tokens: 1000 }, 'claude-opus-5', AFTER_INTRO_END);
        session.reset();
        expect(session.total.requests).toBe(0);
        expect(session.total.dollars).toBe(0);
    });
});

describe('formatUsd', () => {
    it('мелкие суммы показывает с точностью до цента-другого', () => {
        expect(formatUsd(0.0234)).toBe('$0,023');
        expect(formatUsd(0.4567)).toBe('$0,46');
    });

    it('крупные суммы — до цента', () => {
        expect(formatUsd(12.3456)).toBe('$12,35');
    });

    it('ноль показывает явно', () => {
        expect(formatUsd(0)).toBe('$0');
    });
});

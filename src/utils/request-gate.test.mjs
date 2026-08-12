import { describe, it, expect } from 'vitest';
import gateModule from './request-gate.js';

const { RequestGate } = gateModule;

describe('RequestGate', () => {
    it('выдаёт номера, начиная с первого', () => {
        const gate = new RequestGate();
        expect(gate.begin()).toBe(1);
        expect(gate.begin()).toBe(2);
    });

    it('актуален только последний запрос', () => {
        const gate = new RequestGate();
        const first = gate.begin();
        const second = gate.begin();
        expect(gate.isCurrent(second)).toBe(true);
        expect(gate.isCurrent(first)).toBe(false);
    });

    // Оборванный запрос падает с ошибкой прерывания — она не должна
    // всплыть в интерфейсе как настоящая ошибка нового запроса.
    it('вытесненный запрос перестаёт быть актуальным сразу', () => {
        const gate = new RequestGate();
        const superseded = gate.begin();
        gate.begin();
        expect(gate.isCurrent(superseded)).toBe(false);
    });

    it('cancel обесценивает текущий запрос', () => {
        const gate = new RequestGate();
        const id = gate.begin();
        gate.cancel();
        expect(gate.isCurrent(id)).toBe(false);
    });

    it('после cancel следующий запрос снова актуален', () => {
        const gate = new RequestGate();
        gate.begin();
        gate.cancel();
        const fresh = gate.begin();
        expect(gate.isCurrent(fresh)).toBe(true);
    });

    it('до первого запроса актуального нет', () => {
        expect(new RequestGate().isCurrent(1)).toBe(false);
    });

    it('чужие и выдуманные номера не проходят', () => {
        const gate = new RequestGate();
        gate.begin();
        expect(gate.isCurrent(999)).toBe(false);
        expect(gate.isCurrent(undefined)).toBe(false);
        expect(gate.isCurrent(null)).toBe(false);
    });
});

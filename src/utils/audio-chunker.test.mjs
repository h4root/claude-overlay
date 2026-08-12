import { describe, it, expect } from 'vitest';
import chunker from './audio-chunker.js';

const { ChunkAccumulator } = chunker;

const SAMPLE_RATE = 16;

function accumulator(overrides = {}) {
    return new ChunkAccumulator({ sampleRate: SAMPLE_RATE, chunkSeconds: 3, overlapSeconds: 1, ...overrides });
}

function block(value, length = SAMPLE_RATE) {
    return Float32Array.from({ length }, () => value);
}

describe('ChunkAccumulator', () => {
    it('молчит, пока окно не набралось', () => {
        const accumulate = accumulator();
        expect(accumulate.push(block(1))).toBeNull();
        expect(accumulate.push(block(2))).toBeNull();
    });

    it('отдаёт окно нужной длины, когда оно набралось', () => {
        const accumulate = accumulator();
        accumulate.push(block(1));
        accumulate.push(block(2));
        const chunk = accumulate.push(block(3));
        expect(chunk).toBeInstanceOf(Float32Array);
        expect(chunk.length).toBe(3 * SAMPLE_RATE);
    });

    it('сохраняет порядок сэмплов', () => {
        const accumulate = accumulator();
        accumulate.push(block(1));
        accumulate.push(block(2));
        const chunk = accumulate.push(block(3));
        expect(chunk[0]).toBe(1);
        expect(chunk[SAMPLE_RATE]).toBe(2);
        expect(chunk[2 * SAMPLE_RATE]).toBe(3);
    });

    // Перехлёст нужен, чтобы слово на стыке окон не потерялось.
    it('оставляет хвост перехлёста для следующего окна', () => {
        const accumulate = accumulator();
        accumulate.push(block(1));
        accumulate.push(block(2));
        accumulate.push(block(3));
        accumulate.push(block(4));
        const second = accumulate.push(block(5));
        expect(second).not.toBeNull();
        expect(second[0]).toBe(3);
        expect(second[SAMPLE_RATE]).toBe(4);
        expect(second[2 * SAMPLE_RATE]).toBe(5);
    });

    it('принимает блоки произвольной длины', () => {
        const accumulate = accumulator();
        expect(accumulate.push(block(1, 40))).toBeNull();
        const chunk = accumulate.push(block(2, 8));
        expect(chunk.length).toBe(48);
    });

    it('reset очищает накопленное', () => {
        const accumulate = accumulator();
        accumulate.push(block(1));
        accumulate.push(block(2));
        accumulate.reset();
        expect(accumulate.push(block(3))).toBeNull();
    });

    it('перехлёст не может быть больше окна', () => {
        expect(() => new ChunkAccumulator({ sampleRate: 16, chunkSeconds: 2, overlapSeconds: 2 })).toThrow(/перехл/i);
    });

    // По хоткею нужно расшифровать то, что уже накопилось, не дожидаясь
    // конца окна: иначе самый свежий вопрос в запрос не попадёт.
    it('flush отдаёт недобранное окно', () => {
        const accumulate = accumulator();
        accumulate.push(block(1));
        accumulate.push(block(2));
        const chunk = accumulate.flush();
        expect(chunk).toBeInstanceOf(Float32Array);
        expect(chunk.length).toBe(2 * SAMPLE_RATE);
        expect(chunk[0]).toBe(1);
    });

    it('после flush остаётся только перехлёст', () => {
        const accumulate = accumulator();
        accumulate.push(block(1));
        accumulate.push(block(2));
        accumulate.flush();
        expect(accumulate.push(block(3))).toBeNull();
        const next = accumulate.flush();
        expect(next[0]).toBe(2);
        expect(next[SAMPLE_RATE]).toBe(3);
    });

    it('flush на пустом буфере ничего не отдаёт', () => {
        expect(accumulator().flush()).toBeNull();
    });

    // Обрывок в треть секунды whisper расшифрует в выдумку.
    it('слишком короткий обрывок не отдаётся', () => {
        const accumulate = accumulator({ minFlushSeconds: 1 });
        accumulate.push(block(1, SAMPLE_RATE / 2));
        expect(accumulate.flush()).toBeNull();
    });

    it('порог короткого обрывка по умолчанию — полсекунды', () => {
        const accumulate = new ChunkAccumulator({ sampleRate: 16000 });
        expect(accumulate.minFlushSamples).toBe(8000);
    });

    it('по умолчанию окно 10 секунд с секундой перехлёста', () => {
        const accumulate = new ChunkAccumulator({ sampleRate: 16000 });
        expect(accumulate.chunkSamples).toBe(160000);
        expect(accumulate.overlapSamples).toBe(16000);
    });
});

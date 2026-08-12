import { describe, it, expect } from 'vitest';
import registry from './whisper-models.js';

const { WHISPER_MODELS, getWhisperModel, modelFilePath } = registry;

describe('реестр моделей whisper', () => {
    it('содержит три уровня, от лёгкого к тяжёлому', () => {
        expect(WHISPER_MODELS.map(model => model.id)).toEqual(['small', 'medium', 'large-v3-turbo']);
    });

    it('у каждой модели есть всё нужное для скачивания и проверки', () => {
        for (const model of WHISPER_MODELS) {
            expect(model.file).toMatch(/^ggml-.+\.bin$/);
            expect(model.url).toMatch(/^https:\/\/huggingface\.co\//);
            expect(model.url.endsWith(model.file)).toBe(true);
            expect(model.sha256).toMatch(/^[a-f0-9]{64}$/);
            expect(model.sizeBytes).toBeGreaterThan(1_000_000);
            expect(model.ramMb).toBeGreaterThan(0);
            expect(model.label.length).toBeGreaterThan(0);
        }
    });

    // medium крупнее small и почти равен turbo по памяти, но слабее и медленнее его.
    it('помечает medium как вытесненный turbo', () => {
        expect(getWhisperModel('medium').dominated).toBe(true);
        expect(getWhisperModel('small').dominated).toBe(false);
        expect(getWhisperModel('large-v3-turbo').dominated).toBe(false);
    });

    it('размер и память растут вместе с уровнем', () => {
        const [small, medium] = WHISPER_MODELS;
        expect(small.sizeBytes).toBeLessThan(medium.sizeBytes);
        expect(small.ramMb).toBeLessThan(medium.ramMb);
    });

    it('отдаёт модель по идентификатору', () => {
        expect(getWhisperModel('small').file).toBe('ggml-small-q5_1.bin');
    });

    it('бросает ошибку на неизвестной модели', () => {
        expect(() => getWhisperModel('huge')).toThrow(/неизвестная модель/i);
    });

    it('строит путь к файлу внутри каталога моделей', () => {
        expect(modelFilePath('/tmp/models', 'small')).toBe('/tmp/models/ggml-small-q5_1.bin');
    });

    it('не даёт выйти за каталог моделей через идентификатор', () => {
        expect(() => modelFilePath('/tmp/models', '../../etc/passwd')).toThrow(/неизвестная модель/i);
    });
});

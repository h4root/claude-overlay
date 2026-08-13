import { describe, it, expect } from 'vitest';
import registry from './whisper-models.js';

const { WHISPER_MODELS, getWhisperModel, modelFilePath } = registry;

describe('реестр моделей whisper', () => {
    it('содержит два уровня: экономный и точный', () => {
        expect(WHISPER_MODELS.map(model => model.id)).toEqual(['small', 'large-v3-turbo']);
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

    // Medium вытеснен turbo: та же память, но хуже и медленнее.
    it('medium больше не предлагается', () => {
        expect(() => getWhisperModel('medium')).toThrow(/неизвестная модель/i);
    });

    it('размер и память растут вместе с уровнем', () => {
        const [small, turbo] = WHISPER_MODELS;
        expect(small.sizeBytes).toBeLessThan(turbo.sizeBytes);
        expect(small.ramMb).toBeLessThan(turbo.ramMb);
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

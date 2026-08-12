import { describe, it, expect } from 'vitest';
import tempFiles from './temp-files.js';

const { TEMP_PREFIX, temporaryWavName, isOverlayTempName } = tempFiles;

describe('temporaryWavName', () => {
    it('имя начинается с нашего префикса и кончается на .wav', () => {
        const name = temporaryWavName();
        expect(name.startsWith(TEMP_PREFIX)).toBe(true);
        expect(name.endsWith('.wav')).toBe(true);
    });

    it('имена не повторяются', () => {
        const names = new Set(Array.from({ length: 50 }, () => temporaryWavName()));
        expect(names.size).toBe(50);
    });

    it('собственное имя признаётся своим', () => {
        expect(isOverlayTempName(temporaryWavName())).toBe(true);
    });
});

// Осиротевшие файлы удаляются из общего /tmp, поэтому ошибка здесь means
// стереть чужое.
describe('isOverlayTempName', () => {
    it('чужие файлы не трогаем', () => {
        for (const name of ['note.wav', 'com.apple.something', 'overlay.wav', 'my-overlay-1234.wav', '', null]) {
            expect(isOverlayTempName(name)).toBe(false);
        }
    });

    it('файл с нашим префиксом, но другого расширения — не наш', () => {
        expect(isOverlayTempName(`${TEMP_PREFIX}abc123.txt`)).toBe(false);
    });

    it('без шестнадцатеричной части — не наш', () => {
        expect(isOverlayTempName(`${TEMP_PREFIX}.wav`)).toBe(false);
        expect(isOverlayTempName(`${TEMP_PREFIX}не-хекс.wav`)).toBe(false);
    });

    it('путь с разделителями не принимается: удалять можно только по имени', () => {
        expect(isOverlayTempName(`../${TEMP_PREFIX}abc123.wav`)).toBe(false);
        expect(isOverlayTempName(`/tmp/${TEMP_PREFIX}abc123.wav`)).toBe(false);
    });
});

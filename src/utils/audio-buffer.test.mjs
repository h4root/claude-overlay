import { describe, it, expect } from 'vitest';
import audio from './audio-buffer.js';

const { encodeWav, rms, isSilent, trimSilence, SILENCE_THRESHOLD } = audio;

function readString(buffer, offset, length) {
    return buffer.toString('latin1', offset, offset + length);
}

describe('encodeWav', () => {
    const samples = Float32Array.from([0, 0.5, -0.5, 1]);

    it('пишет корректный RIFF/WAVE-заголовок', () => {
        const wav = encodeWav(samples, 16000);
        expect(readString(wav, 0, 4)).toBe('RIFF');
        expect(readString(wav, 8, 4)).toBe('WAVE');
        expect(readString(wav, 12, 4)).toBe('fmt ');
        expect(readString(wav, 36, 4)).toBe('data');
    });

    it('описывает моно 16 бит с заданной частотой', () => {
        const wav = encodeWav(samples, 16000);
        expect(wav.readUInt16LE(20)).toBe(1); // PCM
        expect(wav.readUInt16LE(22)).toBe(1); // каналов
        expect(wav.readUInt32LE(24)).toBe(16000); // частота
        expect(wav.readUInt32LE(28)).toBe(32000); // байт в секунду
        expect(wav.readUInt16LE(32)).toBe(2); // выравнивание блока
        expect(wav.readUInt16LE(34)).toBe(16); // бит на сэмпл
    });

    it('считает размеры от числа сэмплов', () => {
        const wav = encodeWav(samples, 16000);
        expect(wav.length).toBe(44 + samples.length * 2);
        expect(wav.readUInt32LE(4)).toBe(36 + samples.length * 2);
        expect(wav.readUInt32LE(40)).toBe(samples.length * 2);
    });

    it('переводит float в 16-битный PCM', () => {
        const wav = encodeWav(Float32Array.from([0, 1, -1]), 16000);
        expect(wav.readInt16LE(44)).toBe(0);
        expect(wav.readInt16LE(46)).toBe(32767);
        expect(wav.readInt16LE(48)).toBe(-32768);
    });

    it('обрезает выбросы за пределами диапазона, а не заворачивает их', () => {
        const wav = encodeWav(Float32Array.from([2.5, -3.1]), 16000);
        expect(wav.readInt16LE(44)).toBe(32767);
        expect(wav.readInt16LE(46)).toBe(-32768);
    });

    it('принимает пустой сигнал', () => {
        expect(encodeWav(new Float32Array(0), 16000).length).toBe(44);
    });
});

describe('rms', () => {
    it('на тишине даёт ноль', () => {
        expect(rms(new Float32Array(128))).toBe(0);
    });

    it('на постоянной амплитуде равен ей', () => {
        expect(rms(Float32Array.from([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5, 6);
    });

    it('на пустом массиве не делит на ноль', () => {
        expect(rms(new Float32Array(0))).toBe(0);
    });
});

describe('isSilent', () => {
    it('считает тишиной сигнал ниже порога', () => {
        expect(isSilent(new Float32Array(256))).toBe(true);
    });

    it('не считает тишиной обычную речь', () => {
        const speech = Float32Array.from({ length: 256 }, (unused, index) => Math.sin(index) * 0.2);
        expect(isSilent(speech)).toBe(false);
    });

    it('принимает свой порог', () => {
        const quiet = Float32Array.from({ length: 256 }, () => 0.01);
        expect(isSilent(quiet, 0.05)).toBe(true);
        expect(isSilent(quiet, 0.001)).toBe(false);
    });

    it('порог по умолчанию отсекает фоновый шум микрофона, но не тихую речь', () => {
        expect(SILENCE_THRESHOLD).toBeGreaterThan(0);
        expect(SILENCE_THRESHOLD).toBeLessThan(0.05);
    });
});

// Whisper на тишине уверенно выдумывает текст («Продолжение следует...»),
// поэтому в кусок должна попадать только речь.
describe('trimSilence', () => {
    const RATE = 1000;

    function signal(parts) {
        const samples = [];
        for (const [seconds, amplitude] of parts) {
            for (let index = 0; index < seconds * RATE; index += 1) {
                samples.push(index % 2 === 0 ? amplitude : -amplitude);
            }
        }
        return Float32Array.from(samples);
    }

    it('сплошную тишину вырезает целиком', () => {
        expect(trimSilence(signal([[3, 0]]), RATE).length).toBe(0);
    });

    it('пустой сигнал отдаёт пустым', () => {
        expect(trimSilence(new Float32Array(0), RATE).length).toBe(0);
    });

    it('оставляет речь, отрезая тишину с обеих сторон', () => {
        const trimmed = trimSilence(
            signal([
                [2, 0],
                [1, 0.3],
                [3, 0],
            ]),
            RATE
        );
        expect(trimmed.length).toBeLessThan(2 * RATE);
        expect(trimmed.length).toBeGreaterThanOrEqual(RATE);
    });

    it('речь в самом начале не обрезает', () => {
        const trimmed = trimSilence(
            signal([
                [1, 0.3],
                [4, 0],
            ]),
            RATE
        );
        expect(trimmed[0]).toBeCloseTo(0.3, 5);
    });

    it('речь в самом конце не теряет', () => {
        const trimmed = trimSilence(
            signal([
                [4, 0],
                [1, 0.3],
            ]),
            RATE
        );
        expect(Math.abs(trimmed.at(-1))).toBeCloseTo(0.3, 5);
    });

    it('сигнал целиком из речи возвращает как есть', () => {
        const speech = signal([[2, 0.3]]);
        expect(trimSilence(speech, RATE).length).toBe(speech.length);
    });

    // Небольшой запас нужен, чтобы не срезать атаку и затухание слова.
    it('оставляет запас вокруг речи', () => {
        const trimmed = trimSilence(
            signal([
                [2, 0],
                [1, 0.3],
                [2, 0],
            ]),
            RATE
        );
        expect(trimmed.length).toBeGreaterThan(RATE);
    });
});

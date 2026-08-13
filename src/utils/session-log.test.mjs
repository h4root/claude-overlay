import { describe, it, expect } from 'vitest';
import sessionLog from './session-log.js';

const { sessionDirName, shotFileName, encodeLogLine } = sessionLog;

describe('sessionDirName', () => {
    const moment = new Date('2026-08-12T20:45:07Z');

    it('начинается с даты и времени', () => {
        expect(sessionDirName(moment, 'a1b2')).toMatch(/^2026-08-12-\d{4}-a1b2$/);
    });

    // Каталоги сортируются по имени, и это должно совпадать с порядком во времени.
    it('сортируется по имени в хронологическом порядке', () => {
        const earlier = sessionDirName(new Date('2026-08-12T09:00:00Z'), 'aaaa');
        const later = sessionDirName(new Date('2026-08-12T21:00:00Z'), 'aaaa');
        expect([later, earlier].sort()).toEqual([earlier, later]);
    });

    it('не содержит символов, опасных в пути', () => {
        expect(sessionDirName(moment, 'a1b2')).toMatch(/^[A-Za-z0-9-]+$/);
    });

    it('без суффикса тоже работает и остаётся безопасным', () => {
        expect(sessionDirName(moment)).toMatch(/^[A-Za-z0-9-]+$/);
    });
});

describe('shotFileName', () => {
    it('нумерует с ведущими нулями, чтобы файлы шли по порядку', () => {
        expect(shotFileName(1)).toBe('0001.jpg');
        expect(shotFileName(42)).toBe('0042.jpg');
    });

    it('не ломается на больших номерах', () => {
        expect(shotFileName(12345)).toBe('12345.jpg');
    });
});

describe('encodeLogLine', () => {
    const started = 1_000_000;

    it('строка ровно одна, без переносов', () => {
        const line = encodeLogLine({ kind: 'ask', at: started + 5000, prompt: 'что тут' }, started);
        expect(line).not.toContain('\n');
        expect(JSON.parse(line)).toBeTypeOf('object');
    });

    // Время относительное: абсолютные метки в каждой строке — это лишние
    // тринадцать символов на запись без всякой пользы.
    it('время записывает относительно начала сессии', () => {
        expect(JSON.parse(encodeLogLine({ kind: 'ask', at: started + 7500 }, started)).t).toBe(7500);
    });

    it('ключи короткие', () => {
        const parsed = JSON.parse(encodeLogLine({ kind: 'ans', at: started, text: 'ответ', inputTokens: 10 }, started));
        expect(Object.keys(parsed).sort()).toEqual(['i', 'k', 't', 'x'].sort());
    });

    it('пропущенные поля в строку не попадают', () => {
        const parsed = JSON.parse(encodeLogLine({ kind: 'ask', at: started }, started));
        expect(parsed).toEqual({ t: 0, k: 'ask' });
    });

    // Экранированная кириллица раздувает файл втрое и делает его нечитаемым.
    it('кириллицу не экранирует', () => {
        expect(encodeLogLine({ kind: 'ans', at: started, text: 'привет' }, started)).toContain('привет');
    });

    it('номер скриншота и признак расшифровки сохраняет', () => {
        const parsed = JSON.parse(encodeLogLine({ kind: 'ask', at: started, shot: 3, withTranscript: true }, started));
        expect(parsed.s).toBe(3);
        expect(parsed.tr).toBe(true);
    });

    it('стоимость и токены сохраняет', () => {
        const parsed = JSON.parse(encodeLogLine({ kind: 'ans', at: started, inputTokens: 1730, outputTokens: 420, dollars: 0.0123 }, started));
        expect(parsed).toMatchObject({ i: 1730, o: 420, c: 0.0123 });
    });

    it('неизвестный вид записи не роняет кодировщик', () => {
        expect(() => encodeLogLine({ kind: 'что-то новое', at: started }, started)).not.toThrow();
    });
});

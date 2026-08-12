import { describe, it, expect } from 'vitest';
import transcript from './transcript.js';

const { RollingTranscript } = transcript;

describe('RollingTranscript', () => {
    it('пустой буфер отдаёт пустую строку', () => {
        expect(new RollingTranscript().text()).toBe('');
    });

    it('склеивает реплики в порядке поступления', () => {
        const buffer = new RollingTranscript({ windowMs: 60000 });
        buffer.add('первая', 1000);
        buffer.add('вторая', 2000);
        expect(buffer.text(3000)).toBe('первая вторая');
    });

    it('выбрасывает реплики старше окна', () => {
        const buffer = new RollingTranscript({ windowMs: 120000 });
        buffer.add('старое', 0);
        buffer.add('свежее', 130000);
        expect(buffer.text(130000)).toBe('свежее');
    });

    it('оставляет реплику ровно на границе окна', () => {
        const buffer = new RollingTranscript({ windowMs: 120000 });
        buffer.add('граница', 10000);
        expect(buffer.text(130000)).toBe('граница');
    });

    it('игнорирует пустые фрагменты и пробелы', () => {
        const buffer = new RollingTranscript();
        buffer.add('   ', 1000);
        buffer.add('', 2000);
        buffer.add(null, 3000);
        expect(buffer.text()).toBe('');
    });

    it('обрезает пробелы по краям фрагмента', () => {
        const buffer = new RollingTranscript();
        buffer.add('  реплика \n', 1000);
        expect(buffer.text(2000)).toBe('реплика');
    });

    // Окна распознавания идут с перехлёстом, поэтому whisper повторяет хвост предыдущего окна.
    it('не дублирует фрагмент, повторённый подряд', () => {
        const buffer = new RollingTranscript();
        buffer.add('привет всем', 1000);
        buffer.add('привет всем', 2000);
        expect(buffer.text(3000)).toBe('привет всем');
    });

    it('повтор через другую реплику дублем не считает', () => {
        const buffer = new RollingTranscript();
        buffer.add('да', 1000);
        buffer.add('нет', 2000);
        buffer.add('да', 3000);
        expect(buffer.text(4000)).toBe('да нет да');
    });

    // Соседние окна перекрываются на секунду, поэтому начало нового фрагмента
    // повторяет конец предыдущего. В расшифровке это выглядит как заикание.
    it('срезает у нового фрагмента хвост предыдущего', () => {
        const buffer = new RollingTranscript();
        buffer.add('давайте вернёмся к вопросу о сроках релиза', 1000);
        buffer.add('о сроках релиза мы успеваем закрыть интеграцию', 2000);
        expect(buffer.text(3000)).toBe('давайте вернёмся к вопросу о сроках релиза мы успеваем закрыть интеграцию');
    });

    it('склейка не зависит от регистра и знаков препинания', () => {
        const buffer = new RollingTranscript();
        buffer.add('Мы успеваем закрыть интеграцию.', 1000);
        buffer.add('Закрыть интеграцию до конца квартала?', 2000);
        expect(buffer.text(3000)).toBe('Мы успеваем закрыть интеграцию. до конца квартала?');
    });

    it('одно общее слово совпадением не считает', () => {
        const buffer = new RollingTranscript();
        buffer.add('сроки уже горят', 1000);
        buffer.add('горят заявки на отпуск', 2000);
        expect(buffer.text(3000)).toBe('сроки уже горят горят заявки на отпуск');
    });

    it('фрагмент, целиком повторяющий хвост, отбрасывается', () => {
        const buffer = new RollingTranscript();
        buffer.add('мы успеваем закрыть интеграцию', 1000);
        buffer.add('закрыть интеграцию', 2000);
        expect(buffer.text(3000)).toBe('мы успеваем закрыть интеграцию');
    });

    it('ограничивает длину, оставляя свежий хвост', () => {
        const buffer = new RollingTranscript({ windowMs: 600000, maxChars: 20 });
        buffer.add('первая реплика тут', 1000);
        buffer.add('последняя', 2000);
        const text = buffer.text(3000);
        expect(text.length).toBeLessThanOrEqual(20);
        expect(text).toContain('последняя');
    });

    it('clear стирает всё', () => {
        const buffer = new RollingTranscript();
        buffer.add('что-то', 1000);
        buffer.clear();
        expect(buffer.text()).toBe('');
    });

    it('окно по умолчанию — две минуты', () => {
        expect(new RollingTranscript().windowMs).toBe(120000);
    });
});

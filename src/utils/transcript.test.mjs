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

    // Одну и ту же секунду соседние окна распознают по-разному: вокруг неё
    // разный контекст. Точное совпадение слов на этом и ломалось.
    it('склеивает, когда у слова разошлось окончание', () => {
        const buffer = new RollingTranscript();
        buffer.add('мы успеваем закрыть интеграцию', 1000);
        buffer.add('закрыть интеграции до конца квартала', 2000);
        expect(buffer.text(3000)).toBe('мы успеваем закрыть интеграцию до конца квартала');
    });

    it('склеивает при разнице в одну букву внутри слова', () => {
        const buffer = new RollingTranscript();
        buffer.add('вернёмся к вопросу о релизе', 1000);
        buffer.add('о ремизе поговорим позже', 2000);
        expect(buffer.text(3000)).toBe('вернёмся к вопросу о релизе поговорим позже');
    });

    it('короткие слова требуют точного совпадения', () => {
        const buffer = new RollingTranscript();
        buffer.add('он был там', 1000);
        buffer.add('от был другой разговор', 2000);
        expect(buffer.text(3000)).toBe('он был там от был другой разговор');
    });

    it('разные слова похожими не считает', () => {
        const buffer = new RollingTranscript();
        buffer.add('обсудим бюджет отдела', 1000);
        buffer.add('сроки релиза сдвинулись', 2000);
        expect(buffer.text(3000)).toBe('обсудим бюджет отдела сроки релиза сдвинулись');
    });

    it('срезает самый длинный совпадающий стык, а не первый попавшийся', () => {
        const buffer = new RollingTranscript();
        buffer.add('это надо закрыть до конца квартала', 1000);
        buffer.add('до конца квартала мы точно успеем', 2000);
        expect(buffer.text(3000)).toBe('это надо закрыть до конца квартала мы точно успеем');
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

    it('окно по умолчанию — десять минут', () => {
        expect(new RollingTranscript().windowMs).toBe(600000);
    });

    // Раньше лимит резал строку посередине слова; выбрасывать надо целыми
    // репликами, начиная со старых.
    it('при переполнении выбрасывает старые реплики целиком', () => {
        const buffer = new RollingTranscript({ maxChars: 20 });
        buffer.add('первая реплика', 1000);
        buffer.add('вторая', 2000);
        buffer.add('третья', 3000);
        expect(buffer.text(4000)).toBe('вторая третья');
    });
});

describe('RollingTranscript.formatted', () => {
    it('пустой буфер даёт пустую строку', () => {
        expect(new RollingTranscript().formatted()).toBe('');
    });

    // Модель должна видеть, насколько реплика свежая: вопрос трёхминутной
    // давности и вопрос, прозвучавший только что, требуют разного отношения.
    it('помечает давность первой реплики', () => {
        const buffer = new RollingTranscript();
        buffer.add('о сроках', 0);
        expect(buffer.formatted(180000)).toBe('[3 мин назад] о сроках');
    });

    it('свежую реплику помечает как только что', () => {
        const buffer = new RollingTranscript();
        buffer.add('вопрос', 100000);
        expect(buffer.formatted(110000)).toBe('[только что] вопрос');
    });

    it('реплики подряд не разбивает метками', () => {
        const buffer = new RollingTranscript();
        buffer.add('первая', 100000);
        buffer.add('вторая', 110000);
        expect(buffer.formatted(115000)).toBe('[только что] первая вторая');
    });

    it('после долгой паузы ставит новую метку', () => {
        const buffer = new RollingTranscript();
        buffer.add('старое', 0);
        buffer.add('новое', 300000);
        const text = buffer.formatted(300000);
        expect(text).toBe('[5 мин назад] старое\n[только что] новое');
    });

    it('метка меняется вместе с временем', () => {
        const buffer = new RollingTranscript();
        buffer.add('реплика', 0);
        expect(buffer.formatted(30000)).toBe('[только что] реплика');
        expect(buffer.formatted(60000)).toBe('[1 мин назад] реплика');
    });

    // Голосовое окно спрашивает по последним секундам, но основное окно должно
    // сохранить свою десятиминутную память — срез не имеет права её испортить.
    it('срез по возрасту отдаёт только свежие реплики', () => {
        const buffer = new RollingTranscript();
        buffer.add('старое', 0);
        buffer.add('свежее', 100000);
        expect(buffer.formatted(100000, { maxAgeMs: 20000 })).toBe('[только что] свежее');
    });

    it('срез не выбрасывает реплики из буфера', () => {
        const buffer = new RollingTranscript();
        buffer.add('старое', 0);
        buffer.add('свежее', 100000);
        buffer.formatted(100000, { maxAgeMs: 20000 });
        expect(buffer.text(100000)).toBe('старое свежее');
    });

    it('если за срез ничего не попало, отдаёт пустую строку', () => {
        const buffer = new RollingTranscript();
        buffer.add('давнее', 0);
        expect(buffer.formatted(100000, { maxAgeMs: 20000 })).toBe('');
    });

    it('без среза ведёт себя как раньше', () => {
        const buffer = new RollingTranscript();
        buffer.add('старое', 0);
        buffer.add('свежее', 100000);
        expect(buffer.formatted(100000)).toContain('старое');
    });

    it('выпавшие по окну реплики в разметку не попадают', () => {
        const buffer = new RollingTranscript({ windowMs: 60000 });
        buffer.add('древнее', 0);
        buffer.add('свежее', 100000);
        expect(buffer.formatted(100000)).toBe('[только что] свежее');
    });
});

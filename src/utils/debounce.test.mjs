import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import debounceModule from './debounce.js';

const { debounce } = debounceModule;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('debounce', () => {
    it('не вызывает раньше срока', () => {
        const spy = vi.fn();
        debounce(spy, 200)();
        vi.advanceTimersByTime(199);
        expect(spy).not.toHaveBeenCalled();
    });

    it('вызывает один раз после паузы', () => {
        const spy = vi.fn();
        const run = debounce(spy, 200);
        run();
        vi.advanceTimersByTime(200);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    // Перетаскивание ползунка даёт десятки событий; на диск должно уйти одно.
    it('серия вызовов схлопывается в один', () => {
        const spy = vi.fn();
        const run = debounce(spy, 200);
        for (let i = 0; i < 30; i += 1) {
            run(i);
            vi.advanceTimersByTime(10);
        }
        vi.advanceTimersByTime(200);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('передаёт аргументы последнего вызова', () => {
        const spy = vi.fn();
        const run = debounce(spy, 100);
        run('первый');
        run('последний');
        vi.advanceTimersByTime(100);
        expect(spy).toHaveBeenCalledWith('последний');
    });

    it('после срабатывания счёт начинается заново', () => {
        const spy = vi.fn();
        const run = debounce(spy, 100);
        run();
        vi.advanceTimersByTime(100);
        run();
        vi.advanceTimersByTime(100);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('cancel отменяет отложенный вызов', () => {
        const spy = vi.fn();
        const run = debounce(spy, 100);
        run();
        run.cancel();
        vi.advanceTimersByTime(500);
        expect(spy).not.toHaveBeenCalled();
    });

    it('flush выполняет отложенное немедленно', () => {
        const spy = vi.fn();
        const run = debounce(spy, 1000);
        run('значение');
        run.flush();
        expect(spy).toHaveBeenCalledWith('значение');
        vi.advanceTimersByTime(1000);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('flush без отложенного вызова ничего не делает', () => {
        const spy = vi.fn();
        debounce(spy, 100).flush();
        expect(spy).not.toHaveBeenCalled();
    });
});

import { describe, it, expect } from 'vitest';
import proxy from './proxy.js';

const { SCHEMES, buildProxyRules, validateProxy } = proxy;

const VALID = { enabled: true, scheme: 'socks5', host: '127.0.0.1', port: 1080 };

describe('buildProxyRules', () => {
    it('собирает правило из схемы, хоста и порта', () => {
        expect(buildProxyRules(VALID)).toBe('socks5://127.0.0.1:1080');
    });

    it('выключенный прокси означает прямое соединение', () => {
        expect(buildProxyRules({ ...VALID, enabled: false })).toBeNull();
    });

    it('пустая настройка — тоже прямое соединение', () => {
        expect(buildProxyRules(null)).toBeNull();
        expect(buildProxyRules({})).toBeNull();
    });

    it('поддерживает все заявленные схемы', () => {
        for (const scheme of SCHEMES) {
            expect(buildProxyRules({ ...VALID, scheme })).toBe(`${scheme}://127.0.0.1:1080`);
        }
    });

    it('принимает имя хоста, а не только адрес', () => {
        expect(buildProxyRules({ ...VALID, host: 'proxy.local' })).toBe('socks5://proxy.local:1080');
    });

    it('порт-строку приводит к числу', () => {
        expect(buildProxyRules({ ...VALID, port: '8080' })).toBe('socks5://127.0.0.1:8080');
    });
});

describe('validateProxy', () => {
    it('корректная настройка проходит', () => {
        expect(validateProxy(VALID)).toEqual({ ok: true });
    });

    it('выключенный прокси не проверяется', () => {
        expect(validateProxy({ enabled: false, host: '', port: 0 })).toEqual({ ok: true });
    });

    it('пустой хост отклоняется', () => {
        expect(validateProxy({ ...VALID, host: '  ' }).ok).toBe(false);
    });

    it('неизвестная схема отклоняется', () => {
        const result = validateProxy({ ...VALID, scheme: 'gopher' });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/схем/i);
    });

    it('порт вне диапазона отклоняется', () => {
        expect(validateProxy({ ...VALID, port: 0 }).ok).toBe(false);
        expect(validateProxy({ ...VALID, port: 70000 }).ok).toBe(false);
        expect(validateProxy({ ...VALID, port: 'abc' }).ok).toBe(false);
    });

    // Хост подставляется в строку правил, поэтому спецсимволы в нём — способ
    // подсунуть чужой адрес или учётные данные.
    it('отклоняет хост со служебными символами', () => {
        for (const host of ['evil.com/path', 'user@evil.com', 'a b', 'host:1234', 'http://x']) {
            expect(validateProxy({ ...VALID, host }).ok).toBe(false);
        }
    });

    it('сообщение об ошибке на русском и не пустое', () => {
        const result = validateProxy({ ...VALID, host: '' });
        expect(result.message.length).toBeGreaterThan(0);
    });
});

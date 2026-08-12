'use strict';

const SCHEMES = ['socks5', 'socks4', 'http', 'https'];

// Хост подставляется в строку правил Chromium, поэтому допускаем только
// буквы, цифры, точки и дефисы: всё остальное — способ подменить адрес.
const HOST_PATTERN = /^[A-Za-z0-9.-]+$/;

function isEnabled(proxy) {
    return Boolean(proxy && proxy.enabled);
}

function validateProxy(proxy) {
    if (!isEnabled(proxy)) {
        return { ok: true };
    }

    if (!SCHEMES.includes(proxy.scheme)) {
        return { ok: false, message: `Неизвестная схема прокси. Допустимо: ${SCHEMES.join(', ')}` };
    }

    const host = String(proxy.host || '').trim();
    if (!host) {
        return { ok: false, message: 'Не указан адрес прокси' };
    }
    if (!HOST_PATTERN.test(host)) {
        return { ok: false, message: 'Адрес прокси может содержать только буквы, цифры, точки и дефисы' };
    }

    const port = Number(proxy.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { ok: false, message: 'Порт прокси должен быть числом от 1 до 65535' };
    }

    return { ok: true };
}

function buildProxyRules(proxy) {
    if (!isEnabled(proxy)) {
        return null;
    }
    const check = validateProxy(proxy);
    if (!check.ok) {
        throw new Error(check.message);
    }
    return `${proxy.scheme}://${String(proxy.host).trim()}:${Number(proxy.port)}`;
}

module.exports = {
    SCHEMES,
    buildProxyRules,
    validateProxy,
};

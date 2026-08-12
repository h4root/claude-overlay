'use strict';

const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

// Цены за миллион токенов. intro действует до introUntil, после чего
// автоматически возвращается обычная — счётчик не придётся править руками.
const PRICES = {
    'claude-opus-5': { input: 5, output: 25 },
    'claude-sonnet-5': {
        input: 3,
        output: 15,
        intro: { input: 2, output: 10, until: Date.parse('2026-09-01T00:00:00Z') },
    },
    'claude-haiku-4-5': { input: 1, output: 5 },
};

function priceFor(modelId, at = Date.now()) {
    const price = PRICES[modelId];
    if (!price) {
        throw new Error(`Неизвестная модель для расчёта цены: ${modelId}`);
    }
    if (price.intro && at < price.intro.until) {
        return { input: price.intro.input, output: price.intro.output };
    }
    return { input: price.input, output: price.output };
}

function costOf(usage, modelId, at = Date.now()) {
    if (!usage) {
        return 0;
    }
    const price = priceFor(modelId, at);
    const input = usage.input_tokens || 0;
    const output = usage.output_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;

    const dollarsPerToken = price.input / 1_000_000;
    return (
        input * dollarsPerToken +
        cacheWrite * dollarsPerToken * CACHE_WRITE_MULTIPLIER +
        cacheRead * dollarsPerToken * CACHE_READ_MULTIPLIER +
        (output * price.output) / 1_000_000
    );
}

class SessionCost {
    constructor() {
        this.reset();
    }

    add(usage, modelId, at = Date.now()) {
        this.total.requests += 1;
        this.total.inputTokens += (usage && usage.input_tokens) || 0;
        this.total.outputTokens += (usage && usage.output_tokens) || 0;
        try {
            this.total.dollars += costOf(usage, modelId, at);
        } catch (error) {
            // Новая модель, которой ещё нет в таблице цен, не должна ронять сессию.
            console.warn('Стоимость запроса не посчитана:', error.message);
        }
    }

    reset() {
        this.total = { requests: 0, inputTokens: 0, outputTokens: 0, dollars: 0 };
    }
}

function formatUsd(dollars) {
    if (!dollars) {
        return '$0';
    }
    const digits = dollars < 0.1 ? 3 : 2;
    return `$${dollars.toFixed(digits).replace('.', ',')}`;
}

module.exports = {
    PRICES,
    priceFor,
    costOf,
    SessionCost,
    formatUsd,
};

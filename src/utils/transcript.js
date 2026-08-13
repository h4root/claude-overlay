'use strict';

// Десять минут вместо двух: вопрос, который обсуждают до сих пор, мог
// прозвучать давно, а выпадал он молча. Реальный предел объёма — maxChars.
const DEFAULT_WINDOW_MS = 600000;
const DEFAULT_MAX_CHARS = 6000;
const MIN_OVERLAP_WORDS = 2;
// Слова короче этого сравниваем только точно: на «он» и «от» допуск в одну
// букву склеил бы несвязанные реплики.
const MIN_FUZZY_LENGTH = 4;
// Пауза, после которой реплика считается новым куском разговора.
const PAUSE_MS = 45000;
const RECENT_MS = 45000;

function ageLabel(ageMs) {
    if (ageMs < RECENT_MS) {
        return 'только что';
    }
    return `${Math.max(1, Math.round(ageMs / 60000))} мин назад`;
}

function normalizeWord(word) {
    return word
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[.,!?…:;"'«»()-]/g, '');
}

function editDistance(left, right, limit) {
    if (Math.abs(left.length - right.length) > limit) {
        return limit + 1;
    }

    let previous = Array.from({ length: right.length + 1 }, (unused, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
        const current = [i];
        let best = i;
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
            best = Math.min(best, current[j]);
        }
        if (best > limit) {
            return limit + 1;
        }
        previous = current;
    }
    return previous[right.length];
}

// Одну и ту же секунду соседние окна распознают по-разному: чаще всего
// расходится окончание слова. Требовать точного совпадения — значит
// оставлять заикание в расшифровке почти на каждом стыке.
function wordsSimilar(left, right) {
    if (left === right) {
        return true;
    }
    const shortest = Math.min(left.length, right.length);
    if (shortest < MIN_FUZZY_LENGTH) {
        return false;
    }
    const allowance = Math.max(left.length, right.length) >= 8 ? 2 : 1;
    return editDistance(left, right, allowance) <= allowance;
}

function sequencesMatch(left, right) {
    return left.length === right.length && left.every((word, index) => wordsSimilar(word, right[index]));
}

// Соседние окна распознавания перекрываются, поэтому начало нового фрагмента
// повторяет конец предыдущего. Ищем самый длинный такой стык и срезаем его.
function dropRepeatedHead(previous, next) {
    const previousWords = previous.split(/\s+/);
    const nextWords = next.split(/\s+/);
    const limit = Math.min(previousWords.length, nextWords.length);

    for (let size = limit; size >= MIN_OVERLAP_WORDS; size -= 1) {
        const tail = previousWords.slice(previousWords.length - size).map(normalizeWord);
        const head = nextWords.slice(0, size).map(normalizeWord);
        if (sequencesMatch(tail, head)) {
            return nextWords.slice(size).join(' ');
        }
    }
    return next;
}

class RollingTranscript {
    constructor({ windowMs = DEFAULT_WINDOW_MS, maxChars = DEFAULT_MAX_CHARS } = {}) {
        this.windowMs = windowMs;
        this.maxChars = maxChars;
        this.entries = [];
    }

    add(text, at = Date.now()) {
        const clean = String(text || '').trim();
        if (!clean) {
            return;
        }
        const previous = this.entries.at(-1);
        if (previous && previous.text === clean) {
            previous.at = at;
            return;
        }

        const trimmed = previous ? dropRepeatedHead(previous.text, clean) : clean;
        if (!trimmed) {
            previous.at = at;
            return;
        }

        this.entries.push({ text: trimmed, at });
        this.prune(at);
    }

    prune(now = Date.now()) {
        const cutoff = now - this.windowMs;
        this.entries = this.entries.filter(entry => entry.at >= cutoff);

        // Обрезаем целыми репликами: резать строку посередине слова значит
        // отдать модели обрубок без начала фразы.
        let total = this.entries.reduce((sum, entry) => sum + entry.text.length + 1, 0);
        while (this.entries.length > 1 && total > this.maxChars) {
            total -= this.entries[0].text.length + 1;
            this.entries.shift();
        }
    }

    text(now = Date.now()) {
        this.prune(now);
        return this.entries.map(entry => entry.text).join(' ');
    }

    // Для запроса к модели: давность видна явно, иначе трёхминутной давности
    // вопрос неотличим от прозвучавшего только что.
    formatted(now = Date.now(), { maxAgeMs } = {}) {
        this.prune(now);

        // Срез только фильтрует выдачу: голосовое окно спрашивает по последним
        // секундам, но десятиминутная память основного окна должна уцелеть.
        const visible = maxAgeMs ? this.entries.filter(entry => now - entry.at <= maxAgeMs) : this.entries;
        if (visible.length === 0) {
            return '';
        }

        const groups = [];
        for (const entry of visible) {
            const last = groups.at(-1);
            if (!last || entry.at - last.at >= PAUSE_MS) {
                groups.push({ at: entry.at, parts: [entry.text] });
            } else {
                last.at = entry.at;
                last.parts.push(entry.text);
            }
        }

        return groups.map(group => `[${ageLabel(now - group.at)}] ${group.parts.join(' ')}`).join('\n');
    }

    clear() {
        this.entries = [];
    }
}

module.exports = {
    DEFAULT_WINDOW_MS,
    PAUSE_MS,
    ageLabel,
    RollingTranscript,
};

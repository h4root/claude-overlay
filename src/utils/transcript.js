'use strict';

const DEFAULT_WINDOW_MS = 120000;
const DEFAULT_MAX_CHARS = 6000;
const MIN_OVERLAP_WORDS = 2;

function normalizeWord(word) {
    return word.toLowerCase().replace(/[.,!?…:;"'«»()-]/g, '');
}

function wordsEqual(left, right) {
    return left.length === right.length && left.every((word, index) => word === right[index]);
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
        if (wordsEqual(tail, head)) {
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
    }

    text(now = Date.now()) {
        this.prune(now);
        const joined = this.entries.map(entry => entry.text).join(' ');
        return joined.length > this.maxChars ? joined.slice(joined.length - this.maxChars) : joined;
    }

    clear() {
        this.entries = [];
    }
}

module.exports = {
    DEFAULT_WINDOW_MS,
    RollingTranscript,
};

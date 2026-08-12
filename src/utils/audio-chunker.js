'use strict';

const DEFAULT_CHUNK_SECONDS = 10;
const DEFAULT_OVERLAP_SECONDS = 1;
const DEFAULT_MIN_FLUSH_SECONDS = 0.5;

class ChunkAccumulator {
    constructor({
        sampleRate,
        chunkSeconds = DEFAULT_CHUNK_SECONDS,
        overlapSeconds = DEFAULT_OVERLAP_SECONDS,
        minFlushSeconds = DEFAULT_MIN_FLUSH_SECONDS,
    }) {
        if (overlapSeconds >= chunkSeconds) {
            throw new Error('Перехлёст должен быть короче окна');
        }
        this.chunkSamples = Math.round(sampleRate * chunkSeconds);
        this.overlapSamples = Math.round(sampleRate * overlapSeconds);
        this.minFlushSamples = Math.round(sampleRate * minFlushSeconds);
        this.buffer = new Float32Array(0);
    }

    push(block) {
        const merged = new Float32Array(this.buffer.length + block.length);
        merged.set(this.buffer, 0);
        merged.set(block, this.buffer.length);
        this.buffer = merged;

        if (this.buffer.length < this.chunkSamples) {
            return null;
        }

        const chunk = this.buffer.slice(0, this.buffer.length);
        this.buffer = this.buffer.slice(this.buffer.length - this.overlapSamples);
        return chunk;
    }

    // Отдаёт недобранное окно по требованию: ждать его конца значит потерять
    // самую свежую реплику — как раз ту, ради которой нажимают хоткей.
    flush() {
        if (this.buffer.length < this.minFlushSamples) {
            return null;
        }
        const chunk = this.buffer.slice(0);
        this.buffer = this.buffer.slice(Math.max(0, this.buffer.length - this.overlapSamples));
        return chunk;
    }

    reset() {
        this.buffer = new Float32Array(0);
    }
}

module.exports = {
    DEFAULT_CHUNK_SECONDS,
    ChunkAccumulator,
};

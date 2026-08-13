'use strict';

const WAV_HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;
const SILENCE_THRESHOLD = 0.006;
const FRAME_MS = 20;
const PADDING_MS = 100;

function clampToInt16(value) {
    if (value > 1) return 32767;
    if (value < -1) return -32768;
    return Math.round(value < 0 ? value * 32768 : value * 32767);
}

function encodeWav(samples, sampleRate) {
    const dataBytes = samples.length * BYTES_PER_SAMPLE;
    const buffer = Buffer.alloc(WAV_HEADER_BYTES + dataBytes);

    buffer.write('RIFF', 0, 'latin1');
    buffer.writeUInt32LE(36 + dataBytes, 4);
    buffer.write('WAVE', 8, 'latin1');
    buffer.write('fmt ', 12, 'latin1');
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * BYTES_PER_SAMPLE, 28);
    buffer.writeUInt16LE(BYTES_PER_SAMPLE, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36, 'latin1');
    buffer.writeUInt32LE(dataBytes, 40);

    for (let index = 0; index < samples.length; index += 1) {
        buffer.writeInt16LE(clampToInt16(samples[index]), WAV_HEADER_BYTES + index * BYTES_PER_SAMPLE);
    }

    return buffer;
}

function rms(samples) {
    if (samples.length === 0) {
        return 0;
    }
    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) {
        sum += samples[index] * samples[index];
    }
    return Math.sqrt(sum / samples.length);
}

function isSilent(samples, threshold = SILENCE_THRESHOLD) {
    return rms(samples) < threshold;
}

// Средний RMS по всему окну пропускает кусок, где секунда речи и девять
// секунд тишины. Whisper на тихой части выдумывает текст, поэтому в него
// должна попадать только речь плюс небольшой запас на атаку и затухание.
function trimSilence(samples, sampleRate, threshold = SILENCE_THRESHOLD) {
    const frame = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
    let first = -1;
    let last = -1;

    for (let start = 0; start < samples.length; start += frame) {
        if (rms(samples.subarray(start, Math.min(start + frame, samples.length))) >= threshold) {
            if (first === -1) {
                first = start;
            }
            last = Math.min(start + frame, samples.length);
        }
    }

    if (first === -1) {
        return new Float32Array(0);
    }

    const padding = Math.round((sampleRate * PADDING_MS) / 1000);
    return samples.slice(Math.max(0, first - padding), Math.min(samples.length, last + padding));
}

module.exports = {
    SILENCE_THRESHOLD,
    trimSilence,
    encodeWav,
    rms,
    isSilent,
};

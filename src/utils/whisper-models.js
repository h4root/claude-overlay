'use strict';

const path = require('path');

const BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';

// Medium убран намеренно: у turbo 809M параметров против 769M, то есть та же
// память, но качество уровня large и вчетверо меньше декодерных слоёв.
// Контрольные суммы сняты с файлов, скачанных 2026-08-11. Несовпадение при
// повторной загрузке означает подмену или битую закачку — файл отбрасывается.
const WHISPER_MODELS = [
    {
        id: 'small',
        label: 'Small',
        hint: 'Экономит память. На шумном звонке заметно ошибается.',
        file: 'ggml-small-q5_1.bin',
        sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb',
        sizeBytes: 190085487,
        ramMb: 600,
    },
    {
        id: 'large-v3-turbo',
        label: 'Large v3 Turbo',
        hint: 'Лучше всех держит плохой микрофон и VoIP-кодек.',
        file: 'ggml-large-v3-turbo-q5_0.bin',
        sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
        sizeBytes: 574041195,
        ramMb: 1600,
    },
].map(model => ({ ...model, url: BASE_URL + model.file }));

function getWhisperModel(id) {
    const model = WHISPER_MODELS.find(candidate => candidate.id === id);
    if (!model) {
        throw new Error(`Неизвестная модель whisper: ${id}`);
    }
    return model;
}

function modelFilePath(modelsDir, id) {
    return path.join(modelsDir, getWhisperModel(id).file);
}

module.exports = {
    WHISPER_MODELS,
    getWhisperModel,
    modelFilePath,
};

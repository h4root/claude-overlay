'use strict';

const { ipcMain, desktopCapturer, screen } = require('electron');
const storage = require('../storage');

// Claude принимает изображения до 2576 px по длинной стороне; выше — только рост
// стоимости в токенах. Ниже 1024 мелкий текст на скриншоте становится нечитаемым.
const QUALITY_LONG_EDGE = {
    low: 1024,
    medium: 1568,
    high: 2200,
};

function targetSize(display, quality) {
    const longEdge = QUALITY_LONG_EDGE[quality] || QUALITY_LONG_EDGE.medium;
    const { width, height } = display.size;
    const scale = Math.min(1, longEdge / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function captureActiveDisplay() {
    const preferences = storage.getPreferences();
    // По умолчанию снимаем основной монитор: следование за курсором на двух
    // экранах регулярно снимает не то, что человек в этот момент смотрит.
    const display =
        preferences.captureDisplay === 'cursor' ? screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) : screen.getPrimaryDisplay();
    const quality = preferences.imageQuality;
    const thumbnailSize = targetSize(display, quality);

    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
    const source = sources.find(candidate => String(candidate.display_id) === String(display.id)) || sources[0];

    if (!source || source.thumbnail.isEmpty()) {
        throw new Error('Не удалось снять экран. Проверь разрешение «Запись экрана» в настройках системы.');
    }

    return {
        mediaType: 'image/jpeg',
        data: source.thumbnail.toJPEG(80).toString('base64'),
        width: thumbnailSize.width,
        height: thumbnailSize.height,
    };
}

function setupCaptureIpcHandlers() {
    ipcMain.handle('capture:displays', async () => displayCount());

    ipcMain.handle('capture:screen', async () => {
        try {
            return { success: true, data: await captureActiveDisplay() };
        } catch (error) {
            console.error('Ошибка захвата экрана:', error.message);
            return { success: false, error: error.message };
        }
    });
}

function displayCount() {
    return screen.getAllDisplays().length;
}

module.exports = {
    captureActiveDisplay,
    displayCount,
    setupCaptureIpcHandlers,
};

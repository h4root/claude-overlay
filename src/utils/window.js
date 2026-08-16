'use strict';

const { BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer, session, app } = require('electron');
const path = require('node:path');
const storage = require('../storage');
const { mergeKeybinds, defaultKeybinds } = require('./keybinds');
const { purgeNow } = require('./whisper');
const { clampToWorkArea } = require('./geometry');

const SETUP_SIZE = { width: 760, height: 560 };
const SESSION_SIZE = { width: 520, height: 540 };
const VOICE_SIZE = { width: 400, height: 300 };
const HINTS_SIZE = { width: 240, height: 112 };
const HINTS_MARGIN = 16;
const MIN_SIZE = { width: 360, height: 220 };

let clickThrough = false;
let contentProtected = false;
let failedKeybinds = [];

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: SETUP_SIZE.width,
        height: SETUP_SIZE.height,
        minWidth: MIN_SIZE.width,
        minHeight: MIN_SIZE.height,
        resizable: true,
        frame: false,
        transparent: true,
        hasShadow: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
            enableBlinkFeatures: 'GetDisplayMedia',
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
    });

    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer
            .getSources({ types: ['screen'] })
            .then(sources => callback({ video: sources[0], audio: 'loopback' }))
            .catch(() => callback({}));
    });

    applyContentProtection(mainWindow, true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    if (process.platform === 'darwin') {
        try {
            mainWindow.setHiddenInMissionControl(true);
        } catch (error) {
            console.warn('Не удалось скрыть окно из Mission Control:', error.message);
        }
    }

    mainWindow.loadFile(path.join(__dirname, '../index.html'));

    mainWindow.webContents.once('dom-ready', () => {
        updateGlobalShortcuts(mergeKeybinds(storage.getKeybinds()), mainWindow);
    });

    setupWindowIpcHandlers(mainWindow);

    return mainWindow;
}

// Попап живёт отдельным окном: расшифровка и ответы по речи не должны
// мешать работе с основным чатом по экрану.
function createVoiceWindow() {
    const { workArea } = screen.getPrimaryDisplay();
    const voiceWindow = new BrowserWindow({
        width: VOICE_SIZE.width,
        height: VOICE_SIZE.height,
        x: workArea.x + workArea.width - VOICE_SIZE.width - 24,
        y: workArea.y + workArea.height - VOICE_SIZE.height - 24,
        minWidth: 280,
        minHeight: 160,
        resizable: true,
        frame: false,
        transparent: true,
        hasShadow: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        show: false,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
        },
    });

    applyContentProtection(voiceWindow, true);
    voiceWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    voiceWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (process.platform === 'darwin') {
        try {
            voiceWindow.setHiddenInMissionControl(true);
        } catch (error) {
            console.warn('Не удалось скрыть попап из Mission Control:', error.message);
        }
    }

    voiceWindow.loadFile(path.join(__dirname, '../voice.html'));
    return voiceWindow;
}

// Подсказки живут отдельным окном у края экрана: рядом с доком почти всегда
// есть пустое место, а во весь экран приложение разворачивают редко.
function hintsPosition(corner) {
    const { workArea } = screen.getPrimaryDisplay();
    const left = workArea.x + HINTS_MARGIN;
    const right = workArea.x + workArea.width - HINTS_SIZE.width - HINTS_MARGIN;
    const top = workArea.y + HINTS_MARGIN;
    const bottom = workArea.y + workArea.height - HINTS_SIZE.height - HINTS_MARGIN;

    switch (corner) {
        case 'top-left':
            return { x: left, y: top };
        case 'top-right':
            return { x: right, y: top };
        case 'bottom-left':
            return { x: left, y: bottom };
        default:
            return { x: right, y: bottom };
    }
}

function createHintsWindow() {
    const corner = storage.getPreferences().hintsCorner;
    const { x, y } = hintsPosition(corner);

    const hintsWindow = new BrowserWindow({
        width: HINTS_SIZE.width,
        height: HINTS_SIZE.height,
        x,
        y,
        resizable: false,
        frame: false,
        transparent: true,
        hasShadow: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        focusable: false,
        show: false,
        backgroundColor: '#00000000',
        webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false },
    });

    applyContentProtection(hintsWindow, true);
    hintsWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    hintsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Подсказки только читают: клики должны доходить до окна под ними.
    hintsWindow.setIgnoreMouseEvents(true, { forward: true });
    if (process.platform === 'darwin') {
        try {
            hintsWindow.setHiddenInMissionControl(true);
        } catch (error) {
            console.warn('Не удалось скрыть подсказки из Mission Control:', error.message);
        }
    }

    hintsWindow.loadFile(path.join(__dirname, '../hints.html'));
    return hintsWindow;
}

function moveHints(hintsWindow, corner) {
    if (!hintsWindow || hintsWindow.isDestroyed()) return;
    const { x, y } = hintsPosition(corner);
    hintsWindow.setPosition(x, y);
}

// Окно не должно уезжать за край: оттуда его уже не достать ни мышью,
// ни стрелками, потому что заголовка не видно.
function keepOnScreen(targetWindow, dx = 0, dy = 0) {
    if (!targetWindow || targetWindow.isDestroyed()) return;
    const [x, y] = targetWindow.getPosition();
    const [width, height] = targetWindow.getSize();
    const { workArea } = screen.getDisplayNearestPoint({ x, y });
    const next = clampToWorkArea({ x: x + dx, y: y + dy, width, height }, workArea);
    targetWindow.setPosition(next.x, next.y);
}

// Единственное место, где меняется защита: иначе флаг для индикатора
// незаметно разъезжается с реальным состоянием окна.
function applyContentProtection(targetWindow, enabled) {
    targetWindow.setContentProtection(enabled);
    contentProtected = enabled;
}

function updateGlobalShortcuts(keybinds, mainWindow) {
    globalShortcut.unregisterAll();

    const emit = channel => () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel);
        }
    };

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const step = Math.floor(Math.min(width, height) * 0.1);

    const move = (dx, dy) => () => {
        if (!mainWindow.isVisible()) return;
        keepOnScreen(mainWindow, dx * step, dy * step);
    };

    const actions = {
        capture: emit('shortcut:capture'),
        toggleHints: emit('shortcut:toggle-hints'),
        askVoice: emit('shortcut:ask-voice'),
        listen: emit('shortcut:listen'),
        scrollUp: emit('shortcut:scroll-up'),
        scrollDown: emit('shortcut:scroll-down'),
        newSession: emit('shortcut:new-session'),
        moveUp: move(0, -1),
        moveDown: move(0, 1),
        moveLeft: move(-1, 0),
        moveRight: move(1, 0),
        toggleVisibility: () => {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                // Экран мог смениться, пока окно было скрыто: возвращаем его
                // в видимую область до показа.
                keepOnScreen(mainWindow);
                // showInactive: фокус остаётся в приложении, поверх которого висит оверлей.
                mainWindow.showInactive();
            }
        },
        toggleClickThrough: () => {
            clickThrough = !clickThrough;
            mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
            mainWindow.webContents.send('click-through-toggled', clickThrough);
        },
        panic: () => {
            mainWindow.hide();
            // Сначала синхронно убиваем whisper и стираем временные файлы:
            // после app.quit() никакой finally уже не отработает.
            purgeNow();
            mainWindow.webContents.send('shortcut:panic');
            setTimeout(() => app.quit(), 200);
        },
    };

    // register возвращает false, а не бросает исключение: занятое системой
    // сочетание иначе провалилось бы совершенно молча.
    failedKeybinds = [];
    for (const [action, handler] of Object.entries(actions)) {
        const accelerator = keybinds[action];
        if (!accelerator) continue;
        let registered = false;
        try {
            registered = globalShortcut.register(accelerator, handler);
        } catch (error) {
            registered = false;
        }
        if (!registered) {
            failedKeybinds.push({ action, accelerator });
            console.error(`Сочетание занято, не зарегистрировано: ${action} (${accelerator})`);
        }
    }
    return failedKeybinds;
}

function setupWindowIpcHandlers(mainWindow) {
    ipcMain.handle('window:minimize', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }
    });

    ipcMain.handle('window:hide', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.hide();
        }
    });

    ipcMain.handle('window:mode', (event, mode) => {
        if (mainWindow.isDestroyed()) return;
        const size = mode === 'session' ? SESSION_SIZE : SETUP_SIZE;
        mainWindow.setSize(size.width, size.height, true);
        keepOnScreen(mainWindow);
    });

    ipcMain.handle('window:content-protected', () => contentProtected);

    ipcMain.handle('keybinds:get', () => ({
        keybinds: mergeKeybinds(storage.getKeybinds()),
        defaults: defaultKeybinds(),
        failed: failedKeybinds,
    }));

    ipcMain.handle('keybinds:set', (event, keybinds) => {
        const merged = mergeKeybinds(keybinds);
        storage.setKeybinds(merged);
        const failed = updateGlobalShortcuts(merged, mainWindow);
        // Подсказки показывают сочетания и должны обновиться сразу.
        for (const target of BrowserWindow.getAllWindows()) {
            if (!target.isDestroyed()) {
                target.webContents.send('keybinds:changed');
            }
        }
        return { keybinds: merged, failed };
    });
}

module.exports = {
    createWindow,
    createVoiceWindow,
    createHintsWindow,
    moveHints,
    updateGlobalShortcuts,
};

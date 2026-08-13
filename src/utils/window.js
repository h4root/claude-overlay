'use strict';

const { BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer, session, app } = require('electron');
const path = require('node:path');
const storage = require('../storage');
const { mergeKeybinds, defaultKeybinds } = require('./keybinds');
const { purgeNow } = require('./whisper');

const SETUP_SIZE = { width: 560, height: 620 };
const SESSION_SIZE = { width: 480, height: 380 };
const VOICE_SIZE = { width: 400, height: 300 };
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
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(x + dx * step, y + dy * step);
    };

    const actions = {
        capture: emit('shortcut:capture'),
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
        return { keybinds: merged, failed };
    });
}

module.exports = {
    createWindow,
    createVoiceWindow,
    updateGlobalShortcuts,
};

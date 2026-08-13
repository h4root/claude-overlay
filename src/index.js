'use strict';

if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain, desktopCapturer, session, powerMonitor } = require('electron');
const { createWindow, createVoiceWindow, updateGlobalShortcuts } = require('./utils/window');
const { mergeKeybinds } = require('./utils/keybinds');
const claude = require('./utils/claude');
const audio = require('./utils/audio');
const { setupCaptureIpcHandlers } = require('./utils/capture');
const { purgeNow, purgeOrphans } = require('./utils/whisper');
const sessions = require('./utils/sessions');
const storage = require('./storage');
const { buildProxyRules, validateProxy } = require('./utils/proxy');
const { normalizeBaseUrl } = require('./utils/claude-client');

let mainWindow = null;
let voiceWindow = null;

function createMainWindow() {
    mainWindow = createWindow();
    voiceWindow = createVoiceWindow();

    claude.setWindow('main', mainWindow);
    claude.setWindow('voice', voiceWindow);
    audio.setWindows([mainWindow, voiceWindow]);

    return mainWindow;
}

// Приложение не должно падать посреди встречи из-за необработанной ошибки:
// логируем и продолжаем работать.
process.on('uncaughtException', error => {
    console.error('Необработанное исключение:', error && error.message);
});
process.on('unhandledRejection', reason => {
    console.error('Необработанный отказ промиса:', reason && reason.message ? reason.message : reason);
});

app.on('before-quit', () => {
    sessions.finishSession();
    purgeNow();
});

app.whenReady().then(async () => {
    storage.initializeStorage();

    const orphans = purgeOrphans();
    if (orphans) {
        console.log(`Подчищено осиротевших временных файлов: ${orphans}`);
    }

    if (process.platform === 'darwin') {
        // Провоцируем системный запрос прав на запись экрана до первого хоткея.
        desktopCapturer.getSources({ types: ['screen'] }).catch(() => {});
    }

    await applyProxy();
    createMainWindow();
    claude.setupClaudeIpcHandlers();
    audio.setupAudioIpcHandlers();
    setupCaptureIpcHandlers();
    setupStorageIpcHandlers();
    setupGeneralIpcHandlers();
    setupPowerHandlers();
});

// После сна поток захвата и права на него ведут себя непредсказуемо, поэтому
// сессию честно закрываем и просим начать заново — вместо тихой поломки.
function setupPowerHandlers() {
    powerMonitor.on('suspend', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('power:suspend');
        }
    });
    powerMonitor.on('resume', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('power:resume');
        }
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Прокси применяется к сессии целиком: запросы к API идут через net.fetch,
// то есть через сетевой стек Chromium.
async function applyProxy() {
    const { proxy } = storage.getConfig();
    const rules = buildProxyRules(proxy);
    if (rules) {
        await session.defaultSession.setProxy({ proxyRules: rules, proxyBypassRules: '<local>' });
        console.log(`Прокси включён: ${proxy.scheme}://${proxy.host}:${proxy.port}`);
    } else {
        await session.defaultSession.setProxy({ mode: 'direct' });
    }
}

function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return { success: true, data: await fn(...args) };
        } catch (error) {
            console.error(`IPC ${channel}:`, error.message);
            return { success: false, error: error.message };
        }
    });
}

function setupStorageIpcHandlers() {
    handle('storage:get-config', () => storage.getConfig());
    handle('storage:update-config', (key, value) => storage.updateConfig(key, value));
    handle('storage:get-preferences', () => storage.getPreferences());
    handle('storage:update-preference', (key, value) => storage.updatePreference(key, value));
    handle('storage:get-keybinds', () => mergeKeybinds(storage.getKeybinds()));
    handle('storage:clear-all', () => storage.clearAllData());

    handle('proxy:set', async proxy => {
        const check = validateProxy(proxy);
        if (!check.ok) {
            throw new Error(check.message);
        }
        storage.updateConfig('proxy', proxy);
        await applyProxy();
        return true;
    });

    handle('base-url:set', value => {
        // Проверяем до сохранения: неверный адрес не должен доживать до запроса.
        normalizeBaseUrl(value);
        storage.updateConfig('baseUrl', String(value || '').trim());
        return true;
    });

    handle('storage:has-api-key', () => Boolean(storage.getApiKey()));
    handle('storage:set-api-key', apiKey => storage.setApiKey(apiKey));
}

function setupGeneralIpcHandlers() {
    handle('get-app-version', () => app.getVersion());

    handle('session:start', context => sessions.startSession(context));
    handle('session:finish', () => sessions.finishSession());
    handle('session:current', () => sessions.currentSession());
    handle('session:list', limit => sessions.listSessions(limit));

    handle('session:open', async id => {
        const found = sessions.listSessions(200).find(item => item.id === id) || sessions.currentSession();
        if (!found) {
            throw new Error('Сессия не найдена');
        }
        await shell.openPath(found.dir);
        return found.dir;
    });

    handle('voice:show', () => {
        if (voiceWindow && !voiceWindow.isDestroyed()) {
            voiceWindow.showInactive();
        }
    });

    handle('voice:hide', () => {
        if (voiceWindow && !voiceWindow.isDestroyed()) {
            voiceWindow.hide();
        }
    });

    handle('quit-application', () => {
        app.quit();
    });

    handle('open-external', async url => {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            throw new Error('Разрешены только https-ссылки');
        }
        await shell.openExternal(url);
    });
}

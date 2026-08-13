'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_VERSION = 1;

const DEFAULT_CONFIG = {
    configVersion: CONFIG_VERSION,
    model: 'claude-sonnet-5',
    effort: 'medium',
    baseUrl: '',
    voiceModel: 'claude-sonnet-5',
    voiceEffort: 'low',
    proxy: { enabled: false, scheme: 'socks5', host: '127.0.0.1', port: 1080 },
};

const DEFAULT_CREDENTIALS = {
    apiKey: '',
};

const DEFAULT_PREFERENCES = {
    profile: 'meeting',
    customPrompt: '',
    defaultPrompt: 'Проанализируй экран и помоги с тем, что на нём происходит.',
    imageQuality: 'high',
    fontSize: 'medium',
    backgroundTransparency: 0.75,
    whisperModel: 'large-v3-turbo',
    whisperLanguage: 'ru',
    listenInSession: true,
    captureDisplay: 'primary',
    hintsCorner: 'bottom-right',
    hintsVisible: true,
    transcriptWithScreenshot: false,
    transcriptWindowMinutes: 10,
    voicePrompt: 'Ответь на то, что сейчас прозвучало в разговоре.',
};

function getConfigDir() {
    const platform = os.platform();
    if (platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'claude-overlay');
    }
    if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'claude-overlay');
    }
    return path.join(os.homedir(), '.config', 'claude-overlay');
}

const paths = {
    config: () => path.join(getConfigDir(), 'config.json'),
    credentials: () => path.join(getConfigDir(), 'credentials.json'),
    preferences: () => path.join(getConfigDir(), 'preferences.json'),
    keybinds: () => path.join(getConfigDir(), 'keybinds.json'),
};

function readJson(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return { ...fallback, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
        }
    } catch (error) {
        console.warn(`Не удалось прочитать ${path.basename(filePath)}: ${error.message}`);
    }
    return { ...fallback };
}

function writeJson(filePath, data, mode) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode });
    if (mode) {
        fs.chmodSync(filePath, mode);
    }
}

function initializeStorage() {
    const dir = getConfigDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const config = readJson(paths.config(), DEFAULT_CONFIG);
    if (config.configVersion !== CONFIG_VERSION) {
        writeJson(paths.config(), DEFAULT_CONFIG);
    }
}

const getConfig = () => readJson(paths.config(), DEFAULT_CONFIG);
const setConfig = config => writeJson(paths.config(), { ...getConfig(), ...config });
const updateConfig = (key, value) => setConfig({ [key]: value });

const getPreferences = () => readJson(paths.preferences(), DEFAULT_PREFERENCES);
const setPreferences = preferences => writeJson(paths.preferences(), { ...getPreferences(), ...preferences });
const updatePreference = (key, value) => setPreferences({ [key]: value });

const getApiKey = () => readJson(paths.credentials(), DEFAULT_CREDENTIALS).apiKey || '';
const setApiKey = apiKey => writeJson(paths.credentials(), { apiKey: (apiKey || '').trim() }, 0o600);

const getKeybinds = () => (fs.existsSync(paths.keybinds()) ? readJson(paths.keybinds(), {}) : null);
const setKeybinds = keybinds => writeJson(paths.keybinds(), keybinds);

function clearAllData() {
    for (const getPath of Object.values(paths)) {
        const filePath = getPath();
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { force: true });
        }
    }
    initializeStorage();
}

module.exports = {
    getConfigDir,
    initializeStorage,
    getConfig,
    setConfig,
    updateConfig,
    getPreferences,
    setPreferences,
    updatePreference,
    getApiKey,
    setApiKey,
    getKeybinds,
    setKeybinds,
    clearAllData,
};

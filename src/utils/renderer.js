'use strict';

const { ipcRenderer } = require('electron');
const audioCapture = require('./utils/audio-capture');
const { buildHealth, overallState } = require('./utils/health');
const { SessionCost, formatUsd } = require('./utils/pricing');
const keybindsModule = require('./utils/keybinds');
const { debounce } = require('./utils/debounce');

const sessionCost = new SessionCost();

async function unwrap(channel, ...args) {
    const result = await ipcRenderer.invoke(channel, ...args);
    if (result && result.success === false) {
        throw new Error(result.error || `Ошибка вызова ${channel}`);
    }
    return result && 'data' in result ? result.data : result;
}

const overlay = {
    version: () => unwrap('get-app-version'),
    quit: () => unwrap('quit-application'),
    openExternal: url => unwrap('open-external', url),

    window: {
        hide: () => ipcRenderer.invoke('window:hide'),
        minimize: () => ipcRenderer.invoke('window:minimize'),
        setMode: mode => ipcRenderer.invoke('window:mode', mode),
        isContentProtected: () => ipcRenderer.invoke('window:content-protected'),
    },

    storage: {
        getConfig: () => unwrap('storage:get-config'),
        updateConfig: (key, value) => unwrap('storage:update-config', key, value),
        getPreferences: () => unwrap('storage:get-preferences'),
        updatePreference: (key, value) => unwrap('storage:update-preference', key, value),
        getKeybinds: () => unwrap('storage:get-keybinds'),
        hasApiKey: () => unwrap('storage:has-api-key'),
        setApiKey: apiKey => unwrap('storage:set-api-key', apiKey),
        clearAll: () => unwrap('storage:clear-all'),
        setProxy: proxy => unwrap('proxy:set', proxy),
    },

    models: () => ipcRenderer.invoke('claude:models'),
    displays: () => ipcRenderer.invoke('capture:displays'),
    debounce: (fn, ms) => debounce(fn, ms),

    async captureScreen() {
        const result = await ipcRenderer.invoke('capture:screen');
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.data;
    },

    listen: {
        start: onStatus => audioCapture.start(onStatus),
        stop: () => audioCapture.stop(),
        isActive: () => audioCapture.isActive(),
        transcript: () => ipcRenderer.invoke('audio:transcript'),
        flush: () => ipcRenderer.invoke('audio:flush', audioCapture.takePending()),
        clear: () => ipcRenderer.invoke('audio:clear-transcript'),
    },

    session: {
        start: context => unwrap('session:start', context),
        finish: () => unwrap('session:finish'),
        current: () => unwrap('session:current'),
        list: limit => unwrap('session:list', limit),
        open: id => unwrap('session:open', id),
    },

    voice: {
        show: () => ipcRenderer.invoke('voice:show'),
        hide: () => ipcRenderer.invoke('voice:hide'),
    },

    keybinds: {
        load: () => ipcRenderer.invoke('keybinds:get'),
        save: keybinds => ipcRenderer.invoke('keybinds:set', keybinds),
        actions: () => keybindsModule.ACTIONS,
        fromEvent: event => keybindsModule.acceleratorFromEvent(event),
        conflicts: map => keybindsModule.findConflicts(map),
    },

    whisper: {
        models: () => ipcRenderer.invoke('whisper:models'),
        download: id => ipcRenderer.invoke('whisper:download', id),
    },

    health: {
        build: input => buildHealth(input),
        overall: report => overallState(report),
    },

    cost: {
        add: (usage, model) => sessionCost.add(usage, model),
        total: () => sessionCost.total,
        reset: () => sessionCost.reset(),
        format: dollars => formatUsd(dollars),
    },

    testKey: () => ipcRenderer.invoke('claude:test-key'),
    ask: payload => ipcRenderer.invoke('claude:ask', payload),
    cancel: () => ipcRenderer.invoke('claude:cancel'),
    resetConversation: (id = 'main') => ipcRenderer.invoke('claude:reset', id),

    on(channel, handler) {
        const listener = (event, payload) => handler(payload);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },
};

window.overlay = overlay;

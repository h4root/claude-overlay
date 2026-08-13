'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const storage = require('../storage');
const { sessionDirName, shotFileName, encodeLogLine } = require('./session-log');

const LOG_FILE = 'log.jsonl';
const META_FILE = 'session.json';
const SHOTS_DIR = 'shots';

let current = null;

function sessionsRoot() {
    return path.join(storage.getConfigDir(), 'sessions');
}

function writeMeta() {
    if (!current) return;
    fs.writeFileSync(path.join(current.dir, META_FILE), JSON.stringify(current.meta, null, 2), { encoding: 'utf8', mode: 0o600 });
}

function startSession(context = {}) {
    finishSession();

    const startedAt = Date.now();
    const date = new Date(startedAt);
    const id = sessionDirName(date, crypto.randomBytes(2).toString('hex'));
    const dir = path.join(sessionsRoot(), id);

    fs.mkdirSync(path.join(dir, SHOTS_DIR), { recursive: true, mode: 0o700 });

    current = {
        id,
        dir,
        startedAt,
        shots: 0,
        meta: {
            id,
            startedAt: date.toISOString(),
            finishedAt: null,
            ...context,
            totals: { requests: 0, inputTokens: 0, outputTokens: 0, dollars: 0, shots: 0, errors: 0 },
        },
    };

    writeMeta();
    logEntry({ kind: 'start', ...context });
    return { id, dir };
}

function logEntry(entry) {
    if (!current) return;
    const line = encodeLogLine({ at: Date.now(), ...entry }, current.startedAt);
    fs.appendFileSync(path.join(current.dir, LOG_FILE), `${line}\n`, { encoding: 'utf8', mode: 0o600 });
}

// Кадр кладём как есть, тем же JPEG, что ушёл в модель: пересжатие сделало бы
// запись расходящейся с тем, что на самом деле видел Claude.
function saveShot(base64) {
    if (!current) return null;
    current.shots += 1;
    const name = shotFileName(current.shots);
    fs.writeFileSync(path.join(current.dir, SHOTS_DIR, name), Buffer.from(base64, 'base64'), { mode: 0o600 });
    current.meta.totals.shots = current.shots;
    return current.shots;
}

function recordUsage({ inputTokens = 0, outputTokens = 0, dollars = 0 }) {
    if (!current) return;
    const totals = current.meta.totals;
    totals.requests += 1;
    totals.inputTokens += inputTokens;
    totals.outputTokens += outputTokens;
    totals.dollars += dollars;
    writeMeta();
}

function recordError() {
    if (!current) return;
    current.meta.totals.errors += 1;
    writeMeta();
}

function finishSession() {
    if (!current) return null;
    logEntry({ kind: 'end' });
    current.meta.finishedAt = new Date().toISOString();
    current.meta.durationSeconds = Math.round((Date.now() - current.startedAt) / 1000);
    writeMeta();
    const finished = { id: current.id, dir: current.dir };
    current = null;
    return finished;
}

function currentSession() {
    return current ? { id: current.id, dir: current.dir } : null;
}

// Читаем только метаданные: лог и кадры могут быть большими, а списку нужен
// лишь заголовок.
function listSessions(limit = 30) {
    const root = sessionsRoot();
    if (!fs.existsSync(root)) {
        return [];
    }
    return fs
        .readdirSync(root)
        .sort()
        .reverse()
        .slice(0, limit)
        .map(id => {
            try {
                const meta = JSON.parse(fs.readFileSync(path.join(root, id, META_FILE), 'utf8'));
                return { ...meta, dir: path.join(root, id) };
            } catch {
                return { id, dir: path.join(root, id), broken: true };
            }
        });
}

module.exports = {
    sessionsRoot,
    startSession,
    finishSession,
    currentSession,
    logEntry,
    saveShot,
    recordUsage,
    recordError,
    listSessions,
};

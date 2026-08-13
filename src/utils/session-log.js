'use strict';

const KEYS = {
    text: 'x',
    prompt: 'q',
    shot: 's',
    withTranscript: 'tr',
    inputTokens: 'i',
    outputTokens: 'o',
    dollars: 'c',
    model: 'm',
    effort: 'e',
    profile: 'p',
    message: 'msg',
};

function pad(value, width) {
    return String(value).padStart(width, '0');
}

// Имя сортируется как время: каталоги сессий выстраиваются по порядку сами,
// без чтения метаданных.
function sessionDirName(date, suffix = '') {
    const parts = [
        date.getFullYear(),
        '-',
        pad(date.getMonth() + 1, 2),
        '-',
        pad(date.getDate(), 2),
        '-',
        pad(date.getHours(), 2),
        pad(date.getMinutes(), 2),
    ].join('');
    const clean = String(suffix).replace(/[^A-Za-z0-9]/g, '');
    return clean ? `${parts}-${clean}` : parts;
}

function shotFileName(index) {
    return `${pad(index, 4)}.jpg`;
}

// Время относительное, ключи короткие, кириллица не экранируется: лог пишется
// на каждый шаг, и лишние байты копятся быстрее, чем кажется.
function encodeLogLine(entry, startedAt) {
    const line = { t: entry.at - startedAt, k: entry.kind };

    for (const [long, short] of Object.entries(KEYS)) {
        if (entry[long] !== undefined && entry[long] !== null && entry[long] !== '') {
            line[short] = entry[long];
        }
    }

    return JSON.stringify(line);
}

module.exports = {
    sessionDirName,
    shotFileName,
    encodeLogLine,
};

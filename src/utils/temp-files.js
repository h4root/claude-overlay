'use strict';

const crypto = require('crypto');

const TEMP_PREFIX = 'claude-overlay-';
const NAME_PATTERN = new RegExp(`^${TEMP_PREFIX}[a-f0-9]+\\.wav$`);

function temporaryWavName() {
    return `${TEMP_PREFIX}${crypto.randomBytes(8).toString('hex')}.wav`;
}

// Осиротевшие файлы подчищаются из общего /tmp, поэтому признак должен быть
// узким: имя без разделителей, наш префикс, шестнадцатеричный хвост.
function isOverlayTempName(name) {
    if (typeof name !== 'string' || name.includes('/') || name.includes('\\')) {
        return false;
    }
    return NAME_PATTERN.test(name);
}

module.exports = {
    TEMP_PREFIX,
    temporaryWavName,
    isOverlayTempName,
};

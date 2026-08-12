'use strict';

function debounce(fn, waitMs) {
    let timer = null;
    let pendingArgs = null;

    const run = (...args) => {
        pendingArgs = args;
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = null;
            const args_ = pendingArgs;
            pendingArgs = null;
            fn(...args_);
        }, waitMs);
    };

    run.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        pendingArgs = null;
    };

    run.flush = () => {
        if (!timer) {
            return;
        }
        clearTimeout(timer);
        timer = null;
        const args = pendingArgs;
        pendingArgs = null;
        fn(...args);
    };

    return run;
}

module.exports = { debounce };

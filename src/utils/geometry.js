'use strict';

// Окно двигают стрелками, и без ограничения оно уезжает за край экрана,
// откуда его уже не достать: заголовок и кнопки оказываются вне видимости.
function clampToWorkArea({ x, y, width, height }, workArea) {
    const maxX = workArea.x + workArea.width - width;
    const maxY = workArea.y + workArea.height - height;

    return {
        // Окно шире экрана прижимаем к началу области, а не к отрицательному
        // максимуму, иначе оно уедет ровно на разницу размеров.
        x: Math.round(Math.min(Math.max(x, workArea.x), Math.max(maxX, workArea.x))),
        y: Math.round(Math.min(Math.max(y, workArea.y), Math.max(maxY, workArea.y))),
    };
}

module.exports = { clampToWorkArea };

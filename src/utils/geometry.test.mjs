import { describe, it, expect } from 'vitest';
import geometry from './geometry.js';

const { clampToWorkArea } = geometry;

const AREA = { x: 0, y: 25, width: 1440, height: 875 };

describe('clampToWorkArea', () => {
    it('окно внутри области не двигает', () => {
        expect(clampToWorkArea({ x: 100, y: 100, width: 480, height: 380 }, AREA)).toEqual({ x: 100, y: 100 });
    });

    // Окно двигают стрелками; уехав за край, оно становится недостижимым.
    it('возвращает окно, уехавшее за правый край', () => {
        expect(clampToWorkArea({ x: 1400, y: 100, width: 480, height: 380 }, AREA).x).toBe(960);
    });

    it('возвращает окно, уехавшее за левый край', () => {
        expect(clampToWorkArea({ x: -300, y: 100, width: 480, height: 380 }, AREA).x).toBe(0);
    });

    it('учитывает строку меню сверху', () => {
        expect(clampToWorkArea({ x: 100, y: -50, width: 480, height: 380 }, AREA).y).toBe(25);
    });

    it('не даёт уехать под нижний край', () => {
        expect(clampToWorkArea({ x: 100, y: 5000, width: 480, height: 380 }, AREA).y).toBe(520);
    });

    it('область начинается не в нуле — учитывает смещение', () => {
        const area = { x: 200, y: 100, width: 1000, height: 800 };
        expect(clampToWorkArea({ x: 0, y: 0, width: 400, height: 300 }, area)).toEqual({ x: 200, y: 100 });
    });

    // Окно шире экрана прижимаем к левому верхнему углу: иначе оно уедет
    // влево на разницу размеров и заголовок станет недоступен.
    it('окно больше области прижимает к началу, а не за край', () => {
        expect(clampToWorkArea({ x: 50, y: 50, width: 2000, height: 1200 }, AREA)).toEqual({ x: 0, y: 25 });
    });

    it('оба края сразу', () => {
        expect(clampToWorkArea({ x: -900, y: 4000, width: 480, height: 380 }, AREA)).toEqual({ x: 0, y: 520 });
    });
});

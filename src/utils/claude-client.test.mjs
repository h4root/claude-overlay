import { describe, it, expect } from 'vitest';
import client from './claude-client.js';

const { MODELS, getModel, buildRequest, normalizeApiError, maskKey, normalizeBaseUrl, prepareHistory } = client;

const PNG = { mediaType: 'image/png', data: 'aGVsbG8=' };

function opusRequest(overrides = {}) {
    return buildRequest({
        model: 'claude-opus-5',
        effort: 'high',
        systemPrompt: 'Ты ассистент.',
        prompt: 'Что на экране?',
        images: [PNG],
        ...overrides,
    });
}

describe('каталог моделей', () => {
    it('содержит только идентификаторы без суффикса даты', () => {
        for (const model of MODELS) {
            expect(model.id).not.toMatch(/-\d{8}$/);
        }
    });

    it('отдаёт модель по идентификатору', () => {
        expect(getModel('claude-opus-5').label).toBe('Opus 5');
    });

    it('бросает ошибку на неизвестной модели', () => {
        expect(() => getModel('gpt-4')).toThrow(/неизвестная модель/i);
    });
});

describe('buildRequest: сообщение пользователя', () => {
    it('кладёт изображение перед текстом', () => {
        const content = opusRequest().messages.at(-1).content;
        expect(content[0].type).toBe('image');
        expect(content[0].source).toEqual({ type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' });
        expect(content.at(-1)).toEqual({ type: 'text', text: 'Что на экране?' });
    });

    it('поддерживает несколько скриншотов', () => {
        const content = opusRequest({ images: [PNG, { mediaType: 'image/jpeg', data: 'eHl6' }] }).messages.at(-1).content;
        expect(content.filter(block => block.type === 'image')).toHaveLength(2);
        expect(content[1].source.media_type).toBe('image/jpeg');
    });

    it('без изображений собирает текстовый ход — для уточняющих вопросов', () => {
        const content = buildRequest({
            model: 'claude-opus-5',
            prompt: 'А подробнее?',
            images: [],
        }).messages.at(-1).content;
        expect(content).toEqual([{ type: 'text', text: 'А подробнее?' }]);
    });

    it('сохраняет историю перед новым ходом', () => {
        const history = [
            { role: 'user', content: [{ type: 'text', text: 'привет' }] },
            { role: 'assistant', content: [{ type: 'text', text: 'здравствуй' }] },
        ];
        const messages = opusRequest({ history }).messages;
        expect(messages).toHaveLength(3);
        expect(messages.slice(0, 2)).toEqual(history);
        expect(messages.at(-1).role).toBe('user');
    });

    it('отклоняет пустой запрос без промпта и без картинок', () => {
        expect(() => buildRequest({ model: 'claude-opus-5', prompt: '   ', images: [] })).toThrow(/пуст/i);
    });
});

describe('buildRequest: картинки в истории', () => {
    const shot = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } };

    function history() {
        return [
            { role: 'user', content: [shot, { type: 'text', text: 'что тут?' }] },
            { role: 'assistant', content: [{ type: 'text', text: 'вот что' }] },
            { role: 'user', content: [shot, { type: 'text', text: 'а теперь?' }] },
            { role: 'assistant', content: [{ type: 'text', text: 'а теперь так' }] },
        ];
    }

    function imagesIn(message) {
        return message.content.filter(block => block.type === 'image').length;
    }

    // Уточняющий вопрос задают про тот же экран: без картинки модель отвечает
    // вслепую, по одному своему прошлому тексту.
    it('без нового скриншота сохраняет картинку последнего хода', () => {
        const request = buildRequest({ model: 'claude-opus-5', prompt: 'объясни подробнее', images: [], history: history() });
        const previousTurns = request.messages.slice(0, -1);
        expect(imagesIn(previousTurns[2])).toBe(1);
    });

    it('картинки более ранних ходов вырезает всегда', () => {
        const request = buildRequest({ model: 'claude-opus-5', prompt: 'объясни', images: [], history: history() });
        expect(imagesIn(request.messages[0])).toBe(0);
    });

    // Новый скриншот делает старый лишним, а платим мы за оба.
    it('с новым скриншотом вырезает все картинки из истории', () => {
        const request = buildRequest({ model: 'claude-opus-5', prompt: 'что тут', images: [PNG], history: history() });
        const previousTurns = request.messages.slice(0, -1);
        expect(previousTurns.every(message => imagesIn(message) === 0)).toBe(true);
        expect(imagesIn(request.messages.at(-1))).toBe(1);
    });

    it('текст истории не теряется', () => {
        const request = buildRequest({ model: 'claude-opus-5', prompt: 'дальше', images: [], history: history() });
        const texts = request.messages.slice(0, -1).flatMap(m => m.content.filter(b => b.type === 'text').map(b => b.text));
        expect(texts).toEqual(['что тут?', 'вот что', 'а теперь?', 'а теперь так']);
    });

    it('ответы ассистента не трогает', () => {
        const request = buildRequest({ model: 'claude-opus-5', prompt: 'дальше', images: [], history: history() });
        expect(request.messages[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'вот что' }] });
    });

    it('пустая история ничего не ломает', () => {
        expect(buildRequest({ model: 'claude-opus-5', prompt: 'привет', images: [], history: [] }).messages).toHaveLength(1);
    });
});

describe('buildRequest: расшифровка разговора', () => {
    function blocksOf(request) {
        return request.messages.at(-1).content;
    }

    it('кладёт расшифровку отдельным блоком между картинкой и вопросом', () => {
        const blocks = blocksOf(opusRequest({ transcript: 'Расскажите про индексы в базе.' }));
        expect(blocks[0].type).toBe('image');
        expect(blocks[1].type).toBe('text');
        expect(blocks[1].text).toContain('Расскажите про индексы в базе.');
        expect(blocks.at(-1).text).toBe('Что на экране?');
    });

    it('помечает расшифровку как речь собеседников, а не как указание', () => {
        const blocks = blocksOf(opusRequest({ transcript: 'реплика' }));
        expect(blocks[1].text).toMatch(/расшифровк/i);
    });

    it('без расшифровки лишнего блока не добавляет', () => {
        expect(blocksOf(opusRequest())).toHaveLength(2);
        expect(blocksOf(opusRequest({ transcript: '   ' }))).toHaveLength(2);
    });

    it('одной расшифровки достаточно: ни скриншота, ни вопроса не требуется', () => {
        const request = buildRequest({ model: 'claude-opus-5', images: [], prompt: '', transcript: 'что там по срокам?' });
        expect(blocksOf(request)).toHaveLength(1);
        expect(blocksOf(request)[0].text).toContain('что там по срокам?');
    });

    it('расшифровка не подменяет собой системный промпт', () => {
        const request = opusRequest({ transcript: 'реплика' });
        expect(request.system[0].text).toBe('Ты ассистент.');
    });
});

describe('buildRequest: effort и thinking', () => {
    it('кладёт effort внутрь output_config, а не на верхний уровень', () => {
        const request = opusRequest({ effort: 'medium' });
        expect(request.output_config).toEqual({ effort: 'medium' });
        expect(request.effort).toBeUndefined();
    });

    it('включает адаптивное мышление с читаемой сводкой', () => {
        expect(opusRequest().thinking).toEqual({ type: 'adaptive', display: 'summarized' });
    });

    it('не шлёт budget_tokens — параметр удалён в моделях 5-го поколения', () => {
        expect(JSON.stringify(opusRequest())).not.toContain('budget_tokens');
    });

    it('не шлёт параметры сэмплирования — они отвергаются с 400', () => {
        const request = opusRequest();
        expect(request.temperature).toBeUndefined();
        expect(request.top_p).toBeUndefined();
        expect(request.top_k).toBeUndefined();
    });

    it('для модели без поддержки effort не добавляет ни output_config, ни thinking', () => {
        const request = buildRequest({ model: 'claude-haiku-4-5', prompt: 'go', images: [PNG] });
        expect(request.output_config).toBeUndefined();
        expect(request.thinking).toBeUndefined();
    });

    it('бросает ошибку на уровне effort, которого у модели нет', () => {
        expect(() => opusRequest({ effort: 'turbo' })).toThrow(/effort/i);
        expect(() => buildRequest({ model: 'claude-haiku-4-5', effort: 'high', prompt: 'go', images: [PNG] })).toThrow(/effort/i);
    });

    it('подставляет effort по умолчанию, если он не задан', () => {
        expect(buildRequest({ model: 'claude-opus-5', prompt: 'go', images: [PNG] }).output_config.effort).toBe('high');
    });
});

describe('buildRequest: системный промпт и лимиты', () => {
    it('помечает системный промпт для кеширования', () => {
        const request = opusRequest();
        expect(request.system).toEqual([{ type: 'text', text: 'Ты ассистент.', cache_control: { type: 'ephemeral' } }]);
    });

    it('опускает system, если промпт пустой', () => {
        expect(opusRequest({ systemPrompt: '' }).system).toBeUndefined();
    });

    it('не превышает лимит вывода модели', () => {
        expect(buildRequest({ model: 'claude-haiku-4-5', prompt: 'go', images: [PNG], maxTokens: 999999 }).max_tokens).toBe(
            getModel('claude-haiku-4-5').maxOutputTokens
        );
    });
});

describe('normalizeApiError', () => {
    it('распознаёт неверный ключ и не предлагает повтор', () => {
        const error = normalizeApiError({ status: 401 });
        expect(error.kind).toBe('auth');
        expect(error.retryable).toBe(false);
        expect(error.message).toMatch(/ключ/i);
    });

    it('помечает лимит запросов как повторяемый', () => {
        expect(normalizeApiError({ status: 429 })).toMatchObject({ kind: 'rate_limit', retryable: true });
    });

    it('помечает ошибку сервера как повторяемую', () => {
        expect(normalizeApiError({ status: 529 })).toMatchObject({ kind: 'server', retryable: true });
    });

    it('распознаёт обрыв сети', () => {
        expect(normalizeApiError({ name: 'APIConnectionError' })).toMatchObject({ kind: 'network', retryable: true });
    });

    it('никогда не пропускает ключ в текст ошибки', () => {
        const error = normalizeApiError({ status: 400, message: 'bad key sk-ant-api03-SECRETVALUE1234 rejected' });
        expect(error.message).not.toContain('SECRETVALUE1234');
    });
});

describe('maskKey', () => {
    it('оставляет только хвост ключа', () => {
        expect(maskKey('sk-ant-api03-abcdefghijklmnop')).toBe('sk-ant-…mnop');
    });

    it('полностью скрывает короткое значение', () => {
        expect(maskKey('short')).toBe('…');
    });

    it('не падает на пустом значении', () => {
        expect(maskKey('')).toBe('…');
        expect(maskKey(undefined)).toBe('…');
    });
});

// По этому адресу уходит API-ключ, поэтому разбор строгий: подсунутый хост
// означает утечку ключа.
describe('normalizeBaseUrl', () => {
    it('пустое значение означает адрес Anthropic по умолчанию', () => {
        expect(normalizeBaseUrl('')).toBeNull();
        expect(normalizeBaseUrl('   ')).toBeNull();
        expect(normalizeBaseUrl(null)).toBeNull();
    });

    it('принимает https-адрес', () => {
        expect(normalizeBaseUrl('https://gateway.example.com')).toBe('https://gateway.example.com');
    });

    it('сохраняет путь шлюза', () => {
        expect(normalizeBaseUrl('https://gateway.example.com/anthropic')).toBe('https://gateway.example.com/anthropic');
    });

    // SDK сам дописывает /v1/messages, а адрес шлюза обычно копируют вместе
    // с /v1 — без обрезки получился бы путь с двумя /v1 и ответ 404.
    it('срезает хвостовой /v1: его добавит сам SDK', () => {
        expect(normalizeBaseUrl('https://gateway.example.com/v1')).toBe('https://gateway.example.com');
        expect(normalizeBaseUrl('https://gateway.example.com/anthropic/v1')).toBe('https://gateway.example.com/anthropic');
        expect(normalizeBaseUrl('https://gateway.example.com/v1/')).toBe('https://gateway.example.com');
    });

    it('путь, который лишь оканчивается на v1, не трогает', () => {
        expect(normalizeBaseUrl('https://gateway.example.com/apiv1')).toBe('https://gateway.example.com/apiv1');
    });

    it('убирает хвостовой слеш, чтобы путь не удвоился', () => {
        expect(normalizeBaseUrl('https://gateway.example.com/')).toBe('https://gateway.example.com');
    });

    // Локальный шлюз вроде LiteLLM живёт на http, и это нормально: трафик
    // не покидает машину.
    it('разрешает http только для локального адреса', () => {
        expect(normalizeBaseUrl('http://localhost:4000')).toBe('http://localhost:4000');
        expect(normalizeBaseUrl('http://127.0.0.1:4000')).toBe('http://127.0.0.1:4000');
    });

    it('http на чужой хост отклоняет: ключ ушёл бы открытым текстом', () => {
        expect(() => normalizeBaseUrl('http://gateway.example.com')).toThrow(/https/i);
    });

    it('отклоняет учётные данные в адресе', () => {
        expect(() => normalizeBaseUrl('https://user:secret@gateway.example.com')).toThrow(/учётные|логин|пароль/i);
    });

    it('отклоняет другие схемы', () => {
        expect(() => normalizeBaseUrl('ftp://gateway.example.com')).toThrow();
        expect(() => normalizeBaseUrl('file:///etc/passwd')).toThrow();
    });

    it('отклоняет мусор', () => {
        expect(() => normalizeBaseUrl('просто текст')).toThrow(/адрес/i);
        expect(() => normalizeBaseUrl('gateway.example.com')).toThrow(/адрес/i);
    });
});

// Кадр весит около двухсот килобайт в base64. Держать в памяти все кадры
// сессии незачем: в запрос уходит только последний.
describe('prepareHistory: что остаётся в памяти', () => {
    const shot = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } };

    function history() {
        return [
            { role: 'user', content: [shot, { type: 'text', text: 'первый экран' }] },
            { role: 'assistant', content: [{ type: 'text', text: 'ответ' }] },
            { role: 'user', content: [shot, { type: 'text', text: 'второй экран' }] },
            { role: 'assistant', content: [{ type: 'text', text: 'ответ' }] },
        ];
    }

    function imageCount(messages) {
        return messages.reduce((sum, message) => sum + message.content.filter(block => block.type === 'image').length, 0);
    }

    it('оставляет кадр только у последнего хода с картинкой', () => {
        const kept = prepareHistory(history(), true);
        expect(imageCount(kept)).toBe(1);
        expect(kept[2].content.some(block => block.type === 'image')).toBe(true);
    });

    // Уточняющий вопрос идёт без своего кадра, но спрашивают про тот же экран.
    it('кадр переживает текстовый ход, добавленный следом', () => {
        const withFollowUp = [...history(), { role: 'user', content: [{ type: 'text', text: 'а подробнее?' }] }];
        expect(imageCount(prepareHistory(withFollowUp, true))).toBe(1);
    });

    it('текст всех ходов сохраняется целиком', () => {
        const texts = prepareHistory(history(), true).flatMap(m => m.content.filter(b => b.type === 'text').map(b => b.text));
        expect(texts).toEqual(['первый экран', 'ответ', 'второй экран', 'ответ']);
    });

    it('история без картинок не меняется', () => {
        const plain = [{ role: 'user', content: [{ type: 'text', text: 'привет' }] }];
        expect(prepareHistory(plain, true)).toEqual(plain);
    });

    it('пустая история не ломает разбор', () => {
        expect(prepareHistory([], true)).toEqual([]);
    });
});

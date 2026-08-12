'use strict';

// Пока идёт ответ, новый запрос обрывает предыдущий. У оборванного падает
// finalMessage(), и без этого счётчика его ошибка прилетала бы в интерфейс
// вместо ответа на новый вопрос — а обрывки текста подмешивались бы в него.
class RequestGate {
    constructor() {
        this.current = 0;
    }

    begin() {
        this.current += 1;
        return this.current;
    }

    isCurrent(id) {
        return this.current !== 0 && id === this.current;
    }

    cancel() {
        this.current += 1;
    }
}

module.exports = { RequestGate };

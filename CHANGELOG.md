# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## [0.7.0] - 2026-08-31

### Добавлено

- Методы работы с сообщениями записи
  ([messages](https://docs.bpium.ru/docs/integracii/api/data/soobsheniya-messages)):
  - `getMessages(catalogId, recordId)` — получить сообщения записи;
  - `postMessage(catalogId, recordId, message)` — создать сообщение,
    принимает текст строкой или объект `{ text, mentions, attachments, replyMessageId }`;
  - `patchMessage(catalogId, recordId, messageId, message)` — изменить сообщение;
  - `deleteMessage(catalogId, recordId, messageId)` — удалить сообщение;
  - `subscribeToMessages(catalogId, recordId, subscribe)` — подписаться на сообщения записи или отписаться.
- Типы `IBpMessage`, `IBpMessageAuthor`, `IBpMessageBody`.
- Ресурсы `messages` и `chatOptions` в `_getUrl`.

## [0.6.6] - 2025-04-29

### Исправлено

- Ошибка в `getRecords` и `getWidget` при пустом значении в фильтре.

## [0.6.2] - 2023-08-09

### Исправлено

- Описание `getAllRecords` в jsDoc.
- Сериализация `fields` и `filters` — больше не нужно оборачивать их в `JSON.stringify`.
- Статус ответа в сокращённом объекте ошибки.

## [0.6.1] - 2023-08-07

### Исправлено

- Флаг `BP.debug` по умолчанию выставлен в `false`.

## [0.6.0] - 2023-07-28

### Изменено

- Проект переведён на TypeScript, публикуется собранный `dist` с `d.ts`.
- Импорт теперь через свойство `default`: `const BP = require('bp-api').default`.

### Добавлено

- Типы значений полей (`values.ts`) и интерфейсы api (`interfaces.ts`).
- Поддержка `Buffer` в `uploadFile`.

## Более ранние версии

История версий до 0.6.0 — в `git log`.

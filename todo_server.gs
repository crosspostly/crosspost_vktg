/**
 * TODO_SERVER.GS — план рефакторинга server.gs (от простого к сложному)
 * Дата: 2025-11-02
 * Назначение: единая точка задач для чистки кода и вынесения универсальных утилит
 */

// ШАГ 0. Контрольная точка
// - Зафиксировать текущую рабочую версию (main)
// - После каждого шага — ручной smoke-тест: конфиг → лицензия → связки → тест-публикация

// ШАГ 1. Быстрые унификации и шаблоны (минимальный риск)
// 1.1 API-обертка
//   - добавить makeApiRequest(service, url, options) + parseJsonSafe(text)
//   - внедрить в Telegram sendMessage/sendMediaGroup и VK wall.get/video.get
// 1.2 Валидация payload
//   - добавить validatePayload(payload, requiredFields)
//   - использовать в каждом handler в начале
// 1.3 Проверка лицензии
//   - добавить validateLicenseOrThrow(licenseKey)
//   - заменить внутренние вызовы handleCheckLicense + JSON.parse на эту функцию
// 1.4 Ответы API
//   - success(data, meta?) и fail(message, code?, meta?)
//   - jsonResponse оборачивает единый формат
// 1.5 Telegram caption split
//   - ensureCaptionOrSplit(token, chatId, mediaUrls, caption)
//   - сократить sendVkPostToTelegram
// 1.6 Sheets-хелперы (минимально)
//   - findRow(sheetName, predicate), getRows(sheetName), appendRow(sheetName, obj)

// ШАГ 2. Вынести утилиты в отдельные файлы .gs (GAS-проект)
//   api-utils.gs: makeApiRequest, parseJsonSafe, logApiCall, rateLimitDelay
//   validation-utils.gs: validatePayload, validateLicenseOrThrow, extractVkGroupId, resolveVkScreenName, extractTelegramChatId, checkLimits
//   sheets-utils.gs: getSheet, createFormattedSheet, getRows, findRow, appendRow, updateRow
//   html-builder.gs: buildPage, buildTable, buildAlert, safeHtml
//   config-manager.gs: getConfig, setConfig, validateConfig

// ШАГ 3. Перевести обработчики на утилиты
//   - doPost: validatePayload(payload, ["event"]) → switch
//   - handlers: validatePayload + validateLicenseOrThrow → доменная логика → success/fail

// ШАГ 4. HTML-генерация
//   - переписать getServerHealthHtml/getAdminPanelHtml через html-builder
//   - выделить общие стили и каркас страницы

// ШАГ 5. Карта ошибок API
//   - formatApiError(service, code, description)
//   - единое человекочитаемое сообщение + логирование

// ШАГ 6. Кеш имен
//   - централизовать getCachedVkGroupName/getCachedTelegramChatName
//   - (опционально) TTL/инвалидация при редактировании связок

// ШАГ 7. Тесты утилит (ручные)
//   - testUrlExtraction(), testNameRetrieval(), testApiWrappers()

// ОЖИДАЕМАЯ ВЫГОДА:
// ✅ -30..40% строк в server.gs
// ✅ Единые шаблоны для запросов/ответов, валид. и логирования
// ✅ Быстрое добавление новых обработчиков без дублирования
// ✅ Проще поддержка и развитие

// @ts-nocheck
/**
 * VK→Telegram Crossposter - CLIENT v6.0 ИСПРАВЛЕННЫЙ (PRODUCTION-READY)
 * 
 * ✅ Клиентская часть для Google Sheets
 * ✅ Работает с Server Web App
 * ✅ Управление лицензиями и связками
 * ✅ Проверка и отправка постов из ВК в TG
 * ✅ Автоматическая проверка по расписанию
 * ✅ Логирование всех операций
 * 
 * Автор: f_den
 * Дата: 2025-11-01
 * Примечание: Не требует VK Access Token! Всё на сервере.
 */

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const DEV_MODE = true; // true для подробного логирования
const CLIENT_VERSION = "6.0";

// ⭐ ВСТАВЬТЕ ПРАВИЛЬНЫЙ URL ВАШЕГО СЕРВЕРА ⭐
const SERVER_URL = "https://script.google.com/macros/s/AKfycbzNlXEfpsiMi1UAgaXJWCA9rF35swkvl2Amr2exZ1AWVfCiI7HttGq_yxZWgcceG_zG/exec";

const CACHE_DURATION = 10 * 60 * 1000; // 10 минут
const MAX_POSTS_CHECK = 50;
const REQUEST_TIMEOUT = 30000;
var LICENSE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 минут
var USER_PROP_LICENSE_KEY = 'LICENSE_KEY';
var USER_PROP_LICENSE_META = 'LICENSE_META'; // JSON: { type, maxGroups, expires, cachedAt }

// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ И МЕНЮ
// ============================================

function onOpen() {
  try {
    logEvent("INFO", "spreadsheet_opened", "client", "VK→TG Manager spreadsheet opened by user");
    
    const ui = SpreadsheetApp.getUi();
    
    ui.createMenu("VK→Telegram")
      .addItem("🎛️ Открыть управление", "openMainPanel")
      .addItem("🔄 Проверить посты (вручную)", "checkNewPostsManually")
      .addItem("⏱️ Настроить автопроверку (каждые 30 мин)", "setupTrigger")
      .addItem("📊 Статистика", "showUserStatistics")
      .addSeparator()
      .addItem("📋 Показать логи", "showLogsSheet")
      .addItem("🧹 Очистить старые логи (>30 дней)", "cleanOldLogs")
      .addToUi();
    
    // Только критическое логирование UI ошибок - все бизнес-логи идут через сервер
  } catch (error) {
    console.error("[onOpen] Failed:", error.message);
    logEvent("ERROR", "on_open_failed", "client", error.message);
  }
}

function openMainPanel() {
  try {
    logEvent("INFO", "main_panel_opened", "client", "User opened VK→TG management panel");
    
    const htmlContent = getMainPanelHtml();
    if (!htmlContent) throw new Error("Failed to generate HTML");
    
    const html = HtmlService.createHtmlOutput(htmlContent);
    html.setWidth(1000).setHeight(700);
    
    SpreadsheetApp.getUi().showModelessDialog(html, `VK→Telegram Manager v${CLIENT_VERSION}`);
    
  } catch (error) {
    // Только критические UI ошибки логируем на клиенте
    logCriticalUiError("main_panel_error", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка: " + error.message);
  }
}

// ============================================
// 2. ФУНКЦИИ ЛОГИРОВАНИЯ КЛИЕНТА
// ============================================

/**
 * Логирует событие в лист "Logs" клиентской таблицы
 * @param {string} level - Уровень: INFO, WARN, ERROR, DEBUG
 * @param {string} event - Тип события (например: license_check, binding_added)
 * @param {string} user - Email пользователя (по умолчанию текущий)
 * @param {string} details - Детали события
 */
function logEvent(level, event, user, details) {
  try {
    var sheet = getOrCreateLogsSheet();
    var timestamp = new Date().toISOString();
    var userEmail = user || Session.getActiveUser().getEmail();
    
    sheet.appendRow([
      timestamp,
      level,
      event,
      userEmail,
      details || ""
    ]);
    
    // Применяем цветное форматирование для новой строки
    applyLogRowFormatting(sheet, sheet.getLastRow(), level);
    
  } catch (error) {
    console.error("[LogEvent] Failed:", error.message);
  }
}

/**
 * Создаёт или возвращает лист "Logs" с форматированием
 */
function getOrCreateLogsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Logs");
  
  if (!sheet) {
    sheet = ss.insertSheet("Logs");
    
    // Заголовки
    sheet.appendRow(["Timestamp", "Level", "Event", "User", "Details"]);
    
    // Форматирование шапки
    var headerRange = sheet.getRange(1, 1, 1, 5);
    headerRange.setBackground("#667eea");
    headerRange.setFontColor("white");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    
    // Закрепляем шапку
    sheet.setFrozenRows(1);
    
    // Автоширина колонок
    sheet.autoResizeColumns(1, 5);
    
    // Conditional Formatting для уровней логирования
    applyConditionalFormattingToLogs(sheet);
  }
  
  return sheet;
}

/**
 * Применяет цветное форматирование ко ВСЕМУ листу Logs
 * Использует Conditional Formatting Rules для автоматической раскраски
 */
function applyConditionalFormattingToLogs(sheet) {
  var rules = sheet.getConditionalFormatRules();
  
  // Правило для INFO
  var infoRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("INFO")
    .setBackground("#d4edda")
    .setFontColor("#155724")
    .setRanges([sheet.getRange("A2:E")]) // Применяем ко всей строке
    .build();
  
  // Правило для WARN
  var warnRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("WARN")
    .setBackground("#fff3cd")
    .setFontColor("#856404")
    .setRanges([sheet.getRange("A2:E")])
    .build();
  
  // Правило для ERROR
  var errorRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("ERROR")
    .setBackground("#f8d7da")
    .setFontColor("#721c24")
    .setRanges([sheet.getRange("A2:E")])
    .build();
  
  // Правило для DEBUG
  var debugRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("DEBUG")
    .setBackground("#e7f3ff")
    .setFontColor("#004085")
    .setRanges([sheet.getRange("A2:E")])
    .build();
  
  rules.push(infoRule);
  rules.push(warnRule);
  rules.push(errorRule);
  rules.push(debugRule);
  
  sheet.setConditionalFormatRules(rules);
}

/**
 * Применяет цвет к конкретной строке лога СРАЗУ после добавления
 */
function applyLogRowFormatting(sheet, rowNumber, level) {
  var rowRange = sheet.getRange(rowNumber, 1, 1, 5);
  
  switch(level) {
    case "INFO":
      rowRange.setBackground("#d4edda");
      rowRange.setFontColor("#155724");
      break;
    case "WARN":
      rowRange.setBackground("#fff3cd");
      rowRange.setFontColor("#856404");
      break;
    case "ERROR":
      rowRange.setBackground("#f8d7da");
      rowRange.setFontColor("#721c24");
      break;
    case "DEBUG":
      rowRange.setBackground("#e7f3ff");
      rowRange.setFontColor("#004085");
      break;
  }
}

/**
 * Открывает лист "Logs" (или создаёт его, если отсутствует)
 */
function showLogsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateLogsSheet();
  ss.setActiveSheet(sheet);
  
  SpreadsheetApp.getUi().alert(
    "📊 Лист логов открыт!\n\n" +
    "Цветовая схема:\n" +
    "🟢 INFO - зелёный\n" +
    "🟡 WARN - жёлтый\n" +
    "🔴 ERROR - красный\n" +
    "🔵 DEBUG - синий"
  );
}

/**
 * Возвращает последние N записей из листа "Logs"
 */
function getClientLogs(limit) {
  try {
    var sheet = getOrCreateLogsSheet();
    var lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return [];
    }
    
    var count = Math.min(limit || 50, lastRow - 1);
    var startRow = Math.max(2, lastRow - count + 1);
    
    var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 5).getValues();
    
    // Сортируем по убыванию (последние сверху)
    return data.reverse().map(function(row) {
      return {
        timestamp: row[0],
        level: row[1],
        event: row[2],
        user: row[3],
        details: row[4]
      };
    });
    
  } catch (error) {
    logEvent("ERROR", "get_client_logs_error", "", error.message);
    return [];
  }
}

// ============================================
// 3. ФУНКЦИИ ЛИСТОВ ПУБЛИКАЦИЙ
// ============================================

/**
 * Создаёт или возвращает лист публикаций для связки
 * @param {string} bindingName - Название связки
 * @returns {Sheet} Лист публикаций
 */
function getOrCreatePublishedSheet(bindingName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = sanitizeSheetName(bindingName);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Заголовки
    sheet.appendRow([
      "Timestamp", 
      "Status", 
      "VK Group ID", 
      "VK Post ID", 
      "VK Post URL", 
      "VK Post Date", 
      "Media Count", 
      "Caption Length", 
      "TG Chat ID", 
      "TG Message IDs", 
      "TG Message URLs", 
      "Notes"
    ]);
    
    // Форматирование шапки
    var headerRange = sheet.getRange(1, 1, 1, 12);
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("white");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 12);
    
    logEvent("INFO", "published_sheet_created", "", 
             "Sheet: " + sheetName + " for binding: " + bindingName);
  }
  
  return sheet;
}

/**
 * Очищает имя листа от недопустимых символов
 * Поддерживает кириллицу, латиницу, цифры, пробелы, дефисы, подчёркивания
 */
function sanitizeSheetName(name) {
  if (!name || typeof name !== "string") {
    return "Binding";
  }
  
  // Разрешённые символы: кириллица, латиница, цифры, пробелы, дефис, подчёркивание
  var cleaned = name
    .replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '') // Удаляем спецсимволы
    .replace(/\s+/g, '_')                // Пробелы → подчёркивания
    .substring(0, 27);                   // Лимит Google Sheets: 31 символ (оставляем запас)
  
  if (!cleaned) {
    return "Binding";
  }
  
  return cleaned;
}

/**
 * Записывает строку публикации в лист связки
 * @param {string} bindingName - Название связки
 * @param {Object} publicationData - Данные публикации
 */
function writePublicationRow(bindingName, publicationData) {
  var sheet = getOrCreatePublishedSheet(bindingName);
  
  // Правильная генерация VK URL
  var vkPostUrl = buildVkPostUrl(
    publicationData.vkGroupId, 
    publicationData.vkPostId
  );
  
  // Генерация Telegram URLs
  var tgMessageUrls = buildTelegramMessageUrls(
    publicationData.tgChatId,
    publicationData.tgMessageIds
  );
  
  var rowData = [
    new Date().toISOString(),
    publicationData.status || "sent",
    publicationData.vkGroupId || "",
    publicationData.vkPostId || "",
    vkPostUrl,
    publicationData.vkPostDate || "",
    publicationData.mediaCount || 0,
    publicationData.captionLength || 0,
    publicationData.tgChatId || "",
    (publicationData.tgMessageIds || []).join(", "),
    tgMessageUrls,
    publicationData.notes || ""
  ];
  
  // Вставляем строку СВЕРХУ (после заголовка)
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
  
  // Цветовое форматирование по статусу
  var statusRange = sheet.getRange(2, 2); // Колонка Status
  if (publicationData.status === "sent") {
    statusRange.setBackground("#d4edda");
    statusRange.setFontColor("#155724");
  } else if (publicationData.status === "skipped") {
    statusRange.setBackground("#fff3cd");
    statusRange.setFontColor("#856404");
  } else if (publicationData.status === "error") {
    statusRange.setBackground("#f8d7da");
    statusRange.setFontColor("#721c24");
  }
}

/**
 * Строит правильную VK ссылку на пост
 * @param {string|number} vkGroupId - ID группы (отрицательное для групп)
 * @param {string|number} postId - ID поста
 * @returns {string} Правильная VK ссылка или пустая строка
 */
function buildVkPostUrl(vkGroupId, postId) {
  if (!vkGroupId || !postId) {
    logEvent("WARN", "vk_url_missing_params", "", 
             "VK Group ID: " + vkGroupId + ", Post ID: " + postId);
    return "";
  }
  
  // Приводим к строке и убираем пробелы
  var cleanGroupId = String(vkGroupId).trim();
  var cleanPostId = String(postId).trim();
  
  // Валидация формата
  if (!/^-?\d+$/.test(cleanGroupId)) {
    logEvent("ERROR", "invalid_vk_group_id", "", 
             "Invalid format: " + cleanGroupId);
    return "";
  }
  
  if (!/^\d+$/.test(cleanPostId)) {
    logEvent("ERROR", "invalid_vk_post_id", "", 
             "Invalid format: " + cleanPostId);
    return "";
  }
  
  // Правильный формат: https://vk.com/wall{owner_id}_{post_id}
  return "https://vk.com/wall" + cleanGroupId + "_" + cleanPostId;
}

/**
 * Строит ссылки на Telegram сообщения
 * @param {string} chatId - Chat ID или @username
 * @param {Array<number>} messageIds - Массив message IDs
 * @returns {string} Список ссылок через запятую
 */
function buildTelegramMessageUrls(chatId, messageIds) {
  if (!chatId || !messageIds || messageIds.length === 0) {
    return "";
  }
  
  var urls = [];
  
  // Для @username → https://t.me/username/123
  if (chatId.startsWith("@")) {
    var username = chatId.substring(1);
    messageIds.forEach(function(msgId) {
      urls.push("https://t.me/" + username + "/" + msgId);
    });
  } else {
    // Для chat_id (числовые) → https://t.me/c/{chat_id без -100}/{msg_id}
    var cleanChatId = chatId.replace("-100", "");
    messageIds.forEach(function(msgId) {
      urls.push("https://t.me/c/" + cleanChatId + "/" + msgId);
    });
  }
  
  return urls.join(", ");
}

// ============================================
// 4. ОСНОВНЫЕ API ФУНКЦИИ
// ============================================

function getInitialData() {
  try {
    const license = getLicense();
    
    if (!license) {
      return { success: true, license: null, bindings: [] };
    }
    
    const bindingsResult = getBindings();
    
    if (!bindingsResult.success) {
      return { success: false, error: bindingsResult.error };
    }
    
    return {
      success: true,
      license: license,
      bindings: bindingsResult.bindings || []
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function saveLicenseWithCheck(licenseKey) {
  try {
    logEvent("INFO", "license_check_start", "client", `License key: ${licenseKey.substring(0, 20)}...`);
    
    if (!SERVER_URL || SERVER_URL.includes("YOURSERVERURL")) {
      logEvent("ERROR", "license_config_error", "client", "Server URL not configured");
      return {
        success: false,
        error: "❌ Ошибка конфигурации: URL сервера не указан"
      };
    }
    
    const payload = {
      event: "check_license",
      license_key: licenseKey
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const responseText = response.getContentText();
    const result = JSON.parse(responseText);
    
    if (result.success) {
      PropertiesService.getUserProperties().setProperty("LICENSE_KEY", licenseKey);
      
      logEvent("INFO", "license_activated_successfully", "client", 
               `Type: ${result.license.type}, Max Groups: ${result.license.maxGroups}`);
      
      return {
        success: true,
        license: {
          key: licenseKey,
          type: result.license.type,
          maxGroups: result.license.maxGroups,
          expires: result.license.expires
        }
      };
    } else {
      logEvent("WARN", "license_check_failed", "client", result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    logEvent("ERROR", "license_check_exception", "client", error.message);
    return { success: false, error: `❌ Ошибка проверки лицензии: ${error.message}` };
  }
}

function callServer(payload, options) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload for server call');
  }
  if (!SERVER_URL || SERVER_URL.includes('YOURSERVERURL')) {
    throw new Error('SERVER_URL is not configured');
  }

  var requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: (options && options.timeout) || REQUEST_TIMEOUT
  };

  var response = UrlFetchApp.fetch(SERVER_URL, requestOptions);
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();
  var result = {};

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('Failed to parse server response JSON');
    }
  }

  result = result || {};
  result.httpStatus = responseCode;

  return result;
}

function addBinding(bindingName, bindingDescription, vkGroupUrl, tgChatId, formatSettings) {
  try {
    const license = getLicense();
    if (!license) return { success: false, error: "❌ Лицензия не найдена" };
    
    const sanitizedName = typeof bindingName === "string" ? bindingName.trim() : "";
    const sanitizedDescription = typeof bindingDescription === "string" ? bindingDescription.trim() : "";
    
    logEvent("INFO", "add_binding_start", "client", 
             `Name: ${sanitizedName}, VK URL: ${vkGroupUrl}, TG Chat: ${tgChatId}`);
    
    const payload = {
      event: "add_binding",
      license_key: license.key,
      binding_name: sanitizedName,
      binding_description: sanitizedDescription,
      vk_group_url: vkGroupUrl,
      tg_chat_id: tgChatId,
      formatSettings: formatSettings || {
        boldFirstLine: true,
        boldUppercase: true,
        syncPostsCount: 1
      }
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      logEvent("INFO", "binding_added_successfully", "client", 
               `Name: ${sanitizedName}, Binding ID: ${result.bindingId || 'unknown'}`);
    } else {
      logEvent("WARN", "add_binding_failed", "client", 
               `Name: ${sanitizedName}, Error: ${result.error || 'Unknown error'}`);
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "add_binding_exception", "client", error.message);
    return { success: false, error: error.message };
  }
}

function editBinding(bindingId, bindingName, bindingDescription, vkGroupUrl, tgChatId, formatSettings) {
  try {
    const license = getLicense();
    if (!license) return { success: false, error: "❌ Лицензия не найдена" };
    
    const sanitizedName = typeof bindingName === "string" ? bindingName.trim() : "";
    const sanitizedDescription = typeof bindingDescription === "string" ? bindingDescription.trim() : "";
    
    logEvent("INFO", "edit_binding_start", "client",
             `Binding ID: ${bindingId}, Name: ${sanitizedName}, VK URL: ${vkGroupUrl}`);
    
    // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Получаем старую связку для сравнения групп
    const bindingsResult = getBindings();
    let oldVkGroupId = null;
    
    if (bindingsResult.success) {
      const oldBinding = bindingsResult.bindings.find(b => b.id === bindingId);
      if (oldBinding) {
        oldVkGroupId = extractVkGroupId(oldBinding.vkGroupUrl || oldBinding.vk_group_url);
        logEvent("DEBUG", "old_binding_found", "client", 
                 `Old VK Group ID: ${oldVkGroupId}`);
      }
    }
    
    const newVkGroupId = extractVkGroupId(vkGroupUrl);
    
    // ✅ Если группа изменилась - очищаем кеш старой группы
    if (oldVkGroupId && newVkGroupId && oldVkGroupId !== newVkGroupId) {
      const cleared = clearGroupFromCache(oldVkGroupId);
      logEvent("INFO", "group_cache_cleared_on_edit", "client", 
               `Old group: ${oldVkGroupId} → New group: ${newVkGroupId}, Cache cleared: ${cleared}`);
    }
    
    const payload = {
      event: "edit_binding",
      license_key: license.key,
      binding_id: bindingId,
      binding_name: sanitizedName,
      binding_description: sanitizedDescription,
      vk_group_url: vkGroupUrl,
      tg_chat_id: tgChatId,
      formatSettings: formatSettings || {
        boldFirstLine: true,
        boldUppercase: true,
        syncPostsCount: 1
      }
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      logEvent("INFO", "binding_edited", "client", `Binding ID: ${bindingId}, Name: ${sanitizedName}`);
      
      // Published sheet lifecycle is managed on the server after edits
    } else {
      logEvent("WARN", "edit_binding_failed", "client", result.error);
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "edit_binding_error", "client", error.message);
    return { success: false, error: error.message };
  }
}


function deleteBinding(bindingId) {
  try {
    const license = getLicense();
    if (!license) return { success: false, error: "❌ Лицензия не найдена" };
    
    logEvent("INFO", "delete_binding_start", "client", `Binding ID: ${bindingId}`);
    
    // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Получаем VK Group ID перед удалением для очистки кеша
    const bindingsResult = getBindings();
    let vkGroupId = null;
    
    if (bindingsResult.success) {
      const binding = bindingsResult.bindings.find(b => b.id === bindingId);
      if (binding) {
        vkGroupId = extractVkGroupId(binding.vkGroupUrl || binding.vk_group_url);
        logEvent("DEBUG", "binding_found_for_deletion", "client", 
                 `Binding ID: ${bindingId}, VK Group ID: ${vkGroupId}`);
      }
    }
    
    const payload = {
      event: "delete_binding",
      license_key: license.key,
      binding_id: bindingId
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      logEvent("INFO", "binding_deleted", "client", `Binding ID: ${bindingId}`);
      
      // ✅ Если успешно удалили связку - очищаем кеш VK группы
      if (vkGroupId) {
        const cleared = clearGroupFromCache(vkGroupId);
        logEvent("INFO", "group_cache_cleared_on_delete", "client", 
                 `Binding: ${bindingId}, VK Group: ${vkGroupId}, Cache cleared: ${cleared}`);
      }
    } else {
      logEvent("WARN", "delete_binding_failed", "client", result.error);
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "delete_binding_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

function getBindings() {
  try {
    const license = getLicense();
    if (!license) return { success: true, bindings: [] };
    
    logEvent("DEBUG", "get_bindings_request", "client", `License: ${license.key.substring(0, 20)}...`);
    
    const payload = {
      event: "get_user_bindings_with_names",
      license_key: license.key
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      logEvent("INFO", "bindings_with_names_loaded", "client", `Total bindings: ${result.bindings?.length || 0}`);
      return result;
    } else {
      // Fallback to old API if new one is not available
      logEvent("WARN", "get_bindings_with_names_failed", "client", `${result.error}, falling back to regular bindings`);
      
      const fallbackPayload = {
        event: "get_bindings",
        license_key: license.key
      };
      
      const fallbackResponse = UrlFetchApp.fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(fallbackPayload),
        muteHttpExceptions: true,
        timeout: REQUEST_TIMEOUT
      });
      
      const fallbackResult = JSON.parse(fallbackResponse.getContentText());
      
      if (fallbackResult.success) {
        logEvent("INFO", "bindings_loaded_fallback", "client", `Total bindings: ${fallbackResult.bindings?.length || 0}`);
        return fallbackResult;
      } else {
        logEvent("WARN", "get_bindings_fallback_failed", "client", fallbackResult.error);
        return fallbackResult;
      }
    }
    
  } catch (error) {
    logEvent("ERROR", "get_bindings_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

function toggleBindingStatus(bindingId) {
  try {
    const license = getLicense();
    if (!license) return { success: false, error: "❌ Лицензия не найдена" };
    
    logEvent("INFO", "toggle_binding_status_start", "client", `Binding ID: ${bindingId}`);
    
    const payload = {
      event: "toggle_binding_status",
      license_key: license.key,
      binding_id: bindingId
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      logEvent("INFO", "binding_status_toggled", "client",
               `Binding ID: ${bindingId}, New status: ${result.new_status}`);
    } else {
      logEvent("WARN", "toggle_status_failed", "client", result.error);
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "toggle_status_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

function publishLastPost(bindingId) {
  try {
    const license = getLicense();
    if (!license) return { success: false, error: "❌ Лицензия не найдена" };
    
    logEvent("INFO", "publish_last_post_start", "client", `Binding ID: ${bindingId}`);
    
    const payload = {
      event: "send_post",  // Используем send_post с vk_post: null
      license_key: license.key,
      binding_id: bindingId,
      vk_post: null  // Явно указываем null - сервер сам возьмет последний пост
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      if (result.skipped) {
        logEvent("INFO", "publish_last_post_skipped", "client", `Binding ID: ${bindingId}, Reason: ${result.message || 'Already sent'}`);
      } else {
        logEvent("INFO", "publish_last_post_success", "client", `Binding ID: ${bindingId}, Message ID: ${result.message_id || 'N/A'}`);
      }
    } else {
      logEvent("WARN", "publish_last_post_failed", "client", `Binding ID: ${bindingId}, Error: ${result.error || 'Unknown error'}`);
    }
    
    return {
      success: result.success,
      skipped: result.skipped || false,
      message: result.message || (result.success ? 'Published successfully' : 'Failed to publish'),
      message_id: result.message_id,
      error: result.error
    };
    
  } catch (error) {
    logEvent("ERROR", "publish_last_post_error", "client", `Binding ID: ${bindingId}, Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Alias для обратной совместимости
function testPublication(bindingId) {
  return publishLastPost(bindingId);
}

function setGlobalSetting(settingKey, settingValue) {
  try {
    const license = getLicense();
    if (!license) return { success: false, error: "❌ Лицензия не найдена" };
    
    logEvent("INFO", "set_global_setting_start", "client", `Setting: ${settingKey}, Value: ${settingValue}`);
    
    const payload = {
      event: "set_global_setting",
      license_key: license.key,
      setting_key: settingKey,
      setting_value: settingValue
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      logEvent("INFO", "global_setting_saved", "client", `Setting: ${settingKey} = ${settingValue}`);
    } else {
      logEvent("WARN", "set_global_setting_failed", "client", result.error);
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "set_global_setting_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

function getGlobalSetting(settingKey) {
  try {
    const license = getLicense();
    if (!license) return { success: false, error: "❌ Лицензия не найдена" };
    
    logEvent("DEBUG", "get_global_setting_start", "client", `Setting: ${settingKey}`);
    
    const payload = {
      event: "get_global_setting", 
      license_key: license.key,
      setting_key: settingKey
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      logEvent("DEBUG", "global_setting_loaded", "client", `Setting: ${settingKey} = ${result.value}`);
    } else {
      logEvent("WARN", "get_global_setting_failed", "client", result.error);
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "get_global_setting_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

// УДАЛЕНО: Медленные функции getTelegramChatName() и getVkGroupName()
// Причина: Замедляли работу на 20-25 секунд. Используем bindingName вместо них.

// ============================================
// 3. ПРОВЕРКА И ОТПРАВКА ПОСТОВ
// ============================================

function checkNewPostsManually() {
  try {
    logEvent("INFO", "manual_check_triggered", "client", "User initiated manual check");
    
    const result = checkNewPosts();
    
    if (result.success) {
      const message = `✅ Проверка завершена!\n\n` +
        `📋 Проверено связок: ${result.bindingsChecked}\n` +
        `🆕 Найдено новых постов: ${result.newPostsFound}\n` +
        `✉️ Отправлено в TG: ${result.postsSent}`;
      
      SpreadsheetApp.getUi().alert(message);
      logEvent("INFO", "manual_check_completed", "client", message);
    } else {
      SpreadsheetApp.getUi().alert("❌ Ошибка: " + result.error);
      logEvent("ERROR", "manual_check_failed", "client", result.error);
    }
    
  } catch (error) {
    logEvent("ERROR", "manual_check_error", "client", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка: " + error.message);
  }
}

function checkNewPosts() {
  try {
    logEvent("INFO", "check_posts_start", "client", "Checking for new posts from VK groups");
    
    const license = getLicense();
    if (!license) {
      logEvent("ERROR", "check_posts_license_missing", "client", "License not found");
      return { success: false, error: "Лицензия не найдена" };
    }
    
    const bindingsResult = getBindings();
    if (!bindingsResult.success) {
      logEvent("ERROR", "check_posts_bindings_failed", "client", bindingsResult.error || "Unknown error" );
      return { success: false, error: bindingsResult.error };
    }
    
    const bindings = bindingsResult.bindings || [];
    const activeBindings = bindings.filter(binding => (binding.status || "").toLowerCase() === "active");
    
    logEvent("INFO", "active_bindings_count", "client", `Total: ${bindings.length}, Active: ${activeBindings.length}`);
    
    if (activeBindings.length === 0) {
      return { success: true, bindingsChecked: 0, newPostsFound: 0, postsSent: 0 };
    }
    
    const summary = {
      success: true,
      bindingsChecked: activeBindings.length,
      newPostsFound: 0,
      postsSent: 0
    };
    
    activeBindings.forEach(binding => {
      try {
        logEvent("DEBUG", "checking_binding", "client",
                 `Binding ID: ${binding.id}, VK: ${binding.vkGroupUrl || binding.vk_group_url}, TG: ${binding.tgChatId || binding.tg_chat_id}`);
        
        // Сначала пробуем извлечь ID локально
        let vkGroupId = extractVkGroupId(binding.vkGroupUrl || binding.vk_group_url);
        
        // Если не удалось (screen_name), отправляем исходный URL на сервер для резолвинга
        if (!vkGroupId) {
          vkGroupId = binding.vkGroupUrl || binding.vk_group_url;
          logEvent("INFO", "vk_group_id_server_resolve", "client",
                   `Binding ID: ${binding.id}, will resolve on server: ${vkGroupId}`);
        }
        
        const syncCount = resolveSyncPostsCount(binding);
        const postsResult = getVkPosts(vkGroupId, syncCount, binding.id);
        
        if (!postsResult.success) {
          logEvent("WARN", "get_vk_posts_failed", "client",
                   `Binding ID: ${binding.id}, Status: ${postsResult.httpStatus || 'n/a'}, Error: ${postsResult.error || 'Unknown error'}`);
          return;
        }
        
        const posts = postsResult.posts || [];
        if (posts.length === 0) {
          logEvent("DEBUG", "no_new_posts_for_binding", "client",
                   `Binding ID: ${binding.id}, VK Group: ${vkGroupId}`);
          return;
        }
        
        summary.newPostsFound += posts.length;
        
        posts.forEach(post => {
          try {
            const publishResult = publishPost(binding, post, license.key);
            
            if (publishResult.success) {
              summary.postsSent += 1;
              logEvent("INFO", "post_sent_to_telegram", "client",
                       `Binding ID: ${binding.id}, VK Post: ${post.id}, Message ID: ${publishResult.message_id || 'N/A'}`);
            } else {
              logEvent("ERROR", "post_send_failed", "client",
                       `Binding ID: ${binding.id}, VK Post: ${post.id}, Error: ${publishResult.error || 'Unknown error'}`);
            }
          } catch (sendError) {
            logEvent("ERROR", "post_publish_exception", "client",
                     `Binding ID: ${binding.id}, VK Post: ${post.id}, Error: ${sendError.message}`);
          }
        });
      } catch (bindingError) {
        logEvent("ERROR", "binding_check_error", "client",
                 `Binding ID: ${binding.id}, Error: ${bindingError.message}`);
      }
    });
    
    logEvent("INFO", "check_posts_complete", "client",
             `Checked: ${summary.bindingsChecked} bindings, Found: ${summary.newPostsFound} posts, Sent: ${summary.postsSent} posts`);
    
    return summary;
    
  } catch (error) {
    logEvent("ERROR", "check_posts_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

function resolveSyncPostsCount(binding) {
  const DEFAULT_COUNT = 10;
  try {
    const rawSettings = binding && binding.formatSettings;
    if (!rawSettings) {
      return DEFAULT_COUNT;
    }

    if (typeof rawSettings === 'object') {
      const value = rawSettings.syncPostsCount;
      if (typeof value === 'number' && !isNaN(value) && value > 0) {
        return Math.min(value, MAX_POSTS_CHECK);
      }
    }

    if (typeof rawSettings === 'string' && rawSettings.trim() !== '') {
      const parsed = JSON.parse(rawSettings);
      if (parsed && parsed.syncPostsCount) {
        const numeric = parseInt(parsed.syncPostsCount, 10);
        if (!isNaN(numeric) && numeric > 0) {
          return Math.min(numeric, MAX_POSTS_CHECK);
        }
      }
    }
  } catch (error) {
    logEvent("WARN", "resolve_sync_posts_count_failed", "client",
             `Binding ID: ${binding?.id || 'unknown'}, Error: ${error.message}`);
  }

  return DEFAULT_COUNT;
}

function publishPost(binding, vkPost, licenseKey) {
  try {
    var bindingId = binding?.id;
    logEvent("DEBUG", "publish_post_start", "client",
             `Binding: ${bindingId || 'unknown'}, Post ID: ${vkPost?.id}, Text length: ${vkPost?.text ? vkPost.text.length : 0}, Attachments: ${vkPost?.attachments ? vkPost.attachments.length : 0}`);
    
    var payload = {
      event: "send_post",
      license_key: licenseKey,
      binding_id: bindingId,
      vk_post: {
        id: vkPost?.id,
        text: vkPost?.text ? vkPost.text.substring(0, 4096) : "",
        date: vkPost?.date,
        attachments: vkPost?.attachments || []
      }
    };
    
    var result = callServer(payload);
    
    if (result.success) {
      // ✅ ЗАПИСЫВАЕМ ПУБЛИКАЦИЮ В ЛОКАЛЬНЫЙ ЛИСТ:
      var bindingName = binding.bindingName || binding.binding_name || "Unknown";
      
      // Используем publication data от сервера, если есть
      var publicationData = result.publication;
      
      if (!publicationData) {
        // Fallback: создаем сами, если сервер не вернул данные
        var vkGroupId = binding.vkGroupId || extractVkGroupId(binding.vkGroupUrl || binding.vk_group_url);
        publicationData = {
          vkGroupId: vkGroupId,
          vkPostId: vkPost.id,
          vkPostDate: new Date(vkPost.date * 1000).toISOString(),
          mediaCount: vkPost.attachments ? vkPost.attachments.length : 0,
          captionLength: vkPost.text ? vkPost.text.length : 0,
          tgChatId: binding.tgChatId || binding.tg_chat_id,
          tgMessageIds: result.message_id ? [result.message_id] : [],
          status: "sent",
          notes: ""
        };
      }
      
      writePublicationRow(bindingName, publicationData);
      
      logEvent("INFO", "post_published", "client", 
               `Binding: ${bindingName}, VK Post: ${vkPost.id}, Status: ${publicationData.status}, TG Messages: ${publicationData.tgMessageIds || 'none'}`);
    } else {
      logEvent("WARN", "post_publish_failed", "client", 
               `Binding: ${bindingId}, Error: ${result.error}`);
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "publish_post_exception", "client", error.message);
    return { success: false, error: error.message };
  }
}

// ❌ ВОЗМОЖНО НЕТ handleGetUserBindingsWithNames():
function handleGetUserBindingsWithNames(payload, clientIp) {
  try {
    const bindings = getUserBindings(payload.license_key);
    
    // ✅ ДОБАВИТЬ НОВЫЕ ПОЛЯ:
    const enhancedBindings = bindings.map(binding => ({
      ...binding,
      bindingName: binding.bindingName || null,         // ← ДОБАВЬ ЭТИ ПОЛЯ!
      bindingDescription: binding.bindingDescription || null  // ← ДОБАВЬ ЭТИ ПОЛЯ!
    }));
    
    return jsonResponse({ 
      success: true, 
      bindings: enhancedBindings  // ← ВОЗВРАЩАЙ С НОВЫМИ ПОЛЯМИ!
    });
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================
// 4. VK API ФУНКЦИИ
// ============================================

function getVkPosts(vkGroupId, count, bindingId) {
  try {
    if (!vkGroupId) {
      logEvent("WARN", "get_vk_posts_missing_group", "client", "VK Group ID is required");
      return { success: false, error: "VK group ID is required", posts: [] };
    }
    
    logEvent("DEBUG", "get_vk_posts_start", "client", `VK Group ID: ${vkGroupId}`);
    
    const license = getLicense();
    if (!license) {
      logEvent("ERROR", "no_license_for_vk_posts", "client", `Group: ${vkGroupId}`);
      return { success: false, error: "❌ Лицензия не найдена", posts: [] };
    }
    
    const payload = {
      event: "get_vk_posts",
      license_key: license.key,
      vk_group_id: vkGroupId,
      binding_id: bindingId,
      count: Math.min(count || MAX_POSTS_CHECK, MAX_POSTS_CHECK)
    };
    
    const result = callServer(payload);
    
    if (!result.success) {
      logEvent("WARN", "get_vk_posts_failed", "client", `Group ID: ${vkGroupId}, Status: ${result.httpStatus || 'n/a'}, Error: ${result.error || 'Unknown error'}`);
      result.posts = result.posts || [];
      return result;
    }
    
    result.posts = result.posts || [];
    logEvent("INFO", "vk_posts_retrieved", "client",
             `Group ID: ${vkGroupId}, Posts: ${result.posts.length}, Filtered: ${result.filtered_count != null ? result.filtered_count : result.posts.length}`);
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "get_vk_posts_exception", "client",
             `Group ID: ${vkGroupId}, Error: ${error.message}`);
    return { success: false, error: error.message, posts: [] };
  }
}

function validateVkGroupId(id) {
  try {
    if (!id) {
      logEvent("WARN", "vk_id_empty", "client", "VK Group ID is empty");
      return false;
    }
    
    // Должно быть: -123456 (для групп) или 123456 (для пользователей/страниц)
    const isValid = /^-?\d+$/.test(id);
    
    if (!isValid) {
      logEvent("ERROR", "invalid_vk_group_id_format", "client", `Invalid ID format: ${id}`);
      return false;
    }
    
    // Дополнительная проверка: ID не должен быть слишком коротким
    const numericPart = id.replace('-', '');
    if (numericPart.length < 4) {
      logEvent("WARN", "vk_id_too_short", "client", `ID seems too short: ${id}`);
      return false;
    }
    
    logEvent("DEBUG", "vk_id_validated", "client", `ID is valid: ${id}`);
    return true;
    
  } catch (error) {
    logEvent("ERROR", "validate_vk_id_error", "client", `ID: ${id}, Error: ${error.message}`);
    return false;
  }
}

function extractVkGroupId(url) {
  try {
    if (!url || typeof url !== 'string') {
      logEvent("WARN", "invalid_vk_url_type", "client", `URL type: ${typeof url}`);
      return null;
    }
    
    var originalInput = url;
    var cleanInput = url.trim().toLowerCase().split("?")[0].split("#")[0];
    
    logEvent("DEBUG", "vk_group_id_extraction_start", "client", `Input: "${originalInput}" → Clean: "${cleanInput}"`);

    // Если уже ID (число с минусом или без)
    if (/^-?\d+$/.test(cleanInput)) {
      // Группы ВСЕГДА должны иметь минус
      var normalizedId = cleanInput.startsWith("-") ? cleanInput : "-" + cleanInput;
      if (validateVkGroupId(normalizedId)) {
        return normalizedId;
      } else {
        return null;
      }
    }

    // Форматы: vk.com/public123, vk.com/club123
    var publicClubMatch = cleanInput.match(/vk\.com\/(public|club)(\d+)/i);
    if (publicClubMatch) {
      var result = "-" + publicClubMatch[2];
      if (validateVkGroupId(result)) {
        return result;
      } else {
        return null;
      }
    }

    // Формат: vk.com/wall-123456_789
    var wallMatch = cleanInput.match(/vk\.com\/wall(-?\d+)_\d+/i);
    if (wallMatch) {
      var groupId = wallMatch[1];
      var normalizedGroupId = groupId.startsWith("-") ? groupId : "-" + groupId;
      if (validateVkGroupId(normalizedGroupId)) {
        return normalizedGroupId;
      } else {
        return null;
      }
    }

    // Screen name (например: vk.com/durov или просто "durov")
    // НА КЛИЕНТЕ: возвращаем null, сервер резолвит через API
    var screenNameMatch = cleanInput.match(/vk\.com\/([a-z0-9_]+)/i) || 
                        cleanInput.match(/^([a-z0-9_]+)$/i);
    
    if (screenNameMatch) {
      logEvent("DEBUG", "vk_screen_name_detected", "client", 
               "Screen name: " + screenNameMatch[1] + " - needs server resolution");
      return null; // Сервер резолвит
    }
    
    return null;
    
  } catch (error) {
    logEvent("ERROR", "extract_vk_group_id_exception", "client", error.message);
    return null;
  }
}

// ============================================
// 4. УТИЛИТЫ ПАРСИНГА И ИЗВЛЕЧЕНИЯ ID
// ============================================

/**
 * Клиентская функция извлечения chat_id Telegram с поддержкой всех форматов из ARCHITECTURE.md
 * Поддерживаемые форматы:
 * - @channelname → "@channelname"
 * - https://t.me/channelname → "@channelname"
 * - t.me/username → "@username"  
 * - channelname → "@channelname"
 * - -1001234567890 → "-1001234567890"
 * - 123456789 → "123456789"
 */
function extractTelegramChatId(input) {
  try {
    if (!input || typeof input !== 'string') {
      return null;
    }

    const originalInput = input;
    const cleanInput = input.trim().toLowerCase().split('?')[0].split('#')[0];

    // Если уже chat_id (число с возможным минусом)
    if (/^-?\d+$/.test(cleanInput)) {
      return cleanInput;
    }

    // Извлекаем username из различных форматов
    let username = null;

    // Форматы в порядке приоритета:
    const patterns = [
      /https?:\/\/t\.me\/([a-z0-9_]+)/i,  // https://t.me/username
      /t\.me\/([a-z0-9_]+)/i,            // t.me/username
      /@([a-z0-9_]+)/i,                  // @username
      /^([a-z0-9_]+)$/i                  // просто username
    ];

    for (const pattern of patterns) {
      const match = cleanInput.match(pattern);
      if (match) {
        username = match[1];
        break;
      }
    }

    if (!username) {
      return null;
    }

    // Валидация username
    if (!/^[a-z0-9_]+$/i.test(username)) {
      return null;
    }

    const result = '@' + username;
    
    return result;
    
  } catch (error) {
    return null;
  }
}

/**
 * Клиентская функция очистки старых логов (более 30 дней) из клиентских лог-листов
 * Обрабатывает листы: "Client Logs" и другие листы с "Log" в названии в клиентской таблице
 */
function cleanOldLogsInternal() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = ss.getSheets();
    const logSheets = [];
    
    // Ищем все клиентские листы с логами
    for (let i = 0; i < allSheets.length; i++) {
      const sheetName = allSheets[i].getName();
      if (sheetName === "Client Logs" || sheetName.toLowerCase().includes("log")) {
        logSheets.push(allSheets[i]);
      }
    }
    
    if (logSheets.length === 0) {
      logEvent("WARN", "no_client_log_sheets_found", "client", "No client log sheets found for cleanup");
      return { totalDeleted: 0, sheetResults: [] };
    }
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    const sheetResults = [];
    
    logEvent("INFO", "client_log_cleanup_started", "client", `Starting cleanup of ${logSheets.length} client log sheets older than ${thirtyDaysAgo.toISOString()}`);
    
    // Обрабатываем каждый лог-лист
    for (let j = 0; j < logSheets.length; j++) {
      const sheet = logSheets[j];
      const sheetName = sheet.getName();
      let sheetDeletedCount = 0;
      
      try {
        // Проверяем, есть ли у листа данные
        const dataRange = sheet.getDataRange();
        const data = dataRange.getValues();
        
        if (data.length <= 1) { // Только заголовок или пустой лист
          logEvent("DEBUG", "client_log_cleanup_sheet_empty", "client", `Sheet "${sheetName}" is empty or has only headers`);
          sheetResults.push({ sheetName: sheetName, deletedCount: 0, status: "empty" });
          continue;
        }
        
        // Удаляем старые записи (начиная с конца, чтобы не сбивать индексы)
        for (let i = data.length - 1; i >= 1; i--) {
          try {
            const logDate = new Date(data[i][0]);
            
            // Проверяем валидность даты
            if (isNaN(logDate.getTime())) {
              logEvent("DEBUG", "client_log_cleanup_invalid_date", "client", `Invalid date in sheet "${sheetName}" row ${i + 1}: ${data[i][0]}`);
              continue;
            }
            
            if (logDate < thirtyDaysAgo) {
              sheet.deleteRow(i + 1);
              sheetDeletedCount++;
            }
          } catch (rowError) {
            logEvent("WARN", "client_log_cleanup_row_error", "client", `Error processing row ${i + 1} in sheet "${sheetName}": ${rowError.message}`);
          }
        }
        
        totalDeleted += sheetDeletedCount;
        sheetResults.push({ 
          sheetName: sheetName, 
          deletedCount: sheetDeletedCount, 
          status: "success",
          totalRows: data.length
        });
        
        logEvent("INFO", "client_log_cleanup_sheet_completed", "client", `Sheet "${sheetName}": deleted ${sheetDeletedCount} of ${data.length - 1} entries`);
        
      } catch (sheetError) {
        logEvent("ERROR", "client_log_cleanup_sheet_error", "client", `Error processing sheet "${sheetName}": ${sheetError.message}`);
        sheetResults.push({ 
          sheetName: sheetName, 
          deletedCount: 0, 
          status: "error", 
          error: sheetError.message 
        });
      }
    }
    
    // Финальная сводка
    const summary = {
      totalDeleted: totalDeleted,
      sheetsProcessed: logSheets.length,
      cutoffDate: thirtyDaysAgo.toISOString(),
      sheetResults: sheetResults
    };
    
    return summary;
    
  } catch (error) {
    logEvent("ERROR", "client_log_cleanup_error", "client", error.message);
    return { totalDeleted: 0, sheetResults: [], error: error.message };
  }
}

/**
 * UI функция для очистки старых логов с показом результата пользователю
 */
function cleanOldLogs() {
  try {
    const result = cleanOldLogsInternal();
    
    if (result.error) {
      SpreadsheetApp.getUi().alert("❌ Ошибка очистки логов: " + result.error);
      return;
    }
    
    const message = `✅ Очистка логов завершена!\n\n` +
      `Удалено записей: ${result.totalDeleted}\n` +
      `Обработано листов: ${result.sheetsProcessed || result.sheetResults?.length || 0}`;
    
    SpreadsheetApp.getUi().alert(message);
    
  } catch (error) {
    logCriticalUiError("clean_logs_ui_error", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка: " + error.message);
  }
}

// ============================================
// 5. УТИЛИТЫ СОХРАНЕНИЯ СОСТОЯНИЯ
// ============================================

function getLicense() {
  try {
    const licenseKey = PropertiesService.getUserProperties().getProperty("LICENSE_KEY");
    
    if (!licenseKey) {
      logEvent("DEBUG", "no_license_stored", "client", "License key not found in properties");
      return null;
    }
    
    logEvent("DEBUG", "license_key_found", "client", `License: ${licenseKey.substring(0, 20)}...`);
    
    // Получаем полную информацию о лицензии с сервера
    try {
      const payload = {
        event: "check_license",
        license_key: licenseKey
      };
      
      const response = UrlFetchApp.fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        timeout: REQUEST_TIMEOUT
      });
      
      const result = JSON.parse(response.getContentText());
      
      if (result.success && result.license) {
        logEvent("DEBUG", "license_details_retrieved", "client", 
                 `Type: ${result.license.type}, Max Groups: ${result.license.maxGroups}`);
        
        return {
          key: licenseKey,
          type: result.license.type,
          maxGroups: result.license.maxGroups,
          expires: result.license.expires
        };
      } else {
        logEvent("WARN", "license_verification_failed", "client", result.error || "Unknown error");
        // Возвращаем только ключ если сервер недоступен
        return { key: licenseKey };
      }
      
    } catch (serverError) {
      // Возвращаем только ключ если сервер недоступен
      return { key: licenseKey };
    }
    
  } catch (error) {
    return null;
  }
}

// ============================================
// 6. ЛОГИРОВАНИЕ (ТОЛЬКО КРИТИЧЕСКИЕ UI ОШИБКИ)
// ============================================
/**
 * Только для критических UI ошибок - все бизнес-логи идут через сервер
 * @param {string} event - тип ошибки
 * @param {string} details - детали ошибки
 */
function logCriticalUiError(event, details) {
  try {
    console.error(`[UI_ERROR] ${event}: ${details}`);
    // Можно добавить отправку критических ошибок на сервер, если нужно
  } catch (e) {
    console.error("Failed to log critical UI error:", e.message);
  }
}

// ============================================
// 7. УПРАВЛЕНИЕ ТРИГГЕРАМИ И РАЗРЕШЕНИЯМИ
// ============================================

/**
 * Функция для первичной активации разрешений ScriptApp
 * Пользователь должен запустить её вручную из редактора Apps Script
 */
function doFirstAuth() {
  try {
    // Пытаемся получить доступ к триггерам (требует авторизации)
    const triggers = ScriptApp.getProjectTriggers();
    
    SpreadsheetApp.getUi().alert(
      "✅ Разрешения активированы!\n\n" +
      "Теперь вы можете настроить автопроверку из панели управления."
    );
    
    return { success: true, message: "Authorization granted" };
    
  } catch (error) {
    logCriticalUiError("first_auth_error", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка авторизации: " + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Проверяет, есть ли у скрипта разрешения ScriptApp
 */
function checkScriptAppPermissions() {
  try {
    ScriptApp.getProjectTriggers();
    return { success: true, hasPermissions: true };
  } catch (error) {
    return { success: true, hasPermissions: false, error: error.message };
  }
}

function setupTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === "checkNewPosts") {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    ScriptApp.newTrigger("checkNewPosts")
      .timeBased()
      .everyMinutes(30)
      .create();
    
    SpreadsheetApp.getUi().alert(
      "✅ Автопроверка установлена!\n\n" +
      "Посты будут проверяться каждые 30 минут.\n\n" +
      "Проверить статус можно в:\n" +
      "Панель управления → Триггеры (слева)"
    );
    
  } catch (error) {
    // Если ошибка связана с разрешениями, показываем подробное сообщение
    if (error.message.includes("Authorization") || error.message.includes("permission")) {
      SpreadsheetApp.getUi().alert(
        "❌ Ошибка: Недостаточно разрешений!\n\n" +
        "Для настройки автопроверки нужно активировать разрешения ScriptApp.\n\n" +
        "Инструкция:\n" +
        "1. Откройте редактор Apps Script (Расширения → Apps Script)\n" +
        "2. Найдите функцию 'doFirstAuth' в файле client.gs\n" +
        "3. Нажмите кнопку 'Выполнить' (▶️)\n" +
        "4. Разрешите доступ к ScriptApp\n" +
        "5. Вернитесь сюда и повторите попытку"
      );
    } else {
      SpreadsheetApp.getUi().alert("❌ Ошибка установки триггера: " + error.message);
    }
  }
}

// ============================================
// 8. СТАТИСТИКА
// ============================================

function showUserStatistics() {
  try {
    const license = getLicense();
    
    if (!license) {
      SpreadsheetApp.getUi().alert("❌ Лицензия не активирована");
      return;
    }
    
    const bindingsResult = getBindings();
    const bindings = bindingsResult.success ? bindingsResult.bindings : [];
    
    const activeBindings = bindings.filter(b => b.status === "active").length;
    const pausedBindings = bindings.filter(b => b.status === "paused").length;
    
    // Подсчитаем отправленные посты из листов публикаций по именам связок
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets().filter(s => {
      const name = s.getName();
      return name !== "Logs" && 
             name !== "Config" && 
             name !== "Licenses" &&
             name !== "Bindings" &&
             !name.startsWith("Sheet"); // Исключаем системные листы
    });
    
    let totalPostsSent = 0;
    sheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      if (data.length > 1 && data[0].length >= 2) {
        // Проверяем, что это лист публикаций (есть колонка статуса)
        const hasStatusColumn = data[0][1] === "Status" || data[0][1].toString().toLowerCase().includes("status");
        if (hasStatusColumn) {
          totalPostsSent += Math.max(0, data.length - 1);
        }
      }
    });
    
    const triggerCount = ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === "checkNewPosts").length;
    
    const message = `📊 Статистика VK→Telegram Manager v${CLIENT_VERSION}\n\n` +
      `🔑 Лицензия: ${license.key.substring(0, 20)}...\n` +
      `🔗 Связок: ${bindings.length} (${activeBindings} активных, ${pausedBindings} на паузе)\n` +
      `✉️ Отправлено постов: ${totalPostsSent}\n` +
      `⏱️ Авто-проверка: ${triggerCount > 0 ? '✅ Включена' : '❌ Выключена'}\n` +
      `📁 Листов отслеживания: ${sheets.length}\n` +
      `🌐 Сервер: ${SERVER_URL.substring(0, 50)}...\n`;
    
    SpreadsheetApp.getUi().alert(message);
    
  } catch (error) {
    logCriticalUiError("show_statistics_error", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка: " + error.message);
  }
}

// ============================================
// 9. HTML ИНТЕРФЕЙС
// ============================================

function getMainPanelHtml() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VK→Telegram Manager</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fa; color: #333; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 40px; text-align: center; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 30px 40px; max-width: 1000px; margin: 0 auto; }
    .section { background: white; padding: 24px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .section h2 { font-size: 18px; color: #333; margin-bottom: 20px; font-weight: 600; display: flex; align-items: center; }
    .section h2 .icon { margin-right: 10px; font-size: 20px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-weight: 600; color: #333; margin-bottom: 8px; font-size: 14px; }
    input, select { width: 100%; padding: 12px; border: 2px solid #f0f0f0; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    input:focus, select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
    .hint { font-size: 12px; color: #999; margin-top: 6px; line-height: 1.4; }
    button { padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.3s; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 100%; }
    .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3); }
    .btn-secondary { background: #e5e7eb; color: #374151; width: 100%; }
    .btn-secondary:hover:not(:disabled) { background: #d1d5db; }
    .btn-small { padding: 6px 12px; font-size: 12px; width: auto; }
    .btn-success { background: #10b981; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-warning { background: #f59e0b; color: white; }
    button:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
    .message { padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; display: none; }
    .message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; display: block; }
    .message.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; display: block; }
    .message.warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; display: block; }
    .message.loading { background: #e7f3ff; color: #004085; display: block; }
    .loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; display: none; }
    .loader.show { display: flex; }
    .spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .bindings-list { max-height: 300px; overflow-y: auto; }
    .binding-item { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .binding-item.paused { opacity: 0.6; background: #fff3cd; border-color: #ffeaa7; }
    .binding-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .binding-info { flex: 1; }
    .binding-actions { display: flex; gap: 6px; margin-left: 12px; }
    .binding-vk { font-weight: 600; color: #333; margin-bottom: 4px; word-break: break-all; }
    .binding-tg { font-size: 12px; color: #666; font-family: 'Courier New', monospace; }
    .binding-status { font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #d4edda; color: #155724; }
    .status-paused { background: #fff3cd; color: #856404; }
    .empty-state { text-align: center; color: #999; padding: 40px 20px; font-style: italic; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
    .stat-label { font-size: 12px; opacity: 0.9; }
    .license-info { background: #e7f3ff; border: 1px solid #bee5eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; position: relative; }
    .license-type { font-weight: 600; color: #004085; font-size: 16px; margin-bottom: 4px; }
    .license-details { font-size: 13px; color: #004085; opacity: 0.8; }
    .license-change { position: absolute; top: 16px; right: 16px; }
    /* Modal styles */
    .modal { display: none; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); }
    .modal.show { display: flex; justify-content: center; align-items: center; }
    .modal-content { background: white; padding: 30px; border-radius: 12px; width: 90%; max-width: 500px; max-height: 80%; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-title { font-size: 20px; font-weight: 600; color: #333; }
    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; color: #999; }
    .modal-close:hover { color: #333; }
    .modal-form { display: flex; flex-direction: column; gap: 20px; }
    .modal-buttons { display: flex; gap: 12px; margin-top: 20px; }
    .modal-buttons button { flex: 1; }
    
    /* Collapse/Expand styles */
    .header-controls { position: absolute; top: 30px; right: 40px; }
    .collapse-btn { background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s; }
    .collapse-btn:hover { background: rgba(255,255,255,0.3); }
    .content.collapsed { display: none; }
    .mini-controls { display: none; padding: 20px 40px; background: #f5f7fa; border-top: 2px solid #667eea; }
    .mini-controls.show { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .mini-info { flex: 1; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="loader" id="loader">
    <div class="spinner"></div>
  </div>

  <!-- Modal for Add/Edit Binding -->
  <div class="modal" id="binding-modal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title" id="modal-title">➕ Добавить связку</div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div id="modal-message" class="message"></div>
      <form class="modal-form" onsubmit="event.preventDefault(); submitBinding();">
        
        <!-- ✅ НОВЫЕ ПОЛЯ ДЛЯ НАЗВАНИЯ И ОПИСАНИЯ: -->
        <div class="form-group">
          <label>📝 Название связки <span style="color: red;">*</span></label>
          <input type="text" id="modal-binding-name" placeholder="Например: Новости компании, Акции магазина..." required maxlength="100">
          <div class="hint">Короткое название, чтобы легко отличать связки друг от друга</div>
        </div>
        
        <div class="form-group">
          <label>📄 Описание (необязательно)</label>
          <textarea id="modal-binding-description" placeholder="Дополнительная информация о связке..." rows="2" style="width: 100%; padding: 12px; border: 2px solid #f0f0f0; border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical;" maxlength="500"></textarea>
          <div class="hint">Дополнительные заметки, если нужны</div>
        </div>
        
        <div style="border-top: 1px solid #f0f0f0; margin: 20px 0; padding-top: 20px;"></div>
        
        <!-- ОСНОВНЫЕ ПОЛЯ: -->
        <div class="form-group">
          <label>🔗 URL группы ВКонтакте <span style="color: red;">*</span></label>
          <input type="text" id="modal-vk-url" placeholder="https://vk.com/public123456 или club123456" required>
          <div class="hint">Укажите URL или ID группы ВК (public123456, club123456, или -123456)</div>
        </div>
        
        <div class="form-group">
          <label>📱 ID Telegram чата/канала <span style="color: red;">*</span></label>
          <input type="text" id="modal-tg-chat" placeholder="-1001234567890 или @channel_name" required>
          <div class="hint">ID чата (с минусом для групп) или @имя_канала</div>
        </div>
        
        <!-- НАСТРОЙКИ ФОРМАТИРОВАНИЯ: -->
        <div style="border-top: 1px solid #f0f0f0; margin: 20px 0; padding-top: 20px;">
          <label style="font-size: 16px; color: #333; margin-bottom: 15px; display: block;">⚙️ Настройки форматирования</label>
          
          <div class="form-group" style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; font-weight: normal; cursor: pointer;">
              <input type="checkbox" id="modal-bold-first-line" checked style="width: auto; margin-right: 10px;">
              <strong>Первая строчка выделить жирным</strong>
            </label>
            <div class="hint">Первое предложение поста будет выделено жирным шрифтом</div>
          </div>
          
          <div class="form-group" style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; font-weight: normal; cursor: pointer;">
              <input type="checkbox" id="modal-bold-uppercase" checked style="width: auto; margin-right: 10px;">
              <strong>ВСЕ ЗАГЛАВНЫЕ БУКВЫ ВЫДЕЛИТЬ ЖИРНЫМ</strong>
            </label>
            <div class="hint">Слова, написанные заглавными буквами, будут выделены жирным</div>
          </div>
          
          <div class="form-group" style="margin-bottom: 15px;">
            <label>📊 Синхронизировать последние посты</label>
            <select id="modal-sync-posts" style="width: 100%;">
              <option value="1">Только последний пост</option>
              <option value="3">Последние 3 поста</option>
              <option value="5">Последние 5 постов</option>
              <option value="10">Последние 10 постов</option>
            </select>
            <div class="hint">Количество постов для синхронизации при первой настройке</div>
          </div>
        </div>
        
        <!-- КНОПКИ: -->
        <div class="modal-buttons">
          <button type="button" class="btn-secondary" onclick="closeModal()">❌ Отмена</button>
          <button type="submit" class="btn-primary" id="submit-binding-btn">✅ Сохранить</button>
        </div>
      </form>
    </div>
  </div>

  <div class="header">
    <div class="header-controls">
      <button class="collapse-btn" onclick="togglePanel()">
        <span id="toggle-icon">▼</span> <span id="toggle-text">Свернуть</span>
      </button>
    </div>
    <h1>VK→Telegram Manager</h1>
    <p>Кросспостинг из ВКонтакте в Telegram</p>
  </div>
  
  <!-- Mini controls (shown when collapsed) -->
  <div class="mini-controls" id="mini-controls">
    <div class="mini-info">
      <strong>VK→TG Manager:</strong> <span id="mini-status">Система готова к работе</span>
    </div>
    <button class="btn-primary" onclick="togglePanel()">
      <span id="toggle-icon-mini">▲</span> Развернуть панель
    </button>
  </div>

  <div class="content">
    <!-- License Section -->
    <div class="section" id="license-section">
      <h2><span class="icon">🔑</span> 1. Активация лицензии</h2>
      <div id="license-message" class="message"></div>
      
      <div id="license-input-form">
        <div class="form-group">
          <label>Ключ лицензии</label>
          <input type="text" id="license-key-input" placeholder="LICENSE-TRIAL-ABC123-2025-12-31">
          <div class="hint">Укажите ключ лицензии, выданный администратором</div>
        </div>
        <button class="btn-primary" onclick="checkAndSaveLicense()">✅ Активировать лицензию</button>
      </div>

      <div id="license-info" class="license-info" style="display: none;">
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button class="btn-small btn-secondary license-change" onclick="changeLicense()">🔄 Изменить</button>
          <button class="btn-small btn-secondary license-check" onclick="checkLicenseStatus()">🔍 Проверить лицензию</button>
        </div>
        <div class="license-type" id="license-type-display"></div>
        <div class="license-details" id="license-details-display"></div>
      </div>
    </div>

    <!-- Bindings Section -->
    <div class="section" id="bindings-section" style="display: none;">
      <h2><span class="icon">🔗</span> 2. Связки (VK → TG)</h2>
      <div id="bindings-message" class="message"></div>
      
      <div class="stats-grid" id="bindings-stats" style="display: none;">
        <div class="stat-card">
          <div class="stat-value" id="active-bindings">0</div>
          <div class="stat-label">Активных</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="paused-bindings">0</div>
          <div class="stat-label">На паузе</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="total-bindings">0</div>
          <div class="stat-label">Всего</div>
        </div>
      </div>

      <!-- Глобальные настройки -->
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
        <label style="display: flex; align-items: center; font-weight: normal; cursor: pointer; color: #495057;">
          <input type="checkbox" id="disable-all-stores" style="width: auto; margin-right: 12px;" onchange="toggleAllStores()">
          <span style="font-size: 14px;"><strong>🏪 Выключить все магазины</strong></span>
        </label>
        <div class="hint" style="margin-top: 8px; margin-left: 24px;">При включении этой опции посты о товарах в магазинах ВК не будут пересылаться в Telegram</div>
      </div>

      <div id="bindings-list" class="bindings-list"></div>
      <button class="btn-secondary" id="add-binding-btn" onclick="showAddBindingDialog()" style="margin-top: 16px;">➕ Добавить связку</button>
    </div>

    <!-- Status Section -->
    <div class="section" id="status-section" style="display: none;">
      <h2><span class="icon">📊</span> 3. Статус системы</h2>
      <div id="status-message" class="message"></div>
      <div id="status-content"></div>
      
      <div style="margin-top: 20px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <button class="btn-secondary" onclick="manualCheck()">🔄 Проверить посты</button>
        <button class="btn-secondary" onclick="setupAutoCheck()">⏱️ Авто-проверка</button>
      </div>
    </div>

    <!-- Logs Section -->
    <div class="section" id="logs-section" style="display: none;">
      <h2><span class="icon">📋</span> 4. Логи системы</h2>
      <div id="logs-message" class="message"></div>
      
      <!-- Фильтры -->
      <div style="margin-bottom: 20px; display: flex; gap: 12px;">
        <select id="log-level-filter" onchange="filterLogs()" style="width: auto;">
          <option value="">Все уровни</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
          <option value="DEBUG">DEBUG</option>
        </select>
        
        <input type="text" id="log-search" placeholder="Поиск по событию..." 
               onkeyup="filterLogs()" style="flex: 1;">
        
        <button class="btn-small btn-secondary" onclick="refreshLogs()">🔄 Обновить</button>
        <button class="btn-small btn-danger" onclick="clearOldLogs()">🧹 Очистить старые</button>
      </div>
      
      <!-- Таблица логов -->
      <div id="logs-table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid #e9ecef; border-radius: 8px;">
        <table id="logs-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #667eea; color: white; position: sticky; top: 0;">
              <th style="padding: 10px; text-align: left;">Timestamp</th>
              <th style="padding: 10px; text-align: center;">Level</th>
              <th style="padding: 10px; text-align: left;">Event</th>
              <th style="padding: 10px; text-align: left;">Details</th>
            </tr>
          </thead>
          <tbody id="logs-table-body">
            <tr><td colspan="4" style="text-align: center; padding: 40px; color: #999;">Загрузка логов...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    const SERVER_URL = "${SERVER_URL}";
    let appState = {
      license: null,
      bindings: [],
      stats: { active: 0, paused: 0, total: 0 },
      currentEditingId: null
    };

    // Utility function for console logging
    function logMessageToConsole(message) {
      console.log('[VK→TG] ' + message);
    }

    document.addEventListener("DOMContentLoaded", function() {
      loadInitialData();
    });

    function loadInitialData() {
      logMessageToConsole("Loading initial data...");
      showLoader(true);
      
      google.script.run
        .withSuccessHandler(function(data) {
          logMessageToConsole("Initial data received: License=" + !!data.license + ", Bindings=" + (data.bindings?.length || 0));
          showLoader(false);
          
          if (data.success) {
            appState.license = data.license;
            appState.bindings = data.bindings || [];
            updateUI();
            
            // Загружаем глобальные настройки
            loadGlobalSettings();
            
            logMessageToConsole("UI updated successfully");
          } else {
            showMessage("license", "error", data.error || "Ошибка загрузки");
            logMessageToConsole("Initial data error: " + (data.error || "Unknown error"));
          }
        })
        .withFailureHandler(function(error) {
          logMessageToConsole("Initial data fetch failed: " + error.message);
          showLoader(false);
          showMessage("license", "error", "❌ Ошибка: " + error.message);
        })
        .getInitialData();
    }

    function updateUI() {
      updateLicenseSection();
      updateBindingsSection();
      updateStatusSection();
    }

    function updateLicenseSection() {
      const licenseInputForm = document.getElementById("license-input-form");
      const licenseInfo = document.getElementById("license-info");
      const licenseTypeDisplay = document.getElementById("license-type-display");
      const licenseDetailsDisplay = document.getElementById("license-details-display");

      if (appState.license) {
        licenseInputForm.style.display = "none";
        licenseInfo.style.display = "block";
        
        // Safe handling of license properties with fallbacks
        const licenseType = appState.license.type || "UNKNOWN";
        const maxGroups = appState.license.maxGroups || "N/A";
        const expires = appState.license.expires;
        
        licenseTypeDisplay.textContent = "✅ " + licenseType;
        
        let expiresText = "N/A";
        if (expires) {
          try {
            const expiresDate = new Date(expires);
            if (!isNaN(expiresDate.getTime())) {
              expiresText = expiresDate.toLocaleDateString();
            }
          } catch (e) {
            logMessageToConsole("Error parsing expires date: " + e.message);
          }
        }
        
        licenseDetailsDisplay.innerHTML = "<strong>Максимум групп:</strong> " + maxGroups + "<br>" +
          "<strong>Действительна до:</strong> " + expiresText + "<br>" +
          "<strong>Ключ:</strong> " + (appState.license.key ? appState.license.key.substring(0, 20) + "..." : "N/A");
        
        document.getElementById("bindings-section").style.display = "block";
        document.getElementById("status-section").style.display = "block";
      } else {
        licenseInputForm.style.display = "block";
        licenseInfo.style.display = "none";
        document.getElementById("bindings-section").style.display = "none";
        document.getElementById("status-section").style.display = "none";
      }
    }

    function updateBindingsSection() {
      if (!appState.license) return;

      const bindings = appState.bindings;
      const activeBindings = bindings.filter(b => b.status === "active").length;
      const pausedBindings = bindings.filter(b => b.status === "paused").length;

      appState.stats = { active: activeBindings, paused: pausedBindings, total: bindings.length };

      document.getElementById("active-bindings").textContent = activeBindings;
      document.getElementById("paused-bindings").textContent = pausedBindings;
      document.getElementById("total-bindings").textContent = bindings.length;

      const statsGrid = document.getElementById("bindings-stats");
      if (bindings.length === 0) {
        statsGrid.style.display = "none";
      } else {
        statsGrid.style.display = "grid";
      }

      const bindingsList = document.getElementById("bindings-list");
      if (bindings.length === 0) {
        bindingsList.innerHTML = '<div class="empty-state">Нет связок<br><br>Добавьте первую связку для начала кросспостинга</div>';
      } else {
        bindingsList.innerHTML = bindings.map(binding => {
          const isPaused = binding.status === "paused";
          
          // Получаем название связки и описание
          const bindingName = binding.bindingName || binding.binding_name || null;
          const bindingDesc = binding.bindingDescription || binding.binding_description || null;
          
          // Получаем VK и TG данные
          const vkUrl = binding.vkGroupUrl || binding.vk_group_url || 'N/A';
          const tgChat = binding.tgChatId || binding.tg_chat_id || 'N/A';
          
          return \`
            <div class="binding-item \${isPaused ? 'paused' : ''}" style="margin-bottom: 12px;">
              <div class="binding-header">
                <div class="binding-info">
                  <!-- Показываем название связки крупно -->
                  \${bindingName ? \`<div class="binding-vk" style="font-size: 16px; color: #667eea; margin-bottom: 6px;">📌 \${bindingName}</div>\` : ''}
                  \${bindingDesc ? \`<div style="font-size: 12px; color: #666; margin-bottom: 6px; font-style: italic;">\${bindingDesc}</div>\` : ''}
                  
                  <!-- VK и TG мельче -->
                  <div style="font-size: 12px; color: #888; margin-top: 4px;">
                    📰 VK: \${vkUrl}<br>
                    📱 TG: \${tgChat}
                  </div>
                </div>
                <div class="binding-actions">
                  <button class="btn-small btn-success" onclick="publishBinding('\${binding.id}')" title="▶️ Опубликовать последний пост">▶️</button>
                  <button class="btn-small btn-warning" onclick="toggleBinding('\${binding.id}')" title="\${binding.status === 'active' ? 'Пауза' : 'Включить'}">\${binding.status === 'active' ? '⏸️' : '▶️'}</button>
                  <button class="btn-small btn-secondary" onclick="editBinding('\${binding.id}')" title="Редактировать">✏️</button>
                  <button class="btn-small btn-danger" onclick="deleteBinding('\${binding.id}')" title="Удалить">🗑️</button>
                </div>
              </div>
              <div style="margin-top: 8px;">
                <span class="binding-status status-\${binding.status}">\${binding.status === 'active' ? 'АКТИВНА' : 'ПАУЗА'}</span>
              </div>
            </div>
          \`;
        }).join("");
      }

      const addButton = document.getElementById("add-binding-btn");
      if (bindings.length >= appState.license.maxGroups) {
        addButton.disabled = true;
        addButton.textContent = "❌ Лимит достигнут";
      } else {
        addButton.disabled = false;
        addButton.textContent = "➕ Добавить связку";
      }
    }

    function updateStatusSection() {
      if (!appState.license) return;

      const statusContent = document.getElementById("status-content");
      const serverStatus = SERVER_URL ? "✅ Подключен" : "❌ Ошибка подключения";

      statusContent.innerHTML = \`
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;">
          <div><strong>🌐 Сервер:</strong> \${serverStatus}</div>
          <div><strong>⏱️ Авто-проверка:</strong> ⚙️ Настраивается</div>
          <div><strong>📊 Статистика:</strong> \${appState.stats.total} связок (\${appState.stats.active} активных)</div>
          <div><strong>🔑 Лицензия:</strong> \${appState.license.type}</div>
        </div>

        <div style="margin-top: 16px; padding: 12px; background: #f8f9fa; border-radius: 6px; font-size: 13px; color: #666;">
          <strong>💡 Подсказка:</strong> Используйте "🔄 Проверить посты" для тестирования или "⏱️ Авто-проверка" для настройки автоматической проверки каждые 30 минут.
        </div>
      \`;
    }

    // ============================================
    // LICENSE FUNCTIONS
    // ============================================
    
    function checkAndSaveLicense() {
      try {
        logMessageToConsole('checkAndSaveLicense called');

        const licenseKey = document.getElementById("license-key-input");
        if (!licenseKey) {
          logMessageToConsole('ERROR: license-key-input element not found');
          showMessage("license", "error", "❌ Ошибка: элемент ввода лицензии не найден");
          return;
        }

        const keyValue = licenseKey.value.trim();

        if (!keyValue) {
          showMessage("license", "error", "❌ Укажите ключ лицензии");
          logMessageToConsole("User did not enter license key");
          return;
        }

        logMessageToConsole("Sending license key to server: " + keyValue.substring(0, 20) + "...");
        showMessage("license", "loading", "🔄 Проверка лицензии...");
        showLoader(true);

        google.script.run
          .withSuccessHandler(function(result) {
            logMessageToConsole("Success handler called with result: " + JSON.stringify(result).substring(0, 200));
            showLoader(false);

            if (result && result.success) {
              logMessageToConsole("License verified successfully");
              appState.license = result.license;
              updateUI();
              showMessage("license", "success", "✅ Лицензия активирована!");

              setTimeout(() => {
                const licenseMessage = document.getElementById("license-message");
                if (licenseMessage) {
                  licenseMessage.style.display = "none";
                }
              }, 3000);
            } else {
              const errorMsg = result?.error || "Неизвестная ошибка";
              logMessageToConsole("License check failed: " + errorMsg);
              showMessage("license", "error", errorMsg);
            }
          })
          .withFailureHandler(function(error) {
            logMessageToConsole("Failure handler called with error: " + error.message);
            showLoader(false);
            showMessage("license", "error", "❌ Ошибка: " + error.message);
          })
          .withUserObject({timestamp: new Date().toISOString()})
          .saveLicenseWithCheck(keyValue);

      } catch (error) {
        logMessageToConsole("Exception caught in checkAndSaveLicense: " + error.message);
        showLoader(false);
        showMessage("license", "error", "❌ Исключение: " + error.message);
      }
    }

    function changeLicense() {
      if (confirm("Изменить лицензию?\\n\\nВсе связки будут удалены.")) {
        appState.license = null;
        appState.bindings = [];
        document.getElementById("license-key-input").value = "";
        updateUI();
        showMessage("license", "warning", "🔄 Введите новый ключ лицензии");
      }
    }

    function checkLicenseStatus() {
      if (!appState.license) {
        showMessage("license", "error", "❌ Нет активной лицензии для проверки");
        return;
      }

      showMessage("license", "loading", "🔍 Проверка статуса лицензии...");
      logMessageToConsole("Checking license status");

      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.success) {
            appState.license = result.license;
            updateUI();
            showMessage("license", "success", "✅ Статус лицензии обновлен!");
            logMessageToConsole("License status check completed successfully");
          } else {
            const errorMsg = result?.error || "Ошибка проверки лицензии";
            showMessage("license", "error", "❌ " + errorMsg);
            logMessageToConsole("License status check failed: " + errorMsg);
          }
        })
        .withFailureHandler(function(error) {
          showMessage("license", "error", "❌ Ошибка: " + error.message);
          logMessageToConsole("License status check error: " + error.message);
        })
        .getLicense();
    }

    // ============================================
    // BINDING FUNCTIONS
    // ============================================

    function showAddBindingDialog() {
      appState.currentEditingId = null;
      document.getElementById("modal-title").textContent = "➕ Добавить связку";
      
      // ✅ ОЧИЩАЕМ ВСЕ ПОЛЯ:
      document.getElementById("modal-binding-name").value = "";
      document.getElementById("modal-binding-description").value = "";
      
      document.getElementById("modal-vk-url").value = "";
      document.getElementById("modal-tg-chat").value = "";
      
      // Настройки форматирования по умолчанию
      document.getElementById("modal-bold-first-line").checked = true;
      document.getElementById("modal-bold-uppercase").checked = true;
      document.getElementById("modal-sync-posts").value = "1";
      
      document.getElementById("submit-binding-btn").textContent = "✅ Добавить связку";
      clearModalMessage();
      openModal();
      logEvent("INFO", "add_binding_dialog_opened", "client", "User opened add binding dialog");
    }

    function editBinding(bindingId) {
  const binding = appState.bindings.find(b => b.id === bindingId);
  if (!binding) {
    showMessage("bindings", "error", "❌ Связка не найдена");
    return;
  }

  appState.currentEditingId = bindingId;
  document.getElementById("modal-title").textContent = "✏️ Редактировать связку";
  
  // ✅ ЗАПОЛНЯЕМ ВСЕ ПОЛЯ ИЗ BINDING:
  document.getElementById("modal-binding-name").value = binding.bindingName || binding.binding_name || "";
  document.getElementById("modal-binding-description").value = binding.bindingDescription || binding.binding_description || "";
  
  document.getElementById("modal-vk-url").value = binding.vkGroupUrl || binding.vk_group_url || "";
  document.getElementById("modal-tg-chat").value = binding.tgChatId || binding.tg_chat_id || "";
  
  // Загружаем настройки форматирования (с значениями по умолчанию если не заданы)
  document.getElementById("modal-bold-first-line").checked = binding.formatSettings?.boldFirstLine !== false;
  document.getElementById("modal-bold-uppercase").checked = binding.formatSettings?.boldUppercase !== false;
  document.getElementById("modal-sync-posts").value = binding.formatSettings?.syncPostsCount || "1";
  
  document.getElementById("submit-binding-btn").textContent = "✅ Сохранить изменения";
  clearModalMessage();
  openModal();    
    logEvent("INFO", "edit_binding_dialog_opened", "client", "Binding ID: " + bindingId + ", Name: " + (binding.bindingName || binding.binding_name || 'N/A'));
}

    function submitBinding() {
      // Читаем название и описание
      const bindingName = document.getElementById("modal-binding-name").value.trim();
      const bindingDescription = document.getElementById("modal-binding-description").value.trim();
      const vkUrl = document.getElementById("modal-vk-url").value.trim();
      const tgChat = document.getElementById("modal-tg-chat").value.trim();
      
      // Получаем настройки форматирования
      const boldFirstLine = document.getElementById("modal-bold-first-line").checked;
      const boldUppercase = document.getElementById("modal-bold-uppercase").checked;
      const syncPosts = document.getElementById("modal-sync-posts").value;
      
      const formatSettings = {
        boldFirstLine: boldFirstLine,
        boldUppercase: boldUppercase,
        syncPostsCount: parseInt(syncPosts, 10)
      };

      // Валидация обязательных полей
      if (!bindingName || !vkUrl || !tgChat) {
        showModalMessage("error", "❌ Заполните все обязательные поля (название, VK URL, TG Chat)");
        return;
      }

      showModalMessage("loading", "🔄 Сохранение...");
      document.getElementById("submit-binding-btn").disabled = true;

      const isEdit = !!appState.currentEditingId;
      const action = isEdit ? "editBinding" : "addBinding";
      const params = isEdit 
        ? [appState.currentEditingId, bindingName, bindingDescription, vkUrl, tgChat, formatSettings] 
        : [bindingName, bindingDescription, vkUrl, tgChat, formatSettings];

      google.script.run
        .withSuccessHandler(function(result) {
          document.getElementById("submit-binding-btn").disabled = false;
          
          if (result && result.success) {
            closeModal();
            refreshBindings();
            const message = isEdit ? "✅ Связка обновлена!" : "✅ Связка добавлена!";
            showMessage("bindings", "success", message);
            logEvent("INFO", "binding_operation_success", "client", "Action: " + action + ", Name: " + bindingName);
          } else {
            const errorMsg = result?.error || "Неизвестная ошибка";
            showModalMessage("error", errorMsg);
            logEvent("ERROR", "binding_operation_failed", "client", "Action: " + action + ", Error: " + errorMsg);
          }
        })
        .withFailureHandler(function(error) {
          document.getElementById("submit-binding-btn").disabled = false;
          showModalMessage("error", "❌ Ошибка: " + error.message);
          logEvent("ERROR", "binding_operation_error", "client", "Action: " + action + ", Error: " + error.message);
        })
        [action](...params);
    }


    function publishBinding(bindingId) {
      if (!confirm("▶️ Опубликовать последний пост из VK в Telegram?\\n\\nПост будет отправлен в канал согласно настройкам связки.")) {
        return;
      }

      showMessage("bindings", "loading", "▶️ Публикация последнего поста...");
      logMessageToConsole("Publishing last post for binding: " + bindingId);

      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.success) {
            showMessage("bindings", "success", "✅ Пост опубликован в Telegram!");
            logMessageToConsole("Publish binding successful for ID: " + bindingId);
          } else {
            const errorMsg = result?.error || "Ошибка публикации";
            showMessage("bindings", "error", "❌ " + errorMsg);
            logMessageToConsole("Publish binding failed: " + errorMsg);
          }
        })
        .withFailureHandler(function(error) {
          showMessage("bindings", "error", "❌ Ошибка: " + error.message);
          logMessageToConsole("Publish binding error: " + error.message);
        })
        .publishLastPost(bindingId);
    }

    // Alias для обратной совместимости
    function testBinding(bindingId) {
      return publishBinding(bindingId);
    }

    function toggleBinding(bindingId) {
      const binding = appState.bindings.find(b => b.id === bindingId);
      if (!binding) return;

      const newStatus = binding.status === "active" ? "paused" : "active";
      const action = newStatus === "active" ? "включить" : "поставить на паузу";
      
      if (!confirm(\`\${action === "включить" ? "Включить" : "Поставить на паузу"} связку?\\n\\n📰 \${binding.vkGroupUrl || binding.vk_group_url}\\n📱 \${binding.tgChatId || binding.tg_chat_id}\`)) {
        return;
      }

      showMessage("bindings", "loading", \`🔄 \${action === "включить" ? "Включение" : "Постановка на паузу"}...\`);
      logMessageToConsole("Toggling binding status: " + bindingId + " to " + newStatus);

      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.success) {
            refreshBindings();
            const message = newStatus === "active" ? "▶️ Связка включена!" : "⏸️ Связка на паузе";
            showMessage("bindings", "success", message);
            logMessageToConsole("Binding status toggled successfully");
          } else {
            const errorMsg = result?.error || "Ошибка изменения статуса";
            showMessage("bindings", "error", "❌ " + errorMsg);
            logMessageToConsole("Toggle binding failed: " + errorMsg);
          }
        })
        .withFailureHandler(function(error) {
          showMessage("bindings", "error", "❌ Ошибка: " + error.message);
          logMessageToConsole("Toggle binding error: " + error.message);
        })
        .toggleBindingStatus(bindingId);
    }

    function deleteBinding(bindingId) {
      const binding = appState.bindings.find(b => b.id === bindingId);
      if (!binding) return;

      if (!confirm(\`Удалить связку?\\n\\n📰 \${binding.vkGroupUrl || binding.vk_group_url}\\n📱 \${binding.tgChatId || binding.tg_chat_id}\\n\\n⚠️ Это действие нельзя отменить!\`)) {
        return;
      }

      showMessage("bindings", "loading", "🗑️ Удаление связки...");
      logMessageToConsole("Deleting binding: " + bindingId);

      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.success) {
            refreshBindings();
            showMessage("bindings", "success", "🗑️ Связка удалена!");
            logMessageToConsole("Binding deleted successfully");
          } else {
            const errorMsg = result?.error || "Ошибка удаления";
            showMessage("bindings", "error", "❌ " + errorMsg);
            logMessageToConsole("Delete binding failed: " + errorMsg);
          }
        })
        .withFailureHandler(function(error) {
          showMessage("bindings", "error", "❌ Ошибка: " + error.message);
          logMessageToConsole("Delete binding error: " + error.message);
        })
        .deleteBinding(bindingId);
    }

    function refreshBindings() {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.success) {
            appState.bindings = result.bindings || [];
            updateBindingsSection();
            logMessageToConsole("Bindings refreshed: " + appState.bindings.length);
          }
        })
        .withFailureHandler(function(error) {
          logMessageToConsole("Refresh bindings error: " + error.message);
        })
        .getBindings();
    }

    // ============================================
    // SYSTEM FUNCTIONS
    // ============================================

    function manualCheck() {
      if (!confirm("Проверить новые посты вручную?\\n\\nЭто может занять некоторое время.")) {
        return;
      }

      showMessage("status", "loading", "🔄 Проверка новых постов...");
      logMessageToConsole("Manual check initiated");

      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.success) {
            const message = \`✅ Проверка завершена!\\n\\n📋 Проверено связок: \${result.bindingsChecked}\\n🆕 Найдено новых постов: \${result.newPostsFound}\\n✉️ Отправлено в TG: \${result.postsSent}\`;
            showMessage("status", "success", message);
            logMessageToConsole("Manual check completed successfully");
          } else {
            showMessage("status", "error", "❌ " + (result?.error || "Ошибка проверки"));
            logMessageToConsole("Manual check failed: " + (result?.error || "Unknown error"));
          }
        })
        .withFailureHandler(function(error) {
          showMessage("status", "error", "❌ Ошибка: " + error.message);
          logMessageToConsole("Manual check error: " + error.message);
        })
        .checkNewPostsManually();
    }

    function setupAutoCheck() {
      if (!confirm("Настроить автоматическую проверку каждые 30 минут?")) {
        return;
      }

      showMessage("status", "loading", "⏱️ Настройка триггера...");
      logMessageToConsole("Setting up auto check");

      google.script.run
        .withSuccessHandler(function() {
          showMessage("status", "success", "✅ Автопроверка настроена! Посты будут проверяться каждые 30 минут.");
          logMessageToConsole("Auto check setup completed");
        })
        .withFailureHandler(function(error) {
          showMessage("status", "error", "❌ Ошибка: " + error.message);
          logMessageToConsole("Auto check setup error: " + error.message);
        })
        .setupTrigger();
    }

    // ============================================
    // MODAL FUNCTIONS
    // ============================================

    function openModal() {
      document.getElementById("binding-modal").classList.add("show");
    }

    function closeModal() {
      document.getElementById("binding-modal").classList.remove("show");
      clearModalMessage();
    }

    function showModalMessage(type, text) {
      const messageEl = document.getElementById("modal-message");
      messageEl.className = "message " + type;
      messageEl.textContent = text;
      messageEl.style.display = "block";
    }

    function clearModalMessage() {
      const messageEl = document.getElementById("modal-message");
      messageEl.style.display = "none";
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    function logMessageToConsole(message) {
      console.log("[CLIENT] " + new Date().toISOString() + " - " + message);
    }

    function showMessage(section, type, text) {
      const messageEl = document.getElementById(section + "-message");
      if (!messageEl) {
        logMessageToConsole("ERROR: Message element not found for section: " + section);
        alert(text);
        return;
      }
      
      messageEl.className = "message " + type;
      messageEl.innerHTML = text;
      messageEl.style.display = "block";

      logMessageToConsole("Message shown: [" + type + "] " + text);

      if (type !== "loading") {
        setTimeout(() => {
          messageEl.style.display = "none";
        }, 5000);
      }
    }

    function showLoader(show) {
      const loader = document.getElementById("loader");
      if (!loader) {
        logMessageToConsole("ERROR: Loader element not found");
        return;
      }
      
      if (show) {
        loader.classList.add("show");
        logMessageToConsole("Loader shown");
      } else {
        loader.classList.remove("show");
        logMessageToConsole("Loader hidden");
      }
    }

    // ============================================
    // GLOBAL SETTINGS FUNCTIONS
    // ============================================
    
    function loadGlobalSettings() {
      if (!appState.license) return;
      
      logMessageToConsole("Loading global settings...");
      
      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.success) {
            // Устанавливаем состояние чекбокса "Выключить все магазины"
            const disableAllStores = result.value === true || result.value === "true";
            document.getElementById("disable-all-stores").checked = disableAllStores;
            logMessageToConsole("Global settings loaded: disable_all_stores = " + disableAllStores);
          } else {
            // По умолчанию магазины включены
            document.getElementById("disable-all-stores").checked = false;
            logMessageToConsole("Failed to load global settings, using defaults");
          }
        })
        .withFailureHandler(function(error) {
          // По умолчанию магазины включены
          document.getElementById("disable-all-stores").checked = false;
          logMessageToConsole("Global settings load error: " + error.message);
        })
        .getGlobalSetting("disable_all_stores");
    }
    
    function toggleAllStores() {
      const checkbox = document.getElementById("disable-all-stores");
      const isDisabled = checkbox.checked;
      
      showMessage("bindings", "loading", "🔄 Сохранение настройки...");
      logMessageToConsole("Toggling all stores disabled: " + isDisabled);
      
      // Сохраняем в Properties Service
      try {
        google.script.run
          .withSuccessHandler(function(result) {
            if (result && result.success) {
              const message = isDisabled ? 
                "🏪 Все магазины выключены! Посты о товарах не будут пересылаться." : 
                "🏪 Магазины включены! Все посты будут пересылаться нормально.";
              showMessage("bindings", "success", message);
              logMessageToConsole("All stores toggle saved successfully");
            } else {
              showMessage("bindings", "error", "❌ Ошибка сохранения настройки");
              logMessageToConsole("Failed to save all stores setting");
              // Отменяем изменение чекбокса
              checkbox.checked = !isDisabled;
            }
          })
          .withFailureHandler(function(error) {
            showMessage("bindings", "error", "❌ Ошибка: " + error.message);
            logMessageToConsole("All stores toggle error: " + error.message);
            // Отменяем изменение чекбокса
            checkbox.checked = !isDisabled;
          })
          .setGlobalSetting("disable_all_stores", isDisabled);
      } catch (error) {
        showMessage("bindings", "error", "❌ Ошибка: " + error.message);
        logMessageToConsole("All stores toggle exception: " + error.message);
        checkbox.checked = !isDisabled;
      }
    }

    // Collapse/Expand panel functionality
    let isPanelCollapsed = false;
    
    function togglePanel() {
      try {
        logMessageToConsole('togglePanel called, current state: ' + isPanelCollapsed);
        isPanelCollapsed = !isPanelCollapsed;
        
        const content = document.querySelector('.content');
        const miniControls = document.getElementById('mini-controls');
        const toggleIcon = document.getElementById('toggle-icon');
        const toggleText = document.getElementById('toggle-text');
        const toggleIconMini = document.getElementById('toggle-icon-mini');
        
        if (!content || !miniControls || !toggleIcon || !toggleText) {
          logMessageToConsole('ERROR: Required elements not found for togglePanel');
          return;
        }
        
        if (isPanelCollapsed) {
          // Collapse
          content.classList.add('collapsed');
          miniControls.classList.add('show');
          toggleIcon.textContent = '▲';
          toggleText.textContent = 'Развернуть';
          
          // Update mini status based on app state
          updateMiniStatus();
          
          logMessageToConsole('Panel collapsed successfully');
        } else {
          // Expand
          content.classList.remove('collapsed');
          miniControls.classList.remove('show');
          toggleIcon.textContent = '▼';
          toggleText.textContent = 'Свернуть';
          
          logMessageToConsole('Panel expanded successfully');
        }
      } catch (error) {
        logMessageToConsole('ERROR in togglePanel: ' + error.message);
      }
    }
    
    function updateMiniStatus() {
      const miniStatus = document.getElementById('mini-status');
      if (!appState.license) {
        miniStatus.textContent = 'Требуется активация лицензии';
      } else if (appState.stats.active > 0) {
        miniStatus.textContent = "Работает " + appState.stats.active + " " + (appState.stats.active === 1 ? 'связка' : 'связок');
      } else {
        miniStatus.textContent = 'Нет активных связок';
      }
    }

    // Close modal on outside click
    window.onclick = function(event) {
      const modal = document.getElementById("binding-modal");
      if (event.target === modal) {
        closeModal();
      }
    }

    // ============================================
    // FUNCTIONS FOR LOGS SECTION
    // ============================================

    function loadLogs() {
      google.script.run
        .withSuccessHandler(function(logs) {
          appState.logs = logs || [];
          renderLogs(appState.logs);
        })
        .withFailureHandler(function(error) {
          showMessage("logs", "error", "❌ Ошибка загрузки логов: " + error.message);
        })
        .getClientLogs(50); // Последние 50 записей
    }

    function renderLogs(logs) {
      var tbody = document.getElementById("logs-table-body");
      
      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #999;">Нет логов</td></tr>';
        return;
      }
      
      tbody.innerHTML = logs.map(function(log) {
        var levelClass = "log-" + log.level.toLowerCase();
        var levelColor = getLogLevelColor(log.level);
        
        return '<tr class="' + levelClass + '">' +
          '<td style="padding: 10px; font-size: 12px; color: #666;">' + formatTimestamp(log.timestamp) + '</td>' +
          '<td style="padding: 10px; text-align: center;">' +
            '<span style="background: ' + levelColor.bg + '; color: ' + levelColor.text + '; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">' +
              log.level +
            '</span>' +
          '</td>' +
          '<td style="padding: 10px; font-weight: 600; font-size: 13px;">' + log.event + '</td>' +
          '<td style="padding: 10px; font-size: 12px; color: #666;">' + log.details + '</td>' +
        '</tr>';
      }).join("");
    }

    function getLogLevelColor(level) {
      switch(level) {
        case "INFO":
          return { bg: "#d4edda", text: "#155724" };
        case "WARN":
          return { bg: "#fff3cd", text: "#856404" };
        case "ERROR":
          return { bg: "#f8d7da", text: "#721c24" };
        case "DEBUG":
          return { bg: "#e7f3ff", text: "#004085" };
        default:
          return { bg: "#f8f9fa", text: "#333" };
      }
    }

    function formatTimestamp(timestamp) {
      try {
        var date = new Date(timestamp);
        return date.toLocaleString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } catch (e) {
        return timestamp;
      }
    }

    function filterLogs() {
      var levelFilter = document.getElementById("log-level-filter").value;
      var searchText = document.getElementById("log-search").value.toLowerCase();
      
      var filtered = appState.logs.filter(function(log) {
        var matchLevel = !levelFilter || log.level === levelFilter;
        var matchSearch = !searchText || 
                      log.event.toLowerCase().includes(searchText) ||
                      log.details.toLowerCase().includes(searchText);
        return matchLevel && matchSearch;
      });
      
      renderLogs(filtered);
    }

    function refreshLogs() {
      showMessage("logs", "loading", "🔄 Обновление логов...");
      loadLogs();
      setTimeout(function() {
        showMessage("logs", "success", "✅ Логи обновлены!");
      }, 1000);
    }

    function clearOldLogs() {
      if (!confirm("🧹 Очистить логи старше 30 дней?\n\nЭто действие удалит все записи из листа 'Logs', которые старше 30 дней.")) {
        return;
      }

      showMessage("logs", "loading", "🧹 Очистка старых логов...");
      
      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.success) {
            showMessage("logs", "success", "✅ " + result.message);
            loadLogs(); // Перезагружаем логи
          } else {
            showMessage("logs", "error", "❌ " + (result?.error || "Ошибка очистки логов"));
          }
        })
        .withFailureHandler(function(error) {
          showMessage("logs", "error", "❌ Ошибка: " + error.message);
        })
        .cleanOldLogs();
    }

    // Добавляем функцию в updateLicenseSection для показа логов
    function updateLicenseSection() {
      const license = appState.license;
      const licenseInputForm = document.getElementById("license-input-form");
      const licenseInfo = document.getElementById("license-info");
      const licenseTypeDisplay = document.getElementById("license-type-display");
      const licenseDetailsDisplay = document.getElementById("license-details-display");
      
      if (license) {
        licenseInputForm.style.display = "none";
        licenseInfo.style.display = "block";
        
        const licenseType = license.type || "TRIAL";
        const maxGroups = appState.license.maxGroups || "N/A";
        const expires = appState.license.expires;
        
        licenseTypeDisplay.textContent = "✅ " + licenseType;
        
        let expiresText = "N/A";
        if (expires) {
          try {
            const expiresDate = new Date(expires);
            if (!isNaN(expiresDate.getTime())) {
              expiresText = expiresDate.toLocaleDateString();
            }
          } catch (e) {
            logMessageToConsole("Error parsing expires date: " + e.message);
          }
        }
        
        licenseDetailsDisplay.innerHTML = "<strong>Максимум групп:</strong> " + maxGroups + "<br>" +
          "<strong>Действительна до:</strong> " + expiresText + "<br>" +
          "<strong>Ключ:</strong> " + (appState.license.key ? appState.license.key.substring(0, 20) + "..." : "N/A");
        
        document.getElementById("bindings-section").style.display = "block";
        document.getElementById("status-section").style.display = "block";
        document.getElementById("logs-section").style.display = "block"; // Показываем логи
        loadLogs(); // Загружаем логи при активации лицензии
      } else {
        licenseInputForm.style.display = "block";
        licenseInfo.style.display = "none";
        document.getElementById("bindings-section").style.display = "none";
        document.getElementById("status-section").style.display = "none";
        document.getElementById("logs-section").style.display = "none"; // Скрываем логи
      }
    }
  </script>
</body>
</html>`;
}

// ============================================
// РАБОТА С КЕШЕМ ГРУПП
// ============================================

/**
 * Получить кеш последних ID постов групп из PropertiesService
 * @returns {Object} Объект с VK группами и их последними ID постов
 */
function getLastPostIds() {
  try {
    const props = PropertiesService.getUserProperties();
    const cacheData = props.getProperty("vk_group_last_post_ids");
    
    if (!cacheData) {
      logEvent("DEBUG", "no_cache_found", "client", "No last post IDs cache found");
      return {};
    }
    
    const lastPostIds = JSON.parse(cacheData);
    logEvent("DEBUG", "cache_loaded", "client", `Loaded cache for ${Object.keys(lastPostIds).length} groups`);
    
    return lastPostIds;
  } catch (error) {
    logEvent("ERROR", "get_cache_error", "client", error.message);
    return {};
  }
}

/**
 * Сохранить кеш последних ID постов групп в PropertiesService
 * @param {Object} lastPostIds - Объект с VK группами и их последними ID постов
 */
function saveLastPostIds(lastPostIds) {
  try {
    const props = PropertiesService.getUserProperties();
    props.setProperty("vk_group_last_post_ids", JSON.stringify(lastPostIds));
    
    logEvent("DEBUG", "cache_saved", "client", `Saved cache for ${Object.keys(lastPostIds).length} groups`);
  } catch (error) {
    logEvent("ERROR", "save_cache_error", "client", error.message);
  }
}

/**
 * ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Очистить группу из кеша при изменении/удалении связки
 * @param {string} vkGroupId - ID VK группы (например, "-123456")
 */
function clearGroupFromCache(vkGroupId) {
  try {
    const lastPostIds = getLastPostIds();
    
    if (lastPostIds[vkGroupId]) {
      delete lastPostIds[vkGroupId];
      saveLastPostIds(lastPostIds);
      
      logEvent("INFO", "group_cache_cleared", "client", 
               `VK Group: ${vkGroupId} removed from cache`);
      return true;
    } else {
      logEvent("DEBUG", "group_cache_not_found", "client", 
               `VK Group: ${vkGroupId} was not in cache`);
      return false;
    }
  } catch (error) {
    logEvent("ERROR", "clear_cache_error", "client", 
             `VK Group: ${vkGroupId}, Error: ${error.message}`);
    return false;
  }
}

/**
 * 💡 НОВАЯ ФУНКЦИЯ: Форсированное создание всех Published листов для существующих связок
 * Проверяет все связки и создает отсутствующие листы Published_
 */
function ensureAllPublishedSheetsExist() {
  try {
    logEvent("INFO", "ensure_published_sheets_start", "client", "Checking Published sheets for all bindings");
    
    const bindingsResult = getBindings();
    if (!bindingsResult.success) {
      logEvent("WARN", "no_bindings_for_sheets", "client", "Could not get bindings");
      return { created: 0, total: 0, error: "Could not get bindings" };
    }
    
    const bindings = bindingsResult.bindings || [];
    let createdCount = 0;
    let checkedCount = 0;
    
    for (const binding of bindings) {
      try {
        const bindingName = binding.bindingName || binding.binding_name;
        // Сначала пробуем извлечь ID локально
        let vkGroupId = extractVkGroupId(binding.vkGroupUrl || binding.vk_group_url);
        
        // Если не удалось (screen_name), отправляем исходный URL на сервер для резолвинга
        if (!vkGroupId) {
          vkGroupId = binding.vkGroupUrl || binding.vk_group_url;
          logEvent("INFO", "vk_group_id_server_resolve_send", "client", 
                   `Binding ID: ${binding.id}, will resolve on server for sending: ${vkGroupId}`);
        }
        
        // Получаем или создаем лист (функция создаст если нужно)
        const sheet = getOrCreatePublishedPostsSheet(bindingName, vkGroupId);
        
        if (sheet) {
          checkedCount++;
          // Проверяем был ли создан новый лист
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const sheetName = sheet.getName();
          
          logEvent("DEBUG", "published_sheet_checked", "client", 
                   `Binding: ${binding.id}, Sheet: ${sheetName}, VK Group: ${vkGroupId}`);
          
          // Если лист создается впервые, он будет иметь только заголовок
          const lastRow = sheet.getLastRow();
          if (lastRow === 1) {
            createdCount++;
            logEvent("INFO", "published_sheet_created_forced", "client", 
                     `New sheet: ${sheetName} for binding: ${binding.id}`);
          }
        }
        
      } catch (bindingError) {
        logEvent("ERROR", "ensure_sheet_binding_error", "client", 
                 `Binding ID: ${binding.id}, Error: ${bindingError.message}`);
      }
    }
    
    logEvent("INFO", "ensure_published_sheets_complete", "client", 
             `Checked: ${checkedCount} bindings, Created: ${createdCount} new sheets`);
    
    return { created: createdCount, total: checkedCount };
    
  } catch (error) {
    logEvent("ERROR", "ensure_published_sheets_error", "client", error.message);
    return { created: 0, total: 0, error: error.message };
  }
}

/**
 * 💡 НОВАЯ ФУНКЦИЯ: Очистка мусорного кеша - удаляет группы, которых нет в связках
 * Вызывается при добавлении новой связки для поддержания чистоты кеша
 */
function cleanupOrphanedCache() {
  try {
    logEvent("INFO", "orphaned_cache_cleanup_start", "client", "Starting cache cleanup");
    
    const lastPostIds = getLastPostIds();
    const cachedGroupIds = Object.keys(lastPostIds);
    
    if (cachedGroupIds.length === 0) {
      logEvent("DEBUG", "no_cache_to_cleanup", "client", "Cache is empty");
      return { cleaned: 0, total: 0 };
    }
    
    // Получаем все активные VK группы из связок
    const bindingsResult = getBindings();
    const activeGroupIds = new Set();
    
    if (bindingsResult.success) {
      for (const binding of bindingsResult.bindings) {
        const vkGroupId = extractVkGroupId(binding.vkGroupUrl || binding.vk_group_url);
        if (vkGroupId) {
          activeGroupIds.add(vkGroupId);
        }
      }
    }
    
    logEvent("DEBUG", "cache_cleanup_analysis", "client", 
             `Cache: ${cachedGroupIds.length} groups, Active: ${activeGroupIds.size} groups`);
    
    // Находим мусорные записи (есть в кеше, но нет в связках)
    const orphanedGroupIds = cachedGroupIds.filter(cachedId => !activeGroupIds.has(cachedId));
    
    if (orphanedGroupIds.length === 0) {
      logEvent("INFO", "cache_cleanup_no_orphans", "client", "No orphaned cache entries found");
      return { cleaned: 0, total: cachedGroupIds.length };
    }
    
    // Удаляем мусорные записи
    let cleanedCount = 0;
    for (const orphanedId of orphanedGroupIds) {
      delete lastPostIds[orphanedId];
      cleanedCount++;
      logEvent("DEBUG", "orphaned_cache_entry_removed", "client", 
               `Removed orphaned VK Group: ${orphanedId}`);
    }
    
    saveLastPostIds(lastPostIds);
    
    logEvent("INFO", "orphaned_cache_cleanup_complete", "client", 
             `Cleaned ${cleanedCount} orphaned entries from cache (${Object.keys(lastPostIds).length} remain)`);
    
    return { cleaned: cleanedCount, total: cachedGroupIds.length };
    
  } catch (error) {
    logEvent("ERROR", "orphaned_cache_cleanup_error", "client", error.message);
    return { cleaned: 0, total: 0, error: error.message };
  }
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
// ============================================

/**
 * Миграция Published листов: переименование из Published_-123456 в Published_GroupName
 * Согласно требованиям UNIFIED_TODO.md
 */
function migratePublishedSheetsNames() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    let renamedCount = 0;
    
    logEvent("INFO", "published_migration_start", "client", "Starting Published sheets migration");
    
    // Ищем листы в старом формате Published_-123456
    for (const sheet of sheets) {
      const currentName = sheet.getName();
      const match = currentName.match(/^Published_(-?\d+)$/);
      
      if (match) {
        const groupId = match[1];
        
        // Пытаемся найти bindingName для этого groupId
        const bindingsResult = getBindings();
        let newName = null;
        
        if (bindingsResult.success) {
          for (const binding of bindingsResult.bindings) {
            const bindingGroupId = extractVkGroupId(binding.vkGroupUrl || binding.vk_group_url);
            if (bindingGroupId === groupId && (binding.bindingName || binding.binding_name)) {
              newName = (binding.bindingName || binding.binding_name).substring(0, 27);
              break;
            }
          }
        }
        
        if (newName) {
          try {
            const finalName = `Published_${newName.replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '').replace(/\s+/g, '_')}`;
            
            // Проверяем уникальность
            if (ss.getSheetByName(finalName)) {
              logEvent("WARN", "migration_name_exists", "client", `Name already exists: ${finalName}`);
              continue;
            }
            
            sheet.setName(finalName);
            renamedCount++;
            
            logEvent("INFO", "published_sheet_renamed", "client", `${currentName} → ${finalName}`);
          } catch (error) {
            logEvent("ERROR", "migration_rename_error", "client", 
                     `Sheet: ${currentName}, Error: ${error.message}`);
          }
        } else {
          logEvent("WARN", "migration_no_binding_name", "client", 
                   `No binding name found for group ID: ${groupId}`);
        }
      }
    }
    
    const message = `✅ Миграция Published листов завершена!\n\nПереименовано листов: ${renamedCount}`;
    SpreadsheetApp.getUi().alert(message);
    
    logEvent("INFO", "published_migration_complete", "client", `Renamed: ${renamedCount} sheets`);
    
  } catch (error) {
    logEvent("ERROR", "published_migration_error", "client", error.message);
    SpreadsheetApp.getUi().alert(`❌ Ошибка миграции: ${error.message}`);
  }
}

// ============================================
// КОНЕЦ CLIENT.GS
// ============================================

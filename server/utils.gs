/**
 * VK→Telegram Crossposter - UTILS MODULE
 * Утилиты и общие функции для всех модулей
 * 
 * Размер: ~300 строк
 * Зависимости: нет (базовый модуль)
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// LOGGING
// ============================================

function logEvent(level, event, user, details, ip) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logsSheet = ss.getSheetByName("Logs");
    
    if (!logsSheet) {
      // Создаем лист логов если не существует
      logsSheet = ss.insertSheet("Logs");
      logsSheet.getRange("A1:F1").setValues([["Timestamp", "Level", "Event", "User", "Details", "IP"]])
        .setFontWeight("bold")
        .setBackground("#667eea")
        .setFontColor("white");
    }
    
    var timestamp = new Date().toISOString();
    var rowData = [timestamp, level, event, user || "", details || "", ip || ""];
    
    // Вставляем новую строку в начало (после заголовков)
    logsSheet.insertRowBefore(2);
    logsSheet.getRange(2, 1, 1, 6).setValues([rowData]);
    
    // Ограничиваем количество записей (оставляем последние 1000)
    var lastRow = logsSheet.getLastRow();
    if (lastRow > 1000) {
      logsSheet.deleteRows(lastRow - 1000 + 1, lastRow - 1000);
    }
    
  } catch (error) {
    // Если логирование не работает, выводим в консоль
    console.error(`Log error: ${error.message}`);
    console.log(`[${new Date().toISOString()}] ${level}: ${event} - ${details}`);
  }
}

function logApiError(service, endpoint, request, response) {
  var errorDetails = {
    service: service,
    endpoint: endpoint,
    request: request,
    response: response,
    timestamp: new Date().toISOString()
  };
  
  logEvent("ERROR", "api_error", "system", JSON.stringify(errorDetails));
}

function cleanOldLogs() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var allSheets = ss.getSheets();
    var logSheets = [];
    
    // Ищем все листы с логами
    for (var i = 0; i < allSheets.length; i++) {
      var sheetName = allSheets[i].getName();
      if (sheetName === "Logs" || sheetName === "Client Logs" || sheetName.toLowerCase().includes("log")) {
        logSheets.push(allSheets[i]);
      }
    }
    
    if (logSheets.length === 0) {
      logEvent("WARN", "no_log_sheets_found", "system", "No log sheets found for cleanup");
      return { totalDeleted: 0, sheetsProcessed: 0 };
    }
    
    var thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    var totalDeleted = 0;
    
    logEvent("INFO", "log_cleanup_started", "system", `Starting cleanup of ${logSheets.length} log sheets`);
    
    // Обрабатываем каждый лог-лист
    for (var j = 0; j < logSheets.length; j++) {
      var sheet = logSheets[j];
      var sheetName = sheet.getName();
      var sheetDeletedCount = 0;
      
      try {
        var dataRange = sheet.getDataRange();
        var data = dataRange.getValues();
        
        if (data.length <= 1) { // Только заголовок или пустой лист
          continue;
        }
        
        // Удаляем старые записи (начиная с конца, чтобы не сбивать индексы)
        for (var i = data.length - 1; i >= 1; i--) {
          try {
            var logDate = new Date(data[i][0]);
            
            if (isNaN(logDate.getTime())) {
              continue;
            }
            
            if (logDate < thirtyDaysAgo) {
              sheet.deleteRow(i + 1);
              sheetDeletedCount++;
            }
          } catch (rowError) {
            logEvent("WARN", "log_cleanup_row_error", "system", `Error processing row ${i + 1} in sheet "${sheetName}": ${rowError.message}`);
          }
        }
        
        totalDeleted += sheetDeletedCount;
        
        logEvent("INFO", "log_cleanup_sheet_completed", "system", `Sheet "${sheetName}": deleted ${sheetDeletedCount} entries`);
        
      } catch (sheetError) {
        logEvent("ERROR", "log_cleanup_sheet_error", "system", `Error processing sheet "${sheetName}": ${sheetError.message}`);
      }
    }
    
    logEvent("INFO", "log_cleanup_completed", "system", `Cleanup complete: ${totalDeleted} entries deleted from ${logSheets.length} sheets`);
    
    return {
      success: true,
      totalDeleted: totalDeleted,
      sheetsProcessed: logSheets.length
    };
    
  } catch (error) {
    logEvent("ERROR", "log_cleanup_failed", "system", error.message);
    return { success: false, error: error.message, totalDeleted: 0, sheetsProcessed: 0 };
  }
}

// ============================================
// SHEETS UTILITIES
// ============================================

function createSheet(name, headers) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(name);
    
    if (!sheet) {
      sheet = ss.insertSheet(name);
      
      // Добавляем заголовки
      if (headers && headers.length > 0) {
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#667eea");
        headerRange.setFontColor("white");
      }
      
      logEvent("INFO", "sheet_created", "system", `Sheet "${name}" created with ${headers.length} columns`);
    }
    
    return sheet;
    
  } catch (error) {
    logEvent("ERROR", "sheet_creation_failed", "system", `Sheet: ${name}, Error: ${error.message}`);
    throw error;
  }
}

function getSheet(name) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(name);
    
    if (!sheet) {
      throw new Error(`Sheet "${name}" not found`);
    }
    
    return sheet;
    
  } catch (error) {
    logEvent("ERROR", "sheet_access_failed", "system", `Sheet: ${name}, Error: ${error.message}`);
    throw error;
  }
}

function ensureSheetExists(name, headers) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(name);
    
    if (!sheet) {
      sheet = ss.insertSheet(name);
      
      // Добавляем заголовки если предоставлены
      if (headers && headers.length > 0) {
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#667eea");
        headerRange.setFontColor("white");
        
        logEvent("INFO", "sheet_ensured", "system", `Sheet "${name}" created with headers`);
      } else {
        logEvent("INFO", "sheet_ensured", "system", `Sheet "${name}" created without headers`);
      }
    } else {
      logEvent("DEBUG", "sheet_exists", "system", `Sheet "${name}" already exists`);
    }
    
    return sheet;
    
  } catch (error) {
    logEvent("ERROR", "ensure_sheet_failed", "system", `Sheet: ${name}, Error: ${error.message}`);
    throw error;
  }
}

// ============================================
// DATA UTILITIES
// ============================================

function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Базовая валидация email
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    // Проверяем валидность URL
    var urlObj = new URL(url.trim());
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch (error) {
    return false;
  }
}

function sanitizeSheetName(name) {
  if (!name || typeof name !== 'string') {
    return 'Unnamed';
  }
  
  // Удаляем недопустимые символы и ограничиваем длину
  return name
    .trim()
    .replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30); // Google Sheets limit
}

function generateUniqueId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================
// STATISTICS
// ============================================

function getSystemStats() {
  try {
    var licensesSheet = getSheet("Licenses");
    var bindingsSheet = getSheet("Bindings");
    var logsSheet = getSheet("Logs");
    
    var licensesData = licensesSheet.getDataRange().getValues().slice(1);
    var bindingsData = bindingsSheet.getDataRange().getValues().slice(1);
    var logsData = logsSheet.getDataRange().getValues().slice(1);
    
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
      totalLicenses: licensesData.length,
      activeLicenses: licensesData.filter(lic => lic[6] === "active").length,
      expiredLicenses: licensesData.filter(lic => new Date(lic[4]) < now).length,
      
      totalBindings: bindingsData.length,
      activeBindings: bindingsData.filter(b => b[5] === "active").length,
      pausedBindings: bindingsData.filter(b => b[5] === "paused").length,
      
      postsToday: logsData.filter(log => 
        log[2] === "post_sent" && new Date(log[0]) >= today
      ).length,
      
      lastPostTime: logsData
        .filter(log => log[2] === "post_sent")
        .sort((a, b) => new Date(b[0]) - new Date(a[0))[0]?.[0] || "Нет данных",
      
      topUser: findTopUser(bindingsData)
    };
    
  } catch (error) {
    logEvent("ERROR", "stats_error", "system", error.message);
    return {
      totalLicenses: 0, activeLicenses: 0, expiredLicenses: 0,
      totalBindings: 0, activeBindings: 0, pausedBindings: 0,
      postsToday: 0, lastPostTime: "Ошибка", topUser: "Ошибка"
    };
  }
}

function showStatistics() {
  var stats = getSystemStats();
    
  var message = '📊 Статистика сервера v' + SERVER_VERSION + '\n\n';
  message += '🔑 Лицензии:\n';
  message += '• Всего: ' + stats.totalLicenses + '\n';
  message += '• Активных: ' + stats.activeLicenses + '\n';
  message += '• Истекших: ' + stats.expiredLicenses + '\n\n';
  message += '🔗 Связки:\n';
  message += '• Всего: ' + stats.totalBindings + '\n';
  message += '• Активных: ' + stats.activeBindings + '\n';
  message += '• На паузе: ' + stats.pausedBindings + '\n\n';
  message += '📈 Активность:\n';
  message += '• Постов отправлено сегодня: ' + stats.postsToday + '\n';
  message += '• Последний пост: ' + stats.lastPostTime + '\n\n';
  message += '🏆 Топ пользователь: ' + stats.topUser;
  
  SpreadsheetApp.getUi().alert(message);
}

function showLogsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logsSheet = ss.getSheetByName("Logs");
  
  if (logsSheet) {
    ss.setActiveSheet(logsSheet);
  } else {
    SpreadsheetApp.getUi().alert("❌ Лист 'Logs' не найден. Выполните инициализацию сервера.");
  }
}

function findTopUser(bindingsData) {
  var userCounts = {};
  
  bindingsData.forEach(binding => {
    var email = binding[2];
    userCounts[email] = (userCounts[email] || 0) + 1;
  });
  
  var topEntry = Object.entries(userCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  return topEntry ? `${topEntry[0]} (${topEntry[1]} связок)` : "Нет данных";
}

// ============================================
// HTML UTILITIES
// ============================================

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function jsonResponse(data, statusCode = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// URL AND ID EXTRACTION UTILITIES
// ============================================

/**
 * Извлекает ID группы VK из URL с поддержкой всех форматов из ARCHITECTURE.md
 * @param {string} url - URL группы VK
 * @return {string} - ID группы с префиксом - для групп
 */
function extractVkGroupId(url) {
  try {
    if (!url || typeof url !== 'string') {
      logEvent('WARN', 'vk_url_invalid_type', 'server', `URL type: ${typeof url}`);
      throw new Error('Invalid URL type');
    }
    
    const originalInput = url;
    const cleanInput = url.trim().toLowerCase().split('?')[0].split('#')[0];
    
    logEvent('DEBUG', 'vk_group_id_extraction_start', 'server', `Input: "${originalInput}" → Clean: "${cleanInput}"`);
    
    // Если уже ID (число или -число)
    if (/^-?\d+$/.test(cleanInput)) {
      const normalizedId = cleanInput.startsWith('-') ? cleanInput : '-' + cleanInput;
      logEvent('DEBUG', 'vk_group_id_numeric', 'server', `${originalInput} → ${normalizedId}`);
      return normalizedId;
    }
    
    // Форматы: vk.com/public123, vk.com/club123
    const publicClubMatch = cleanInput.match(/vk\.com\/(public|club)(\d+)/i);
    if (publicClubMatch) {
      const result = '-' + publicClubMatch[2];
      logEvent('DEBUG', 'vk_group_id_public_club', 'server', `${originalInput} → ${result}`);
      return result;
    }
    
    // Форматы: vk.com/username
    const nameMatch = cleanInput.match(/vk\.com\/([a-z0-9_]+)/i);
    if (nameMatch) {
      const screenName = nameMatch[1];
      const resolvedId = resolveVkScreenName(screenName);
      if (resolvedId) {
        logEvent('DEBUG', 'vk_group_id_resolved', 'server', `${originalInput} → ${resolvedId}`);
        return resolvedId;
      }
    }
    
    throw new Error('Invalid VK URL format: ' + originalInput);
    
  } catch (error) {
    logEvent('ERROR', 'vk_url_extraction_failed', 'server', `URL: ${url}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Резолвит screen name VK в числовой ID через API
 * @param {string} screenName - screen name пользователя или группы
 * @return {string} - числовой ID с префиксом - для групп
 */
function resolveVkScreenName(screenName) {
  try {
    const userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      throw new Error('VK User Access Token not configured');
    }
    
    const apiUrl = `https://api.vk.com/method/utils.resolveScreenName?screen_name=${encodeURIComponent(screenName)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    logEvent('DEBUG', 'vk_screen_name_resolution_start', 'server', `Screen name: ${screenName}`);
    
    const response = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      timeout: TIMEOUTS.FAST
    });
    
    const responseText = response.getContentText();
    const data = JSON.parse(responseText);
    
    if (data.error) {
      const errorCode = data.error.error_code;
      const errorMsg = data.error.error_msg;
      
      switch (errorCode) {
        case 5:
          throw new Error('VK User Access Token invalid');
        case 100:
          throw new Error(`Screen name '${screenName}' invalid format`);
        case 104:
          throw new Error(`Screen name '${screenName}' not found`);
        case 113:
          throw new Error(`Screen name '${screenName}' not found`);
        case 7:
          throw new Error(`Access denied to '${screenName}'`);
        default:
          throw new Error(`VK API Error ${errorCode}: ${errorMsg}`);
      }
    }
    
    if (!data.response) {
      throw new Error(`No response data for screen name '${screenName}'`);
    }
    
    const objectId = data.response.object_id;
    const type = data.response.type;
    
    // Правильное добавление минуса для групп
    const result = (type === 'group' || type === 'page') ? `-${objectId}` : objectId.toString();
    
    logEvent('DEBUG', 'vk_screen_name_resolved', 'server', 
      `Screen name: ${screenName} → Type: ${type}, ID: ${objectId} → Result: ${result}`);
    
    return result;
    
  } catch (error) {
    logEvent('ERROR', 'vk_screen_name_resolution_failed', 'server', 
      `Failed to resolve '${screenName}': ${error.message}`);
    throw error;
  }
}

/**
 * Извлекает chat_id Telegram с поддержкой всех форматов
 * @param {string} input - input в любом формате
 * @return {string} - chat_id или @username
 */
function extractTelegramChatId(input) {
  if (!input) throw new Error('Empty Telegram input');
  
  const cleanInput = input.trim();
  
  // Уже chat_id (число)
  if (/^-?\d+$/.test(cleanInput)) return cleanInput;
  
  // Извлекаем username из разных форматов
  const patterns = [
    /t\.me\/([a-z0-9_]+)/i,     // t.me/username
    /@([a-z0-9_]+)/i,           // @username  
    /^([a-z0-9_]+)$/i           // username
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) return '@' + match[1];
  }
  
  throw new Error('Invalid Telegram format: ' + input);
}

/**
 * Извлекает безопасное имя листа из URL VK группы
 * @param {string} url - URL группы VK
 * @return {string} - безопасное имя для листа Google Sheets
 */
function extractSheetNameFromVkUrl(url) {
  if (!url) return null;
  
  const cleanUrl = url.trim().toLowerCase().split('?')[0].split('#')[0];
  
  // public123456, club789012
  const idMatch = cleanUrl.match(/(?:public|club)(\d+)/);
  if (idMatch) {
    return `${idMatch[0]}`.substring(0, 27); // Ограничение 30 символов для имени листа
  }
  
  // durov, varsmana, apiclub
  const nameMatch = cleanUrl.match(/vk\.com\/([a-z0-9_]+)/);
  if (nameMatch) {
    return nameMatch[1]
      .replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 27);
  }
  
  return null;
}

// ============================================
// BINDING SHEET UTILITIES
// ============================================

/**
 * Validates binding name according to requirements: letters (Latin/Cyrillic) and digits only
 * @param {string} bindingName - binding name to validate
 * @return {boolean} - true if valid
 */
function validateBindingName(bindingName) {
  if (!bindingName || typeof bindingName !== 'string') {
    return false;
  }
  
  // Allow Latin letters, Cyrillic letters, and digits only
  const validPattern = /^[a-zA-Zа-яА-ЯёЁ0-9]+$/;
  return validPattern.test(bindingName.trim());
}

/**
 * Creates or gets a binding sheet for publication logging
 * @param {string} bindingName - validated binding name (used as sheet name)
 * @return {Sheet} - sheet object
 */
function getOrCreateBindingSheet(bindingName) {
  try {
    var sanitizedName = sanitizeBindingSheetSuffix(bindingName);
    if (!validateBindingName(sanitizedName)) {
      throw new Error(`Invalid binding name: "${bindingName}". Only letters and digits allowed.`);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sanitizedName);
    
    if (!sheet) {
      var legacySheet = ss.getSheetByName('Published_' + sanitizedName);
      if (legacySheet) {
        // Rename legacy sheet
        legacySheet.setName(sanitizedName);
        sheet = legacySheet;
        logEvent('INFO', 'legacy_sheet_renamed', 'server', 
          `Renamed "Published_${sanitizedName}" to "${sanitizedName}"`);
      } else {
        // Create new sheet
        sheet = ss.insertSheet(sanitizedName);
        
        // Add headers
        var headers = [
          "Timestamp", "Status", "VK Group ID", "VK Post ID", "VK Post URL", "VK Post Date",
          "Media Summary", "Caption Chars", "Caption Parts", "TG Chat", "TG Message IDs", 
          "TG Message URLs", "Notes"
        ];
        
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#4285f4");
        headerRange.setFontColor("white");
        
        logEvent('INFO', 'binding_sheet_created', 'server', 
          `Created binding sheet "${sanitizedName}" with ${headers.length} columns`);
      }
    }
    
    return sheet;
    
  } catch (error) {
    logEvent('ERROR', 'binding_sheet_creation_failed', 'server', 
      `Binding: ${bindingName}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Sanitizes binding sheet suffix
 * @param {string} bindingName - binding name to sanitize
 * @return {string} - sanitized name
 */
function sanitizeBindingSheetSuffix(bindingName) {
  if (!bindingName) return 'Unnamed';
  
  return bindingName
    .trim()
    .replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
}

/**
 * Gets sheet name from binding name
 * @param {string} bindingName - binding name
 * @return {string} - sheet name
 */
function getPublishedSheetNameFromBindingName(bindingName) {
  return sanitizeBindingSheetSuffix(bindingName);
}

/**
 * Writes a publication row to binding sheet with top-insert behavior
 * @param {string} bindingName - validated binding name
 * @param {Object} publicationData - publication data
 */
function writePublicationRowToBindingSheet(bindingName, publicationData) {
  try {
    var sanitizedName = sanitizeBindingSheetSuffix(bindingName);
    if (!validateBindingName(sanitizedName)) {
      logEvent('WARN', 'invalid_binding_name_skip', 'server', 
        `Skipping publication row for invalid binding name: "${bindingName}"`);
      return;
    }
    
    var sheet = getOrCreateBindingSheet(sanitizedName);
    
    // Prepare row data according to column order
    var rowData = [
      publicationData.timestamp || new Date().toISOString(),
      publicationData.status || 'unknown',
      publicationData.vkGroupId || '',
      publicationData.vkPostId || '',
      publicationData.vkPostUrl || '',
      publicationData.vkPostDate || '',
      publicationData.mediaSummary || '',
      publicationData.captionChars || 0,
      publicationData.captionParts || 0,
      publicationData.tgChat || '',
      publicationData.tgMessageIds || '',
      publicationData.tgMessageUrls || '',
      publicationData.notes || ''
    ];
    
    // Insert at row 2 (top-insert behavior)
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
    
    logEvent('INFO', 'publication_row_written', 'server', 
      `Binding: "${sanitizedName}", Status: ${publicationData.status}, VK Post: ${publicationData.vkPostId}`);
    
  } catch (error) {
    logEvent('ERROR', 'publication_row_write_failed', 'server', 
      `Binding: "${bindingName}", Error: ${error.message}`);
    // Don't throw - publication logging failure shouldn't break main flow
  }
}

/**
 * Checks if post was already sent (success/partial status)
 * @param {string} bindingName - binding name
 * @param {string} postId - post ID
 * @return {boolean} - true if post was already sent
 */
function checkPostAlreadySent(bindingName, postId) {
  try {
    if (!postId) {
      return false;
    }
    
    var sheetName = getPublishedSheetNameFromBindingName(bindingName);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return false;
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return false;
    }
    
    var rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (var i = 0; i < rows.length; i++) {
      var status = (rows[i][1] || '').toString().toLowerCase();
      var loggedPostId = rows[i][3];
      if ((status === 'success' || status === 'partial') && loggedPostId && loggedPostId.toString() === postId.toString()) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    logEvent('ERROR', 'check_post_sent_failed', 'server', error.message);
    return false;
  }
}

/**
 * Creates media summary string from attachments
 * @param {Array} attachments - VK post attachments
 * @return {string} - media summary
 */
function createMediaSummary(attachments) {
  try {
    if (!attachments || attachments.length === 0) {
      return 'no media';
    }
    
    var counts = {
      photo: 0,
      video: 0,
      audio: 0,
      doc: 0,
      link: 0,
      other: 0
    };
    
    for (var i = 0; i < attachments.length; i++) {
      var type = attachments[i].type;
      if (counts.hasOwnProperty(type)) {
        counts[type]++;
      } else {
        counts.other++;
      }
    }
    
    var parts = [];
    if (counts.photo > 0) parts.push(`${counts.photo} photo${counts.photo > 1 ? 's' : ''}`);
    if (counts.video > 0) parts.push(`${counts.video} video${counts.video > 1 ? 's' : ''}`);
    if (counts.audio > 0) parts.push(`${counts.audio} audio${counts.audio > 1 ? 's' : ''}`);
    if (counts.doc > 0) parts.push(`${counts.doc} doc${counts.doc > 1 ? 's' : ''}`);
    if (counts.link > 0) parts.push(`${counts.link} link${counts.link > 1 ? 's' : ''}`);
    if (counts.other > 0) parts.push(`${counts.other} other`);
    
    return parts.length > 0 ? parts.join(', ') : 'no media';
    
  } catch (error) {
    logEvent('ERROR', 'media_summary_failed', 'server', error.message);
    return 'error counting media';
  }
}

/**
 * Generates Telegram message URLs from message IDs and chat info
 * @param {string} chatId - Telegram chat ID
 * @param {Array} messageIds - array of message IDs
 * @return {string} - comma-separated URLs
 */
function generateTelegramMessageUrls(chatId, messageIds) {
  try {
    if (!messageIds || messageIds.length === 0) {
      return '';
    }
    
    var urls = [];
    
    // Try to get chat info to determine if we have username
    var chatInfo = null;
    try {
      var botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
      if (botToken) {
        var response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload: JSON.stringify({ chat_id: chatId }),
          muteHttpExceptions: true,
          timeout: TIMEOUTS.FAST
        });
        
        var result = JSON.parse(response.getContentText());
        if (result.ok) {
          chatInfo = result.result;
        }
      }
    } catch (chatError) {
      logEvent('DEBUG', 'tg_chat_info_failed', 'server', `Chat: ${chatId}, Error: ${chatError.message}`);
    }
    
    // Generate URLs
    for (var i = 0; i < messageIds.length; i++) {
      var messageId = messageIds[i];
      
      if (chatInfo && chatInfo.username) {
        // Prefer username format: https://t.me/username/messageId
        urls.push(`https://t.me/${chatInfo.username}/${messageId}`);
      } else {
        // Fallback to internal format: https://t.me/c/chatId/messageId
        // Remove @ if present and handle negative chat IDs
        var cleanChatId = chatId.toString().replace('@', '');
        if (cleanChatId.startsWith('-100')) {
          cleanChatId = cleanChatId.substring(4); // Remove -100 prefix for /c/ format
        }
        urls.push(`https://t.me/c/${cleanChatId}/${messageId}`);
      }
    }
    
    return urls.join(', ');
    
  } catch (error) {
    logEvent('ERROR', 'tg_url_generation_failed', 'server', error.message);
    return '';
  }
}
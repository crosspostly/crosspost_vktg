/**
 * VK→Telegram Crossposter - UTILS CORE MODULE
 * Базовые утилиты и общие функции для всех модулей
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
// INPUT VALIDATION
// ============================================

function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .substring(0, 1000); // Limit length
}

function checkRateLimit(clientIp, licenseKey) {
  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = `rate_limit_${clientIp}_${licenseKey}`;
    var currentCount = cache.get(cacheKey) || "0";
    
    var maxRequests = 100; // Максимум запросов в час
    var count = parseInt(currentCount);
    
    if (count >= maxRequests) {
      return false;
    }
    
    // Увеличиваем счетчик
    cache.put(cacheKey, (count + 1).toString(), 3600); // 1 час
    
    return true;
    
  } catch (error) {
    logEvent("ERROR", "rate_limit_check_error", "system", error.message);
    // В случае ошибки с кэшем, разрешаем запрос
    return true;
  }
}
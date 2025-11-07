// @ts-nocheck
/**
 * VK→Telegram Crossposter - UTILS MODULE
 * Общие утилиты и helper функции
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// ОБЩИЕ УТИЛИТЫ
// ============================================

/**
 * Экранирование HTML символов
 * @param {string} text - Текст для экранирования
 * @returns {string} - Экранированный текст
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Генерация уникального ID для связки
 * @returns {string} - Уникальный идентификатор
 */
function generateBindingId() {
  return 'binding_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Создание нового листа с заголовками
 * @param {string} name - Название листа
 * @param {Array<string>} headers - Массив заголовков
 * @returns {Sheet} - Созданный лист
 */
function createSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    
    // Стилизуем заголовок
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#667eea');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Получение листа по имени
 * @param {string} name - Название листа
 * @returns {Sheet} - Лист или null если не найден
 */
function getSheet(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet '${name}' not found. Run server initialization first.`);
  }
  return sheet;
}

/**
 * Очистка старых логов (старше указанного количества дней)
 * @param {number} daysToKeep - Количество дней для сохранения (по умолчанию 30)
 * @returns {Object} - Результат очистки
 */
function cleanOldLogs(daysToKeep = 30) {
  try {
    var cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheets = ['Logs'];
    var totalDeleted = 0;
    var sheetResults = [];

    logSheets.forEach(function(sheetName) {
      try {
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          sheetResults.push({ sheetName: sheetName, deleted: 0, status: 'not_found' });
          return;
        }

        var data = sheet.getDataRange().getValues();
        var rowsToDelete = [];
        
        // Начинаем с ряда 2 (пропускаем заголовок)
        for (var i = 1; i < data.length; i++) {
          var timestamp = data[i][0];
          if (timestamp) {
            var rowDate = new Date(timestamp);
            if (rowDate < cutoffDate) {
              rowsToDelete.push(i + 1); // Google Sheets использует 1-based индексы
            }
          }
        }

        // Удаляем ряды в обратном порядке
        for (var j = rowsToDelete.length - 1; j >= 0; j--) {
          sheet.deleteRow(rowsToDelete[j]);
          totalDeleted++;
        }

        sheetResults.push({ 
          sheetName: sheetName, 
          deleted: rowsToDelete.length, 
          status: 'success' 
        });
        
        logEvent('INFO', 'sheet_logs_cleaned', 'server', 
                `Sheet: ${sheetName}, Deleted: ${rowsToDelete.length} rows older than ${daysToKeep} days`);

      } catch (sheetError) {
        logEvent('ERROR', 'sheet_cleanup_error', 'server', 
                `Sheet: ${sheetName}, Error: ${sheetError.message}`);
        sheetResults.push({ 
          sheetName: sheetName, 
          deleted: 0, 
          status: 'error', 
          error: sheetError.message 
        });
      }
    });

    logEvent('INFO', 'log_cleanup_completed', 'server', 
            `Cleanup complete. Total deleted: ${totalDeleted} rows from ${logSheets.length} sheets`);
  
    return {
      success: true,
      totalDeleted: totalDeleted,
      sheetResults: sheetResults
    };

  } catch (error) {
    logEvent('ERROR', 'log_cleanup_failed', 'server', error.message);
    return {
      success: false,
      error: error.message,
      totalDeleted: 0,
      sheetResults: []
    };
  }
}

/**
 * Разбивка длинного текста на части для Telegram
 * @param {string} text - Текст для разбивки
 * @param {number} maxLength - Максимальная длина части (по умолчанию 4000)
 * @returns {Array<string>} - Массив частей текста
 */
function splitTextIntoChunks(text, maxLength = 4000) {
  if (!text || text.length <= maxLength) {
    return [text || ''];
  }

  var chunks = [];
  var currentText = text;

  while (currentText.length > maxLength) {
    var chunk = currentText.substring(0, maxLength);
    
    // Пытаемся разорвать на границе слов
    var lastSpace = chunk.lastIndexOf(' ');
    var lastNewline = chunk.lastIndexOf('\n');
    var breakPoint = Math.max(lastSpace, lastNewline);
    
    if (breakPoint > maxLength * 0.7) { // Используем только если разрыв достаточно далеко
      chunk = currentText.substring(0, breakPoint);
      currentText = currentText.substring(breakPoint + 1);
    } else {
      currentText = currentText.substring(maxLength);
    }
    
    chunks.push(chunk.trim());
  }

  if (currentText.trim().length > 0) {
    chunks.push(currentText.trim());
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Валидация токенов Telegram Bot и VK User Access
 * @param {string} botToken - Telegram Bot Token
 * @param {string} vkUserToken - VK User Access Token
 * @param {string} adminChatId - Admin Chat ID
 * @returns {Object} - Результат валидации
 */
function validateTokens(botToken, vkUserToken, adminChatId) {
  var results = {
    telegram: { status: '❌', message: '' },
    vkUser: { status: '❌', message: '' },
    adminChat: { status: '❌', message: '' }
  };

  try {
    // 1. Telegram Bot Token
    logEvent('DEBUG', 'validating_telegram_token', 'admin', 'Testing Telegram Bot API');
    try {
      var tgResponse = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        muteHttpExceptions: true,
        timeout: 10000
      });
      
      var tgData = JSON.parse(tgResponse.getContentText());
      if (tgData.ok) {
        results.telegram = { status: '✅', message: `@${tgData.result.username}` };
        logEvent('INFO', 'telegram_token_valid', 'admin', `Bot: @${tgData.result.username}`);
      } else {
        results.telegram = { status: '❌', message: tgData.description };
        logEvent('WARN', 'telegram_token_invalid', 'admin', tgData.description);
      }
    } catch (tgError) {
      results.telegram = { status: '❌', message: tgError.message };
    }

    // 2. VK User Token
    logEvent('DEBUG', 'validating_vk_user_token', 'admin', 'Testing VK User Token');
    try {
      var vkUserResponse = UrlFetchApp.fetch(
        `https://api.vk.com/method/users.get?v=${VK_API_VERSION}&access_token=${vkUserToken}`,
        { muteHttpExceptions: true, timeout: 10000 }
      );
      
      var vkUserData = JSON.parse(vkUserResponse.getContentText());
      if (vkUserData.response && vkUserData.response.length > 0) {
        var user = vkUserData.response[0];
        if (user && user.first_name && user.last_name) {
          results.vkUser = { status: '✅', message: `${user.first_name} ${user.last_name}` };
          logEvent('INFO', 'vk_user_token_valid', 'admin', `User: ${user.first_name} ${user.last_name}`);
        } else {
          results.vkUser = { status: '❌', message: 'VK API вернуло неполные данные' };
          logEvent('WARN', 'vk_user_data_incomplete', 'admin', 'User data is incomplete or missing');
        }
      } else if (vkUserData.error) {
        var errorMessage = vkUserData.error.error_msg;
        if (vkUserData.error.error_code === 4) {
          errorMessage = 'Неправильная подпись запроса. User Access Token должен иметь права: wall, offline';
        } else if (vkUserData.error.error_code === 5) {
          errorMessage = 'User Access Token недействителен или истёк. Нужны права: wall, offline';
        }
        results.vkUser = { status: '❌', message: `VK API ошибка: ${errorMessage} (код: ${vkUserData.error.error_code})` };
        logEvent('WARN', 'vk_user_token_invalid', 'admin', `Error code: ${vkUserData.error.error_code}, ${errorMessage}`);
      }
    } catch (vkUserError) {
      results.vkUser = { status: '❌', message: vkUserError.message };
    }

    // 3. Admin Chat ID
    if (results.telegram.status === '✅') {
      logEvent('DEBUG', 'validating_admin_chat', 'admin', `Testing Admin Chat ID: ${adminChatId}`);
      try {
        var adminTestResponse = UrlFetchApp.fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(adminChatId)}`,
          { method: 'GET', muteHttpExceptions: true, timeout: 10000 }
        );
        
        var adminTestData = JSON.parse(adminTestResponse.getContentText());
        if (adminTestData.ok) {
          results.adminChat = { status: '✅', message: '✅ Доступен' };
          logEvent('INFO', 'admin_chat_valid', 'admin', `Chat ID: ${adminChatId}`);
        } else {
          errorMessage = adminTestData.description;
          if (errorMessage.includes('chat not found')) {
            errorMessage = 'Чат не найден. Проверьте Chat ID';
          } else if (errorMessage.includes('bot was blocked')) {
            errorMessage = 'Бот заблокирован в чате';
          } else if (errorMessage.includes('not enough rights')) {
            errorMessage = 'Недостаточно прав в чате';
          }
          results.adminChat = { status: '❌', message: errorMessage };
          logEvent('WARN', 'admin_chat_invalid', 'admin', `Chat ID: ${adminChatId}, Error: ${errorMessage}`);
        }
      } catch (adminError) {
        results.adminChat = { status: '❌', message: adminError.message };
      }
    } else {
      results.adminChat = { status: '⚠️', message: 'Bot Token недействителен, невозможно проверить чат' };
    }

    // Итоговая оценка
    var allValid = Object.values(results).every(r => r.status === '✅');
    var partialValid = Object.values(results).some(r => r.status === '✅');
    
    var message;
    if (allValid) {
      message = '🎉 Все токены валидны!';
    } else if (partialValid) {
      message = '⚠️ Некоторые токены имеют проблемы. Проверьте детали выше.';
    } else {
      message = '❌ Все токены невалидны!';
    }

    logEvent('INFO', 'token_validation_complete', 'admin', message);
    return {
      success: allValid || partialValid,
      error: allValid ? null : message,
      details: results
    };

  } catch (error) {
    logEvent('ERROR', 'token_validation_error', 'admin', error.message);
    return {
      success: false,
      error: error.message,
      details: results
    };
  }
}

// ============================================
// ИДЕНТИФИКАЦИЯ VK И TELEGRAM
// ============================================

/**
 * Извлечение VK Group ID из URL или преобразование screen_name
 * @param {string} url - VK URL или ID
 * @returns {string} - Нормализованный VK Group ID
 */
function extractVkGroupId(url) {
  try {
    if (!url || typeof url !== 'string') {
      logEvent('WARN', 'vk_url_invalid_type', 'server', `URL type: ${typeof url}`);
      throw new Error('Invalid URL type');
    }

    const originalInput = url;
    const cleanInput = url.trim().toLowerCase().split('?')[0].split('#')[0];
    
    logEvent('DEBUG', 'vk_group_id_extraction_start', 'server', `Input: ${originalInput}, Clean: ${cleanInput}`);

    // Случай 1: Чистый числовой ID (-123456 или 123456)
    if (/^-?\d+$/.test(cleanInput)) {
      const normalizedId = cleanInput.startsWith('-') ? cleanInput : '-' + cleanInput;
      logEvent('DEBUG', 'vk_group_id_numeric', 'server', `${originalInput} → ${normalizedId}`);
      return normalizedId;
    }

    // Случай 2: vk.com/public123, vk.com/club123
    const publicClubMatch = cleanInput.match(/vk\.com\/(public|club)(\d+)/i);
    if (publicClubMatch) {
      const result = '-' + publicClubMatch[2];
      logEvent('DEBUG', 'vk_group_id_public_club', 'server', `${originalInput} → ${result}`);
      return result;
    }

    // Случай 3: vk.com/username - нужно резолвить через API
    const nameMatch = cleanInput.match(/vk\.com\/([a-z0-9_]+)/i);
    if (nameMatch) {
      const screenName = nameMatch[1];
      
      // Фолбэк: если это выглядит как число, попробуем
      if (/^\d+$/.test(screenName)) {
        const result = '-' + screenName;
        logEvent('DEBUG', 'vk_group_id_fallback_numeric', 'server', `${originalInput} → ${result}`);
        return result;
      }
      
      // Резолвим через API
      try {
        const result = resolveVkScreenName(screenName);
        logEvent('DEBUG', 'vk_group_id_resolved', 'server', `${originalInput} → ${screenName} → ${result}`);
        return result;
      } catch (error) {
        logEvent('ERROR', 'vk_group_id_resolution_failed', 'server', 
                `Failed to resolve ${screenName} from ${originalInput}: ${error.message}`);
        throw new Error(`Не удалось определить ID группы из ${screenName} (${originalInput}): ${error.message}`);
      }
    }

    // Если ничего не подошло
    throw new Error(`VK URL format not recognized: ${originalInput}`);

  } catch (error) {
    logEvent('ERROR', 'vk_url_extraction_failed', 'server', `URL: ${url}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Извлечение Telegram Chat ID из URL или username
 * @param {string} input - Telegram URL, username или chat ID
 * @returns {string} - Нормализованный chat ID
 */
function extractTelegramChatId(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Empty Telegram input');
  }

  const cleanInput = input.trim();
  
  // Числовой chat ID
  if (/^-?\d+$/.test(cleanInput)) {
    return cleanInput;
  }
  
  // Username или URL patterns
  const patterns = [
    /t\.me\/([a-z0-9_]+)/i,
    /t\.me\/([a-z0-9_]+)/i,
    /^@?([a-z0-9_]+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      return '@' + match[1];
    }
  }
  
  throw new Error('Invalid Telegram format');
}

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
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))[0]?.[0] || "Нет данных",
      
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

// escapeHtml function is defined at the top of this file

function jsonResponse(data, statusCode = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// URL AND ID EXTRACTION UTILITIES
// ============================================

// extractVkGroupId function is defined earlier in this file

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

// extractTelegramChatId function is defined earlier in this file
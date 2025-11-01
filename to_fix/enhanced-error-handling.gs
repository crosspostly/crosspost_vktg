/**
 * ИСПРАВЛЕНИЕ 5: Enhanced Error Logging and Handling
 * Добавить улучшенные функции логирования в server.gs
 */

/**
 * Улучшенная функция логирования с поддержкой структурированных данных
 */
function logEvent(level, event, user, details, extraData = null) {
  try {
    // Пропускаем DEBUG логи в продакшене
    if (!DEV_MODE && level === "DEBUG") {
      return;
    }
    
    const sheet = getSheet("Logs");
    
    // Структурированные данные для лога
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      user: user || "system",
      details: details || "",
      server_version: SERVER_VERSION
    };
    
    // Добавляем дополнительные данные если есть
    if (extraData) {
      logEntry.extra = JSON.stringify(extraData);
    }
    
    // Записываем в лист
    sheet.appendRow([
      logEntry.timestamp,
      logEntry.level,
      logEntry.event,
      logEntry.user,
      logEntry.details,
      logEntry.extra || ""
    ]);
    
    // Логируем в консоль для отладки
    console.log(`[${level}] ${event} (${user}): ${details}`, extraData || '');
    
    // Отправляем критические ошибки админу
    if (level === "ERROR" && shouldNotifyAdmin(event)) {
      notifyAdminAboutError(logEntry);
    }
    
    // Автоматическая ротация логов (удаляем старые записи)
    if (Math.random() < 0.01) { // 1% вероятность проверки
      rotateLogsIfNeeded();
    }
    
  } catch (error) {
    console.error("Critical logging error:", error.message);
    // Fallback - пытаемся записать хотя бы в консоль
  }
}

/**
 * Специализированная функция для логирования API ошибок
 */
function logApiError(service, endpoint, request, response, error = null) {
  try {
    const apiErrorData = {
      service: service, // 'VK', 'TG', 'GOOGLE'
      endpoint: endpoint,
      request: {
        method: request.method || 'GET',
        url: request.url ? request.url.substring(0, 200) + '...' : 'N/A',
        payload_size: request.payload ? request.payload.length : 0
      },
      response: {
        status_code: response.status_code || 'N/A',
        headers: response.headers || {},
        body_size: response.body ? response.body.length : 0,
        body_preview: response.body ? response.body.substring(0, 500) + '...' : 'N/A'
      },
      error_message: error || 'No error message'
    };
    
    logEvent("ERROR", `${service.toLowerCase()}_api_error`, "system", 
             `${service} API Error: ${endpoint}`, apiErrorData);
             
    // Обновляем статистику ошибок
    updateErrorStatistics(service, endpoint);
    
  } catch (logError) {
    console.error("API error logging failed:", logError.message);
  }
}

/**
 * Функция retry с exponential backoff для API запросов
 */
function retryApiCall(apiFunction, maxRetries = 3, initialBackoffMs = 1000, ...args) {
  let lastError = null;
  let backoffMs = initialBackoffMs;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logEvent("DEBUG", "api_retry_attempt", "system", 
               `Function: ${apiFunction.name}, Attempt: ${attempt}/${maxRetries}`);
      
      const result = apiFunction.apply(null, args);
      
      // Если результат содержит success: true, считаем успешным
      if (result && result.success === true) {
        if (attempt > 1) {
          logEvent("INFO", "api_retry_success", "system", 
                   `Function: ${apiFunction.name}, Success on attempt: ${attempt}`);
        }
        return result;
      }
      
      // Если результат содержит success: false, считаем ошибкой
      if (result && result.success === false) {
        lastError = new Error(result.error || 'API call failed');
        
        // Проверяем, стоит ли повторять (некоторые ошибки не имеет смысла повторять)
        if (!shouldRetryError(result.error)) {
          logEvent("WARN", "api_retry_skip", "system", 
                   `Function: ${apiFunction.name}, Non-retryable error: ${result.error}`);
          break;
        }
      }
      
    } catch (error) {
      lastError = error;
      logEvent("WARN", "api_retry_exception", "system", 
               `Function: ${apiFunction.name}, Attempt: ${attempt}, Error: ${error.message}`);
    }
    
    // Если это не последняя попытка - ждем перед следующей
    if (attempt < maxRetries) {
      logEvent("DEBUG", "api_retry_backoff", "system", 
               `Waiting ${backoffMs}ms before retry ${attempt + 1}`);
      Utilities.sleep(backoffMs);
      backoffMs *= 2; // Exponential backoff
    }
  }
  
  // Все попытки неудачны
  logEvent("ERROR", "api_retry_failed", "system", 
           `Function: ${apiFunction.name}, All ${maxRetries} attempts failed. Last error: ${lastError?.message}`);
  
  return { success: false, error: lastError?.message || 'All retry attempts failed' };
}

/**
 * Определяет, стоит ли повторять запрос при данной ошибке
 */
function shouldRetryError(errorMessage) {
  if (!errorMessage) return true;
  
  const errorLower = errorMessage.toLowerCase();
  
  // НЕ повторяем при этих ошибках (они не временные)
  const nonRetryableErrors = [
    'license not found',
    'license expired',
    'invalid token',
    'unauthorized',
    'forbidden',
    'not found',
    'bad request',
    'invalid format',
    'binding not found'
  ];
  
  for (const nonRetryable of nonRetryableErrors) {
    if (errorLower.includes(nonRetryable)) {
      return false;
    }
  }
  
  return true; // По умолчанию повторяем
}

/**
 * Валидация входных данных для binding
 */
function validateBindingData(vkUrl, tgChatId) {
  const errors = [];
  
  // Проверка VK URL
  if (!vkUrl || typeof vkUrl !== 'string' || vkUrl.trim() === '') {
    errors.push('VK URL cannot be empty');
  } else {
    try {
      extractVkGroupId(vkUrl); // Попытка извлечь ID
    } catch (vkError) {
      errors.push(`Invalid VK URL: ${vkError.message}`);
    }
  }
  
  // Проверка Telegram Chat ID
  if (!tgChatId || typeof tgChatId !== 'string' || tgChatId.trim() === '') {
    errors.push('Telegram Chat ID cannot be empty');
  } else {
    try {
      extractTelegramChatId(tgChatId); // Попытка извлечь ID
    } catch (tgError) {
      errors.push(`Invalid Telegram Chat ID: ${tgError.message}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Проверка квот API
 */
function isApiQuotaExceeded(service) {
  try {
    const quotaKey = `quota_${service.toLowerCase()}_${new Date().toDateString()}`;
    const currentCount = parseInt(PropertiesService.getScriptProperties()
      .getProperty(quotaKey) || '0');
    
    const quotaLimits = {
      'vk': 5000,      // VK API лимит в день
      'telegram': 3000, // Произвольный лимит для Telegram
      'google': 10000   // Google Apps Script лимит
    };
    
    const limit = quotaLimits[service.toLowerCase()] || 1000;
    
    if (currentCount >= limit) {
      logEvent("WARN", "api_quota_exceeded", "system", 
               `Service: ${service}, Count: ${currentCount}, Limit: ${limit}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    logEvent("ERROR", "quota_check_error", "system", error.message);
    return false; // В случае ошибки считаем что квота не превышена
  }
}

/**
 * Увеличивает счетчик использования API
 */
function incrementApiQuota(service) {
  try {
    const quotaKey = `quota_${service.toLowerCase()}_${new Date().toDateString()}`;
    const currentCount = parseInt(PropertiesService.getScriptProperties()
      .getProperty(quotaKey) || '0');
    
    PropertiesService.getScriptProperties()
      .setProperty(quotaKey, (currentCount + 1).toString());
      
  } catch (error) {
    logEvent("ERROR", "quota_increment_error", "system", error.message);
  }
}

/**
 * Определяет нужно ли уведомлять админа об ошибке
 */
function shouldNotifyAdmin(event) {
  const criticalEvents = [
    'server_init_failed',
    'config_save_failed',
    'license_check_error',
    'binding_add_error',
    'send_post_error',
    'vk_api_error',
    'telegram_api_error',
    'database_error'
  ];
  
  return criticalEvents.includes(event);
}

/**
 * Отправляет уведомление админу о критической ошибке
 */
function notifyAdminAboutError(logEntry) {
  try {
    const adminChatId = PropertiesService.getScriptProperties()
      .getProperty("ADMIN_CHAT_ID");
    const botToken = PropertiesService.getScriptProperties()
      .getProperty("BOT_TOKEN");
    
    if (!adminChatId || !botToken) {
      return; // Нет конфигурации для уведомлений
    }
    
    const message = `🚨 Критическая ошибка VK→TG Server\n\n` +
      `⏰ Время: ${logEntry.timestamp}\n` +
      `🔴 Уровень: ${logEntry.level}\n` +
      `📋 Событие: ${logEntry.event}\n` +
      `👤 Пользователь: ${logEntry.user}\n` +
      `📄 Детали: ${logEntry.details}\n\n` +
      `🏢 Сервер: v${logEntry.server_version}`;
    
    // Отправляем уведомление (без retry чтобы не создать бесконечный цикл)
    UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: 'Markdown',
        disable_notification: false
      }),
      muteHttpExceptions: true,
      timeout: 10000
    });
    
  } catch (error) {
    console.error("Admin notification failed:", error.message);
  }
}

/**
 * Ротация логов - удаляет старые записи
 */
function rotateLogsIfNeeded() {
  try {
    const sheet = getSheet("Logs");
    const data = sheet.getDataRange().getValues();
    
    const MAX_LOG_ENTRIES = 10000; // Максимум записей в логе
    const KEEP_ENTRIES = 8000;     // Сколько оставить после очистки
    
    if (data.length > MAX_LOG_ENTRIES) {
      logEvent("INFO", "log_rotation_start", "system", 
               `Current entries: ${data.length}, Max: ${MAX_LOG_ENTRIES}`);
      
      // Удаляем старые записи (оставляем заголовок + последние KEEP_ENTRIES)
      const rowsToDelete = data.length - KEEP_ENTRIES - 1; // -1 для заголовка
      
      if (rowsToDelete > 0) {
        sheet.deleteRows(2, rowsToDelete); // Начинаем с строки 2 (после заголовка)
        
        logEvent("INFO", "log_rotation_complete", "system", 
                 `Deleted ${rowsToDelete} old log entries`);
      }
    }
    
  } catch (error) {
    logEvent("ERROR", "log_rotation_error", "system", error.message);
  }
}

/**
 * Обновляет статистику ошибок для мониторинга
 */
function updateErrorStatistics(service, endpoint) {
  try {
    const today = new Date().toDateString();
    const statsKey = `error_stats_${service}_${endpoint}_${today}`;
    
    const currentCount = parseInt(PropertiesService.getScriptProperties()
      .getProperty(statsKey) || '0');
    
    PropertiesService.getScriptProperties()
      .setProperty(statsKey, (currentCount + 1).toString());
    
    // Если слишком много ошибок в одном API - логируем предупреждение
    if (currentCount > 10) {
      logEvent("WARN", "high_error_rate_detected", "system", 
               `Service: ${service}, Endpoint: ${endpoint}, Errors today: ${currentCount + 1}`);
    }
    
  } catch (error) {
    console.error("Error statistics update failed:", error.message);
  }
}

/**
 * ОБНОВЛЕНИЕ: Модификация существующих функций с улучшенной обработкой ошибок
 */

// Пример обновления функции sendVkPostToTelegram с улучшенной обработкой:
/*
function sendVkPostToTelegram(chatId, vkPost) {
  return retryApiCall(function(chatId, vkPost) {
    try {
      const botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
      
      if (!botToken) {
        return { success: false, error: "Bot token not configured" };
      }
      
      // Проверяем квоту
      if (isApiQuotaExceeded('telegram')) {
        return { success: false, error: "Telegram API quota exceeded for today" };
      }
      
      // Увеличиваем счетчик использования
      incrementApiQuota('telegram');
      
      // ... остальная логика функции ...
      
    } catch (error) {
      logApiError('TG', 'sendMessage', 
        { method: 'POST', url: 'sendMessage', payload: JSON.stringify({chat_id: chatId}) },
        { status_code: 0, body: error.message },
        error.message
      );
      return { success: false, error: error.message };
    }
  }, 3, 1000, chatId, vkPost); // 3 попытки, начальная задержка 1 сек
}
*/

/**
 * Функция для тестирования системы логирования
 */
function testErrorLogging() {
  try {
    // Тестируем разные уровни логов
    logEvent("DEBUG", "test_debug_log", "tester", "This is a debug message");
    logEvent("INFO", "test_info_log", "tester", "This is an info message");
    logEvent("WARN", "test_warning_log", "tester", "This is a warning message");
    logEvent("ERROR", "test_error_log", "tester", "This is an error message");
    
    // Тестируем API лог
    logApiError("TEST", "test_endpoint", 
      { method: "POST", url: "https://api.test.com/endpoint", payload: "test data" },
      { status_code: 500, body: "Internal server error", headers: {} },
      "Test error message"
    );
    
    console.log("✅ Error logging system test completed");
    
  } catch (error) {
    console.error("❌ Error logging test failed:", error.message);
  }
}
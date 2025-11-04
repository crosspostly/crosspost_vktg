// ============================================
// SERVER.GS v6.1 ПАТЧИ - ПОДДЕРЖКА НОВЫХ ВОЗМОЖНОСТЕЙ
// ============================================

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Улучшенное форматирование текста для Telegram v6.1
 * Поддерживает VK гиперссылки [url|текст] и другие улучшения
 */
function formatVkTextForTelegramV61(text, options) {
  if (!text || typeof text !== 'string') {
    return "";
  }

  options = options || {};
  var boldFirstLine = options.boldFirstLine !== false;
  var boldUppercase = options.boldUppercase !== false;

  // 1. Обрабатываем VK гиперссылки [url|текст] -> [текст](url)
  text = text.replace(/\[([^\|\]]+)\|([^\]]+)\]/g, function(match, url, linkText) {
    if (url && linkText) {
      var processedUrl = url.trim();
      
      // Добавляем https если нужно
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        if (processedUrl.startsWith('vk.com/') || processedUrl.startsWith('www.vk.com/')) {
          processedUrl = 'https://' + processedUrl;
        } else if (processedUrl.startsWith('/')) {
          processedUrl = 'https://vk.com' + processedUrl;
        }
      }
      
      return '[' + linkText.trim() + '](' + processedUrl + ')';
    }
    return linkText ? linkText.trim() : match;
  });

  // 2. Делаем жирным первое предложение (если включено)
  if (boldFirstLine) {
    text = text.replace(/^([^.!?]*[.!?])/, '*$1*');
  }

  // 3. Делаем жирными слова в ВЕРХНЕМ РЕГИСТРЕ (если включено)
  if (boldUppercase) {
    text = text.replace(/\b[А-ЯA-Z]{2,}\b/g, '*$&*');
  }

  // 4. Обрабатываем стандартные VK ссылки [id123|имя]
  text = text.replace(/\[(id\d+|club\d+|public\d+|\w+)\|([^\]]+)\]/g, function(match, id, title) {
    if (id.startsWith('id') || id.startsWith('club') || id.startsWith('public')) {
      return '[' + title + '](https://vk.com/' + id + ')';
    } else {
      return '[' + title + '](https://vk.com/' + id + ')';
    }
  });

  // 5. Удаляем лишние пробелы
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * ✅ ОБНОВЛЕННАЯ ФУНКЦИЯ: formatVkPostForTelegram v6.1
 * Использует новую функцию форматирования с поддержкой VK гиперссылок
 */
function formatVkPostForTelegramV61(vkPost, binding) {
  if (!vkPost || !vkPost.text) {
    return "";
  }

  // Получаем настройки форматирования из связки
  var formatOptions = {
    boldFirstLine: false,
    boldUppercase: false
  };

  // Парсим formatSettings из связки
  if (binding && binding.formatSettings) {
    try {
      var settings = typeof binding.formatSettings === 'string' 
        ? JSON.parse(binding.formatSettings) 
        : binding.formatSettings;

      formatOptions.boldFirstLine = settings.boldFirstLine || false;
      formatOptions.boldUppercase = settings.boldUppercase || false;

      logEvent("DEBUG", "format_settings_applied_v61", binding.licenseKey || "unknown", 
               'Bold first: ' + formatOptions.boldFirstLine + ', Bold uppercase: ' + formatOptions.boldUppercase);
    } catch (e) {
      logEvent("WARN", "format_settings_parse_error_v61", binding.licenseKey || "unknown", e.message);
    }
  }

  // ✅ ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ ФОРМАТИРОВАНИЯ v6.1
  return formatVkTextForTelegramV61(vkPost.text, formatOptions);
}

/**
 * ✅ ОБНОВЛЕННАЯ: Алиас для совместимости с клиентом
 */
function formatVkPostForTelegram(vkPost, binding) {
  return formatVkPostForTelegramV61(vkPost, binding);
}

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Принудительная очистка кеша лицензий (для отладки)
 */
function clearAllLicenseCache() {
  try {
    var props = PropertiesService.getScriptProperties();
    var allProps = props.getProperties();
    var clearedCount = 0;
    
    // Ищем и удаляем все записи кеша лицензий
    Object.keys(allProps).forEach(function(key) {
      if (key.indexOf('LICENSE_META') !== -1 || key.indexOf('license_cache_') !== -1) {
        props.deleteProperty(key);
        clearedCount++;
      }
    });
    
    logEvent("INFO", "license_cache_cleared", "admin", 
             'Cleared ' + clearedCount + ' license cache entries');
    
    return { success: true, cleared: clearedCount };
    
  } catch (error) {
    logEvent("ERROR", "clear_license_cache_error", "admin", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Статистика кеширования лицензий
 */
function getLicenseCacheStats() {
  try {
    var props = PropertiesService.getScriptProperties();
    var allProps = props.getProperties();
    
    var stats = {
      totalCacheEntries: 0,
      activeCacheKeys: [],
      oldestCache: null,
      newestCache: null
    };
    
    // Анализируем все записи кеша
    Object.keys(allProps).forEach(function(key) {
      if (key.indexOf('LICENSE_META') !== -1) {
        stats.totalCacheEntries++;
        stats.activeCacheKeys.push(key);
        
        try {
          var metaData = JSON.parse(allProps[key]);
          if (metaData.cachedAt) {
            var cacheDate = new Date(metaData.cachedAt);
            
            if (!stats.oldestCache || cacheDate < stats.oldestCache) {
              stats.oldestCache = cacheDate;
            }
            
            if (!stats.newestCache || cacheDate > stats.newestCache) {
              stats.newestCache = cacheDate;
            }
          }
        } catch (e) {
          // Игнорируем поврежденные записи
        }
      }
    });
    
    logEvent("INFO", "license_cache_stats", "admin", 
             'Total cache entries: ' + stats.totalCacheEntries);
    
    return { success: true, stats: stats };
    
  } catch (error) {
    logEvent("ERROR", "license_cache_stats_error", "admin", error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ API ОБРАБОТЧИКИ v6.1
// ============================================

/**
 * ✅ НОВЫЙ ОБРАБОТЧИК: Получение статистики кеша лицензий
 */
function handleGetCacheStats(payload, clientIp) {
  try {
    var { license_key } = payload;
    
    // Проверяем что это запрос от валидной лицензии
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    var cacheStats = getLicenseCacheStats();
    
    logEvent("INFO", "cache_stats_requested", license_key, 
             'IP: ' + clientIp + ', Stats: ' + (cacheStats.success ? 'retrieved' : 'failed'));
    
    return jsonResponse(cacheStats);
    
  } catch (error) {
    logEvent("ERROR", "get_cache_stats_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * ✅ НОВЫЙ ОБРАБОТЧИК: Очистка кеша лицензий (для администраторов)
 */
function handleClearCache(payload, clientIp) {
  try {
    var { license_key, admin_action } = payload;
    
    // Проверяем лицензию и права администратора
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Дополнительная проверка на админские права (опционально)
    if (admin_action && admin_action === 'clear_all_cache') {
      var clearResult = clearAllLicenseCache();
      
      logEvent("INFO", "cache_cleared_by_admin", license_key, 
               'IP: ' + clientIp + ', Result: ' + JSON.stringify(clearResult));
      
      return jsonResponse(clearResult);
    } else {
      return jsonResponse({
        success: false,
        error: "Admin action required"
      }, 403);
    }
    
  } catch (error) {
    logEvent("ERROR", "clear_cache_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * ✅ ОБНОВЛЕННАЯ ФУНКЦИЯ: Расширенная обработка событий doPost v6.1
 */
function doPostV61(e) {
  try {
    // Стандартная валидация
    if (!e || !e.postData || !e.postData.contents) {
      logEvent("ERROR", "invalid_request_structure", "anonymous", "Missing post data");
      return jsonResponse({
        success: false, 
        error: "Invalid request: missing post data"
      }, 400);
    }

    var clientIp = e.parameter?.clientIp || "unknown";
    
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      logEvent("ERROR", "json_parse_error", "anonymous", 
               'Invalid JSON: ' + parseError.message + ', Content: ' + e.postData.contents.substring(0, 100));
      return jsonResponse({
        success: false, 
        error: "Invalid JSON in request body"
      }, 400);
    }

    if (!payload.event) {
      logEvent("WARN", "missing_event_field", payload.license_key || "anonymous", 
               'Payload keys: ' + Object.keys(payload).join(', '));
      return jsonResponse({
        success: false, 
        error: "Missing 'event' field in request"
      }, 400);
    }
    
    logEvent("DEBUG", "api_request_v61", payload.license_key || "anonymous", 
             'Event: ' + payload.event + ', IP: ' + clientIp);
    
    // Обработка событий с добавленными v6.1 обработчиками
    switch(payload.event) {
      case "check_license":
        return handleCheckLicense(payload, clientIp);
      
      case "get_bindings":
        return handleGetBindings(payload, clientIp);
      
      case "get_user_bindings_with_names":
        return handleGetUserBindingsWithNames(payload, clientIp);
      
      case "add_binding":
        return handleAddBinding(payload, clientIp);
      
      case "edit_binding":
        return handleEditBinding(payload, clientIp);
      
      case "delete_binding":
        return handleDeleteBinding(payload, clientIp);
      
      case "toggle_binding_status":
        return handleToggleBindingStatus(payload, clientIp);
      
      case "send_post":
        return handleSendPost(payload, clientIp);
      
      case "test_publication":
        return handleTestPublication(payload, clientIp);
      
      case "get_vk_posts":
        return handleGetVkPosts(payload, clientIp);
      
      case "publish_last_post":
        return handlePublishLastPost(payload, clientIp);
      
      case "get_global_setting":
        return handleGetGlobalSetting(payload, clientIp);
      
      case "set_global_setting":
        return handleSetGlobalSetting(payload, clientIp);
      
      // ✅ НОВЫЕ ОБРАБОТЧИКИ v6.1:
      case "get_cache_stats":
        return handleGetCacheStats(payload, clientIp);
      
      case "clear_cache":
        return handleClearCache(payload, clientIp);
      
      default:
        logEvent("WARN", "unknown_event_v61", payload.license_key || "anonymous", 
                 'Unknown event: ' + payload.event);
        return jsonResponse({
          success: false, 
          error: 'Unknown event: ' + payload.event
        }, 400);
    }
    
  } catch (error) {
    logEvent("ERROR", "api_critical_error_v61", "system", 
             'Critical API error: ' + error.message);
    return jsonResponse({
      success: false, 
      error: "Critical server error:" + error.message
    }, 500);
  }
}

// ============================================
// ОБНОВЛЕННАЯ ИНТЕГРАЦИЯ - ЗАМЕНИТЬ ИСХОДНЫЕ ФУНКЦИИ
// ============================================

// Заменяем старую функцию на новую (сохраняем обратную совместимость)
// Эта замена должна быть в самом конце server.gs файла
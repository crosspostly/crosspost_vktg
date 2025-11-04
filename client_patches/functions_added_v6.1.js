/**
 * НОВЫЕ И ЗАМЕНЯЕМЫЕ ФУНКЦИИ ДЛЯ CLIENT.GS v6.1
 * Критические исправления: кэш лицензии, листы с именами групп, гиперссылки
 * 
 * Дата: 2025-11-04
 * Автор: f_den
 * 
 * ИНСТРУКЦИЯ: Заменить существующие функции в CLIENT.GS на версии ниже
 */

// ============================================
// КОНСТАНТЫ ДЛЯ КЕША ЛИЦЕНЗИИ
// ============================================

// ✅ ДОБАВИТЬ В НАЧАЛО CLIENT.GS (ПОСЛЕ ДРУГИХ КОНСТАНТ):
var LICENSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
var USER_PROP_LICENSE_KEY = 'LICENSE_KEY';
var USER_PROP_LICENSE_META = 'LICENSE_META';

// ============================================
// НОВАЯ СИСТЕМА КЕШИРОВАНИЯ ЛИЦЕНЗИИ
// ============================================

/**
 * Получение лицензии с кешированием (24 часа)
 * @param {boolean} forceRefresh - принудительное обновление с сервера
 * @returns {Object|null} - данные лицензии или null
 */
function getLicenseCached(forceRefresh) {
  try {
    // 1) Пытаемся взять из appState (самое быстрое)
    if (!forceRefresh && appState.license && appState.license.cachedAt) {
      var age = Date.now() - appState.license.cachedAt;
      if (age < LICENSE_CACHE_TTL_MS) {
        logEvent("DEBUG", "license_from_memory", "client", "Using cached license from memory");
        return appState.license;
      }
    }

    // 2) Пытаемся взять из PropertiesService (пользовательское хранилище)
    var props = PropertiesService.getUserProperties();
    var key = props.getProperty(USER_PROP_LICENSE_KEY);
    var metaRaw = props.getProperty(USER_PROP_LICENSE_META);
    
    if (!forceRefresh && key && metaRaw) {
      try {
        var meta = JSON.parse(metaRaw);
        var age2 = Date.now() - (meta.cachedAt || 0);
        if (age2 < LICENSE_CACHE_TTL_MS) {
          appState.license = {
            key: key,
            type: meta.type,
            maxGroups: meta.maxGroups,
            expires: meta.expires,
            cachedAt: meta.cachedAt
          };
          logEvent("DEBUG", "license_from_properties", "client", "Using cached license from UserProperties");
          return appState.license;
        }
      } catch (e) {
        logEvent("WARN", "license_cache_parse_error", "client", e.message);
      }
    }

    // 3) Освежаем с сервера ОДИН РАЗ (или по forceRefresh)
    logEvent("INFO", "license_refresh_from_server", "client", forceRefresh ? "Force refresh" : "Cache expired");
    var fresh = getLicense(); // Существующая функция остается без изменений
    
    if (fresh && fresh.key) {
      // Снабжаем меткой времени и кладем в кэш
      fresh.cachedAt = Date.now();
      appState.license = fresh;
      
      // Сохраняем в PropertiesService
      props.setProperty(USER_PROP_LICENSE_KEY, fresh.key);
      props.setProperty(USER_PROP_LICENSE_META, JSON.stringify({
        type: fresh.type,
        maxGroups: fresh.maxGroups,
        expires: fresh.expires,
        cachedAt: fresh.cachedAt
      }));
      
      logEvent("INFO", "license_cached_successfully", "client", "License refreshed and cached for 24 hours");
      return fresh;
    }

    return null;
    
  } catch (error) {
    logEvent("ERROR", "license_cache_error", "client", error.message);
    return null;
  }
}

// ============================================
// ЛИСТЫ С ИМЕНАМИ ГРУПП (НЕ Published_*)
// ============================================

/**
 * Извлечение имени группы для названия листа из VK URL
 * @param {string} url - VK URL
 * @returns {string|null} - имя группы для листа или null
 */
function extractSheetNameFromVkUrl(url) {
  if (!url) return null;
  
  try {
    // Очистка URL
    var cleanUrl = url.replace(/^https?:\/\/(m\.|www\.)?/i, '').split('?')[0].split('#')[0];
    
    // vk.com/varsmana → "varsmana"
    // vk.com/club123 → "club123"
    // vk.com/public123 → "public123"
    var match = cleanUrl.match(/vk\.com\/([a-zA-Z0-9_.]+)/);
    
    if (match && match[1]) {
      var sheetName = match[1];
      logEvent("DEBUG", "sheet_name_extracted", "client", "URL: " + url + " → Sheet: " + sheetName);
      return sheetName;
    }
    
    logEvent("WARN", "sheet_name_not_extracted", "client", "Could not extract sheet name from: " + url);
    return null;
    
  } catch (error) {
    logEvent("ERROR", "sheet_name_extraction_error", "client", error.message);
    return null;
  }
}

/**
 * Проверка отправлен ли пост (по листу группы)
 * @param {string} sheetName - имя листа группы
 * @param {number} postId - ID поста VK
 * @returns {boolean}
 */
function isPostAlreadySent(sheetName, postId) {
  if (!sheetName || !postId) return false;
  
  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      logEvent("DEBUG", "sheet_not_found_for_check", "client", "Sheet: " + sheetName);
      return false;
    }
    
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) { // Пропускаем заголовок
      if (data[i][0] == postId) {
        logEvent("DEBUG", "post_already_sent", "client", "Post " + postId + " found in sheet " + sheetName);
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    logEvent("ERROR", "check_post_error", "client", error.message);
    return false;
  }
}

/**
 * Отметка поста как отправленного (в лист группы)
 * @param {string} sheetName - имя листа группы
 * @param {number} postId - ID поста VK
 * @param {Object} meta - метаданные поста
 */
function markPostAsSent(sheetName, postId, meta) {
  if (!sheetName || !postId) return;
  
  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      // Создаем лист если не существует
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, 6).setValues([[
        "VK Post ID", "TG Message ID", "Timestamp", "Text Length", "Attachments", "Status"
      ]]);
      logEvent("INFO", "sheet_created_for_posts", "client", "Created sheet: " + sheetName);
    }
    
    // Добавляем запись
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy, HH:mm");
    sheet.appendRow([
      postId,
      meta.messageId || "",
      timestamp,
      meta.textLength || 0,
      meta.attachmentCount || 0,
      "sent"
    ]);
    
    logEvent("DEBUG", "post_marked_as_sent", "client", "Post " + postId + " marked in sheet " + sheetName);
    
  } catch (error) {
    logEvent("ERROR", "mark_post_error", "client", error.message);
  }
}

/**
 * Создание листов для всех связок (с новыми именами)
 * @returns {Object} - результат создания
 */
function ensureAllPublishedSheetsExist() {
  try {
    logEvent("INFO", "ensure_sheets_start", "client", "Creating sheets with group names");
    
    var bindingsResult = getBindingsWithNames();
    if (!bindingsResult.success) {
      logEvent("ERROR", "ensure_sheets_no_bindings", "client", bindingsResult.error);
      return { success: false, error: bindingsResult.error };
    }
    
    var ss = SpreadsheetApp.getActive();
    var created = 0;
    var total = bindingsResult.bindings.length;
    
    bindingsResult.bindings.forEach(function(binding) {
      var sheetName = extractSheetNameFromVkUrl(binding.vkGroupUrl || binding.vk_group_url);
      
      if (sheetName && !ss.getSheetByName(sheetName)) {
        var sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, 6).setValues([[
          "VK Post ID", "TG Message ID", "Timestamp", "Text Length", "Attachments", "Status"
        ]]);
        created++;
        logEvent("INFO", "sheet_created_for_binding", "client", 
                "Sheet: " + sheetName + ", Binding: " + (binding.bindingName || binding.id));
      }
    });
    
    logEvent("INFO", "ensure_sheets_complete", "client", 
            "Checked " + total + " bindings, created " + created + " new sheets");
    
    return { success: true, total: total, created: created };
    
  } catch (error) {
    logEvent("ERROR", "ensure_sheets_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// ОБРАБОТКА VK ГИПЕРССЫЛОК
// ============================================

/**
 * Обработка VK-разметки [id|текст] в Telegram markdown
 * @param {string} text - исходный текст
 * @returns {string} - обработанный текст
 */
function processVkLinks(text) {
  if (!text) return text;
  
  try {
    // VK-ссылки: [id123456|текст], [club123|группа], [durov|Павел]
    var vkLinkRegex = /\[([^|\]]+)\|([^\]]+)\]/g;
    
    return text.replace(vkLinkRegex, function(match, vkId, linkText) {
      var url;
      
      // Определяем полный URL
      if (vkId.match(/^(id|club|public|event)\d+$/) || vkId.match(/^wall-?\d+_\d+$/)) {
        url = 'https://vk.com/' + vkId;
      } else if (vkId.match(/^[a-zA-Z0-9_.]+$/)) {
        // Короткое имя типа "durov"
        url = 'https://vk.com/' + vkId;
      } else {
        // Если уже полная ссылка
        url = vkId;
      }
      
      // ✅ ВОЗВРАЩАЕМ TELEGRAM MARKDOWN: [текст](ссылка)
      return '[' + linkText.trim() + '](' + url + ')';
    });
    
  } catch (error) {
    logEvent("ERROR", "vk_links_processing_error", "client", error.message);
    return text;
  }
}

// ============================================
// БЕЗОПАСНАЯ ПУБЛИКАЦИЯ ПОСЛЕДНЕГО ПОСТА
// ============================================

/**
 * Безопасный выбор последнего валидного поста
 * @param {Array} posts - массив постов VK
 * @returns {Object|null} - валидный пост или null
 */
function safePickLastPost(posts) {
  try {
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      logEvent("WARN", "no_posts_to_pick", "client", "Posts array is empty or invalid");
      return null;
    }
    
    // Ищем первый валидный пост
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      
      if (!post || !post.id) {
        logEvent("WARN", "post_no_id", "client", "Post at index " + i + " has no id");
        continue;
      }
      
      // Проверяем что у поста есть контент
      var hasText = post.text && post.text.trim().length > 0;
      var hasAttachments = post.attachments && post.attachments.length > 0;
      
      if (!hasText && !hasAttachments) {
        logEvent("WARN", "post_no_content", "client", "Post " + post.id + " has no text or attachments");
        continue;
      }
      
      logEvent("DEBUG", "valid_post_found", "client", 
              "Post " + post.id + ", Text: " + (hasText ? "yes" : "no") + ", Attachments: " + (hasAttachments ? post.attachments.length : 0));
      return post;
    }
    
    logEvent("WARN", "no_valid_posts", "client", "No valid posts found in array of " + posts.length);
    return null;
    
  } catch (error) {
    logEvent("ERROR", "safe_pick_post_error", "client", error.message);
    return null;
  }
}

// ============================================
// ОБНОВЛЕННЫЕ ОСНОВНЫЕ ФУНКЦИИ
// ============================================

/**
 * ЗАМЕНИТЬ: getInitialData()
 * Загрузка начальных данных с кешированной лицензией
 */
function getInitialData() {
  try {
    logEvent("INFO", "initial_data_request", "client", "Loading license and bindings");
    
    // ✅ ИСПОЛЬЗУЕМ КЕШИРОВАНИЕ
    var license = getLicenseCached(false);
    if (!license) {
      return { success: false, error: "❌ Лицензия не найдена" };
    }
    
    var bindingsResult = getBindingsWithNames();
    if (!bindingsResult.success) {
      return { success: false, error: bindingsResult.error };
    }
    
    logEvent("INFO", "initial_data_loaded", "client", "License loaded, Bindings: " + bindingsResult.bindings.length);
    
    return {
      success: true,
      license: license,
      bindings: bindingsResult.bindings
    };
    
  } catch (error) {
    logEvent("ERROR", "initial_data_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ЗАМЕНИТЬ: checkNewPosts()
 * Проверка новых постов с кешированной лицензией
 */
function checkNewPosts() {
  try {
    logEvent("INFO", "check_posts_start", "client", "Checking for new posts from VK groups");
    
    // ✅ ИСПОЛЬЗУЕМ КЕШИРОВАНИЕ
    var license = getLicenseCached(false);
    if (!license) {
      return { success: false, error: "❌ Лицензия не найдена" };
    }
    
    var bindingsResult = getBindingsWithNames();
    if (!bindingsResult.success) {
      return bindingsResult;
    }
    
    var activeBindings = bindingsResult.bindings.filter(function(binding) {
      return binding.status === "active";
    });
    
    logEvent("INFO", "active_bindings_count", "client", "Total: " + bindingsResult.bindings.length + ", Active: " + activeBindings.length);
    
    var totalSent = 0;
    var results = [];
    
    activeBindings.forEach(function(binding) {
      try {
        logEvent("DEBUG", "checking_binding", "client", 
                "Binding ID: " + binding.id + ", VK: " + binding.vkGroupUrl + ", TG: " + binding.tgChatId);
        
        var vkGroupId = extractVkGroupId(binding.vkGroupUrl);
        var sheetName = extractSheetNameFromVkUrl(binding.vkGroupUrl);
        
        if (!vkGroupId || !sheetName) {
          logEvent("WARN", "invalid_binding_urls", "client", 
                  "Binding " + binding.id + ": VK ID: " + vkGroupId + ", Sheet: " + sheetName);
          return;
        }
        
        // ✅ УВАЖАЕМ КОЛИЧЕСТВО ПОСТОВ ИЗ НАСТРОЕК
        var postsCount = 1; // По умолчанию
        if (binding.formatSettings && binding.formatSettings.syncPostsCount) {
          postsCount = Math.min(binding.formatSettings.syncPostsCount, 10); // Максимум 10
        }
        
        var vkPosts = getVkPosts(vkGroupId, postsCount);
        if (!vkPosts.success) {
          results.push({ binding: binding.id, error: vkPosts.error });
          return;
        }
        
        var newPosts = vkPosts.posts.filter(function(post) {
          return !isPostAlreadySent(sheetName, post.id);
        });
        
        logEvent("INFO", "new_posts_found", "client", 
                "Sheet: " + sheetName + ", New posts: " + newPosts.length + ", Total fetched: " + vkPosts.posts.length);
        
        newPosts.forEach(function(post) {
          var result = sendPostToServer(binding, post);
          if (result.success) {
            markPostAsSent(sheetName, post.id, {
              messageId: result.message_id,
              textLength: result.formatted_text_length || 0,
              attachmentCount: post.attachments ? post.attachments.length : 0
            });
            totalSent++;
          }
          results.push({ binding: binding.id, postId: post.id, result: result });
        });
        
      } catch (bindingError) {
        logEvent("ERROR", "binding_check_error", "client", "Binding " + binding.id + ": " + bindingError.message);
        results.push({ binding: binding.id, error: bindingError.message });
      }
    });
    
    logEvent("INFO", "check_posts_complete", "client", "Total sent: " + totalSent + ", Results: " + results.length);
    
    return {
      success: true,
      totalSent: totalSent,
      results: results
    };
    
  } catch (error) {
    logEvent("ERROR", "check_posts_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ЗАМЕНИТЬ: publishLastPost()
 * Публикация последнего поста с защитой от ошибок
 */
function publishLastPost(bindingId) {
  try {
    logEvent("INFO", "publish_last_post_start", "client", "Binding ID: " + bindingId);
    
    // ✅ ИСПОЛЬЗУЕМ КЕШИРОВАНИЕ
    var license = getLicenseCached(false);
    if (!license) {
      return { success: false, error: "❌ Лицензия не найдена" };
    }
    
    var bindingsResult = getBindingsWithNames();
    if (!bindingsResult.success) {
      return { success: false, error: bindingsResult.error };
    }
    
    var binding = bindingsResult.bindings.find(function(b) {
      return b.id === bindingId;
    });
    
    if (!binding) {
      return { success: false, error: "❌ Связка не найдена" };
    }
    
    var vkGroupId = extractVkGroupId(binding.vkGroupUrl);
    var sheetName = extractSheetNameFromVkUrl(binding.vkGroupUrl);
    
    if (!vkGroupId || !sheetName) {
      return { success: false, error: "❌ Невозможно определить группу VK" };
    }
    
    // ✅ ВСЕГДА 1 ПОСТ ДЛЯ "ПОСЛЕДНЕГО"
    var vkPosts = getVkPosts(vkGroupId, 1);
    if (!vkPosts.success) {
      return { success: false, error: vkPosts.error };
    }
    
    // ✅ БЕЗОПАСНЫЙ ВЫБОР ПОСТА
    var post = safePickLastPost(vkPosts.posts);
    if (!post) {
      return { success: false, error: "❌ Нет валидных постов для публикации" };
    }
    
    // Проверяем что пост еще не отправлен
    if (isPostAlreadySent(sheetName, post.id)) {
      return { success: false, error: "❌ Пост уже был отправлен" };
    }
    
    var result = sendPostToServer(binding, post);
    
    if (result.success) {
      markPostAsSent(sheetName, post.id, {
        messageId: result.message_id,
        textLength: result.formatted_text_length || 0,
        attachmentCount: post.attachments ? post.attachments.length : 0
      });
      
      logEvent("INFO", "publish_last_post_success", "client", 
              "Post " + post.id + " published, TG message: " + result.message_id);
    } else {
      logEvent("WARN", "publish_last_post_failed", "client", result.error || "Unknown error");
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "publish_last_post_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ЗАМЕНИТЬ: saveLicenseWithCheck()
 * Сохранение лицензии с обновлением кеша
 */
function saveLicenseWithCheck(licenseKey) {
  try {
    if (!licenseKey || licenseKey.trim().length === 0) {
      return { success: false, error: "❌ Введите лицензионный ключ" };
    }
    
    var payload = {
      action: "verify_license",
      license_key: licenseKey.trim()
    };
    
    var response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    var result = JSON.parse(response.getContentText());
    
    if (result.success) {
      // ✅ ОБНОВЛЯЕМ КЭШ ПОСЛЕ УСПЕШНОЙ ПРОВЕРКИ
      PropertiesService.getUserProperties().setProperty(USER_PROP_LICENSE_KEY, licenseKey);
      
      // Принудительно обновляем кэш
      getLicenseCached(true);
      
      logEvent("INFO", "license_saved_and_cached", "client", "License saved and cached for 24 hours");
    }
    
    return result;
    
  } catch (error) {
    logEvent("ERROR", "save_license_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ЗАМЕНИТЬ: changeLicense()
 * Смена лицензии с очисткой кеша
 */
function changeLicense() {
  try {
    // ✅ ОЧИЩАЕМ ВЕСЬ КЭШ ЛИЦЕНЗИИ
    var props = PropertiesService.getUserProperties();
    props.deleteProperty(USER_PROP_LICENSE_KEY);
    props.deleteProperty(USER_PROP_LICENSE_META);
    appState.license = null;
    
    logEvent("INFO", "license_cache_cleared", "client", "License cache cleared, user can enter new license");
    
    // Перезагружаем интерфейс
    loadInitialData();
    
  } catch (error) {
    logEvent("ERROR", "change_license_error", "client", error.message);
  }
}
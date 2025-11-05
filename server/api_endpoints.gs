// ============================================
// API ENDPOINTS AND HANDLERS (split from server.gs)
// ============================================

/**
 * Добавление новой связки VK-Telegram
 */
function handleAddBinding(payload, clientIp) {
  try {
    var { license_key, vk_group_url, tg_chat_id, formatSettings, binding_name, binding_description } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Проверяем лимит
    var currentBindings = getUserBindings(license_key);
    if (currentBindings.length >= licenseData.license.maxGroups) {
      return jsonResponse({
        success: false,
        error: "Max groups limit exceeded"
      }, 429);
    }
    
    // АВТОМАТИЧЕСКОЕ ПРЕОБРАЗОВАНИЕ ССЫЛОК В ID
    var processedVkGroupId;
    var processedTgChatId;
    
    try {
      // Извлекаем ID ВК группы из ссылки
      processedVkGroupId = extractVkGroupId(vk_group_url);
      logEvent("INFO", "vk_url_converted", license_key, `${vk_group_url} -> ${processedVkGroupId}`);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в ВК ссылке: ${error.message}`
      }, 400);
    }
    
    try {
      // Извлекаем chat_id Telegram канала
      processedTgChatId = extractTelegramChatId(tg_chat_id);
      logEvent("INFO", "tg_url_converted", license_key, `${tg_chat_id} -> ${processedTgChatId}`);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в Telegram ссылке: ${error.message}`
      }, 400);
    }
    
    // Создаем новую связку с обработанными ID
    var bindingId = generateBindingId();
    var license = findLicense(license_key);
    
    // Обработка formatSettings
    var formatSettingsString = "";
    if (formatSettings && typeof formatSettings === "object") {
      try {
        formatSettingsString = JSON.stringify(formatSettings);
        logEvent("DEBUG", "format_settings_stored", license_key, 
          `Binding ${bindingId}: ${formatSettingsString}`);
      } catch (e) {
        logEvent("WARN", "format_settings_json_error", license_key, e.message);
      }
    }
    
    var bindingsSheet = getSheet("Bindings");
    bindingsSheet.appendRow([
      bindingId,
      license_key,
      license.email,
      vk_group_url,          // Сохраняем оригинальную ссылку для отображения
      processedTgChatId,     // Сохраняем обработанный chat_id для API
      "active",
      new Date().toISOString(),
      new Date().toISOString(),
      formatSettingsString,  // Format Settings
      binding_name || "",    // Binding Name
      binding_description || "" // Binding Description
    ]);
    
    logEvent("INFO", "binding_added", license_key, 
      `Binding ID: ${bindingId}, VK: ${vk_group_url} (${processedVkGroupId}), TG: ${processedTgChatId}, IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      binding_id: bindingId,
      converted: {
        vk_group_id: processedVkGroupId,
        tg_chat_id: processedTgChatId
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_add_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Редактирование существующей связки
 */
function handleEditBinding(payload, clientIp) {
  try {
    var { license_key, binding_id, vk_group_url, tg_chat_id, formatSettings, binding_name, binding_description } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    var bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // АВТОМАТИЧЕСКОЕ ПРЕОБРАЗОВАНИЕ ССЫЛОК В ID
    var processedVkGroupId;
    var processedTgChatId;
    
    try {
      // Извлекаем ID ВК группы из ссылки
      processedVkGroupId = extractVkGroupId(vk_group_url);
      logEvent("INFO", "vk_url_converted", license_key, `${vk_group_url} -> ${processedVkGroupId}`);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в ВК ссылке: ${error.message}`
      }, 400);
    }
    
    try {
      // Извлекаем chat_id Telegram канала
      processedTgChatId = extractTelegramChatId(tg_chat_id);
      logEvent("INFO", "tg_url_converted", license_key, `${tg_chat_id} -> ${processedTgChatId}`);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в Telegram ссылке: ${error.message}`
      }, 400);
    }
    
    // Обработка formatSettings
    var formatSettingsString = "";
    if (formatSettings && typeof formatSettings === "object") {
      try {
        formatSettingsString = JSON.stringify(formatSettings);
        logEvent("DEBUG", "format_settings_updated", license_key, 
          `Binding ${binding_id}: ${formatSettingsString}`);
      } catch (e) {
        logEvent("WARN", "format_settings_json_error", license_key, e.message);
      }
    }

    // Обновляем связку с обработанными ID
    var bindingsSheet = getSheet("Bindings");
    bindingsSheet.getRange(bindingRow, 4).setValue(vk_group_url);      // VK Group URL (оригинальная ссылка)
    bindingsSheet.getRange(bindingRow, 5).setValue(processedTgChatId); // TG Chat ID (обработанный)
    bindingsSheet.getRange(bindingRow, 8).setValue(new Date().toISOString()); // Last Check
    bindingsSheet.getRange(bindingRow, 9).setValue(formatSettingsString); // Format Settings
    
    // ✅ ДОБАВЛЕНЫ НОВЫЕ ПОЛЯ:
    bindingsSheet.getRange(bindingRow, 10).setValue(binding_name || "");        // Binding Name
    bindingsSheet.getRange(bindingRow, 11).setValue(binding_description || ""); // Binding Description
    
    logEvent("INFO", "binding_edited", license_key, 
      `Binding ID: ${binding_id}, Name: ${binding_name}, VK: ${vk_group_url} (${processedVkGroupId}), TG: ${processedTgChatId}, IP: ${clientIp}`);
    
    return jsonResponse({ 
      success: true,
      converted: {
        vk_group_id: processedVkGroupId,
        tg_chat_id: processedTgChatId
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_edit_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Отправка поста в Telegram
 */
function handleSendPost(payload, clientIp) {
  try {
    var { license_key, binding_id, vk_post } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Проверяем глобальную настройку "disable_all_stores"
    var props = PropertiesService.getScriptProperties();
    var disableAllStores = props.getProperty("global_disable_all_stores");
    
    if (disableAllStores === "true") {
      logEvent("INFO", "post_blocked_by_global_setting", license_key, 
        `Post sending blocked by global disable_all_stores setting`);
      return jsonResponse({
        success: false,
        error: "All stores are globally disabled",
        blocked_by_global_setting: true
      }, 403);
    }

    // Находим связку
    var binding = findBindingById(binding_id, license_key);
    if (!binding) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    if (binding.status !== "active") {
      return jsonResponse({
        success: false,
        error: "Binding is not active"
      }, 403);
    }
    
    // Отправляем пост в Telegram с учетом настроек связки
    var sendResult = sendVkPostToTelegram(binding.tgChatId, vk_post, binding);
    
    if (sendResult.success) {
      logEvent("INFO", "post_sent_successfully", license_key, 
        `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, Message ID: ${sendResult.message_id}, IP: ${clientIp}`);
    } else {
      logEvent("ERROR", "post_send_failed", license_key, 
        `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, Error: ${sendResult.error}, IP: ${clientIp}`);
    }
    
    return jsonResponse(sendResult);
    
  } catch (error) {
    logEvent("ERROR", "send_post_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Тестовая публикация в Telegram
 */
function handleTestPublication(payload, clientIp) {
  try {
    var { license_key, tg_chat_id } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    var botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      return jsonResponse({
        success: false,
        error: "Bot token not configured"
      }, 500);
    }
    
    var testMessage = "✅ Тестовое сообщение VK→Telegram\n\nВаш бот успешно настроен и может отправлять сообщения в этот чат.";
    
    var result = sendTelegramMessage(botToken, tg_chat_id, testMessage);
    
    logEvent("INFO", "test_publication", license_key, 
      `Chat ID: ${tg_chat_id}, Success: ${result.success}, IP: ${clientIp}`);
    
    return jsonResponse(result);
    
  } catch (error) {
    logEvent("ERROR", "test_publication_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Получение постов из VK
 */
function handleGetVkPosts(payload, clientIp) {
  try {
    var { license_key, vk_group_id, count = 50 } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    if (!vk_group_id) {
      return jsonResponse({
        success: false,
        error: "vk_group_id required"
      }, 400);
    }
    
    // Валидация vk_group_id в формате '^-?\d+$'
    if (!/^-?\d+$/.test(vk_group_id)) {
      logEvent("WARN", "invalid_vk_group_id_format", license_key, 
        `Invalid vk_group_id format: ${vk_group_id}, Expected: numeric with optional minus sign, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "Invalid vk_group_id format. Expected numeric format like: -123456 or 123456"
      }, 400);
    }
    
    // Проверяем VK User Token
    var userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      logEvent("ERROR", "vk_user_token_missing", license_key, 
        `Cannot fetch posts without VK User Access Token, Group ID: ${vk_group_id}, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "VK User Access Token не настроен на сервере"
      }, 500);
    }
    
    // Формируем URL для VK API
    var apiUrl = `https://api.vk.com/method/wall.get?owner_id=${encodeURIComponent(vk_group_id)}&count=${encodeURIComponent(count)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    // Логируем API запрос (без токена)
    var logUrl = `https://api.vk.com/method/wall.get?owner_id=${vk_group_id}&count=${count}&v=${VK_API_VERSION}&access_token=***`;
    logEvent("DEBUG", "vk_api_request", license_key, 
      `Request URL: ${logUrl}, Group ID: ${vk_group_id}, IP: ${clientIp}`);
    
    // Получаем посты из ВК
    try {
      var response = UrlFetchApp.fetch(apiUrl, {
        muteHttpExceptions: true,
        timeout: 15000
      });
      
      var responseData = JSON.parse(response.getContentText());
      
      logEvent("DEBUG", "vk_api_response", license_key, 
        `Group ID: ${vk_group_id}, HTTP Status: ${response.getResponseCode()}, Has VK error: ${!!responseData.error}, Response length: ${response.getContentText().length}, IP: ${clientIp}`);
      
      if (responseData.error) {
        logEvent("ERROR", "vk_api_error", license_key,
          `Group ID: ${vk_group_id}, VK Error code: ${responseData.error.error_code}, Message: ${responseData.error.error_msg}, IP: ${clientIp}`);
        
        // Возвращаем информативную ошибку
        var errorMessage = `VK API Error: ${responseData.error.error_msg}`;
        
        if (responseData.error.error_code === 5) {
          errorMessage = "User authorization failed: VK Access Token is invalid or expired";
        } else if (responseData.error.error_code === 15) {
          errorMessage = "Access denied: Unable to access VK group posts";
        } else if (responseData.error.error_code === 100) {
          errorMessage = "Invalid VK group ID";
        } else if (responseData.error.error_code === 200) {
          errorMessage = "Access to this VK group denied";
        }
        
        return jsonResponse({
          success: false,
          error: errorMessage
        }, 400);
      }
      
      var posts = responseData.response ? responseData.response.items || [] : [];
      
      logEvent("INFO", "vk_posts_retrieved", license_key, 
        `Group ID: ${vk_group_id}, Posts count: ${posts.length}, IP: ${clientIp}`);
      
      return jsonResponse({
        success: true,
        posts: posts,
        group_id: vk_group_id,
        total_count: responseData.response ? responseData.response.count : 0
      });
      
    } catch (vkError) {
      logEvent("ERROR", "vk_posts_fetch_error", license_key, 
        `Group ID: ${vk_group_id}, Error: ${vkError.message}, IP: ${clientIp}`);
      
      return jsonResponse({
        success: false,
        error: `Не удалось получить посты из ВК: ${vkError.message}`,
        details: {
          group_id: vk_group_id,
          vk_error: vkError.message
        }
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "get_vk_posts_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Получение связок пользователя с именами групп и чатов
 */
function getUserBindingsWithNames(licenseKey) {
  try {
    var sheet = getSheet("Bindings");
    var data = sheet.getDataRange().getValues();
    var bindings = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === licenseKey) {
        var vkGroupUrl = data[i][3];
        var tgChatId = data[i][4];
        
        var vkGroupName = vkGroupUrl;
        var tgChatName = tgChatId;
        
        // Получаем названия
        try {
          if (vkGroupUrl) {
            var vkGroupId = extractVkGroupId(vkGroupUrl);
            vkGroupName = getCachedVkGroupName(vkGroupId);
          }
        } catch (vkError) {
          logEvent("WARN", "binding_vk_name_error", licenseKey, 
            `URL: ${vkGroupUrl}, Error: ${vkError.message}`);
        }
        
        try {
          if (tgChatId) {
            tgChatName = getCachedTelegramChatName(tgChatId);
          }
        } catch (tgError) {
          logEvent("WARN", "binding_tg_name_error", licenseKey, 
            `Chat ID: ${tgChatId}, Error: ${tgError.message}`);
        }
        
        bindings.push({
          id: data[i][0],
          vkGroupUrl: vkGroupUrl,
          vkGroupName: vkGroupName,
          tgChatId: tgChatId,
          tgChatName: tgChatName,
          status: data[i][5],
          createdAt: data[i][6],
          lastCheck: data[i][7],
          
          // ✅ ДОБАВЛЕНЫ НОВЫЕ ПОЛЯ:
          bindingName: data[i][9] || "",        // Поле 10
          bindingDescription: data[i][10] || ""  // Поле 11
        });
      }
    }
    
    logEvent("INFO", "bindings_with_names_loaded", licenseKey, 
      `Total bindings: ${bindings.length}`);
    
    return bindings;
    
  } catch (error) {
    logEvent("ERROR", "get_bindings_with_names_error", licenseKey, error.message);
    return [];
  }
}

/**
 * Публикация последнего поста из VK группы
 */
function handlePublishLastPost(payload, clientIp) {
  try {
    var { license_key, vk_group_id, binding_id } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    if (!vk_group_id) {
      return jsonResponse({
        success: false,
        error: "vk_group_id required"
      }, 400);
    }
    
    // Валидация vk_group_id
    if (!/^-?\d+$/.test(vk_group_id)) {
      return jsonResponse({
        success: false,
        error: "Invalid vk_group_id format"
      }, 400);
    }
    
    logEvent("INFO", "publish_last_post_request", license_key, 
      `Group ID: ${vk_group_id}, Binding ID: ${binding_id}, IP: ${clientIp}`);
    
    // Получаем последний пост из VK
    var postsResult = handleGetVkPosts({ 
      license_key: license_key, 
      vk_group_id: vk_group_id, 
      count: 1 
    }, clientIp);
    
    var postsData = JSON.parse(postsResult.getContent());
    
    if (!postsData.success) {
      logEvent("ERROR", "publish_last_post_get_posts_failed", license_key, 
        `Error getting posts: ${postsData.error}`);
      return jsonResponse({
        success: false,
        error: `Failed to get VK posts: ${postsData.error}`
      }, 500);
    }
    
    if (!postsData.posts || postsData.posts.length === 0) {
      logEvent("WARN", "publish_last_post_no_posts", license_key, 
        `No posts found in VK group: ${vk_group_id}`);
      return jsonResponse({
        success: false,
        error: "No posts found in VK group"
      }, 404);
    }
    
    var lastPost = postsData.posts[0];
    
    // Получаем настройки связки для форматирования
    var binding = null;
    if (binding_id) {
      try {
        var bindingsSheet = getSheet("Bindings");
        var data = bindingsSheet.getDataRange().getValues();
        
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === binding_id && data[i][1] === license_key) {
            binding = {
              id: data[i][0],
              tgChatId: data[i][4],
              formatSettings: data[i][8] || "{}",
              bindingName: data[i][9] || "",
              bindingDescription: data[i][10] || ""
            };
            break;
          }
        }
      } catch (error) {
        logEvent("WARN", "publish_last_post_binding_lookup_failed", license_key, 
          `Binding ID: ${binding_id}, Error: ${error.message}`);
      }
    }
    
    if (!binding) {
      return jsonResponse({
        success: false,
        error: "Binding not found or no telegram chat specified"
      }, 404);
    }
    
    // Парсим настройки форматирования
    var formatSettings = {};
    try {
      if (binding.formatSettings && binding.formatSettings !== "") {
        formatSettings = JSON.parse(binding.formatSettings);
      }
    } catch (error) {
      logEvent("WARN", "publish_last_post_format_settings_parse_error", license_key, 
        `Error parsing format settings: ${error.message}`);
    }
    
    // Отправляем пост в Telegram
    var sendResult = handleSendPost({
      license_key: license_key,
      post: lastPost,
      tg_chat_id: binding.tgChatId,
      format_settings: formatSettings,
      vk_group_id: vk_group_id
    }, clientIp);
    
    var sendData = JSON.parse(sendResult.getContent());
    
    if (sendData.success) {
      logEvent("INFO", "publish_last_post_success", license_key, 
        `Post published successfully: VK ${vk_group_id}_${lastPost.id} -> TG ${binding.tgChatId}`);
      
      return jsonResponse({
        success: true,
        message: "Last post published successfully",
        published_post: {
          vk_post_id: lastPost.id,
          vk_group_id: vk_group_id,
          tg_chat_id: binding.tgChatId,
          binding_name: binding.bindingName || `Binding ${binding_id}`
        }
      });
    } else {
      logEvent("ERROR", "publish_last_post_send_failed", license_key, 
        `Send error: ${sendData.error}`);
      
      return jsonResponse({
        success: false,
        error: `Failed to send post to Telegram: ${sendData.error}`
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "publish_last_post_error", payload.license_key || "unknown", 
      `Error: ${error.message}`);
    return jsonResponse({ 
      success: false, 
      error: "Failed to publish last post: " + error.message 
    }, 500);
  }
}

/**
 * Функция миграции для автосоздания недостающих колонок в листе Bindings
 */
function migrateBindingsSheet() {
  try {
    var sheet = getSheet("Bindings");
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var expectedHeaders = [
      "Binding ID", "License Key", "User Email", "VK Group URL", "TG Chat ID", 
      "Status", "Created At", "Last Check", "Format Settings", "Binding Name", "Binding Description"
    ];
    
    var missingColumns = [];
    
    // Проверяем какие колонки отсутствуют
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (i >= headers.length || headers[i] !== expectedHeaders[i]) {
        missingColumns.push(expectedHeaders[i]);
      }
    }
    
    // Добавляем недостающие колонки
    if (missingColumns.length > 0) {
      var currentColumn = headers.length + 1;
      
      for (var j = 0; j < missingColumns.length; j++) {
        sheet.getRange(1, currentColumn).setValue(missingColumns[j]);
        currentColumn++;
      }
      
      logEvent("INFO", "bindings_migration_completed", "system", 
        `Added columns: ${missingColumns.join(", ")}`);
      
      return {
        success: true,
        added_columns: missingColumns
      };
    } else {
      logEvent("DEBUG", "bindings_migration_not_needed", "system", 
        "All required columns already exist");
      
      return {
        success: true,
        added_columns: []
      };
    }
    
  } catch (error) {
    logEvent("ERROR", "bindings_migration_error", "system", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
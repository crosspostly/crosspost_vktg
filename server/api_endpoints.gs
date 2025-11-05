// ============================================
// API ENDPOINTS AND HANDLERS (split from server.gs)
// ============================================

// Константы API
var VK_API_VERSION = "5.131";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      logEvent("ERROR", "invalid_request_structure", "anonymous", "Missing post data");
      return jsonResponse({ success: false, error: "Invalid request: missing post data" }, 400);
    }

    var clientIp = e.parameter?.clientIp || "unknown";
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      logEvent("ERROR", "json_parse_error", "anonymous", `Invalid JSON: ${parseError.message}, Content: ${e.postData.contents.substring(0, 100)}`);
      return jsonResponse({ success: false, error: "Invalid JSON in request body" }, 400);
    }

    if (!payload.event) {
      logEvent("WARN", "missing_event_field", payload.license_key || "anonymous", `Payload keys: ${Object.keys(payload).join(', ')}`);
      return jsonResponse({ success: false, error: "Missing 'event' field in request" }, 400);
    }

    logEvent("DEBUG", "api_request", payload.license_key || "anonymous", `Event: ${payload.event}, IP: ${clientIp}`);

    try {
      switch (payload.event) {
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
        default:
          logEvent("WARN", "unknown_event", payload.license_key || "anonymous", `Unknown event: ${payload.event}, Available events: check_license, get_bindings, add_binding, edit_binding, delete_binding, toggle_binding_status, send_post, test_publication`);
          return jsonResponse({ success: false, error: `Unknown event: ${payload.event}` }, 400);
      }
    } catch (handlerError) {
      logEvent("ERROR", "handler_execution_error", payload.license_key || "anonymous", `Event: ${payload.event}, Handler error: ${handlerError.message}, Stack: ${handlerError.stack?.substring(0, 200)}`);
      return jsonResponse({ success: false, error: `Handler error for event '${payload.event}': ${handlerError.message}` }, 500);
    }
  } catch (error) {
    logEvent("ERROR", "api_critical_error", "system", `Critical API error: ${error.message}, Stack: ${error.stack?.substring(0, 200)}`);
    return jsonResponse({ success: false, error: "Critical server error: " + error.message }, 500);
  }
}

function handleCheckLicense(payload, clientIp) {
  try {
    var { license_key } = payload;
    if (!license_key) {
      return jsonResponse({ success: false, error: "License key required" }, 400);
    }
    var license = findLicense(license_key);
    if (!license) {
      logEvent("WARN", "license_not_found", license_key, `IP: ${clientIp}`);
      return jsonResponse({ success: false, error: "License not found" }, 404);
    }
    if (license.status !== "active") {
      logEvent("WARN", "license_inactive", license_key, `Status: ${license.status}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: "License inactive" }, 403);
    }
    if (new Date() > new Date(license.expires)) {
      logEvent("WARN", "license_expired", license_key, `Expires: ${license.expires}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: "License expired" }, 403);
    }
    logEvent("INFO", "license_check_success", license_key, `IP: ${clientIp}`);
    return jsonResponse({ success: true, license: { type: license.type, maxGroups: license.maxGroups, expires: license.expires } });
  } catch (error) {
    logEvent("ERROR", "license_check_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetBindings(payload, clientIp) {
  try {
    var { license_key } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;
    var bindings = getUserBindings(license_key);
    logEvent("INFO", "bindings_retrieved", license_key, `Count: ${bindings.length}, IP: ${clientIp}`);
    return jsonResponse({ success: true, bindings: bindings });
  } catch (error) {
    logEvent("ERROR", "get_bindings_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetUserBindingsWithNames(payload, clientIp) {
  try {
    var { license_key } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;
    var bindings = getUserBindingsWithNames(license_key);
    logEvent("INFO", "bindings_with_names_retrieved", license_key, `Count: ${bindings.length}, IP: ${clientIp}`);
    return jsonResponse({ success: true, bindings: bindings });
  } catch (error) {
    logEvent("ERROR", "get_bindings_with_names_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleAddBinding(payload, clientIp) {
  try {
    var { license_key, vk_group_url, tg_chat_id, formatSettings, binding_name, binding_description } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var currentBindings = getUserBindings(license_key);
    if (currentBindings.length >= licenseData.license.maxGroups) {
      return jsonResponse({ success: false, error: "Max groups limit exceeded" }, 429);
    }

    var processedVkGroupId;
    var processedTgChatId;
    try {
      processedVkGroupId = extractVkGroupId(vk_group_url);
      logEvent("INFO", "vk_url_converted", license_key, `${vk_group_url} -> ${processedVkGroupId}`);
    } catch (error) {
      return jsonResponse({ success: false, error: `Ошибка в ВК ссылке: ${error.message}` }, 400);
    }
    try {
      processedTgChatId = extractTelegramChatId(tg_chat_id);
      logEvent("INFO", "tg_url_converted", license_key, `${tg_chat_id} -> ${processedTgChatId}`);
    } catch (error) {
      return jsonResponse({ success: false, error: `Ошибка в Telegram ссылке: ${error.message}` }, 400);
    }

    var bindingId = generateBindingId();
    var license = findLicense(license_key);
    var formatSettingsString = "";
    if (formatSettings && typeof formatSettings === "object") {
      try {
        formatSettingsString = JSON.stringify(formatSettings);
        logEvent("DEBUG", "format_settings_stored", license_key, `Binding ${bindingId}: ${formatSettingsString}`);
      } catch (e) {
        logEvent("WARN", "format_settings_json_error", license_key, e.message);
      }
    }

    // Обеспечиваем наличие листа с правильной структурой
    ensureBindingsSheetStructure();

    var bindingsSheet = getSheet("Bindings");
    bindingsSheet.appendRow([
      bindingId,
      license_key,
      license.email,
      vk_group_url,
      processedTgChatId,
      "active",
      new Date().toISOString(),
      new Date().toISOString(),
      formatSettingsString,
      binding_name || `Group_${Math.abs(processedVkGroupId)}`,
      binding_description || ""
    ]);

    logEvent("INFO", "binding_added", license_key, `Binding ID: ${bindingId}, Name: ${binding_name || 'Auto'}, VK: ${vk_group_url} (${processedVkGroupId}), TG: ${processedTgChatId}, IP: ${clientIp}`);
    return jsonResponse({ success: true, binding_id: bindingId, converted: { vk_group_id: processedVkGroupId, tg_chat_id: processedTgChatId }, binding_name: binding_name });
  } catch (error) {
    logEvent("ERROR", "binding_add_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleEditBinding(payload, clientIp) {
  try {
    var { license_key, binding_id, vk_group_url, tg_chat_id, formatSettings, binding_name, binding_description } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    // Обеспечиваем наличие листа с правильной структурой
    ensureBindingsSheetStructure();

    var bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({ success: false, error: "Binding not found" }, 404);
    }

    var processedVkGroupId;
    var processedTgChatId;
    try {
      processedVkGroupId = extractVkGroupId(vk_group_url);
      logEvent("INFO", "vk_url_converted", license_key, `${vk_group_url} -> ${processedVkGroupId}`);
    } catch (error) {
      return jsonResponse({ success: false, error: `Ошибка в ВК ссылке: ${error.message}` }, 400);
    }
    try {
      processedTgChatId = extractTelegramChatId(tg_chat_id);
      logEvent("INFO", "tg_url_converted", license_key, `${tg_chat_id} -> ${processedTgChatId}`);
    } catch (error) {
      return jsonResponse({ success: false, error: `Ошибка в Telegram ссылке: ${error.message}` }, 400);
    }

    var formatSettingsString = "";
    if (formatSettings && typeof formatSettings === "object") {
      try {
        formatSettingsString = JSON.stringify(formatSettings);
        logEvent("DEBUG", "format_settings_updated", license_key, `Binding ${binding_id}: ${formatSettingsString}`);
      } catch (e) {
        logEvent("WARN", "format_settings_json_error", license_key, e.message);
      }
    }

    var bindingsSheet = getSheet("Bindings");
    bindingsSheet.getRange(bindingRow, 4).setValue(vk_group_url);
    bindingsSheet.getRange(bindingRow, 5).setValue(processedTgChatId);
    bindingsSheet.getRange(bindingRow, 8).setValue(new Date().toISOString());
    bindingsSheet.getRange(bindingRow, 9).setValue(formatSettingsString);
    
    // Обновляем новые поля если переданы
    if (binding_name !== undefined) {
      bindingsSheet.getRange(bindingRow, 10).setValue(binding_name);
    }
    if (binding_description !== undefined) {
      bindingsSheet.getRange(bindingRow, 11).setValue(binding_description);
    }

    logEvent("INFO", "binding_edited", license_key, `Binding ID: ${binding_id}, Name: ${binding_name || 'unchanged'}, VK: ${vk_group_url} (${processedVkGroupId}), TG: ${processedTgChatId}, IP: ${clientIp}`);
    return jsonResponse({ success: true, converted: { vk_group_id: processedVkGroupId, tg_chat_id: processedTgChatId }, binding_name: binding_name });
  } catch (error) {
    logEvent("ERROR", "binding_edit_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleDeleteBinding(payload, clientIp) {
  try {
    var { license_key, binding_id } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({ success: false, error: "Binding not found" }, 404);
    }

    var bindingsSheet = getSheet("Bindings");
    bindingsSheet.deleteRow(bindingRow);
    logEvent("INFO", "binding_deleted", license_key, `Binding ID: ${binding_id}, IP: ${clientIp}`);
    return jsonResponse({ success: true });
  } catch (error) {
    logEvent("ERROR", "binding_delete_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleToggleBindingStatus(payload, clientIp) {
  try {
    var { license_key, binding_id } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({ success: false, error: "Binding not found" }, 404);
    }

    var bindingsSheet = getSheet("Bindings");
    var currentStatus = bindingsSheet.getRange(bindingRow, 6).getValue();
    var newStatus = currentStatus === "active" ? "paused" : "active";
    bindingsSheet.getRange(bindingRow, 6).setValue(newStatus);
    bindingsSheet.getRange(bindingRow, 8).setValue(new Date().toISOString());
    logEvent("INFO", "binding_status_changed", license_key, `Binding ID: ${binding_id}, Status: ${currentStatus} → ${newStatus}, IP: ${clientIp}`);
    return jsonResponse({ success: true, new_status: newStatus });
  } catch (error) {
    logEvent("ERROR", "binding_status_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetGlobalSetting(payload, clientIp) {
  try {
    var { license_key, setting_key } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;
    if (!setting_key) {
      return jsonResponse({ success: false, error: "Setting key required" }, 400);
    }
    var props = PropertiesService.getScriptProperties();
    var globalSettingKey = `global_${setting_key}`;
    var value = props.getProperty(globalSettingKey);
    logEvent("INFO", "global_setting_retrieved", license_key, `Setting: ${setting_key}, Value: ${value}, IP: ${clientIp}`);
    return jsonResponse({ success: true, value: value });
  } catch (error) {
    logEvent("ERROR", "get_global_setting_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleSetGlobalSetting(payload, clientIp) {
  try {
    var { license_key, setting_key, setting_value } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;
    if (!setting_key) {
      return jsonResponse({ success: false, error: "Setting key required" }, 400);
    }
    var props = PropertiesService.getScriptProperties();
    var globalSettingKey = `global_${setting_key}`;
    if (setting_value === null || setting_value === undefined) {
      props.deleteProperty(globalSettingKey);
      logEvent("INFO", "global_setting_deleted", license_key, `Setting: ${setting_key}, IP: ${clientIp}`);
    } else {
      props.setProperty(globalSettingKey, String(setting_value));
      logEvent("INFO", "global_setting_saved", license_key, `Setting: ${setting_key}, Value: ${setting_value}, IP: ${clientIp}`);
    }
    return jsonResponse({ success: true, value: setting_value });
  } catch (error) {
    logEvent("ERROR", "set_global_setting_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// Improved versions (latest definitions) of send/test/get_vk_posts handlers

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
      logEvent("INFO", "post_blocked_by_global_setting", license_key, `Post sending blocked by global disable_all_stores setting`);
      return jsonResponse({ success: false, error: "All stores are globally disabled", blocked_by_global_setting: true }, 403);
    }

    // Находим связку
    var binding = findBindingById(binding_id, license_key);
    if (!binding) {
      return jsonResponse({ success: false, error: "Binding not found" }, 404);
    }
    if (binding.status !== "active") {
      return jsonResponse({ success: false, error: "Binding is not active" }, 403);
    }
    
    // Отправляем пост в Telegram с учетом настроек связки
    var sendResult = sendVkPostToTelegram(binding.tgChatId, vk_post, binding);
    
    if (sendResult.success) {
      logEvent("INFO", "post_sent_successfully", license_key, `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, Message ID: ${sendResult.message_id}, IP: ${clientIp}`);
    } else {
      logEvent("ERROR", "post_send_failed", license_key, `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, Error: ${sendResult.error}, IP: ${clientIp}`);
    }
    
    return jsonResponse(sendResult);
    
  } catch (error) {
    logEvent("ERROR", "send_post_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

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
      return jsonResponse({ success: false, error: "Bot token not configured" }, 500);
    }
    
    var testMessage = "✅ Тестовое сообщение VK→Telegram\n\nВаш бот успешно настроен и может отправлять сообщения в этот чат.";
    var result = sendTelegramMessage(botToken, tg_chat_id, testMessage);
    
    logEvent("INFO", "test_publication", license_key, `Chat ID: ${tg_chat_id}, Success: ${result.success}, IP: ${clientIp}`);
    return jsonResponse(result);
    
  } catch (error) {
    logEvent("ERROR", "test_publication_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetVkPosts(payload, clientIp) {
  try {
    var { license_key, vk_group_url, vk_group_id, count = 50 } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    var groupId;
    var sourceInfo;
    
    // Приоритет: vk_group_id > vk_group_url
    if (vk_group_id) {
      // Валидация формата vk_group_id
      if (!/^-?\d+$/.test(vk_group_id)) {
        logEvent("WARN", "invalid_vk_group_id_format", license_key, `Invalid vk_group_id format: ${vk_group_id}, IP: ${clientIp}`);
        return jsonResponse({ success: false, error: "Invalid vk_group_id format. Expected: -123456 or 123456" }, 400);
      }
      groupId = vk_group_id;
      sourceInfo = `ID: ${vk_group_id}`;
    } else if (vk_group_url) {
      // Извлекаем ID группы из URL (fallback для обратной совместимости)
      try {
        groupId = extractVkGroupId(vk_group_url);
        sourceInfo = `URL: ${vk_group_url} → ${groupId}`;
      } catch (error) {
        logEvent("WARN", "vk_group_id_extraction_failed", license_key, `URL: ${vk_group_url}, Error: ${error.message}, IP: ${clientIp}`);
        return jsonResponse({ success: false, error: `Ошибка в ВК ссылке: ${error.message}` }, 400);
      }
    } else {
      return jsonResponse({ success: false, error: "Either vk_group_id or vk_group_url required" }, 400);
    }
    
    // Логируем запрос VK API (без токена)
    var logUrl = `https://api.vk.com/method/wall.get?owner_id=${groupId}&count=${count}&v=${VK_API_VERSION}&access_token=[HIDDEN]`;
    logEvent("DEBUG", "vk_api_request", license_key, `Request URL: ${logUrl}, Source: ${sourceInfo}, IP: ${clientIp}`);
    
    // Проверяем VK User Token
    var userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    if (!userToken) {
      logEvent("ERROR", "vk_user_token_missing", license_key, `Cannot fetch posts without VK User Access Token, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: "VK User Access Token не настроен на сервере" }, 500);
    }
    
    // Получаем посты из ВК
    try {
      var posts = getVkPosts(groupId, count || 50);
      logEvent("INFO", "vk_posts_retrieved", license_key, `Group: ${sourceInfo} (${groupId}), Posts count: ${posts.length}, IP: ${clientIp}`);
      return jsonResponse({ success: true, posts: posts, group_id: groupId, source: sourceInfo });
    } catch (vkError) {
      logEvent("ERROR", "vk_posts_fetch_error", license_key, `Group: ${sourceInfo} (${groupId}), Error: ${vkError.message}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: `Не удалось получить посты из ВК: ${vkError.message}`, details: { source: sourceInfo, group_id: groupId, vk_error: vkError.message } }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "get_vk_posts_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handlePublishLastPost(payload, clientIp) {
  try {
    var { license_key, vk_group_id, binding_id } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Валидация vk_group_id
    if (!vk_group_id || !/^-?\d+$/.test(vk_group_id)) {
      logEvent("WARN", "invalid_vk_group_id_format", license_key, `Invalid vk_group_id format: ${vk_group_id}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: "Invalid vk_group_id format. Expected: -123456 or 123456" }, 400);
    }
    
    // Находим связку для получения настроек форматирования
    var binding;
    if (binding_id) {
      binding = findBindingById(binding_id, license_key);
    } else {
      // Ищем связку по vk_group_id
      var bindings = getUserBindingsWithNames(license_key);
      if (bindings.success) {
        var foundBinding = bindings.bindings.find(b => b.vkGroupId === vk_group_id);
        binding = foundBinding;
      }
    }
    
    if (!binding) {
      logEvent("WARN", "binding_not_found_for_publish", license_key, `VK Group ID: ${vk_group_id}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: "Binding not found for this VK group" }, 404);
    }
    
    if (binding.status !== "active") {
      logEvent("WARN", "binding_not_active_for_publish", license_key, `Binding ID: ${binding.id}, Status: ${binding.status}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: "Binding is not active" }, 403);
    }
    
    // Логируем начало операции
    logEvent("DEBUG", "publish_last_post_started", license_key, `VK Group ID: ${vk_group_id}, Binding ID: ${binding.id}, IP: ${clientIp}`);
    
    // Получаем последний пост из VK
    try {
      var posts = getVkPosts(vk_group_id, 1); // Только последний пост
      if (!posts || posts.length === 0) {
        logEvent("WARN", "no_posts_found", license_key, `VK Group ID: ${vk_group_id}, IP: ${clientIp}`);
        return jsonResponse({ success: false, error: "No posts found in VK group" }, 404);
      }
      
      var lastPost = posts[0];
      logEvent("DEBUG", "last_post_retrieved", license_key, `Post ID: ${lastPost.id}, VK Group ID: ${vk_group_id}`);
      
    } catch (vkError) {
      logEvent("ERROR", "vk_last_post_fetch_error", license_key, `VK Group ID: ${vk_group_id}, Error: ${vkError.message}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: `Не удалось получить последний пост из ВК: ${vkError.message}` }, 500);
    }
    
    // Отправляем пост в Telegram с учетом настроек форматирования связки
    try {
      var sendResult = sendVkPostToTelegram(binding.tgChatId, lastPost, binding);
      
      if (sendResult.success) {
        logEvent("INFO", "last_post_published_successfully", license_key, `Binding ID: ${binding.id}, VK Group ID: ${vk_group_id}, Post ID: ${lastPost.id}, Message ID: ${sendResult.message_id}, IP: ${clientIp}`);
        return jsonResponse({ 
          success: true, 
          message: "Last post published successfully",
          post_id: lastPost.id,
          message_id: sendResult.message_id,
          binding_id: binding.id
        });
      } else {
        logEvent("ERROR", "last_post_publish_failed", license_key, `Binding ID: ${binding.id}, VK Group ID: ${vk_group_id}, Post ID: ${lastPost.id}, Error: ${sendResult.error}, IP: ${clientIp}`);
        return jsonResponse({ success: false, error: `Failed to publish last post: ${sendResult.error}` }, 500);
      }
      
    } catch (sendError) {
      logEvent("ERROR", "last_post_send_error", license_key, `Binding ID: ${binding.id}, VK Group ID: ${vk_group_id}, Post ID: ${lastPost.id}, Error: ${sendError.message}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: `Error sending last post to Telegram: ${sendError.message}` }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "publish_last_post_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function ensureBindingsSheetStructure() {
  try {
    var bindingsSheet = getSheet("Bindings");
    var headers = bindingsSheet.getRange(1, 1, 1, bindingsSheet.getLastColumn()).getValues()[0];
    
    var expectedHeaders = [
      "Binding ID", "License Key", "User Email", "VK Group URL", 
      "TG Chat ID", "Status", "Created At", "Last Check", 
      "Format Settings", "Binding Name", "Binding Description"
    ];
    
    var needsUpdate = false;
    
    // Проверяем наличие всех колонок
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (headers[i] !== expectedHeaders[i]) {
        needsUpdate = true;
        break;
      }
    }
    
    if (needsUpdate) {
      logEvent("INFO", "bindings_sheet_migration", "system", "Migrating Bindings sheet structure");
      
      // Создаем временный лист с правильной структурой
      var tempSheet = bindingsSheet.getParent().insertSheet("Bindings_temp");
      tempSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      
      // Копируем данные
      if (bindingsSheet.getLastRow() > 1) {
        var data = bindingsSheet.getRange(2, 1, bindingsSheet.getLastRow() - 1, bindingsSheet.getLastColumn()).getValues();
        
        // Обрабатываем каждую строку данных
        var newData = data.map(function(row) {
          while (row.length < expectedHeaders.length) {
            row.push(""); // Добавляем пустые колонки для новых полей
          }
          return row.slice(0, expectedHeaders.length);
        });
        
        if (newData.length > 0) {
          tempSheet.getRange(2, 1, newData.length, expectedHeaders.length).setValues(newData);
        }
      }
      
      // Удаляем старый лист и переименовываем временный
      bindingsSheet.getParent().deleteSheet(bindingsSheet);
      tempSheet.setName("Bindings");
      
      logEvent("INFO", "bindings_sheet_migration_complete", "system", "Bindings sheet structure updated successfully");
    }
    
  } catch (error) {
    logEvent("ERROR", "bindings_sheet_migration_error", "system", error.message);
    throw error;
  }
}

/**
 * ИСПРАВЛЕНИЕ 4: Group/Channel Name Display
 * Добавить новые функции в server.gs для получения названий
 */

/**
 * Получает название группы ВКонтакте по ID
 */
function getVkGroupName(groupId) {
  try {
    const userToken = PropertiesService.getScriptProperties()
      .getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      logEvent("WARN", "vk_token_missing_for_name", "server", `Group ID: ${groupId}`);
      return null;
    }
    
    const isGroup = groupId.toString().startsWith('-');
    const cleanId = Math.abs(parseInt(groupId));
    
    logEvent("DEBUG", "vk_name_request_start", "server", 
             `Group ID: ${groupId}, Clean ID: ${cleanId}, Is Group: ${isGroup}`);
    
    let apiMethod, apiParams;
    
    if (isGroup) {
      // Получаем название группы
      apiMethod = 'groups.getById';
      apiParams = `group_id=${cleanId}&fields=name,screen_name`;
    } else {
      // Получаем имя пользователя
      apiMethod = 'users.get';
      apiParams = `user_ids=${cleanId}&fields=first_name,last_name,screen_name`;
    }
    
    const response = UrlFetchApp.fetch(
      `https://api.vk.com/method/${apiMethod}?${apiParams}&v=${VK_API_VERSION}&access_token=${userToken}`,
      {
        muteHttpExceptions: true,
        timeout: 8000
      }
    );
    
    const data = JSON.parse(response.getContentText());
    
    if (data.error) {
      logEvent("WARN", "vk_name_api_error", "server", 
               `Group ID: ${groupId}, Error: ${data.error.error_code} - ${data.error.error_msg}`);
      return null;
    }
    
    if (data.response && data.response.length > 0) {
      const obj = data.response[0];
      let name;
      
      if (isGroup) {
        name = obj.name;
      } else {
        name = `${obj.first_name || ''} ${obj.last_name || ''}`.trim();
      }
      
      logEvent("INFO", "vk_name_retrieved", "server", 
               `Group ID: ${groupId} -> Name: "${name}"`);
      
      return name || `Unknown ${isGroup ? 'Group' : 'User'}`;
    }
    
    logEvent("WARN", "vk_name_not_found", "server", `Group ID: ${groupId}`);
    return null;
    
  } catch (error) {
    logEvent("ERROR", "vk_name_request_error", "server", 
             `Group ID: ${groupId}, Error: ${error.message}`);
    return null;
  }
}

/**
 * Получает название Telegram чата/канала по chat_id
 */
function getTelegramChatName(chatId) {
  try {
    const botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      logEvent("WARN", "tg_token_missing_for_name", "server", `Chat ID: ${chatId}`);
      return null;
    }
    
    logEvent("DEBUG", "tg_name_request_start", "server", `Chat ID: ${chatId}`);
    
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ chat_id: chatId }),
      muteHttpExceptions: true,
      timeout: 8000
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      const chat = result.result;
      let name;
      
      // Определяем название в зависимости от типа чата
      if (chat.title) {
        // Группа, супергруппа или канал
        name = chat.title;
      } else if (chat.first_name || chat.last_name) {
        // Личный чат
        name = `${chat.first_name || ''} ${chat.last_name || ''}`.trim();
      } else if (chat.username) {
        // Fallback на username
        name = '@' + chat.username;
      } else {
        name = 'Unknown Chat';
      }
      
      logEvent("INFO", "tg_name_retrieved", "server", 
               `Chat ID: ${chatId} -> Name: "${name}", Type: ${chat.type}`);
      
      return name;
    } else {
      logEvent("WARN", "tg_name_api_error", "server", 
               `Chat ID: ${chatId}, Error: ${result.description}`);
      return null;
    }
    
  } catch (error) {
    logEvent("ERROR", "tg_name_request_error", "server", 
             `Chat ID: ${chatId}, Error: ${error.message}`);
    return null;
  }
}

/**
 * Кеширует названия групп/каналов в Properties для быстрого доступа
 */
function cacheGroupNames() {
  try {
    logEvent("INFO", "cache_names_start", "server", "Starting names caching");
    
    const bindingsSheet = getSheet("Bindings");
    const data = bindingsSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      logEvent("INFO", "no_bindings_to_cache", "server", "No bindings found");
      return { success: true, cached: 0 };
    }
    
    const cache = PropertiesService.getScriptProperties();
    let cachedCount = 0;
    
    // Обрабатываем каждую связку
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const vkGroupUrl = row[3];
      const tgChatId = row[4];
      
      try {
        // Кешируем название ВК группы
        if (vkGroupUrl) {
          const vkGroupId = extractVkGroupId(vkGroupUrl);
          const cacheKey = `vk_name_${vkGroupId}`;
          
          let cachedName = cache.getProperty(cacheKey);
          if (!cachedName) {
            const vkName = getVkGroupName(vkGroupId);
            if (vkName) {
              cache.setProperty(cacheKey, vkName);
              cachedCount++;
              logEvent("DEBUG", "vk_name_cached", "server", 
                       `${vkGroupId} -> ${vkName}`);
            }
          }
        }
        
        // Кешируем название Telegram чата
        if (tgChatId) {
          const cacheKey = `tg_name_${tgChatId}`;
          
          let cachedName = cache.getProperty(cacheKey);
          if (!cachedName) {
            const tgName = getTelegramChatName(tgChatId);
            if (tgName) {
              cache.setProperty(cacheKey, tgName);
              cachedCount++;
              logEvent("DEBUG", "tg_name_cached", "server", 
                       `${tgChatId} -> ${tgName}`);
            }
          }
        }
        
        // Небольшая пауза между запросами
        if (i % 3 === 0) {
          Utilities.sleep(1000); // 1 секунда каждые 3 запроса
        }
        
      } catch (rowError) {
        logEvent("WARN", "cache_row_error", "server", 
                 `Row ${i}, Error: ${rowError.message}`);
      }
    }
    
    logEvent("INFO", "cache_names_complete", "server", 
             `Cached ${cachedCount} new names`);
    
    return { success: true, cached: cachedCount };
    
  } catch (error) {
    logEvent("ERROR", "cache_names_error", "server", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Получает кешированное название или запрашивает новое
 */
function getCachedVkGroupName(groupId) {
  try {
    const cache = PropertiesService.getScriptProperties();
    const cacheKey = `vk_name_${groupId}`;
    
    let cachedName = cache.getProperty(cacheKey);
    
    if (cachedName) {
      logEvent("DEBUG", "vk_name_from_cache", "server", 
               `${groupId} -> ${cachedName} (cached)`);
      return cachedName;
    }
    
    // Если не в кеше - запрашиваем и кешируем
    const freshName = getVkGroupName(groupId);
    if (freshName) {
      cache.setProperty(cacheKey, freshName);
      return freshName;
    }
    
    return `VK:${groupId}`; // Fallback отображение
    
  } catch (error) {
    logEvent("ERROR", "cached_vk_name_error", "server", error.message);
    return `VK:${groupId}`;
  }
}

/**
 * Получает кешированное название Telegram чата или запрашивает новое
 */
function getCachedTelegramChatName(chatId) {
  try {
    const cache = PropertiesService.getScriptProperties();
    const cacheKey = `tg_name_${chatId}`;
    
    let cachedName = cache.getProperty(cacheKey);
    
    if (cachedName) {
      logEvent("DEBUG", "tg_name_from_cache", "server", 
               `${chatId} -> ${cachedName} (cached)`);
      return cachedName;
    }
    
    // Если не в кеше - запрашиваем и кешируем
    const freshName = getTelegramChatName(chatId);
    if (freshName) {
      cache.setProperty(cacheKey, freshName);
      return freshName;
    }
    
    return chatId.toString(); // Fallback отображение
    
  } catch (error) {
    logEvent("ERROR", "cached_tg_name_error", "server", error.message);
    return chatId.toString();
  }
}

/**
 * ОБНОВЛЕНИЕ: Модификация handleGetBindings для включения названий
 * Заменить функцию handleGetBindings в server.gs
 */
function handleGetBindings(payload, clientIp) {
  try {
    const { license_key } = payload;
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    const bindings = getUserBindingsWithNames(license_key); // Используем новую функцию
    
    return jsonResponse({
      success: true,
      bindings: bindings
    });
    
  } catch (error) {
    logEvent("ERROR", "get_bindings_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * НОВАЯ ФУНКЦИЯ: Получает связки пользователя с названиями групп/каналов
 */
function getUserBindingsWithNames(licenseKey) {
  try {
    const sheet = getSheet("Bindings");
    const data = sheet.getDataRange().getValues();
    const bindings = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === licenseKey) {
        const vkGroupUrl = data[i][3];
        const tgChatId = data[i][4];
        
        let vkGroupName = vkGroupUrl;
        let tgChatName = tgChatId;
        
        // Получаем названия
        try {
          if (vkGroupUrl) {
            const vkGroupId = extractVkGroupId(vkGroupUrl);
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
          vkGroupName: vkGroupName, // Добавляем название
          tgChatId: tgChatId,
          tgChatName: tgChatName,   // Добавляем название
          status: data[i][5],
          createdAt: data[i][6],
          lastCheck: data[i][7]
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
 * ОБНОВЛЕНИЕ: Модификация handleAddBinding для автоматического получения названий
 * Добавить этот код в handleAddBinding после создания связки, перед финальным return:
 */

/*
    // Получаем и кешируем названия сразу после создания связки
    try {
      const vkName = getVkGroupName(processedVkGroupId);
      const tgName = getTelegramChatName(processedTgChatId);
      
      if (vkName) {
        PropertiesService.getScriptProperties()
          .setProperty(`vk_name_${processedVkGroupId}`, vkName);
      }
      
      if (tgName) {
        PropertiesService.getScriptProperties()
          .setProperty(`tg_name_${processedTgChatId}`, tgName);
      }
      
      logEvent("INFO", "binding_names_cached_on_create", license_key, 
               `VK: ${vkName || 'N/A'}, TG: ${tgName || 'N/A'}`);
               
    } catch (nameError) {
      logEvent("WARN", "binding_names_cache_failed", license_key, nameError.message);
      // Не прерываем выполнение если не удалось получить названия
    }
*/
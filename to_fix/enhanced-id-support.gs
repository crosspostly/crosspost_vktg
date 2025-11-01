/**
 * ИСПРАВЛЕНИЕ 3: Enhanced ID Format Support
 * Заменить функции extractVkGroupId и extractTelegramChatId в server.gs
 */

/**
 * Улучшенное извлечение ID группы ВКонтакте с поддержкой личных страниц
 */
function extractVkGroupId(url) {
  try {
    if (!url || typeof url !== 'string') {
      throw new Error('Некорректная ссылка на ВК группу/страницу');
    }
    
    // Убираем лишние пробелы и приводим к нижнему регистру
    url = url.trim().toLowerCase();
    
    // Добавляем протокол если отсутствует
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    logEvent("DEBUG", "vk_url_processing", "server", `Processing URL: ${url}`);
    
    // Извлекаем путь из URL
    const urlParts = url.match(/vk\.com\/(.+)/);
    if (!urlParts) {
      // Проверяем короткие ссылки vk.cc
      const vkccMatch = url.match(/vk\.cc\/(.+)/);
      if (vkccMatch) {
        return resolveVkShortLink(vkccMatch[1]);
      }
      throw new Error('Неверный формат ссылки ВК (должна содержать vk.com или vk.cc)');
    }
    
    const path = urlParts[1];
    
    // Случай 1: public123456 -> -123456 (группа)
    const publicMatch = path.match(/^public(\d+)$/);
    if (publicMatch) {
      const groupId = '-' + publicMatch[1];
      logEvent("INFO", "vk_public_group_detected", "server", `URL: ${url} -> ID: ${groupId}`);
      return groupId;
    }
    
    // Случай 2: club123456 -> -123456 (группа)
    const clubMatch = path.match(/^club(\d+)$/);
    if (clubMatch) {
      const groupId = '-' + clubMatch[1];
      logEvent("INFO", "vk_club_group_detected", "server", `URL: ${url} -> ID: ${groupId}`);
      return groupId;
    }
    
    // Случай 3: id123456 -> 123456 (личная страница)
    const userIdMatch = path.match(/^id(\d+)$/);
    if (userIdMatch) {
      const userId = userIdMatch[1];
      logEvent("INFO", "vk_user_page_detected", "server", `URL: ${url} -> ID: ${userId}`);
      return userId;
    }
    
    // Случай 4: просто число (уже ID)
    const numMatch = path.match(/^-?\d+$/);
    if (numMatch) {
      const directId = path;
      logEvent("INFO", "vk_direct_id_detected", "server", `URL: ${url} -> ID: ${directId}`);
      return directId;
    }
    
    // Случай 5: короткое имя -> нужен API запрос к ВК
    const shortName = path.replace(/[^a-z0-9_]/g, '');
    if (shortName) {
      logEvent("DEBUG", "vk_shortname_detected", "server", `URL: ${url} -> ShortName: ${shortName}`);
      return resolveVkShortName(shortName);
    }
    
    throw new Error('Неподдерживаемый формат ссылки ВК');
    
  } catch (error) {
    logEvent('ERROR', 'vk_url_parse_error', 'server', `URL: ${url}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Резолвинг коротких ссылок vk.cc
 */
function resolveVkShortLink(shortCode) {
  try {
    logEvent("DEBUG", "vk_short_link_resolving", "server", `Short code: ${shortCode}`);
    
    // Делаем запрос к короткой ссылке чтобы получить полную
    const response = UrlFetchApp.fetch(`https://vk.cc/${shortCode}`, {
      followRedirects: false,
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const location = response.getHeaders()['Location'] || response.getHeaders()['location'];
    
    if (location && location.includes('vk.com')) {
      logEvent("INFO", "vk_short_link_resolved", "server", `${shortCode} -> ${location}`);
      return extractVkGroupId(location); // Рекурсивно обрабатываем полную ссылку
    }
    
    throw new Error(`Не удалось разрешить короткую ссылку vk.cc/${shortCode}`);
    
  } catch (error) {
    logEvent("ERROR", "vk_short_link_resolve_error", "server", `Short code: ${shortCode}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Улучшенная функция резолвинга коротких имен ВК
 */
function resolveVkShortName(shortName) {
  try {
    const userToken = PropertiesService.getScriptProperties()
      .getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      throw new Error("VK User Access Token not configured");
    }
    
    if (!shortName || typeof shortName !== 'string' || shortName.trim() === '') {
      throw new Error("Empty or invalid screen name");
    }
    
    const cleanShortName = shortName.trim();
    
    logEvent("DEBUG", "vk_resolve_start", "server", `Resolving VK shortname: ${cleanShortName}`);
    
    const apiUrl = `https://api.vk.com/method/utils.resolveScreenName` +
                   `?screen_name=${encodeURIComponent(cleanShortName)}` +
                   `&access_token=${encodeURIComponent(userToken)}` +
                   `&v=${VK_API_VERSION}`;
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const responseText = response.getContentText();
    logEvent("DEBUG", "vk_api_response", "server", 
             `Status: ${response.getResponseCode()}, Response: ${responseText.substring(0, 200)}`);
    
    const data = JSON.parse(responseText);
    
    if (data.error) {
      const errorCode = data.error.error_code;
      const errorMsg = data.error.error_msg;
      
      // Детальная обработка ошибок
      if (errorCode === 100) {
        throw new Error(`Группа/пользователь "${cleanShortName}" не найдены в ВК`);
      } else if (errorCode === 113) {
        throw new Error(`Неверный ID или имя "${cleanShortName}"`);
      } else if (errorCode === 15) {
        throw new Error(`Доступ к "${cleanShortName}" запрещен`);
      } else {
        throw new Error(`VK API Error (${errorCode}): ${errorMsg}`);
      }
    }
    
    if (!data.response) {
      throw new Error(`Объект "${cleanShortName}" не найден`);
    }
    
    const objectType = data.response.type;
    const objectId = data.response.object_id;
    
    let resolvedId;
    if (objectType === "group") {
      resolvedId = "-" + objectId; // Группы с минусом
      logEvent("INFO", "vk_group_resolved", "server", 
               `Screen name: ${cleanShortName} -> Group ID: ${resolvedId}`);
    } else if (objectType === "user") {
      resolvedId = objectId.toString(); // Пользователи без минуса
      logEvent("INFO", "vk_user_resolved", "server", 
               `Screen name: ${cleanShortName} -> User ID: ${resolvedId}`);
    } else if (objectType === "page") {
      resolvedId = "-" + objectId; // Страницы как группы
      logEvent("INFO", "vk_page_resolved", "server", 
               `Screen name: ${cleanShortName} -> Page ID: ${resolvedId}`);
    } else {
      throw new Error(`Неподдерживаемый тип объекта ВК: ${objectType}`);
    }
    
    return resolvedId;
    
  } catch (error) {
    logEvent("ERROR", "vk_resolve_error", "server", 
             `Short name: ${shortName}, Error: ${error.message}`);
    
    if (error.message.includes('не найден') || 
        error.message.includes('запрещен') || 
        error.message.includes('не является')) {
      throw error;
    }
    
    throw new Error(`Не удалось найти ВК объект "${shortName}": ${error.message}`);
  }
}

/**
 * Улучшенное извлечение Chat ID Telegram с поддержкой различных форматов
 */
function extractTelegramChatId(input) {
  try {
    if (!input || typeof input !== 'string') {
      throw new Error('Некорректная ссылка на Telegram канал/чат');
    }
    
    input = input.trim();
    
    logEvent("DEBUG", "tg_input_processing", "server", `Processing input: ${input}`);
    
    // Случай 1: уже является chat_id (начинается с -100 или просто число)
    if (input.match(/^-?\d+$/)) {
      logEvent("INFO", "tg_direct_id_detected", "server", `Input: ${input} -> Chat ID: ${input}`);
      return input;
    }
    
    // Случай 2: начинается с @, оставляем как есть
    if (input.startsWith('@')) {
      const username = input.substring(1);
      if (username.match(/^[a-zA-Z0-9_]+$/)) {
        logEvent("INFO", "tg_username_detected", "server", `Input: ${input} -> Username: ${input}`);
        return input;
      } else {
        throw new Error('Некорректный формат username Telegram (допустимы только буквы, цифры и _)');
      }
    }
    
    // Случай 3: извлекаем имя канала из t.me ссылки
    const tMeMatch = input.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (tMeMatch) {
      const channelName = '@' + tMeMatch[1];
      logEvent("INFO", "tg_link_detected", "server", `Input: ${input} -> Channel: ${channelName}`);
      return channelName;
    }
    
    // Случай 4: извлекаем из полных telegram.me ссылок
    const telegramMeMatch = input.match(/telegram\.me\/([a-zA-Z0-9_]+)/);
    if (telegramMeMatch) {
      const channelName = '@' + telegramMeMatch[1];
      logEvent("INFO", "tg_telegram_me_detected", "server", `Input: ${input} -> Channel: ${channelName}`);
      return channelName;
    }
    
    // Случай 5: invite ссылки (пока просто логируем, полная поддержка позже)
    const inviteMatch = input.match(/t\.me\/joinchat\/([a-zA-Z0-9_-]+)/);
    if (inviteMatch) {
      logEvent("WARN", "tg_invite_link_detected", "server", 
               `Input: ${input} -> Invite code: ${inviteMatch[1]} (requires bot to join first)`);
      throw new Error('Invite ссылки пока не поддерживаются. Используйте @username или chat_id');
    }
    
    // Случай 6: простое имя канала без символов
    if (input.match(/^[a-zA-Z0-9_]+$/)) {
      const channelName = '@' + input;
      logEvent("INFO", "tg_simple_name_detected", "server", `Input: ${input} -> Channel: ${channelName}`);
      return channelName;
    }
    
    throw new Error('Неподдерживаемый формат Telegram ссылки/ID');
    
  } catch (error) {
    logEvent('ERROR', 'tg_input_parse_error', 'server', `Input: ${input}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * НОВАЯ ФУНКЦИЯ: Валидация существования и прав доступа к Telegram чату
 */
function validateTelegramChatAccess(chatId) {
  try {
    const botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      throw new Error("Bot token not configured");
    }
    
    logEvent("DEBUG", "tg_chat_validation_start", "server", `Chat ID: ${chatId}`);
    
    // Пробуем получить информацию о чате
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ chat_id: chatId }),
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      const chat = result.result;
      
      logEvent("INFO", "tg_chat_validation_success", "server", 
               `Chat: ${chat.title || chat.first_name || 'N/A'}, Type: ${chat.type}, ID: ${chat.id}`);
      
      return {
        success: true,
        chatInfo: {
          id: chat.id,
          title: chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim() || 'Private Chat',
          type: chat.type,
          username: chat.username
        }
      };
    } else {
      const error = result.description || 'Unknown error';
      
      logEvent("WARN", "tg_chat_validation_failed", "server", 
               `Chat ID: ${chatId}, Error: ${error}`);
      
      // Детальная обработка ошибок
      if (error.includes('chat not found')) {
        return { success: false, error: 'Чат не найден. Проверьте правильность ID или добавьте бота в чат.' };
      } else if (error.includes('bot was blocked')) {
        return { success: false, error: 'Бот заблокирован в этом чате.' };
      } else if (error.includes('not enough rights')) {
        return { success: false, error: 'У бота недостаточно прав в этом чате.' };
      } else {
        return { success: false, error: `Ошибка доступа к чату: ${error}` };
      }
    }
    
  } catch (error) {
    logEvent("ERROR", "tg_chat_validation_error", "server", 
             `Chat ID: ${chatId}, Error: ${error.message}`);
    return { success: false, error: `Ошибка проверки чата: ${error.message}` };
  }
}

/**
 * НОВАЯ ФУНКЦИЯ: Валидация существования ВК группы/пользователя
 */
function validateVkObjectAccess(objectId) {
  try {
    const userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      throw new Error("VK User Access Token not configured");
    }
    
    logEvent("DEBUG", "vk_object_validation_start", "server", `Object ID: ${objectId}`);
    
    const isGroup = objectId.toString().startsWith('-');
    const cleanId = Math.abs(parseInt(objectId));
    
    let apiMethod, apiParams;
    
    if (isGroup) {
      // Проверяем группу
      apiMethod = 'groups.getById';
      apiParams = `group_id=${cleanId}`;
    } else {
      // Проверяем пользователя
      apiMethod = 'users.get';
      apiParams = `user_ids=${cleanId}`;
    }
    
    const response = UrlFetchApp.fetch(
      `https://api.vk.com/method/${apiMethod}?${apiParams}&v=${VK_API_VERSION}&access_token=${userToken}`,
      {
        muteHttpExceptions: true,
        timeout: 10000
      }
    );
    
    const data = JSON.parse(response.getContentText());
    
    if (data.error) {
      const errorCode = data.error.error_code;
      const errorMsg = data.error.error_msg;
      
      logEvent("WARN", "vk_object_validation_failed", "server", 
               `Object ID: ${objectId}, Error code: ${errorCode}, Message: ${errorMsg}`);
      
      if (errorCode === 100) {
        return { success: false, error: 'Группа/пользователь не найдены или удалены.' };
      } else if (errorCode === 15) {
        return { success: false, error: 'Доступ к группе/странице запрещен (приватная).' };
      } else {
        return { success: false, error: `Ошибка VK API (${errorCode}): ${errorMsg}` };
      }
    }
    
    if (data.response && data.response.length > 0) {
      const obj = data.response[0];
      const name = obj.name || `${obj.first_name || ''} ${obj.last_name || ''}`.trim();
      
      logEvent("INFO", "vk_object_validation_success", "server", 
               `Object: ${name}, ID: ${objectId}, Type: ${isGroup ? 'group' : 'user'}`);
      
      return {
        success: true,
        objectInfo: {
          id: objectId,
          name: name,
          type: isGroup ? 'group' : 'user',
          screenName: obj.screen_name
        }
      };
    } else {
      return { success: false, error: 'Объект не найден или недоступен.' };
    }
    
  } catch (error) {
    logEvent("ERROR", "vk_object_validation_error", "server", 
             `Object ID: ${objectId}, Error: ${error.message}`);
    return { success: false, error: `Ошибка проверки объекта ВК: ${error.message}` };
  }
}
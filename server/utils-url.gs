/**
 * VK→Telegram Crossposter - UTILS URL MODULE
 * Утилиты для работы с URL и извлечения ID
 * 
 * Размер: ~200 строк
 * Зависимости: utils-core.gs
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

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
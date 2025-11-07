// @ts-nocheck
/**
 * VK→Telegram Crossposter - VK SERVICE MODULE
 * VK API сервисы: запросы постов, медиа, форматирование текста
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// VK API ОБРАБОТКА ПОСТОВ
// ============================================

/**
 * Обработка запроса на получение постов из VK
 * @param {Object} payload - Данные запроса
 * @param {string} clientIp - IP адрес клиента
 * @returns {ContentService.TextOutput} - JSON ответ
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
      return jsonResponse({ success: false, error: 'vk_group_id required' }, 400);
    }

    // Преобразуем screenname в ID если необходимо
    var resolvedVkGroupId;
    try {
      resolvedVkGroupId = extractVkGroupId(vk_group_id);
      logEvent('INFO', 'vk_group_id_resolved', license_key, `Input: ${vk_group_id} → Resolved: ${resolvedVkGroupId}, IP: ${clientIp}`);
    } catch (resolveError) {
      logEvent('WARN', 'invalid_vk_group_id_format', license_key, `Failed to resolve vk_group_id: ${vk_group_id}, Error: ${resolveError.message}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: 'Invalid vk_group_id format. Expected a numeric ID or valid vk.com screen name' }, 400);
    }

    // Получаем VK User Token
    var userToken = PropertiesService.getScriptProperties().getProperty('VK_USER_ACCESS_TOKEN');
    if (!userToken) {
      logEvent('ERROR', 'vk_user_token_missing', license_key, `Cannot fetch posts without VK User Access Token, Group ID: ${resolvedVkGroupId}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: 'Не настроен VK User Access Token' }, 500);
    }

    // Построение URL для VK API
    var apiUrl = `https://api.vk.com/method/wall.get?owner_id=${encodeURIComponent(resolvedVkGroupId)}&count=${encodeURIComponent(count)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    // Логируем безопасную версию URL для API
    var logUrl = `https://api.vk.com/method/wall.get?owner_id=${resolvedVkGroupId}&count=${count}&v=${VK_API_VERSION}&access_token=***`;
    logEvent('DEBUG', 'vk_api_request', license_key, `Request URL: ${logUrl}, Group ID: ${resolvedVkGroupId}, Original Input: ${vk_group_id}, IP: ${clientIp}`);

    try {
      var response = UrlFetchApp.fetch(apiUrl, {
        muteHttpExceptions: true,
        timeout: 15000
      });
      
      var responseData = JSON.parse(response.getContentText());
      
      logEvent('DEBUG', 'vk_api_response', license_key, 
              `Group ID: ${resolvedVkGroupId}, HTTP Status: ${response.getResponseCode()}, Has VK error: ${!!responseData.error}, Response length: ${response.getContentText().length}, IP: ${clientIp}`);

      if (responseData.error) {
        logEvent('ERROR', 'vk_api_error', license_key, 
                `Group ID: ${resolvedVkGroupId}, VK Error code: ${responseData.error.error_code}, Message: ${responseData.error.error_msg}, IP: ${clientIp}`);

        var errorMessage = `VK API Error: ${responseData.error.error_msg}`;
        if (responseData.error.error_code === 5) {
          errorMessage = 'User authorization failed: VK Access Token is invalid or expired';
        } else if (responseData.error.error_code === 15) {
          errorMessage = 'Access denied: Unable to access VK group posts';
        } else if (responseData.error.error_code === 100) {
          errorMessage = 'Invalid VK group ID';
        } else if (responseData.error.error_code === 200) {
          errorMessage = 'Access to this VK group denied';
        }
        
        return jsonResponse({ success: false, error: errorMessage, vk_error_code: responseData.error.error_code }, 400);
      }

      var posts = responseData.response ? responseData.response.items : [];

      // Фильтруем уже отправленные посты по bindingName
      try {
        var bindings = getUserBindings(license_key);
        var filteredPosts = [];
        
        for (var post of posts) {
          var alreadySent = false;
          
          for (var binding of bindings) {
            if (binding.vkGroupUrl) {
              var bindingGroupId = extractVkGroupId(binding.vkGroupUrl);
              if (bindingGroupId === resolvedVkGroupId && binding.bindingName) {
                if (checkPostAlreadySent(binding.bindingName, post.id)) {
                  alreadySent = true;
                  logEvent('DEBUG', 'post_already_sent', license_key, `Post ${post.id} already sent to ${binding.bindingName}`);
                  break;
                }
              }
            }
          }
          
          if (!alreadySent) {
            filteredPosts.push(post);
          }
        }

        logEvent('INFO', 'vk_posts_filtered', license_key, 
                `Group ID: ${resolvedVkGroupId}, Original: ${posts.length}, Filtered: ${filteredPosts.length}, IP: ${clientIp}`);
        
        return jsonResponse({ 
          success: true, 
          posts: filteredPosts, 
          group_id: resolvedVkGroupId, 
          total_count: responseData.response ? responseData.response.count : 0,
          filtered_count: filteredPosts.length
        });
        
      } catch (filterError) {
        logEvent('WARN', 'post_filtering_failed', license_key, `Failed to filter posts: ${filterError.message}, returning all posts`);
        
        logEvent('INFO', 'vk_posts_retrieved', license_key, 
                `Group ID: ${resolvedVkGroupId}, Posts count: ${posts.length}, IP: ${clientIp}`);
        
        return jsonResponse({ 
          success: true, 
          posts: posts, 
          group_id: resolvedVkGroupId, 
          total_count: responseData.response ? responseData.response.count : 0
        });
      }

    } catch (vkError) {
      logEvent('ERROR', 'vk_posts_fetch_error', license_key, 
              `Group ID: ${resolvedVkGroupId}, Error: ${vkError.message}, IP: ${clientIp}`);
      return jsonResponse({ 
        success: false, 
        error: vkError.message, 
        details: { group_id: resolvedVkGroupId, vk_error: vkError.message }
      }, 500);
    }
    
  } catch (error) {
    logEvent('ERROR', 'get_vk_posts_error', payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handlePublishLastPost(payload, clientIp) {
  try {
    var { license_key, vk_group_id, binding_id } = payload;

    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) {
      return licenseCheck;
    }

    if (!vk_group_id) {
      return jsonResponse({ success: false, error: 'vk_group_id required' }, 400);
    }

    // Проверяем формат vk_group_id
    if (!/^-?\d+$/.test(vk_group_id)) {
      return jsonResponse({ success: false, error: 'Invalid vk_group_id format' }, 400);
    }

    logEvent('INFO', 'publish_last_post_request', license_key, `Group ID: ${vk_group_id}, Binding ID: ${binding_id}, IP: ${clientIp}`);

    // Получаем VK посты
    var postsResult = handleGetVkPosts({ license_key: license_key, vk_group_id: vk_group_id, count: 1 }, clientIp);
    var postsData = JSON.parse(postsResult.getContent());
    
    if (!postsData.success) {
      logEvent('ERROR', 'publish_last_post_get_posts_failed', license_key, `Error getting posts: ${postsData.error}`);
      return jsonResponse({ success: false, error: `Failed to get VK posts: ${postsData.error}` }, 500);
    }

    if (!postsData.posts || postsData.posts.length === 0) {
      logEvent('WARN', 'publish_last_post_no_posts', license_key, `No posts found in VK group: ${vk_group_id}`);
      return jsonResponse({ success: false, error: 'No posts found in VK group' }, 404);
    }

    var lastPost = postsData.posts[0];
    
    // Поиск binding для получения format settings
    var binding = null;
    if (binding_id) {
      try {
        var bindingsSheet = getSheet('Bindings');
        var data = bindingsSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === binding_id && data[i][1] === license_key) {
            binding = buildBindingObjectFromRow(data[i]);
            if (binding && binding.formatSettings) {
              // formatSettings уже в binding.formatSettings
            }
            break;
          }
        }
      } catch (error) {
        logEvent('WARN', 'publish_last_post_binding_lookup_failed', license_key, `Binding ID: ${binding_id}, Error: ${error.message}`);
      }
    }

    if (!binding) {
      return jsonResponse({ success: false, error: 'Binding not found or no telegram chat specified' }, 404);
    }

    // Парсим format settings
    var formatSettings = {};
    try {
      if (binding.formatSettings && binding.formatSettings !== '') {
        formatSettings = JSON.parse(binding.formatSettings);
      }
    } catch (error) {
      logEvent('WARN', 'publish_last_post_format_settings_parse_error', license_key, `Error parsing format settings: ${error.message}`);
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
      logEvent('INFO', 'publish_last_post_success', license_key, 
              `Post published successfully: VK ${vk_group_id}/${lastPost.id} → TG ${binding.tgChatId}`);
      
      return jsonResponse({ 
        success: true, 
        message: 'Last post published successfully', 
        published_post: {
          vk_post_id: lastPost.id,
          vk_group_id: vk_group_id,
          tg_chat_id: binding.tgChatId,
          binding_name: binding.bindingName
        }
      });
    } else {
      logEvent('ERROR', 'publish_last_post_send_failed', license_key, `Send error: ${sendData.error}`);
      return jsonResponse({ success: false, error: `Failed to send post to Telegram: ${sendData.error}` }, 500);
    }
    
  } catch (error) {
    logEvent('ERROR', 'publish_last_post_error', payload.license_key || 'unknown', `Error: ${error.message}`);
    return jsonResponse({ success: false, error: `Failed to publish last post: ${error.message}` }, 500);
  }
}

/**
 * Получение постов из VK группы
 * @param {string} groupId - VK Group ID
 * @param {number} count - Количество постов (по умолчанию 10)
 * @returns {Array} - Массив постов
 */
function getVkPosts(groupId, count = 10) {
  try {
    var userToken = PropertiesService.getScriptProperties().getProperty('VK_USER_ACCESS_TOKEN');
    if (!userToken) {
      throw new Error('VK User Access Token not configured');
    }

    // Преобразуем group ID в owner ID
    var ownerId = groupId.toString().startsWith('-') ? groupId : '-' + groupId;
    
    var url = `https://api.vk.com/method/wall.get?owner_id=${ownerId}&count=${count}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    logEvent('DEBUG', 'vk_posts_request', 'server', `Group ID: ${groupId}, Owner ID: ${ownerId}, Count: ${count}`);
    
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      timeout: TIMEOUTS.MEDIUM
    });
    
    var responseText = response.getContentText();
    var data = JSON.parse(responseText);

    if (data.error) {
      var errorCode = data.error.error_code;
      var errorMsg = data.error.error_msg;
      
      // Логируем VK API ошибку
      logApiError('VK_API', 'wall.get', 
                 { owner_id: ownerId, count: count, v: VK_API_VERSION }, 
                 { status_code: response.getResponseCode(), error_code: errorCode, description: errorMsg, response_body: responseText.substring(0, 500) });
      
      if (errorCode === 5) {
        throw new Error(`VK User Access Token недействителен: ${errorMsg}`);
      } else if (errorCode === 10) {
        throw new Error(`Внутренняя ошибка VK: ${errorMsg}`);
      } else if (errorCode === 15) {
        throw new Error(`Нет доступа к группе: ${errorMsg}`);
      } else if (errorCode === 200) {
        throw new Error(`Нет доступа к постам группы: ${errorMsg}`);
      } else if (errorCode === 30) {
        throw new Error(`Профиль закрыт: ${errorMsg}`);
      } else if (errorCode === 113) {
        throw new Error(`Невалидный user ID: ${errorMsg}`);
      } else if (errorCode === 18) {
        throw new Error(`Страница удалена: ${errorMsg}`);
      } else if (errorCode === 203) {
        throw new Error(`Нет доступа к группе: ${errorMsg}`);
      }
      
      throw new Error(`VK API Error ${errorCode}: ${errorMsg}`);
    }

    if (!data.response || !data.response.items || data.response.items.length === 0) {
      logEvent('INFO', 'vk_posts_empty', 'server', `Group ID: ${groupId} - no posts found`);
      return [];
    }

    var posts = data.response.items.map(post => ({
      id: post.id,
      text: post.text || '',
      date: post.date,
      attachments: post.attachments
    }));
    
    logEvent('INFO', 'vk_posts_retrieved', 'server', `Group ID: ${groupId}, Posts found: ${posts.length}`);
    return posts;
    
  } catch (error) {
    logEvent('ERROR', 'vk_api_error', 'server', `Group ID: ${groupId}, Error: ${error.message}`);
    throw error;
  }
}

// ============================================
// VK API MEDIA
// ============================================

/**
 * Извлечение медиа URL’ов из VK вложений
 * @param {Array} attachments - VK вложения
 * @returns {Object} - Объект с массивами медиа URL’ов
 */
function getVkMediaUrls(attachments) {
  var result = {
    photos: [],
    videos: [],
    docLinks: [],
    audioLinks: []
  };
  
  if (!attachments || attachments.length === 0) {
    return result;
  }
  
  for (const attachment of attachments) {
    try {
      switch (attachment.type) {
        case 'photo':
          const photoUrl = getBestPhotoUrl(attachment.photo.sizes);
          if (photoUrl) {
            result.photos.push({ type: 'photo', url: photoUrl });
          }
          break;
          
        case 'video':
          const videoId = `${attachment.video.owner_id}_${attachment.video.id}`;
          const directUrl = getVkVideoDirectUrl(videoId);
          if (directUrl) {
            result.videos.push({ type: 'video', url: directUrl, id: videoId });
          } else {
            // Фолбэк: ссылка на embed (без прямого URL)
            result.docLinks.push(`🎥 Видео: https://vk.com/video${videoId}`);
          }
          break;
          
        case 'audio':
          if (attachment.audio.artist && attachment.audio.title) {
            result.audioLinks.push(`🎵 ${attachment.audio.artist} - ${attachment.audio.title}`);
          }
          break;
          
        case 'doc':
          if (attachment.doc.url && attachment.doc.title) {
            result.docLinks.push(`📄 [${attachment.doc.title}](${attachment.doc.url})`);
          }
          break;
          
        case 'link':
          if (attachment.link.url) {
            const title = attachment.link.title || attachment.link.url;
            result.docLinks.push(`🔗 [${title}](${attachment.link.url})`);
          }
          break;
      }
    } catch (attachError) {
      logEvent('WARN', 'attachment_processing_error', 'server', 
              `Type: ${attachment.type}, Error: ${attachError.message}`);
    }
  }
  
  return result;
}

/**
 * Получение прямых ссылок на VK видео
 * @param {string} videoId - ID видео в формате {owner_id}_{video_id}
 * @returns {string|null} - Прямая ссылка на видео или null
 */
function getVkVideoDirectUrl(videoId) {
  try {
    var userToken = PropertiesService.getScriptProperties().getProperty('VK_USER_ACCESS_TOKEN');
    if (!userToken) {
      logEvent('WARN', 'vk_user_token_missing', 'server', 'Cannot get video URLs without user token');
      return null;
    }

    logEvent('DEBUG', 'vk_video_request_start', 'server', `Video ID: ${videoId}`);
    
    var url = `https://api.vk.com/method/video.get?videos=${encodeURIComponent(videoId)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      timeout: TIMEOUTS.SLOW
    });
    
    var responseText = response.getContentText();
    
    logEvent('DEBUG', 'vk_video_api_response', 'server', 
            `Status: ${response.getResponseCode()}, Body length: ${responseText.length}, First 200 chars: ${responseText.substring(0, 200)}`);
    
    var data = JSON.parse(responseText);
    
    if (data.error) {
      logEvent('WARN', 'vk_video_api_error', 'server', 
              `Video ID: ${videoId}, Error Code: ${data.error.error_code}, Message: ${data.error.error_msg}`);
      return null;
    }
    
    if (!data.response || !data.response.items || data.response.items.length === 0) {
      logEvent('DEBUG', 'vk_video_not_found', 'server', `Video ID: ${videoId} - no items in response`);
      return null;
    }
    
    var video = data.response.items[0];
    
    logEvent('DEBUG', 'vk_video_details', 'server', 
            `Video: ${video.title?.substring(0, 50) || 'No title'}, Duration: ${video.duration}, Owner: ${video.owner_id}`);
    
    // Поиск лучшего качества видео
    var files = video.files;
    if (files) {
      var availableQualities = Object.keys(files).filter(key => key.startsWith('mp4'));
      logEvent('DEBUG', 'vk_video_qualities', 'server', `Available: ${availableQualities.join(', ')}`);
      
      var qualities = ['mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
      for (const quality of qualities) {
        if (files[quality]) {
          logEvent('INFO', 'vk_video_url_found', 'server', `Video ID: ${videoId}, Quality: ${quality}, URL length: ${files[quality].length}`);
          return files[quality];
        }
      }
    } else {
      logEvent('DEBUG', 'vk_video_no_files', 'server', `Video ID: ${videoId} - no files object in response`);
    }
    
    // Фолбэк - player URL
    var playerUrl = video.player;
    if (playerUrl) {
      logEvent('DEBUG', 'vk_video_player_url', 'server', `Video ID: ${videoId}, Player URL: ${playerUrl.substring(0, 100)}...`);
      return playerUrl;
    }
    
    return null;
    
  } catch (error) {
    logEvent('ERROR', 'vk_video_direct_url_error', 'server', 
            `Video ID: ${videoId}, Error: ${error.message}, Stack: ${error.stack?.substring(0, 200)}`);
    return null;
  }
}

/**
 * Получение лучшего качества фото из VK
 * @param {Array} sizes - Массив размеров фото
 * @returns {string|null} - URL лучшего качества
 */
function getBestPhotoUrl(sizes) {
  if (!sizes || sizes.length === 0) return null;
  
  // Приоритетные типы по качеству (от лучшего к худшему)
  var preferredTypes = ['w', 'z', 'y', 'x', 'r', 'q', 'p', 'o', 'n', 'm', 's'];
  
  for (const type of preferredTypes) {
    var size = sizes.find(s => s.type === type);
    if (size) {
      return size.url;
    }
  }
  
  // Если ничего не нашли, берём последний доступный
  return sizes[sizes.length - 1].url;
}

// ============================================
// VK NAMES & IDS
// ============================================

/**
 * Резольв screen_name в VK Group ID через VK API
 * @param {string} screenName - Screen name для резольва
 * @returns {string} - VK Group ID в формате -123456
 */
function resolveVkScreenName(screenName) {
  if (!screenName || typeof screenName !== 'string') {
    throw new Error('Screen name обязателен');
  }

  try {
    var userToken = PropertiesService.getScriptProperties().getProperty('VK_USER_ACCESS_TOKEN');
    if (!userToken) {
      throw new Error('VK User Access Token не настроен');
    }

    var apiUrl = `https://api.vk.com/method/utils.resolveScreenName?screen_name=${encodeURIComponent(screenName)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    logEvent('DEBUG', 'vk_resolve_screen_name_start', 'system', `Resolving screenname: ${screenName}`);
    
    var response = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      timeout: TIMEOUTS.FAST
    });
    
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    logEvent('DEBUG', 'vk_resolve_screen_name_response', 'system', 
            `Screen: ${screenName}, Code: ${responseCode}, Response length: ${responseText.length}`);

    if (responseCode !== 200) {
      throw new Error(`VK API HTTP ${responseCode}: ${responseText.substring(0, 100)}`);
    }

    var data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from VK API: ${parseError.message}`);
    }

    // Обработка VK API ошибок
    if (data.error) {
      var errorCode = data.error.error_code;
      var errorMsg = data.error.error_msg;
      
      logEvent('WARN', 'vk_resolve_screen_name_api_error', 'system', 
              `Screen: ${screenName}, Error ${errorCode} - ${errorMsg}`);
      
      switch (errorCode) {
        case 5: // User authorization failed
          throw new Error(`VK User Access Token недействителен: ${errorMsg}. Проверьте VK User Access Token`);
        case 113: // Invalid user id
          throw new Error(`Невалидное имя screenname: ${screenName} - ${errorMsg}`);
        case 100: // One of the parameters specified was missing or invalid
          throw new Error(`Невалидный параметр ${screenName}: ${errorMsg}`);
        case 10: // Internal server error
          throw new Error(`Внутренняя ошибка VK API ${errorCode}: ${errorMsg}`);
        case 15: // Access denied
          throw new Error(`Нет доступа к ${screenName}: ${errorMsg}`);
        default:
          throw new Error(`VK API Error ${errorCode}: ${errorMsg}`);
      }
    }

    if (!data.response || !data.response.object_id) {
      logEvent('WARN', 'vk_resolve_screen_name_not_found', 'system', `Screen name not found: ${screenName}`);
      throw new Error(`Screen name не найден: ${screenName}`);
    }

    var objectId = data.response.object_id;
    var type = data.response.type;

    // Проверяем что objectid - это число
    if (!/^\d+$/.test(objectId.toString())) {
      throw new Error(`Невалидный objectid: ${objectId} для screenname: ${screenName}`);
    }

    var result = (type === 'group' || type === 'page') ? '-' + objectId : objectId.toString();
    
    logEvent('INFO', 'vk_resolve_screen_name_success', 'system', 
            `Screen: ${screenName}, Type: ${type}, ID: ${objectId} → Result: ${result}`);
    
    return result;
    
  } catch (error) {
    if (error.message.includes('timeout') || error.message.includes('Timed out')) {
      logEvent('ERROR', 'vk_resolve_screen_name_timeout', 'system', `Timeout resolving screenname: ${screenName}`);
      throw new Error(`Таймаут при резольве ${screenName}. VK API недоступно.`);
    }
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      logEvent('ERROR', 'vk_resolve_screen_name_network', 'system', `Network error resolving screenname ${screenName}: ${error.message}`);
      throw new Error(`Ошибка сети при резольве ${screenName}: ${error.message}`);
    }
    
    logEvent('ERROR', 'vk_resolve_screen_name_failed', 'system', `Failed to resolve screenName ${screenName}: ${error.message}`);
    throw new Error(`Не удалось резольвить ${screenName}: ${error.message}`);
  }
}

/**
 * Получение названия VK группы по ID
 * @param {string} groupId - VK Group ID
 * @returns {string|null} - Название группы или null
 */
function getVkGroupName(groupId) {
  try {
    var userToken = PropertiesService.getScriptProperties().getProperty('VK_USER_ACCESS_TOKEN');
    if (!userToken) {
      logEvent('WARN', 'vk_token_missing_for_name', 'server', `Group ID: ${groupId}`);
      return null;
    }

    var isGroup = groupId.toString().startsWith('-');
    var cleanId = Math.abs(parseInt(groupId));
    
    logEvent('DEBUG', 'vk_name_request_start', 'server', `Group ID: ${groupId}, Clean ID: ${cleanId}, Is Group: ${isGroup}`);

    var apiMethod, apiParams;
    if (isGroup) {
      apiMethod = 'groups.getById';
      apiParams = `group_id=${cleanId}&fields=name,screen_name`;
    } else {
      apiMethod = 'users.get';
      apiParams = `user_ids=${cleanId}&fields=first_name,last_name,screen_name`;
    }

    var response = UrlFetchApp.fetch(
      `https://api.vk.com/method/${apiMethod}?${apiParams}&v=${VK_API_VERSION}&access_token=${userToken}`,
      { muteHttpExceptions: true, timeout: 8000 }
    );

    var data = JSON.parse(response.getContentText());
    
    if (data.error) {
      logEvent('WARN', 'vk_name_api_error', 'server', 
              `Group ID: ${groupId}, Error: ${data.error.error_code} - ${data.error.error_msg}`);
      return null;
    }
    
    if (data.response && data.response.length > 0) {
      var obj = data.response[0];
      var name;
      if (isGroup) {
        name = obj.name;
      } else {
        name = `${obj.first_name} ${obj.last_name}`.trim();
      }
      
      logEvent('INFO', 'vk_name_retrieved', 'server', `Group ID: ${groupId} → Name: ${name}`);
      return name;
    }
    
    logEvent('WARN', 'vk_name_not_found', 'server', `Group ID: ${groupId}`);
    return null;
    
  } catch (error) {
    logEvent('ERROR', 'vk_name_request_error', 'server', `Group ID: ${groupId}, Error: ${error.message}`);
    return null;
  }
}

/**
 * Кэшированное получение названия VK группы
 * @param {string} groupId - VK Group ID
 * @returns {string} - Название группы с кэшированием
 */
function getCachedVkGroupName(groupId) {
  try {
    var cache = PropertiesService.getScriptProperties();
    var cacheKey = `vk_name_${groupId}`;
    var cachedName = cache.getProperty(cacheKey);
    
    if (cachedName) {
      logEvent('DEBUG', 'vk_name_from_cache', 'server', `${groupId} → ${cachedName} (cached)`);
      return cachedName;
    }
    
    // Получаем свежее имя
    var freshName = getVkGroupName(groupId);
    if (freshName) {
      cache.setProperty(cacheKey, freshName);
    }
    
    return freshName || `VK_${groupId}`;
    
  } catch (error) {
    logEvent('ERROR', 'cached_vk_name_error', 'server', error.message);
    return `VK_${groupId}`;
  }
}

// ============================================
// VK TEXT PROCESSING
// ============================================

/**
 * Форматирование VK текста для Telegram
 * @param {string} text - Исходный VK текст
 * @param {Object} options - Опции форматирования
 * @returns {string} - Отформатированный текст
 */
function formatVkTextForTelegram(text, options) {
  if (!text) return '';
  
  options = options || {};
  var boldFirstLine = options.boldFirstLine !== false; // true по умолчанию
  var boldUppercase = options.boldUppercase !== false; // true по умолчанию

  // Выделяем первую строку жирным
  if (boldFirstLine) {
    text = text.replace(/(^.+?)([\r\n]|$)/, '**$1**$2');
  }
  
  // Выделяем слова из заглавных букв (2+ символа)
  if (boldUppercase) {
    text = text.replace(/\b[A-ZА-Я]{2,}\b/g, '**$&**');
  }
  
  // Преобразуем VK ссылки в Telegram формат
  text = text.replace(/\[id(\d+)\|(.+?)\]/g, '[$2](https://vk.com/id$1)');
  text = text.replace(/\[(club|public)(\d+)\|(.+?)\]/g, function(match, type, id, title) {
    // Преобразуем ID в отрицательный
    if (id.startsWith('id')) {
      return `[${title}](https://vk.com/${id})`;
    } else if (id.startsWith('club') || id.startsWith('public')) {
      return `[${title}](https://vk.com/${id})`;
    } else {
      return `[${title}](https://vk.com/club${id})`;
    }
  });
  
  // Убираем лишние пробелы
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  
  return text;
}

/**
 * Форматирование VK поста для Telegram
 * @param {Object} vkPost - VK пост
 * @param {Object} binding - Связка с настройками
 * @returns {string} - Отформатированный текст
 */
function formatVkPostForTelegram(vkPost, binding) {
  if (!vkPost) return '';
  
  var formatOptions = { boldFirstLine: false, boldUppercase: false };
  
  // Применяем formatSettings если есть
  if (binding && binding.formatSettings) {
    try {
      var settings = typeof binding.formatSettings === 'string' ? 
                    JSON.parse(binding.formatSettings) : binding.formatSettings;
      
      formatOptions.boldFirstLine = settings.boldFirstLine || false;
      formatOptions.boldUppercase = settings.boldUppercase || false;
      
      logEvent('DEBUG', 'format_settings_applied', binding.licenseKey || 'unknown', 
              `Bold first: ${formatOptions.boldFirstLine}, Bold uppercase: ${formatOptions.boldUppercase}`);
    } catch (e) {
      logEvent('WARN', 'format_settings_parse_error', binding.licenseKey || 'unknown', e.message);
    }
  }
  
  // VK пост может быть пустым (только медиа)!
  if (!vkPost.text) return '';
  
  return formatVkTextForTelegram(vkPost.text, formatOptions);
}

/**
 * Создание краткого описания медиа вложений
 * @param {Array} attachments - VK вложения
 * @returns {string} - Описание медиа
 */
function createMediaSummary(attachments) {
  try {
    if (!attachments || attachments.length === 0) {
      return 'no media';
    }
    
    var counts = { photo: 0, video: 0, audio: 0, doc: 0, link: 0, other: 0 };
    
    for (var i = 0; i < attachments.length; i++) {
      var type = attachments[i].type;
      if (counts.hasOwnProperty(type)) {
        counts[type]++;
      } else {
        counts.other++;
      }
    }
    
    var parts = [];
    if (counts.photo > 0) parts.push(`${counts.photo} photo${counts.photo > 1 ? 's' : ''}`);
    if (counts.video > 0) parts.push(`${counts.video} video${counts.video > 1 ? 's' : ''}`);
    if (counts.audio > 0) parts.push(`${counts.audio} audio${counts.audio > 1 ? 's' : ''}`);
    if (counts.doc > 0) parts.push(`${counts.doc} doc${counts.doc > 1 ? 's' : ''}`);
    if (counts.link > 0) parts.push(`${counts.link} link${counts.link > 1 ? 's' : ''}`);
    if (counts.other > 0) parts.push(`${counts.other} other`);
    
    return parts.length > 0 ? parts.join(', ') : 'no media';
    
  } catch (error) {
    logEvent('ERROR', 'media_summary_failed', 'server', error.message);
    return 'error counting media';
  }
}

/**
 * Проверка, был ли уже отправлен пост в связку
 * @param {string} bindingName - Название связки
 * @param {string} postId - ID VK поста
 * @returns {boolean} - true если пост уже отправлен
 */
function checkPostAlreadySent(bindingName, postId) {
  try {
    if (!postId) return false;
    
    var sheetName = getPublishedSheetNameFromBindingName(bindingName);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) return false;
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false; // Только заголовок
    
    // Проверяем последние 50 записей для оптимизации
    var startRow = Math.max(2, lastRow - 49); // 50 записей максимум
    var rowsToCheck = lastRow - startRow + 1;
    
    // Получаем status (колонка B) и vkPostId (колонка D)
    var rows = sheet.getRange(startRow, 2, rowsToCheck, 3).getValues(); // B, C, D колонки
    
    for (var i = 0; i < rows.length; i++) {
      var status = rows[i][0].toString().toLowerCase(); // Колонка B (status)
      var vkPostId = rows[i][2]; // Колонка D (vkPostId)
      
      if ((status === 'success' || status === 'partial') && vkPostId && vkPostId.toString() === postId.toString()) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    logEvent('ERROR', 'check_post_already_sent_failed', 'server', error.message);
    return false; // При ошибке считаем, что пост не отправлен
  }
}
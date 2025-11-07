/**
 * VK→Telegram Crossposter - VK MEDIA MODULE
 * Обработка медиа вложений из VK
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// VK API MEDIA
// ============================================

/**
 * Извлечение медиа URL'ов из VK вложений
 * @param {Array<VkAttachment>} attachments - VK вложения
 * @returns {Object} - Объект с массивами медиа URL'ов
 * @returns {Array<Object>} returns.photos - Массив фото
 * @returns {string} returns.photos[].type - Тип медиа ('photo')
 * @returns {string} returns.photos[].url - URL фото
 * @returns {Array<Object>} returns.videos - Массив видео
 * @returns {string} returns.videos[].type - Тип медиа ('video')
 * @returns {string} returns.videos[].url - URL видео
 * @returns {string} returns.videos[].id - ID видео
 * @returns {Array<string>} returns.docLinks - Массив ссылок на документы
 * @returns {Array<string>} returns.audioLinks - Массив ссылок на аудио
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
        case 'photo': {
          const photoUrl = getBestPhotoUrl(attachment.photo.sizes);
          if (photoUrl) {
            result.photos.push({ type: 'photo', url: photoUrl });
          }
          break;
        }
          
        case 'video': {
          const videoId = `${attachment.video.owner_id}_${attachment.video.id}`;
          const directUrl = getVkVideoDirectUrl(videoId);
          if (directUrl) {
            result.videos.push({ type: 'video', url: directUrl, id: videoId });
          } else {
            // Фолбэк: ссылка на embed (без прямого URL)
            result.docLinks.push(`🎥 Видео: https://vk.com/video${videoId}`);
          }
          break;
        }
          
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
 * @param {Array<VkPhotoSize>} sizes - Массив размеров фото
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

// @ts-nocheck
/**
 * VK→Telegram Crossposter - TELEGRAM SERVICE MODULE
 * Telegram API сервисы: отправка сообщений, медиа групп, документов
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// TELEGRAM ОТПРАВКА VK ПОСТОВ
// ============================================

function sendVkPostToTelegram(chatId, vkPost, binding) {
  try {
    var botToken = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
    if (!botToken) {
      return { success: false, error: 'Bot token not configured' };
    }

    var text = formatVkPostForTelegram(vkPost, binding);
    var mediaData = getVkMediaUrls(vkPost.attachments);
    
    var allMedia = [];
    allMedia = allMedia.concat(mediaData.photos);
    allMedia = allMedia.concat(mediaData.videos);
    
    var results = [];
    
    try {
      if (allMedia.length > 0) {
        var optimizedResult = sendMixedMediaOptimized(botToken, chatId, allMedia, text, { parsemode: 'HTML' });
        results.push(optimizedResult);
      } else {
        const textResult = sendTelegramMessage(botToken, chatId, text);
        results.push(textResult);
      }
      
      var additionalContent = [];
      if (mediaData.docLinks.length > 0) {
        additionalContent.push(mediaData.docLinks.join('\n'));
      }
      if (mediaData.audioLinks.length > 0) {
        additionalContent.push(mediaData.audioLinks.join('\n'));
      }
      
      if (additionalContent.length > 0) {
        const additionalText = additionalContent.join('\n\n');
        const additionalResult = sendTelegramMessage(botToken, chatId, additionalText);
        results.push(additionalResult);
      }
      
      const successCount = results.filter(function(r) { return r.success; }).length;
      const totalCount = results.length;
      
      var publicationData = {
        vkGroupId: binding.vkGroupId || 'unknown',
        vkPostId: vkPost.id || 'unknown',
        vkPostUrl: `https://vk.com/wall${binding.vkGroupId || 'unknown'}_${vkPost.id || 'unknown'}`,
        vkPostDate: vkPost.date ? new Date(vkPost.date * 1000).toISOString() : new Date().toISOString(),
        mediaSummary: createMediaSummary(vkPost.attachments),
        captionChars: (vkPost.text || '').length,
        captionParts: 1,
        tgChat: chatId,
        tgMessageIds: '',
        tgMessageUrls: '',
        notes: ''
      };
      
      var successfulResults = results.filter(function(r) { return r.success; });
      var messageIds = successfulResults.map(function(r) { return r.message_id; }).filter(function(id) { return id; });
      
      if (messageIds.length > 0) {
        publicationData.tgMessageIds = messageIds.join(',');
        publicationData.tgMessageUrls = generateTelegramMessageUrls(chatId, messageIds);
      }
      
      if (successCount === 0) {
        publicationData.status = 'error';
        publicationData.notes = 'All media parts failed to send';
        if (binding && binding.bindingName) {
          writePublicationRowToBindingSheet(binding.bindingName, publicationData);
        }
        return { success: false, error: 'All media parts failed to send' };
      } else if (successCount < totalCount) {
        publicationData.status = 'partial';
        publicationData.notes = `Partial success: ${successCount}/${totalCount} parts sent`;
        if (binding && binding.bindingName) {
          writePublicationRowToBindingSheet(binding.bindingName, publicationData);
        }
        return { 
          success: true, 
          message_id: results.find(r => r.success)?.message_id,
          warning: `Partial success: ${successCount}/${totalCount} parts sent`,
          results: results
        };
      } else {
        publicationData.status = 'success';
        publicationData.notes = 'Successfully sent all media';
        if (binding && binding.bindingName) {
          writePublicationRowToBindingSheet(binding.bindingName, publicationData);
        }
        return { 
          success: true, 
          message_id: results.find(r => r.success)?.message_id,
          results: results
        };
      }
      
    } catch (mediaError) {
      if (text) {
        var fallbackResult = sendTelegramMessage(botToken, chatId, text);
        var fallbackPublicationData = {
          vkGroupId: binding.vkGroupId || 'unknown',
          vkPostId: vkPost.id || 'unknown',
          vkPostUrl: `https://vk.com/wall${binding.vkGroupId || 'unknown'}_${vkPost.id || 'unknown'}`,
          vkPostDate: vkPost.date ? new Date(vkPost.date * 1000).toISOString() : new Date().toISOString(),
          mediaSummary: createMediaSummary(vkPost.attachments),
          captionChars: (vkPost.text || '').length,
          captionParts: 1,
          tgChat: chatId,
          tgMessageIds: '',
          tgMessageUrls: '',
          notes: ''
        };
        
        if (fallbackResult.success) {
          fallbackPublicationData.status = 'success';
          fallbackPublicationData.notes = 'Successfully sent text only (fallback mode)';
          if (fallbackResult.message_id) {
            fallbackPublicationData.tgMessageIds = fallbackResult.message_id.toString();
            fallbackPublicationData.tgMessageUrls = generateTelegramMessageUrls(chatId, [fallbackResult.message_id]);
          }
        } else {
          fallbackPublicationData.status = 'error';
          fallbackPublicationData.notes = `Fallback text send failed: ${fallbackResult.error || 'Unknown error'}`;
        }
        
        if (binding && binding.bindingName) {
          writePublicationRowToBindingSheet(binding.bindingName, fallbackPublicationData);
        }
        return fallbackResult;
      }
      
      var errorPublicationData = {
        status: 'error',
        vkGroupId: binding.vkGroupId || 'unknown',
        vkPostId: vkPost.id || 'unknown',
        vkPostUrl: `https://vk.com/wall${binding.vkGroupId || 'unknown'}_${vkPost.id || 'unknown'}`,
        vkPostDate: vkPost.date ? new Date(vkPost.date * 1000).toISOString() : new Date().toISOString(),
        mediaSummary: createMediaSummary(vkPost.attachments),
        captionChars: (vkPost.text || '').length,
        captionParts: 1,
        tgChat: chatId,
        tgMessageIds: '',
        tgMessageUrls: '',
        notes: `Media send failed: ${mediaError.message}`
      };
      
      if (binding && binding.bindingName) {
        writePublicationRowToBindingSheet(binding.bindingName, errorPublicationData);
      }
      return { success: false, error: mediaError.message };
    }
    
  } catch (error) {
    if (binding && binding.bindingName && vkPost) {
      var errorPublicationData = {
        status: 'error',
        vkGroupId: binding.vkGroupId || 'unknown',
        vkPostId: vkPost.id || 'unknown',
        vkPostUrl: `https://vk.com/wall${binding.vkGroupId || 'unknown'}_${vkPost.id || 'unknown'}`,
        vkPostDate: vkPost.date ? new Date(vkPost.date * 1000).toISOString() : new Date().toISOString(),
        mediaSummary: createMediaSummary(vkPost.attachments),
        captionChars: (vkPost.text || '').length,
        captionParts: 1,
        tgChat: chatId,
        tgMessageIds: '',
        tgMessageUrls: '',
        notes: `General error: ${error.message}`
      };
      writePublicationRowToBindingSheet(binding.bindingName, errorPublicationData);
    }
    return { success: false, error: error.message };
  }
}

function sendTelegramMessage(token, chatId, text) {
  try {
    var url = `https://api.telegram.org/bot${token}/sendMessage`;
    var payload = { chat_id: chatId, text: text, parse_mode: 'Markdown', disable_web_page_preview: true };
    var response = UrlFetchApp.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, payload: JSON.stringify(payload), muteHttpExceptions: true, timeout: TIMEOUTS.FAST });
    var result = JSON.parse(response.getContentText());
    if (result.ok) {
      return { success: true, message_id: result.result.message_id };
    } else {
      return { success: false, error: result.description || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function sendTelegramMediaGroup(token, chatId, mediaUrls, caption) {
  try {
    if (mediaUrls.length === 0) { return sendTelegramMessage(token, chatId, caption); }
    var MAX_CAPTION_LENGTH = 1024;
    if (caption && caption.length > MAX_CAPTION_LENGTH) {
      var mediaResult = sendMediaGroupWithoutCaption(token, chatId, mediaUrls);
      if (mediaResult.success && caption) { var textResult = sendLongTextMessage(token, chatId, caption); return { success: textResult.success, message_id: mediaResult.message_id, text_message_id: textResult.message_id, split_message: true }; }
      return mediaResult;
    }
    return sendMediaGroupWithCaption(token, chatId, mediaUrls, caption);
  } catch (error) { return { success: false, error: error.message }; }
}

function sendMixedMediaOptimized(botToken, chatId, mediaUrls, caption, options) {
  try {
    if (!mediaUrls || mediaUrls.length === 0) { return sendTelegramMessage(botToken, chatId, caption); }
    var photos = mediaUrls.filter(function(m) { return m.type === 'photo'; });
    var videos = mediaUrls.filter(function(m) { return m.type === 'video'; });
    var results = [];
    var apiCallsSaved = 0;
    var MAX_MEDIA_GROUP_SIZE = 10;
    if (photos.length > 0) {
      var photoGroups = []; for (var i = 0; i < photos.length; i += MAX_MEDIA_GROUP_SIZE) { photoGroups.push(photos.slice(i, i + MAX_MEDIA_GROUP_SIZE)); }
      photoGroups.forEach(function(group, index) { var groupCaption = (index === 0) ? caption : null; var groupResult = sendTelegramMediaGroup(botToken, chatId, group, groupCaption, options); results.push(groupResult); });
      apiCallsSaved = photos.length - photoGroups.length;
    }
    videos.forEach(function(video, index) { var videoCaption = (photos.length === 0 && index === 0) ? caption : null; var videoResult = sendTelegramVideo(botToken, chatId, video.url, videoCaption); results.push(videoResult); if (index < videos.length - 1) { Utilities.sleep(1000); } });
    var successCount = results.filter(function(r) { return r.success; }).length; var totalCount = results.length;
    if (successCount === 0) { return { success: false, error: 'All media parts failed to send' }; } else if (successCount < totalCount) { return { success: true, message_id: results.find(function(r) { return r.success; }).message_id, warning: `Partial success: ${successCount}/${totalCount} parts sent`, results: results, optimization_stats: { api_calls_saved: apiCallsSaved, photo_groups: photos.length > 0 ? Math.ceil(photos.length / MAX_MEDIA_GROUP_SIZE) : 0 } }; } else { return { success: true, message_id: results.find(function(r) { return r.success; }).message_id, results: results, optimization_stats: { api_calls_saved: apiCallsSaved, photo_groups: photos.length > 0 ? Math.ceil(photos.length / MAX_MEDIA_GROUP_SIZE) : 0 } }; }
  } catch (error) { return { success: false, error: error.message }; }
}

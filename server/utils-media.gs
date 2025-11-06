/**
 * VK→Telegram Crossposter - UTILS MEDIA MODULE
 * Утилиты для работы с медиа и создания summary
 * 
 * Размер: ~200 строк
 * Зависимости: utils-core.gs
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// MEDIA UTILITIES
// ============================================

/**
 * Creates media summary string from attachments
 * @param {Array} attachments - VK post attachments
 * @return {string} - media summary
 */
function createMediaSummary(attachments) {
  try {
    if (!attachments || attachments.length === 0) {
      return 'no media';
    }
    
    var counts = {
      photo: 0,
      video: 0,
      audio: 0,
      doc: 0,
      link: 0,
      other: 0
    };
    
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
 * Generates Telegram message URLs from message IDs and chat info
 * @param {string} chatId - Telegram chat ID
 * @param {Array} messageIds - array of message IDs
 * @return {string} - comma-separated URLs
 */
function generateTelegramMessageUrls(chatId, messageIds) {
  try {
    if (!messageIds || messageIds.length === 0) {
      return '';
    }
    
    var urls = [];
    
    // Try to get chat info to determine if we have username
    var chatInfo = null;
    try {
      var botToken = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
      if (botToken) {
        var response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload: JSON.stringify({ chat_id: chatId }),
          muteHttpExceptions: true,
          timeout: TIMEOUTS.FAST
        });
        
        var result = JSON.parse(response.getContentText());
        if (result.ok) {
          chatInfo = result.result;
        }
      }
    } catch (chatError) {
      logEvent('DEBUG', 'tg_chat_info_failed', 'server', `Chat: ${chatId}, Error: ${chatError.message}`);
    }
    
    // Generate URLs
    for (var i = 0; i < messageIds.length; i++) {
      var messageId = messageIds[i];
      
      if (chatInfo && chatInfo.username) {
        // Prefer username format: https://t.me/username/messageId
        urls.push(`https://t.me/${chatInfo.username}/${messageId}`);
      } else {
        // Fallback to internal format: https://t.me/c/chatId/messageId
        // Remove @ if present and handle negative chat IDs
        var cleanChatId = chatId.toString().replace('@', '');
        if (cleanChatId.startsWith('-100')) {
          cleanChatId = cleanChatId.substring(4); // Remove -100 prefix for /c/ format
        }
        urls.push(`https://t.me/c/${cleanChatId}/${messageId}`);
      }
    }
    
    return urls.join(', ');
    
  } catch (error) {
    logEvent('ERROR', 'tg_url_generation_failed', 'server', error.message);
    return '';
  }
}

// ============================================
// PUBLISHED SHEETS LEGACY FUNCTIONS
// ============================================

/**
 * Ensures binding-specific publication sheet exists (uses bindingName as sheet name)
 * @param {string} bindingName - название связки
 * @return {Sheet} - лист с заголовками публикаций
 */
function createPublishedSheet(bindingName) {
  try {
    return getOrCreateBindingSheet(bindingName);
  } catch (error) {
    logEvent('ERROR', 'binding_sheet_creation_failed', 'server', 
      `Binding: ${bindingName}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Gets the last successfully sent post ID from binding sheet
 * @param {string} bindingName - название связки
 * @param {string} vkGroupId - ID группы VK (необязателен, для совместимости)
 * @return {string|null} - последний ID поста или null
 */
function getLastPostIdFromSheet(bindingName, vkGroupId) {
  try {
    var sheetName = getPublishedSheetNameFromBindingName(bindingName);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return null;
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return null;
    }
    
    var rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (var i = 0; i < rows.length; i++) {
      var status = (rows[i][1] || '').toString().toLowerCase();
      var postId = rows[i][3];
      if ((status === 'success' || status === 'partial') && postId) {
        return postId.toString();
      }
    }
    
    return null;
    
  } catch (error) {
    logEvent('ERROR', 'get_last_post_failed', 'server', error.message);
    return null;
  }
}

/**
 * Compatible function for saving post (used by old calls)
 * Delegates writing to universal bindingName sheets system
 */
function saveLastPostIdToSheet(bindingName, vkGroupId, postId, postData) {
  try {
    var publicationData = {
      status: 'success',
      vkGroupId: vkGroupId || '',
      vkPostId: postId,
      vkPostUrl: vkGroupId ? `https://vk.com/wall${vkGroupId}_${postId}` : '',
      vkPostDate: postData?.vkPostDate || new Date().toISOString(),
      mediaSummary: postData?.mediaSummary || 'legacy-entry',
      captionChars: postData?.captionChars || 0,
      captionParts: postData?.captionParts || 1,
      tgChat: postData?.tgChat || postData?.tgChatName || '',
      tgMessageIds: Array.isArray(postData?.tgMessageIds) ? postData.tgMessageIds.join(',') : (postData?.tgMessageIds || ''),
      tgMessageUrls: Array.isArray(postData?.tgMessageUrls) ? postData.tgMessageUrls.join(', ') : (postData?.tgMessageUrls || ''),
      notes: postData?.notes || (postData?.preview ? `Legacy entry: ${postData.preview}` : 'Legacy saveLastPostIdToSheet call')
    };
    
    var targetBindingName = sanitizeBindingSheetSuffix(bindingName);
    writePublicationRowToBindingSheet(targetBindingName, publicationData);
    
    logEvent('INFO', 'post_saved_to_binding_sheet', 'server', 
      `Post ${postId} saved to binding sheet ${targetBindingName} via legacy helper`);
    
  } catch (error) {
    logEvent('ERROR', 'save_post_failed', 'server', error.message);
  }
}
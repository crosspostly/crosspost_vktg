/**
 * ИСПРАВЛЕНИЕ 1: Telegram Caption Length Fix
 * Заменить функцию sendTelegramMediaGroup в server.gs (примерно строки 750-780)
 */

function sendTelegramMediaGroup(token, chatId, mediaUrls, caption) {
  try {
    if (mediaUrls.length === 0) {
      return sendTelegramMessage(token, chatId, caption);
    }
    
    const MAX_CAPTION_LENGTH = 1024; // Лимит Telegram для caption
    
    // Проверяем длину caption
    if (caption && caption.length > MAX_CAPTION_LENGTH) {
      logEvent("WARN", "caption_too_long", "server", 
               `Caption length: ${caption.length}, splitting media and text`);
      
      // Отправляем медиа БЕЗ подписи
      const mediaResult = sendMediaGroupWithoutCaption(token, chatId, mediaUrls);
      
      if (mediaResult.success) {
        // Отправляем текст отдельным сообщением (или несколькими, если очень длинный)
        const textResult = sendLongTextMessage(token, chatId, caption);
        
        return {
          success: textResult.success,
          message_id: mediaResult.message_id, // ID первого сообщения (медиа)
          text_message_id: textResult.message_id,
          split_message: true
        };
      }
      
      return mediaResult;
    }
    
    // Обычная отправка с подписью (если caption <= 1024)
    return sendMediaGroupWithCaption(token, chatId, mediaUrls, caption);
    
  } catch (error) {
    logEvent("ERROR", "send_media_group_error", "server", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет media group БЕЗ caption
 */
function sendMediaGroupWithoutCaption(token, chatId, mediaUrls) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    
    const media = mediaUrls.slice(0, 10).map((item) => ({
      type: item.type,
      media: item.url
      // НЕ добавляем caption и parse_mode
    }));
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: chatId,
        media: media
      }),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      logEvent("INFO", "media_group_sent_no_caption", "server", 
               `Media count: ${media.length}, Message ID: ${result.result[0].message_id}`);
      return { success: true, message_id: result.result[0].message_id };
    } else {
      logEvent("ERROR", "media_group_failed_no_caption", "server", 
               `Error: ${result.description}, Code: ${result.error_code}`);
      return { success: false, error: result.description || "Media group send failed" };
    }
    
  } catch (error) {
    logEvent("ERROR", "media_group_exception", "server", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет media group С caption (стандартный способ)
 */
function sendMediaGroupWithCaption(token, chatId, mediaUrls, caption) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    
    const media = mediaUrls.slice(0, 10).map((item, index) => ({
      type: item.type,
      media: item.url,
      caption: index === 0 ? caption : undefined,
      parse_mode: index === 0 ? 'Markdown' : undefined
    }));
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: chatId,
        media: media
      }),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      logEvent("INFO", "media_group_sent_with_caption", "server", 
               `Media count: ${media.length}, Caption length: ${caption?.length || 0}, Message ID: ${result.result[0].message_id}`);
      return { success: true, message_id: result.result[0].message_id };
    } else {
      logEvent("ERROR", "media_group_failed_with_caption", "server", 
               `Error: ${result.description}, Code: ${result.error_code}, Caption length: ${caption?.length || 0}`);
      return { success: false, error: result.description || "Media group send failed" };
    }
    
  } catch (error) {
    logEvent("ERROR", "media_group_with_caption_exception", "server", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет длинное текстовое сообщение, разбивая если нужно
 */
function sendLongTextMessage(token, chatId, text) {
  try {
    const MAX_MESSAGE_LENGTH = 4096; // Лимит Telegram для текстовых сообщений
    
    if (!text || text.length === 0) {
      return { success: true, message_id: null };
    }
    
    // Если текст помещается в одно сообщение
    if (text.length <= MAX_MESSAGE_LENGTH) {
      return sendTelegramMessage(token, chatId, text);
    }
    
    // Разбиваем длинный текст на части
    logEvent("WARN", "splitting_long_text", "server", 
             `Text length: ${text.length}, splitting into multiple messages`);
    
    const textParts = splitTextIntoChunks(text, MAX_MESSAGE_LENGTH);
    let lastMessageId = null;
    
    for (let i = 0; i < textParts.length; i++) {
      const part = textParts[i];
      const partPrefix = textParts.length > 1 ? `📝 ${i + 1}/${textParts.length}: ` : '';
      
      const result = sendTelegramMessage(token, chatId, partPrefix + part);
      
      if (!result.success) {
        logEvent("ERROR", "text_part_send_failed", "server", 
                 `Part ${i + 1}/${textParts.length}, Error: ${result.error}`);
        return result; // Возвращаем ошибку если хотя бы одна часть не отправилась
      }
      
      lastMessageId = result.message_id;
      
      // Небольшая пауза между сообщениями
      if (i < textParts.length - 1) {
        Utilities.sleep(500); // 0.5 секунды
      }
    }
    
    logEvent("INFO", "long_text_sent_successfully", "server", 
             `Sent ${textParts.length} text parts, last message ID: ${lastMessageId}`);
    
    return { success: true, message_id: lastMessageId, parts_count: textParts.length };
    
  } catch (error) {
    logEvent("ERROR", "send_long_text_error", "server", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Разбивает текст на части, стараясь сохранить целостность предложений
 */
function splitTextIntoChunks(text, maxLength) {
  const chunks = [];
  let currentChunk = "";
  
  // Разбиваем текст по предложениям
  const sentences = text.split(/([.!?]\s+)/);
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Если добавление предложения не превысит лимит
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      // Сохраняем текущий chunk если он не пустой
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      
      // Если само предложение длиннее лимита - принудительно разбиваем
      if (sentence.length > maxLength) {
        const forcedChunks = sentence.match(new RegExp(`.{1,${maxLength}}`, 'g'));
        chunks.push(...forcedChunks);
        currentChunk = "";
      } else {
        currentChunk = sentence;
      }
    }
  }
  
  // Добавляем последний chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  // Если ничего не получилось - принудительно разбиваем по символам
  if (chunks.length === 0 && text.length > 0) {
    const forcedChunks = text.match(new RegExp(`.{1,${maxLength}}`, 'g'));
    chunks.push(...forcedChunks);
  }
  
  return chunks;
}
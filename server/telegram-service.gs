/**
 * VK→Telegram Crossposter - TELEGRAM SERVICE MODULE (continued)
 * Дополнение: media group helpers, long text, video/document, chat utils
 */

/**
 * Отправка медиа группы без подписи
 * @param {string} token - Telegram bot token
 * @param {string} chatId - ID чата
 * @param {Array<Object>} mediaUrls - Массив медиа объектов
 * @returns {Object} - Результат отправки
 * @returns {boolean} returns.success - Успешность отправки
 * @returns {number} [returns.message_id] - ID сообщения
 * @returns {string} [returns.error] - Ошибка если была
 */
function sendMediaGroupWithoutCaption(token, chatId, mediaUrls) {
  try {
    var url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    var media = mediaUrls.slice(0, 10).map(item => ({ type: item.type, media: item.url }));
    var response = UrlFetchApp.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, payload: JSON.stringify({ chat_id: chatId, media: media }), muteHttpExceptions: true, timeout: TIMEOUTS.MEDIUM });
    var result = JSON.parse(response.getContentText());
    if (result.ok) { return { success: true, message_id: result.result[0].message_id }; }
    return { success: false, error: result.description || 'Media group failed' };
  } catch (e) { return { success: false, error: e.message }; }
}

/**
 * Отправка медиа группы с подписью
 * @param {string} token - Telegram bot token
 * @param {string} chatId - ID чата
 * @param {Array<Object>} mediaUrls - Массив медиа объектов
 * @param {string} caption - Подпись к медиа
 * @returns {Object} - Результат отправки
 * @returns {boolean} returns.success - Успешность отправки
 * @returns {number} [returns.message_id] - ID сообщения
 * @returns {string} [returns.error] - Ошибка если была
 */
function sendMediaGroupWithCaption(token, chatId, mediaUrls, caption) {
  try {
    var url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    var media = mediaUrls.slice(0, 10).map((item, i) => ({ type: item.type, media: item.url, caption: i === 0 ? caption : undefined, parse_mode: i === 0 ? 'Markdown' : undefined }));
    var response = UrlFetchApp.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, payload: JSON.stringify({ chat_id: chatId, media }), muteHttpExceptions: true, timeout: REQUEST_TIMEOUT });
    var result = JSON.parse(response.getContentText());
    if (result.ok) { return { success: true, message_id: result.result[0].message_id }; }
    return { success: false, error: result.description || 'Media group failed' };
  } catch (e) { return { success: false, error: e.message }; }
}

/**
 * Отправка длинного текстового сообщения
 * @param {string} token - Telegram bot token
 * @param {string} chatId - ID чата
 * @param {string} text - Текст сообщения
 * @returns {Object} - Результат отправки
 * @returns {boolean} returns.success - Успешность отправки
 * @returns {number} [returns.message_id] - ID последнего сообщения
 * @returns {number} [returns.parts_count] - Количество частей
 * @returns {string} [returns.error] - Ошибка если была
 */
function sendLongTextMessage(token, chatId, text) {
  try {
    var MAX_MESSAGE_LENGTH = 4096;
    if (!text || text.length === 0) { return { success: true, message_id: null }; }
    if (text.length <= MAX_MESSAGE_LENGTH) { return sendTelegramMessage(token, chatId, text); }
    var parts = splitTextIntoChunks(text, MAX_MESSAGE_LENGTH);
    var lastId = null;
    for (var i = 0; i < parts.length; i++) { var res = sendTelegramMessage(token, chatId, (parts.length>1?`(${i+1}/${parts.length}) `:'') + parts[i]); if (!res.success) return res; lastId = res.message_id; Utilities.sleep(400); }
    return { success: true, message_id: lastId, parts_count: parts.length };
  } catch (e) { return { success: false, error: e.message }; }
}

function splitTextIntoChunks(text, maxLength) {
  if (!text) return [''];
  if (text.length <= maxLength) return [text];
  var chunks = [];
  var cursor = 0;
  while (cursor < text.length) {
    var end = Math.min(cursor + maxLength, text.length);
    var slice = text.substring(cursor, end);
    var breakPoint = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
    if (breakPoint > maxLength * 0.6) { end = cursor + breakPoint; slice = text.substring(cursor, end); }
    chunks.push(slice.trim());
    cursor = end;
    if (text[cursor] === ' ' || text[cursor] === '\n') cursor++;
  }
  return chunks.filter(Boolean);
}

function sendTelegramVideo(token, chatId, videoUrl, caption) {
  try {
    var url = `https://api.telegram.org/bot${token}/sendVideo`;
    var payload = { chat_id: chatId, video: videoUrl };
    if (caption) { payload.caption = caption; payload.parse_mode = 'Markdown'; }
    var response = UrlFetchApp.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, payload: JSON.stringify(payload), muteHttpExceptions: true, timeout: TIMEOUTS.SLOW });
    var result = JSON.parse(response.getContentText());
    if (result.ok) { return { success: true, message_id: result.result.message_id }; }
    return { success: false, error: result.description || 'Video send failed' };
  } catch (e) { return { success: false, error: e.message }; }
}

function sendTelegramDocument(token, chatId, documentUrl, caption) {
  try {
    var url = `https://api.telegram.org/bot${token}/sendDocument`;
    var payload = { chat_id: chatId, document: documentUrl };
    if (caption) { payload.caption = caption; payload.parse_mode = 'HTML'; }
    var response = UrlFetchApp.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, payload: JSON.stringify(payload), muteHttpExceptions: true, timeout: TIMEOUTS.MEDIUM });
    var result = JSON.parse(response.getContentText());
    if (result.ok) { return { success: true, message_id: result.result.message_id }; }
    return { success: false, error: result.description || 'Document send failed' };
  } catch (e) { return { success: false, error: e.message }; }
}

function getTelegramChatName(chatId) {
  try {
    var botToken = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
    if (!botToken) return null;
    var response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getChat`, { method: 'POST', headers: {'Content-Type':'application/json'}, payload: JSON.stringify({ chat_id: chatId }), muteHttpExceptions: true, timeout: 8000 });
    var result = JSON.parse(response.getContentText());
    if (result.ok) { var chat = result.result; return chat.title || (chat.first_name && chat.last_name ? `${chat.first_name} ${chat.last_name}`.trim() : (chat.username?('@'+chat.username):'Unknown Chat')); }
    return null;
  } catch (e) { return null; }
}

function getCachedTelegramChatName(chatId) {
  try {
    var props = PropertiesService.getScriptProperties();
    var key = `tg_name_${chatId}`;
    var cached = props.getProperty(key);
    if (cached) return cached;
    var fresh = getTelegramChatName(chatId);
    if (fresh) props.setProperty(key, fresh);
    return fresh || chatId.toString();
  } catch (e) { return chatId.toString(); }
}

function generateTelegramMessageUrls(chatId, messageIds) {
  try {
    if (!messageIds || messageIds.length === 0) return '';
    var botToken = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
    var username = null;
    try {
      var response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getChat`, { method: 'POST', headers: {'Content-Type':'application/json'}, payload: JSON.stringify({ chat_id: chatId }), muteHttpExceptions: true, timeout: TIMEOUTS.FAST });
      var result = JSON.parse(response.getContentText());
      if (result.ok && result.result.username) username = result.result.username;
    } catch (e) {
      // Ignore errors when fetching chat info
    }
    var cleanChatId = chatId.toString().replace('-', '');
    if (cleanChatId.startsWith('100')) cleanChatId = cleanChatId.substring(4);
    var urls = messageIds.map(function(id){ return username ? `https://t.me/${username}/${id}` : `https://t.me/c/${cleanChatId}/${id}`; });
    return urls.join(', ');
  } catch (e) { return ''; }
}

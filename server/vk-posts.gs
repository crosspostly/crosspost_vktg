/**
 * VK→Telegram Crossposter - VK POSTS MODULE
 * Форматирование и обработка VK постов
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// VK TEXT PROCESSING
// ============================================

/**
 * Форматирование VK текста для Telegram
 * @param {string} text - Исходный VK текст
 * @param {FormatOptions} options - Опции форматирования
 * @returns {string} - Отформатированный текст
 */
function formatVkTextForTelegram(text, options) {
  if (!text) return '';
  
  options = options || {};
  var boldFirstLine = options.boldFirstLine !== false; // true по умолчанию
  var boldUppercase = options.boldUppercase !== false; // true по умолчанию

  // Сохраняем оригинальные переносы строк - НЕ удаляем их!
  // VK использует \n для переносов строк, сохраняем их как есть
  
  // Выделяем первую строку жирным (HTML формат)
  if (boldFirstLine) {
    text = text.replace(/(^.+?)([\r\n]|$)/, '<b>$1</b>$2');
  }
  
  // Выделяем слова из заглавных букв (2+ символа) в HTML формате
  if (boldUppercase) {
    text = text.replace(/\b[A-ZА-Я]{2,}\b/g, '<b>$&</b>');
  }
  
  // Сначала обрабатываем специфичные VK упоминания пользователей и групп
  text = text.replace(/\[id(\d+)\|(.+?)\]/g, '<a href="https://vk.com/id$1">$2</a>');
  text = text.replace(/\[(club|public)(\d+)\|(.+?)\]/g, function(match, type, id, title) {
    // Для club и public используем правильные URL
    return `<a href="https://vk.com/${type}${id}">${title}</a>`;
  });
  
  // КРИТИЧЕСКИ ВАЖНО: Обрабатываем VK ссылки БЕЗ протокола ПЕРЕД общими
  // [vk.com/...|текст] → https://vk.com/...
  text = text.replace(/\[vk\.com\/([^\]|]+)\|([^\]]+)\]/g, '<a href="https://vk.com/$1">$2</a>');
  
  // Затем обрабатываем VK ссылки С протоколом
  // [https://vk.com/...|текст] → https://vk.com/...
  text = text.replace(/\[(https?:\/\/vk\.com\/[^\]|]+)\|([^\]]+)\]/g, '<a href="$1">$2</a>');
  
  // Затем преобразуем общие гиперссылки [URL|Текст] в HTML <a href="URL">Текст</a>
  text = text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '<a href="$1">$2</a>');
  
  // НЕ удаляем переносы строк и НЕ сокращаем множественные пробелы
  // Сохраняем оригинальное форматирование VK поста
  
  return text;
}

/**
 * Форматирование VK поста для Telegram
 * @param {VkPost} vkPost - VK пост
 * @param {BindingConfig} binding - Связка с настройками
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
 * @param {Array<VkAttachment>} attachments - VK вложения
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
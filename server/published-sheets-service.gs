// @ts-nocheck
/**
 * VK→Telegram Crossposter - PUBLISHED SHEETS SERVICE MODULE
 * Работа с листами публикаций: создание, запись, проверка дублей
 */

function getPublishedSheetNameFromBindingName(bindingName) {
  var sanitized = sanitizeBindingSheetSuffix(bindingName);
  if (!validateBindingName(sanitized)) throw new Error('Unable to resolve binding sheet name (invalid characters after sanitization)');
  return getPublishedSheetNameFromSuffix(sanitized);
}

function getPublishedSheetNameFromSuffix(suffix) { return 'Published ' + suffix; }

function sanitizeBindingSheetSuffix(name) { return (name || '').toString().replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().substring(0, 80); }

function validateBindingName(name) { return !!(name && name.length > 0); }

function getOrCreateBindingSheet(bindingName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = getPublishedSheetNameFromBindingName(bindingName);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(['timestamp','status','bindingName','vkPostId','vkGroupId','vkPostUrl','vkPostDate','mediaSummary','captionChars','captionParts','tgChat','tgMessageIds','tgMessageUrls','notes']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function writePublicationRowToBindingSheet(bindingName, data) {
  try {
    var sheet = getOrCreateBindingSheet(bindingName);
    sheet.appendRow([
      new Date().toISOString(),
      data.status || 'unknown',
      bindingName,
      data.vkPostId || '',
      data.vkGroupId || '',
      data.vkPostUrl || '',
      data.vkPostDate || '',
      data.mediaSummary || '',
      data.captionChars || 0,
      data.captionParts || 1,
      data.tgChat || '',
      data.tgMessageIds || '',
      data.tgMessageUrls || '',
      data.notes || ''
    ]);
    return true;
  } catch (e) {
    logEvent('ERROR', 'write_publication_row_failed', 'server', e.message);
    return false;
  }
}

function saveLastPostIdToSheet(bindingName, postId) {
  try {
    var sheet = getOrCreateBindingSheet(bindingName);
    sheet.getRange(1, 15).setValue(`last_post_id=${postId}`); // служебная ячейка в заголовке
    return true;
  } catch (e) { logEvent('WARN', 'save_last_post_id_failed', 'server', e.message); return false; }
}

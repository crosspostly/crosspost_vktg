/**
 * VK→Telegram Crossposter - UTILS BINDING MODULE
 * Утилиты для работы с binding sheets и публикациями
 * 
 * Размер: ~300 строк
 * Зависимости: utils-core.gs
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// BINDING SHEET UTILITIES
// ============================================

/**
 * Validates binding name according to requirements: letters (Latin/Cyrillic) and digits only
 * @param {string} bindingName - binding name to validate
 * @return {boolean} - true if valid
 */
function validateBindingName(bindingName) {
  if (!bindingName || typeof bindingName !== 'string') {
    return false;
  }
  
  // Allow Latin letters, Cyrillic letters, and digits only
  const validPattern = /^[a-zA-Zа-яА-ЯёЁ0-9]+$/;
  return validPattern.test(bindingName.trim());
}

/**
 * Creates or gets a binding sheet for publication logging
 * @param {string} bindingName - validated binding name (used as sheet name)
 * @return {Sheet} - sheet object
 */
function getOrCreateBindingSheet(bindingName) {
  try {
    var sanitizedName = sanitizeBindingSheetSuffix(bindingName);
    if (!validateBindingName(sanitizedName)) {
      throw new Error(`Invalid binding name: "${bindingName}". Only letters and digits allowed.`);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sanitizedName);
    
    if (!sheet) {
      var legacySheet = ss.getSheetByName('Published_' + sanitizedName);
      if (legacySheet) {
        // Rename legacy sheet
        legacySheet.setName(sanitizedName);
        sheet = legacySheet;
        logEvent('INFO', 'legacy_sheet_renamed', 'server', 
          `Renamed "Published_${sanitizedName}" to "${sanitizedName}"`);
      } else {
        // Create new sheet
        sheet = ss.insertSheet(sanitizedName);
        
        // Add headers
        var headers = [
          "Timestamp", "Status", "VK Group ID", "VK Post ID", "VK Post URL", "VK Post Date",
          "Media Summary", "Caption Chars", "Caption Parts", "TG Chat", "TG Message IDs", 
          "TG Message URLs", "Notes"
        ];
        
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#4285f4");
        headerRange.setFontColor("white");
        
        logEvent('INFO', 'binding_sheet_created', 'server', 
          `Created binding sheet "${sanitizedName}" with ${headers.length} columns`);
      }
    }
    
    return sheet;
    
  } catch (error) {
    logEvent('ERROR', 'binding_sheet_creation_failed', 'server', 
      `Binding: ${bindingName}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Sanitizes binding sheet suffix
 * @param {string} bindingName - binding name to sanitize
 * @return {string} - sanitized name
 */
function sanitizeBindingSheetSuffix(bindingName) {
  if (!bindingName) return 'Unnamed';
  
  return bindingName
    .trim()
    .replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
}

/**
 * Gets sheet name from binding name
 * @param {string} bindingName - binding name
 * @return {string} - sheet name
 */
function getPublishedSheetNameFromBindingName(bindingName) {
  return sanitizeBindingSheetSuffix(bindingName);
}

/**
 * Writes a publication row to binding sheet with top-insert behavior
 * @param {string} bindingName - validated binding name
 * @param {Object} publicationData - publication data
 */
function writePublicationRowToBindingSheet(bindingName, publicationData) {
  try {
    var sanitizedName = sanitizeBindingSheetSuffix(bindingName);
    if (!validateBindingName(sanitizedName)) {
      logEvent('WARN', 'invalid_binding_name_skip', 'server', 
        `Skipping publication row for invalid binding name: "${bindingName}"`);
      return;
    }
    
    var sheet = getOrCreateBindingSheet(sanitizedName);
    
    // Prepare row data according to column order
    var rowData = [
      publicationData.timestamp || new Date().toISOString(),
      publicationData.status || 'unknown',
      publicationData.vkGroupId || '',
      publicationData.vkPostId || '',
      publicationData.vkPostUrl || '',
      publicationData.vkPostDate || '',
      publicationData.mediaSummary || '',
      publicationData.captionChars || 0,
      publicationData.captionParts || 0,
      publicationData.tgChat || '',
      publicationData.tgMessageIds || '',
      publicationData.tgMessageUrls || '',
      publicationData.notes || ''
    ];
    
    // Insert at row 2 (top-insert behavior)
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
    
    logEvent('INFO', 'publication_row_written', 'server', 
      `Binding: "${sanitizedName}", Status: ${publicationData.status}, VK Post: ${publicationData.vkPostId}`);
    
  } catch (error) {
    logEvent('ERROR', 'publication_row_write_failed', 'server', 
      `Binding: "${bindingName}", Error: ${error.message}`);
    // Don't throw - publication logging failure shouldn't break main flow
  }
}

/**
 * Checks if post was already sent (success/partial status)
 * @param {string} bindingName - binding name
 * @param {string} postId - post ID
 * @return {boolean} - true if post was already sent
 */
function checkPostAlreadySent(bindingName, postId) {
  try {
    if (!postId) {
      return false;
    }
    
    var sheetName = getPublishedSheetNameFromBindingName(bindingName);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return false;
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return false;
    }
    
    var rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (var i = 0; i < rows.length; i++) {
      var status = (rows[i][1] || '').toString().toLowerCase();
      var loggedPostId = rows[i][3];
      if ((status === 'success' || status === 'partial') && loggedPostId && loggedPostId.toString() === postId.toString()) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    logEvent('ERROR', 'check_post_sent_failed', 'server', error.message);
    return false;
  }
}
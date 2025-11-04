/**
 * УДАЛЯЕМЫЕ ФУНКЦИИ ИЗ CLIENT.GS v6.1
 * Критические исправления: убрать кеши Properties, удалить орфан-клинап
 * 
 * Дата: 2025-11-04
 * Автор: f_den
 * 
 * ИНСТРУКЦИЯ: Удалить эти функции из CLIENT.GS
 */

// ============================================
// ❗ УДАЛИТЬ ПОЛНОСТЬЮ:
// ============================================

/**
 * ❌ УДАЛИТЬ: cleanupOrphanedCache()
 * Причина: Не нужна при листах с именами групп
 */
function cleanupOrphanedCache() {
  try {
    logEvent("INFO", "orphaned_cache_cleanup_start", "client", "Starting cleanup of orphaned cache entries");
    
    var bindingsResult = getBindingsWithNames();
    if (!bindingsResult.success) {
      logEvent("ERROR", "cleanup_no_bindings", "client", bindingsResult.error);
      return { success: false, error: bindingsResult.error };
    }
    
    // Получаем активные группы VK
    var activeGroups = [];
    bindingsResult.bindings.forEach(function(binding) {
      var vkGroupId = extractVkGroupId(binding.vkGroupUrl || binding.vk_group_url);
      if (vkGroupId && activeGroups.indexOf(vkGroupId) === -1) {
        activeGroups.push(vkGroupId);
      }
    });
    
    logEvent("DEBUG", "active_groups_identified", "client", "Found " + activeGroups.length + " active VK groups: [" + activeGroups.join(', ') + "]");
    
    var ss = SpreadsheetApp.getActive();
    var sheets = ss.getSheets();
    var cleaned = 0;
    var checked = 0;
    
    sheets.forEach(function(sheet) {
      var sheetName = sheet.getName();
      
      // Проверяем листы Published_*
      if (sheetName.startsWith("Published_")) {
        checked++;
        
        // Извлекаем ID группы из названия листа
        var groupIdMatch = sheetName.match(/Published_(-?\d+)/);
        
        if (groupIdMatch) {
          var groupId = groupIdMatch[1];
          
          if (activeGroups.indexOf(groupId) === -1) {
            logEvent("INFO", "removing_orphaned_cache_sheet", "client", 
                    "Deleting unused cache sheet: " + sheetName + " (Group ID: " + groupId + ")");
            ss.deleteSheet(sheet);
            cleaned++;
          } else {
            logEvent("DEBUG", "cache_sheet_active", "client", "Keeping active cache sheet: " + sheetName);
          }
        }
      }
    });
    
    logEvent("INFO", "orphaned_cache_cleanup_complete", "client", 
            "Cleanup complete. Checked " + checked + " cache sheets, cleaned " + cleaned + " orphaned sheets");
    
    return { success: true, checked: checked, cleaned: cleaned };
    
  } catch (error) {
    logEvent("ERROR", "orphaned_cache_cleanup_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// ❌ УДАЛИТЬ ВСЕ ФУНКЦИИ, КОТОРЫЕ РАБОТАЮТ С PropertiesService ДЛЯ lastPostIds:
// ============================================

// Примеры функций, которые МОГУТ быть в коде (искать по ключевым словам):

/*
// ❌ УДАЛИТЬ ЕСЛИ НАЙДЕНО:
function getCachedLastPostIds() {
  // ... PropertiesService.getScriptProperties().getProperty("lastPostIds_" + groupId) ...
}

function setCachedLastPostIds(groupId, lastPostId) {
  // ... PropertiesService.getScriptProperties().setProperty("lastPostIds_" + groupId, lastPostId) ...
}

function clearCachedLastPostIds(groupId) {
  // ... PropertiesService.getScriptProperties().deleteProperty("lastPostIds_" + groupId) ...
}
*/

// ПОИСК ПО КЛЮЧЕВЫМ СЛОВАМ ДЛЯ УДАЛЕНИЯ:
// - "lastPostIds_"
// - "PropertiesService" + "lastPost"
// - "getScriptProperties()" + "lastPost"
// - "setProperty" + "lastPost"
// - "deleteProperty" + "lastPost"

// ЗАМЕНИТЬ ЛЮБЫЕ ОПЕРАЦИИ НА:
// - isPostAlreadySent(sheetName, postId)  // Из нового файла
// - markPostAsSent(sheetName, postId, meta)  // Из нового файла
/**
 * VK→Telegram Crossposter - UTILS STATS MODULE
 * Статистика и логирование
 * 
 * Размер: ~300 строк
 * Зависимости: utils-core.gs
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// STATISTICS
// ============================================

function getSystemStats() {
  try {
    var licensesSheet = getSheet("Licenses");
    var bindingsSheet = getSheet("Bindings");
    var logsSheet = getSheet("Logs");
    
    var licensesData = licensesSheet.getDataRange().getValues().slice(1);
    var bindingsData = bindingsSheet.getDataRange().getValues().slice(1);
    var logsData = logsSheet.getDataRange().getValues().slice(1);
    
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
      totalLicenses: licensesData.length,
      activeLicenses: licensesData.filter(lic => lic[6] === "active").length,
      expiredLicenses: licensesData.filter(lic => new Date(lic[4]) < now).length,
      
      totalBindings: bindingsData.length,
      activeBindings: bindingsData.filter(b => b[5] === "active").length,
      pausedBindings: bindingsData.filter(b => b[5] === "paused").length,
      
      postsToday: logsData.filter(log => 
        log[2] === "post_sent" && new Date(log[0]) >= today
      ).length,
      
      lastPostTime: logsData
        .filter(log => log[2] === "post_sent")
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))[0]?.[0] || "Нет данных",
      
      topUser: findTopUser(bindingsData)
    };
    
  } catch (error) {
    logEvent("ERROR", "stats_error", "system", error.message);
    return {
      totalLicenses: 0, activeLicenses: 0, expiredLicenses: 0,
      totalBindings: 0, activeBindings: 0, pausedBindings: 0,
      postsToday: 0, lastPostTime: "Ошибка", topUser: "Ошибка"
    };
  }
}

function showStatistics() {
  var stats = getSystemStats();
    
  var message = '📊 Статистика сервера v' + SERVER_VERSION + '\n\n';
  message += '🔑 Лицензии:\n';
  message += '• Всего: ' + stats.totalLicenses + '\n';
  message += '• Активных: ' + stats.activeLicenses + '\n';
  message += '• Истекших: ' + stats.expiredLicenses + '\n\n';
  message += '🔗 Связки:\n';
  message += '• Всего: ' + stats.totalBindings + '\n';
  message += '• Активных: ' + stats.activeBindings + '\n';
  message += '• На паузе: ' + stats.pausedBindings + '\n\n';
  message += '📈 Активность:\n';
  message += '• Постов отправлено сегодня: ' + stats.postsToday + '\n';
  message += '• Последний пост: ' + stats.lastPostTime + '\n\n';
  message += '🏆 Топ пользователь: ' + stats.topUser;
  
  SpreadsheetApp.getUi().alert(message);
}

function showLogsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logsSheet = ss.getSheetByName("Logs");
  
  if (logsSheet) {
    ss.setActiveSheet(logsSheet);
  } else {
    SpreadsheetApp.getUi().alert("❌ Лист 'Logs' не найден. Выполните инициализацию сервера.");
  }
}

function findTopUser(bindingsData) {
  var userCounts = {};
  
  bindingsData.forEach(binding => {
    var email = binding[2];
    userCounts[email] = (userCounts[email] || 0) + 1;
  });
  
  var topEntry = Object.entries(userCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  return topEntry ? `${topEntry[0]} (${topEntry[1]} связок)` : "Нет данных";
}

// ============================================
// LOG CLEANUP
// ============================================

function cleanOldLogs() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var allSheets = ss.getSheets();
    var logSheets = [];
    
    // Ищем все листы с логами
    for (var i = 0; i < allSheets.length; i++) {
      var sheetName = allSheets[i].getName();
      if (sheetName === "Logs" || sheetName === "Client Logs" || sheetName.toLowerCase().includes("log")) {
        logSheets.push(allSheets[i]);
      }
    }
    
    if (logSheets.length === 0) {
      logEvent("WARN", "no_log_sheets_found", "system", "No log sheets found for cleanup");
      return { totalDeleted: 0, sheetsProcessed: 0 };
    }
    
    var thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    var totalDeleted = 0;
    
    logEvent("INFO", "log_cleanup_started", "system", `Starting cleanup of ${logSheets.length} log sheets`);
    
    // Обрабатываем каждый лог-лист
    for (var j = 0; j < logSheets.length; j++) {
      var sheet = logSheets[j];
      var sheetName = sheet.getName();
      var sheetDeletedCount = 0;
      
      try {
        var dataRange = sheet.getDataRange();
        var data = dataRange.getValues();
        
        if (data.length <= 1) { // Только заголовок или пустой лист
          continue;
        }
        
        // Удаляем старые записи (начиная с конца, чтобы не сбивать индексы)
        for (var i = data.length - 1; i >= 1; i--) {
          try {
            var logDate = new Date(data[i][0]);
            
            if (isNaN(logDate.getTime())) {
              continue;
            }
            
            if (logDate < thirtyDaysAgo) {
              sheet.deleteRow(i + 1);
              sheetDeletedCount++;
            }
          } catch (rowError) {
            logEvent("WARN", "log_cleanup_row_error", "system", `Error processing row ${i + 1} in sheet "${sheetName}": ${rowError.message}`);
          }
        }
        
        totalDeleted += sheetDeletedCount;
        
        logEvent("INFO", "log_cleanup_sheet_completed", "system", `Sheet "${sheetName}": deleted ${sheetDeletedCount} entries`);
        
      } catch (sheetError) {
        logEvent("ERROR", "log_cleanup_sheet_error", "system", `Error processing sheet "${sheetName}": ${sheetError.message}`);
      }
    }
    
    logEvent("INFO", "log_cleanup_completed", "system", `Cleanup complete: ${totalDeleted} entries deleted from ${logSheets.length} sheets`);
    
    return {
      success: true,
      totalDeleted: totalDeleted,
      sheetsProcessed: logSheets.length
    };
    
  } catch (error) {
    logEvent("ERROR", "log_cleanup_failed", "system", error.message);
    return { success: false, error: error.message, totalDeleted: 0, sheetsProcessed: 0 };
  }
}
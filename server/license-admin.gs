/**
 * VK→Telegram Crossposter - LICENSE ADMIN MODULE
 * Админские функции и UI
 * 
 * Размер: ~300 строк
 * Зависимости: utils-core.gs, utils-stats.gs, license-core.gs, license-handlers.gs, license-security.gs
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// ADMIN PANEL
// ============================================

function showAdminPanel() {
  try {
    var stats = getSystemStats();
    var html = getAdminPanelHtml(stats);
    
    var htmlOutput = HtmlService.createHtmlOutput(html);
    htmlOutput.setWidth(900).setHeight(700);
    
    SpreadsheetApp.getUi()
      .showModelessDialog(htmlOutput, "🎛️ Админ панель");
      
  } catch (error) {
    logEvent("ERROR", "admin_panel_error", "system", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка админ панели: " + error.message);
  }
}

function getAdminPanelHtml(stats) {
  var html = '<!DOCTYPE html>\n';
  html += '<html lang="ru">\n';
  html += '<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  html += '<title>Админ панель</title>\n';
  html += '<style>\n';
  html += 'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }\n';
  html += '.container { max-width: 900px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 0 auto; }\n';
  html += 'h1, h2 { color: #333; }\n';
  html += 'h1 { font-size: 24px; margin-top: 0; }\n';
  html += 'h2 { font-size: 18px; margin-top: 30px; border-bottom: 2px solid #667eea; padding-bottom: 5px; }\n';
  html += '.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }\n';
  html += '.stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }\n';
  html += '.stat-number { font-size: 32px; font-weight: bold; color: #667eea; margin-bottom: 5px; }\n';
  html += '.stat-label { font-size: 14px; color: #666; margin-bottom: 10px; }\n';
  html += '.stat-detail { font-size: 12px; color: #888; }\n';
  html += 'table { width: 100%; border-collapse: collapse; margin: 10px 0; }\n';
  html += 'th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }\n';
  html += 'th { background: #f8f9fa; font-weight: bold; }\n';
  html += '.status { padding: 8px 12px; border-radius: 4px; font-weight: bold; }\n';
  html += '.status.ok { background: #d4edda; color: #155724; }\n';
  html += '.status.error { background: #f8d7da; color: #721c24; }\n';
  html += '.status.warning { background: #fff3cd; color: #856404; }\n';
  html += 'button { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; font-weight: bold; }\n';
  html += 'button:hover { background: #5568d3; }\n';
  html += '</style>\n';
  html += '</head>\n';
  html += '<body>\n';
  html += '<div class="container">\n';
  html += '<h1>🎛️ Админ панель</h1>\n';
  
  // Статистика
  html += '<h2>📊 Статистика системы</h2>\n';
  html += '<div class="stats-grid">\n';
  html += '<div class="stat-card">\n';
  html += '<div class="stat-number">' + stats.totalLicenses + '</div>\n';
  html += '<div class="stat-label">Лицензии</div>\n';
  html += '<div class="stat-detail">' + stats.activeLicenses + ' активных</div>\n';
  html += '</div>\n';
  html += '<div class="stat-card">\n';
  html += '<div class="stat-number">' + stats.totalBindings + '</div>\n';
  html += '<div class="stat-label">Связки</div>\n';
  html += '<div class="stat-detail">' + stats.activeBindings + ' активных</div>\n';
  html += '</div>\n';
  html += '<div class="stat-card">\n';
  html += '<div class="stat-number">' + stats.postsToday + '</div>\n';
  html += '<div class="stat-label">Постов сегодня</div>\n';
  html += '<div class="stat-detail">Отправлено</div>\n';
  html += '</div>\n';
  html += '</div>\n';
  
  // Управление
  html += '<h2>🔧 Управление системой</h2>\n';
  html += '<p>\n';
  html += '  <button onclick="google.script.run.withSuccessHandler(function(result) { alert(\'Логи очищены: \' + result.totalDeleted + \' записей из \' + result.sheetsProcessed + \' листов\'); }).withFailureHandler(function(error) { alert(\'Ошибка: \' + error.message); }).cleanOldLogs();">🧹 Очистить старые логи (>30 дней)</button>\n';
  html += '  <button onclick="google.script.run.withSuccessHandler(function(result) { alert(result.message || \'Структура проверена\'); }).withFailureHandler(function(error) { alert(\'Ошибка: \' + error.message); }).ensureBindingsSheetStructure();">🔧 Обеспечить структуру Bindings (11 колонок)</button>\n';
  html += '  <button onclick="google.script.run.withSuccessHandler(function(result) { alert(\'Тесты завершены!\\n\\n\' + result.message); }).withFailureHandler(function(error) { alert(\'Ошибка: \' + error.message); }).testPublicationRowWrites();">🧪 Тестировать запись строк публикации</button>\n';
  html += '</p>\n';
  
  html += '</div>\n';
  html += '</body>\n';
  html += '</html>\n';
  
  return html;
}

// ============================================
// BINDINGS STRUCTURE MANAGEMENT
// ============================================

function ensureBindingsSheetStructure() {
  try {
    var sheet = getSheet("Bindings");
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var expectedHeaders = [
      "Binding ID", "License Key", "User Email", "VK Group URL", "TG Chat ID", 
      "Status", "Created At", "Last Check", "Format Settings", "Binding Name", "Binding Description"
    ];
    
    var missingColumns = [];
    var currentColumnCount = headers.length;
    
    // Проверяем какие колонки отсутствуют
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (i >= headers.length || headers[i] !== expectedHeaders[i]) {
        missingColumns.push({
          name: expectedHeaders[i],
          index: i + 1 // 1-based index
        });
      }
    }
    
    // Добавляем недостающие колонки
    if (missingColumns.length > 0) {
      var targetColumn = Math.max(currentColumnCount + 1, 1);
      
      for (var j = 0; j < missingColumns.length; j++) {
        var missing = missingColumns[j];
        
        // Если колонка полностью отсутствует (выходит за текущие границы)
        if (missing.index > currentColumnCount) {
          sheet.getRange(1, targetColumn).setValue(missing.name);
          targetColumn++;
        } else {
          // Обновляем существующую колонку с неправильным названием
          sheet.getRange(1, missing.index).setValue(missing.name);
        }
      }
      
      // Форматируем новые заголовки
      var headerRange = sheet.getRange(1, 1, 1, expectedHeaders.length);
      headerRange.setBackground("#667eea");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");
      
      logEvent("INFO", "bindings_structure_ensured", "system", 
               `Added/updated columns: ${missingColumns.map(c => c.name).join(", ")}`);
      
      return {
        success: true,
        added_columns: missingColumns.map(c => c.name),
        total_columns: expectedHeaders.length
      };
    } else {
      logEvent("DEBUG", "bindings_structure_already_valid", "system", 
               "All required columns exist with correct names");
      
      return {
        success: true,
        added_columns: [],
        total_columns: expectedHeaders.length,
        message: "Bindings sheet structure is already correct"
      };
    }
    
  } catch (error) {
    logEvent("ERROR", "ensure_bindings_structure_error", "system", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
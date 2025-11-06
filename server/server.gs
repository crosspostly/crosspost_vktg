/**
 * VK→Telegram Crossposter - SERVER MAIN ENTRY POINT
 * Рефакторинг: Модульная архитектура
 * 
 * Этот файл - главная точка входа для всех API запросов
 * Импортирует все модули и маршрутизирует запросы
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 * Версия: 6.0-refactored
 */

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ОСТАЮТСЯ ЗДЕСЬ
// ============================================

var DEV_MODE = false; // true для подробного логирования (только для отладки)
var SERVER_VERSION = "6.0";
var MAX_MEDIA_GROUP_SIZE = 10; // Лимит Telegram для media group
var VK_API_VERSION = "5.131";
var REQUEST_TIMEOUT = 30000; // 30 секунд (по умолчанию)

// Таймауты по типу операции
var TIMEOUTS = {
  FAST: 8000,    // 8 секунд - быстрые операции
  MEDIUM: 15000, // 15 секунд - средние операции  
  SLOW: 30000    // 30 секунд - медленные операции
};

// ============================================
// ИМПОРТЫ МОДУЛЕЙ
// ============================================

// В Google Apps Script нет прямой системы импортов модулей
// Все функции доступны глобально, так как все .gs файлы загружаются в одно пространство имен
// Для Apps Script достаточно просто разместить все файлы в одном проекте

// ============================================
// ГЛАВНЫЙ ENTRY POINT - API ENDPOINT
// ============================================

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const clientIp = e.parameter.source || e.parameters.source || 'unknown';
    
    logEvent("INFO", "api_request", clientIp, `Endpoint: ${payload.action || 'unknown'}`);
    
    // Маршрутизация к соответствующим обработчикам
    switch (payload.action) {
      case 'check_license':
        return handleCheckLicense(payload, clientIp);
        
      case 'get_bindings':
        return handleGetBindings(payload, clientIp);
        
      case 'get_user_bindings_with_names':
        return handleGetUserBindingsWithNames(payload, clientIp);
        
      case 'add_binding':
        return handleAddBinding(payload, clientIp);
        
      case 'edit_binding':
        return handleEditBinding(payload, clientIp);
        
      case 'delete_binding':
        return handleDeleteBinding(payload, clientIp);
        
      case 'toggle_binding_status':
        return handleToggleBindingStatus(payload, clientIp);
        
      case 'get_vk_posts':
        return handleGetVkPosts(payload, clientIp);
        
      case 'send_post':
        return handleSendPost(payload, clientIp);
        
      case 'publish_last_post':
        return handlePublishLastPost(payload, clientIp);
        
      case 'get_global_setting':
        return handleGetGlobalSetting(payload, clientIp);
        
      case 'set_global_setting':
        return handleSetGlobalSetting(payload, clientIp);
        
      default:
        logEvent("WARN", "unknown_action", clientIp, `Action: ${payload.action}`);
        return jsonResponse({
          success: false,
          error: "Unknown action: " + (payload.action || 'not specified')
        }, 400);
    }
    
  } catch (error) {
    logEvent("ERROR", "doPost_error", "system", error.message);
    return jsonResponse({
      success: false,
      error: "Internal server error"
    }, 500);
  }
}

// ============================================
// UI МЕНЮ И ИНИЦИАЛИЗАЦИЯ
// ============================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  
  ui.createMenu("VK→TG Сервер")
    .addItem("▶️ 1. Инициализировать сервер", "initializeServer")
    .addItem("⚙️ 2. Настроить конфигурацию", "showConfigDialog")
    .addItem("🔧 3. Проверить состояние сервера", "checkServerHealth")
    .addItem("🎛️ 4. Админ панель", "showAdminPanel")
    .addItem("📊 5. Статистика", "showStatistics")
    .addItem("🔍 6. Показать логи", "showLogsSheet")
    .addToUi();
}

function initializeServer() {
  try {
    // Создаем необходимые листы
    createSheet("Licenses", [
      "License Key", "Email", "Type", "Max Groups", "Expires", "Created At", "Status", "Notes"
    ]);
    
    createSheet("Bindings", [
      "Binding ID", "License Key", "User Email", "VK Group URL", "TG Chat ID", "Status", "Created At", "Last Check", "Format Settings", "Binding Name", "Binding Description"
    ]);
    
    createSheet("Logs", [
      "Timestamp", "Level", "Event", "User", "Details", "IP"
    ]);
    
    // Логируем инициализацию
    logEvent("INFO", "server_initialized", "system", `Server v${SERVER_VERSION} initialized`);
    
    SpreadsheetApp.getUi().alert(
      "✅ Сервер инициализирован!\n\n" +
      "Созданы листы:\n" +
      "• Licenses - управление лицензиями\n" +
      "• Bindings - связки пользователей\n" +
      "• Logs - логи системы\n\n" +
      "Теперь настройте конфигурацию (пункт 2)."
    );
    
  } catch (error) {
    logEvent("ERROR", "server_init_failed", "system", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка инициализации: " + error.message);
  }
}

function showConfigDialog() {
  try {
    var htmlContent = getConfigDialogHtml();
    if (!htmlContent) {
      throw new Error("Failed to generate HTML content");
    }
    
    var html = HtmlService.createHtmlOutput(htmlContent);
    if (!html) {
      throw new Error("Failed to create HTML output");
    }
    
    html.setWidth(600).setHeight(700);
    
    SpreadsheetApp.getUi()
      .showModelessDialog(html, "⚙️ Конфигурация сервера");
      
  } catch (error) {
    logEvent("ERROR", "config_dialog_error", "system", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка: " + error.message);
  }
}

function checkServerHealth() {
  try {
    var healthData = getServerHealthData();
    var htmlContent = getServerHealthHtml(healthData);
    
    if (!htmlContent) {
      throw new Error("Failed to generate health check HTML");
    }
    
    var html = HtmlService.createHtmlOutput(htmlContent);
    html.setWidth(800).setHeight(700);
    
    SpreadsheetApp.getUi()
      .showModelessDialog(html, "🔧 Состояние сервера");
      
  } catch (error) {
    logEvent("ERROR", "health_check_error", "system", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка проверки состояния: " + error.message);
  }
}

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

function showStatistics() {
  // Эта функция уже перенесена в utils.gs
  // Оставляем для совместимости
  return getSystemStats();
}

function showLogsSheet() {
  // Эта функция уже перенесена в utils.gs
  // Оставляем для совместимости
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logsSheet = ss.getSheetByName("Logs");
  
  if (logsSheet) {
    ss.setActiveSheet(logsSheet);
  } else {
    SpreadsheetApp.getUi().alert("❌ Лист 'Logs' не найден. Выполните инициализацию сервера.");
  }
}

// ============================================
// ВРЕМЕННЫЕ ФУНКЦИИ (TODO - будут перенесены в другие модули)
// ============================================

// Временные заглушки для функций, которые будут перенесены в другие модули
function handleGetBindings(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to bindings-service.gs" }, 501);
}

function handleGetUserBindingsWithNames(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to bindings-service.gs" }, 501);
}

function handleAddBinding(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to bindings-service.gs" }, 501);
}

function handleEditBinding(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to bindings-service.gs" }, 501);
}

function handleDeleteBinding(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to bindings-service.gs" }, 501);
}

function handleToggleBindingStatus(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to bindings-service.gs" }, 501);
}

function handleGetVkPosts(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to vk-service.gs" }, 501);
}

function handleSendPost(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to posting-service.gs" }, 501);
}

function handlePublishLastPost(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to posting-service.gs" }, 501);
}

function handleGetGlobalSetting(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to posting-service.gs" }, 501);
}

function handleSetGlobalSetting(payload, clientIp) {
  return jsonResponse({ success: false, error: "Not implemented yet - will be moved to posting-service.gs" }, 501);
}

function getAdminPanelHtml(stats) {
  // Временная реализация - будет перенесена в отдельный модуль
  var html = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n';
  html += '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  html += '<title>Админ панель</title>\n';
  html += '<style>body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }</style>\n';
  html += '</head>\n<body>\n';
  html += '<h1>🎛️ Админ панель</h1>\n';
  html += '<p>Временная версия. Полная функциональность будет доступна после завершения рефакторинга.</p>\n';
  html += '<p>Лицензий: ' + stats.totalLicenses + '</p>\n';
  html += '<p>Связок: ' + stats.totalBindings + '</p>\n';
  html += '</body>\n</html>';
  return html;
}
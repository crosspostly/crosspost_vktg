/**
 * VK→Telegram Crossposter - SERVER v6.0 FINAL (PRODUCTION-READY)
 * 
 * ✅ Центральный сервер для всех пользователей
 * ✅ Хранит все токены и секреты VK + Telegram API
 * ✅ Управляет лицензиями и связками пользователей
 * ✅ Обрабатывает медиа (фото, видео, аудио) из VK
 * ✅ Отправляет посты в Telegram с полным форматированием
 * ✅ Встроенный HTML админ-интерфейс
 * ✅ Система логирования и статистики
 * ✅ Защита от дублирования и проверка лимитов
 * 
 * Автор: f_den
 * Дата: 2025-10-31
 * Архитектура: Сервер (хранит секреты) + Клиент (UI + автоматизация)
 */

// ============================================
// КОНФИГУРАЦИЯ
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
// 1. ИНИЦИАЛИЗАЦИЯ И МЕНЮ
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

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getConfigDialogHtml() {
  var props = PropertiesService.getScriptProperties();
  var config = {
    BOT_TOKEN: props.getProperty("BOT_TOKEN") || "",
    VK_USER_ACCESS_TOKEN: props.getProperty("VK_USER_ACCESS_TOKEN") || "",
    ADMIN_CHAT_ID: props.getProperty("ADMIN_CHAT_ID") || ""
  };
  
  var html = '<!DOCTYPE html>\n';
  html += '<html lang="ru">\n';
  html += '<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  html += '<style>\n';
  html += 'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }\n';
  html += '.container { max-width: 500px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 0 auto; }\n';
  html += 'h1 { color: #333; font-size: 20px; margin-top: 0; margin-bottom: 20px; }\n';
  html += 'label { display: block; margin-top: 15px; font-weight: bold; color: #555; margin-bottom: 5px; }\n';
  html += 'input { width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 13px; }\n';
  html += 'small { display: block; margin-top: 3px; color: #888; font-size: 12px; }\n';
  html += 'button { background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 20px; width: 100%; font-weight: bold; }\n';
  html += 'button:hover { background: #5568d3; }\n';
  html += 'button:disabled { background: #ccc; cursor: not-allowed; }\n';
  html += '.status { margin-top: 15px; padding: 12px; border-radius: 4px; background: #f0f0f0; display: none; }\n';
  html += '.error { background: #fee; border-left: 4px solid #f00; color: #c33; }\n';
  html += '.success { background: #efe; border-left: 4px solid #0f0; color: #030; }\n';
  html += '.warning { background: #ffe; border-left: 4px solid #fa0; color: #880; }\n';
  html += '.info { background: #eef; border-left: 4px solid #00f; color: #003; }\n';
  html += '</style>\n';
  html += '</head>\n';
  html += '<body>\n';
  html += '<div class="container">\n';
  html += '<h1>⚙️ Конфигурация сервера</h1>\n';
  html += '<div id="status" class="status"></div>\n';
  
  html += '<label>🤖 Telegram Bot Token</label>\n';
  html += '<input type="password" id="botToken" value="' + escapeHtml(config.BOT_TOKEN) + '" placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz">\n';
  html += '<small>Получить в BotFather: /start → /newbot</small>\n';
  
  html += '<label>ВКонтакте User Token</label>\n';
  html += '<input type="password" id="vkUserToken" value="' + escapeHtml(config.VK_USER_ACCESS_TOKEN) + '" placeholder="abc123def456...">\n';
  html += '<small>Требуемые права: wall, video, offline</small>\n';
  
  html += '<label>📱 Admin Chat ID</label>\n';
  html += '<input type="text" id="adminChatId" value="' + escapeHtml(config.ADMIN_CHAT_ID) + '" placeholder="-1001234567890">\n';
  html += '<small>Получить через @userinfobot после добавления бота в канал/группу</small>\n';
  
  html += '<button id="saveBtn" onclick="saveAndCloseConfig()">💾 Сохранить конфигурацию</button>\n';
  
  html += '<script>\n';
  
  html += 'function escapeHtml(text) {\n';
  html += '  if (!text) return "";\n';
  html += '  const div = document.createElement("div");\n';
  html += '  div.textContent = text;\n';
  html += '  return div.innerHTML;\n';
  html += '}\n';
  
  html += 'function showStatus(message, type) {\n';
  html += '  const status = doc
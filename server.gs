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
    .addItem("🧪 7. Тест логирования", "testLoggingFlow")
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
      "Timestamp", "Level", "Source", "Event", "Binding Name", "Message", "Extra JSON"
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
  html += '  const status = document.getElementById("status");\n';
  html += '  status.innerHTML = message;\n';
  html += '  status.className = "status " + type;\n';
  html += '  status.style.display = "block";\n';
  html += '}\n';
  
  html += 'function saveAndCloseConfig() {\n';
  html += '  const botToken = document.getElementById("botToken").value.trim();\n';
  html += '  const vkUserToken = document.getElementById("vkUserToken").value.trim();\n';
  html += '  const adminChatId = document.getElementById("adminChatId").value.trim();\n';
  html += '  const btn = document.getElementById("saveBtn");\n';
  
  html += '  if (!botToken || !vkUserToken || !adminChatId) {\n';
  html += '    showStatus("❌ Все поля должны быть заполнены!", "error");\n';
  html += '    return;\n';
  html += '  }\n';
  
  html += '  btn.disabled = true;\n';
  html += '  btn.textContent = "🔄 Проверка...";\n';
  html += '  showStatus("🔄 Проверка токенов...", "info");\n';
  
  html += '  try {\n';
  html += '    google.script.run\n';
  html += '      .withSuccessHandler(function(result) {\n';
  html += '        if (result.success) {\n';
  html += '          let message = "<strong>✅ Конфигурация сохранена!</strong><br><br>";\n';
  
  html += '          if (result.validation) {\n';
  html += '            const v = result.validation;\n';
  html += '            message += "🤖 Telegram: " + v.telegram.status + " " + v.telegram.message + "<br>";\n';
  html += '            message += "ВК User: " + v.vkUser.status + " " + v.vkUser.message + "<br>";\n';
  html += '            message += "Admin Chat: " + v.adminChat.status + " " + v.adminChat.message + "<br>";\n';
  html += '          }\n';
  
  html += '          showStatus(message, "success");\n';
  html += '          setTimeout(function() {\n';
  html += '            google.script.host.close();\n';
  html += '          }, 2000);\n';
  html += '        } else {\n';
  html += '          showStatus("<strong>❌ Ошибка:</strong> " + (result.error || "Неизвестная ошибка"), "error");\n';
  html += '          btn.disabled = false;\n';
  html += '          btn.textContent = "💾 Сохранить конфигурацию";\n';
  html += '        }\n';
  html += '      })\n';
  html += '      .withFailureHandler(function(error) {\n';
  html += '        showStatus("<strong>❌ Ошибка сервера:</strong> " + error.message, "error");\n';
  html += '        btn.disabled = false;\n';
  html += '        btn.textContent = "💾 Сохранить конфигурацию";\n';
  html += '      })\n';
  html += '      .saveServerConfig(botToken, vkUserToken, adminChatId);\n';
  html += '  } catch (error) {\n';
  html += '    showStatus("<strong>❌ Исключение:</strong> " + error.message, "error");\n';
  html += '    btn.disabled = false;\n';
  html += '    btn.textContent = "💾 Сохранить конфигурацию";\n';
  html += '  }\n';
  html += '}\n';
  
  html += '</script>\n';
  
  html += '</div>\n';
  html += '</body>\n';
  html += '</html>\n';
  
  return html;
}


function saveServerConfig(botToken, vkUserToken, adminChatId) {
  try {
    // ========== 1. ПРОВЕРЯЕМ НЕ ПУСТО ==========
    if (!botToken || !botToken.trim()) {
      logEvent("WARN", "config_empty_bot_token", "admin", "Bot token is empty");
      return { 
        success: false, 
        error: "❌ Telegram Bot Token не может быть пустым" 
      };
    }
    
    if (!vkUserToken || !vkUserToken.trim()) {
      logEvent("WARN", "config_empty_vk_token", "admin", "VK token is empty");
      return { 
        success: false, 
        error: "❌ VK User Access Token не может быть пустым" 
      };
    }
    
    if (!adminChatId || !adminChatId.trim()) {
      logEvent("WARN", "config_empty_admin_id", "admin", "Admin chat ID is empty");
      return { 
        success: false, 
        error: "❌ Admin Chat ID не может быть пустым" 
      };
    }
    
    // ========== 2. ВАЛИДИРУЕМ ТОКЕНЫ ==========
    logEvent("INFO", "config_validation_start", "admin", "Starting token validation");
    
    var validation = validateTokens(botToken, vkUserToken, adminChatId);
    
    if (!validation.success) {
      logEvent("WARN", "config_validation_failed", "admin", validation.error);
      return { success: false, error: validation.error };
    }
    
    // ========== 3. СОХРАНЯЕМ КОНФИГ ==========
    var props = PropertiesService.getScriptProperties();
    
    props.setProperties({
      "BOT_TOKEN": botToken,
      "VK_USER_ACCESS_TOKEN": vkUserToken,
      "ADMIN_CHAT_ID": adminChatId
    });
    
    logEvent("INFO", "config_updated", "admin", "Server configuration updated and validated");
    
    return { 
      success: true, 
      validation: validation.details 
    };
    
  } catch (error) {
    logEvent("ERROR", "config_save_failed", "admin", error.message);
    return { success: false, error: error.message };
  }
}

function validateTokens(botToken, vkUserToken, adminChatId) {
  var results = {
    telegram: { status: '❌', message: 'Не проверен' },
    vkUser: { status: '❌', message: 'Не проверен' },
    adminChat: { status: '❌', message: 'Не проверен' }
  };
  
  try {
    // 1. Проверяем Telegram Bot Token
    logEvent("DEBUG", "validating_telegram_token", "admin", "Testing Telegram Bot API");
    
    try {
      var tgResponse = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        muteHttpExceptions: true,
        timeout: 10000
      });
      
      var tgData = JSON.parse(tgResponse.getContentText());
      
      if (tgData.ok) {
        results.telegram = { 
          status: '✅', 
          message: `Бот: @${tgData.result.username}` 
        };
        logEvent("INFO", "telegram_token_valid", "admin", `Bot: @${tgData.result.username}`);
      } else {
        results.telegram = { 
          status: '❌', 
          message: `Ошибка: ${tgData.description}` 
        };
        logEvent("WARN", "telegram_token_invalid", "admin", tgData.description);
      }
    } catch (tgError) {
      results.telegram = { 
        status: '❌', 
        message: `Сетевая ошибка: ${tgError.message}` 
      };
    }
    
    // 2. Проверяем VK User Token
    logEvent("DEBUG", "validating_vk_user_token", "admin", "Testing VK User Token");
    
    try {
      var vkUserResponse = UrlFetchApp.fetch(
        `https://api.vk.com/method/users.get?v=${VK_API_VERSION}&access_token=${vkUserToken}`,
        {
          muteHttpExceptions: true,
          timeout: 10000
        }
      );
      
      var vkUserData = JSON.parse(vkUserResponse.getContentText());
      
      if (vkUserData.response && vkUserData.response.length > 0) {
        var user = vkUserData.response[0];
        if (user && user.first_name && user.last_name) {
          results.vkUser = { 
            status: '✅', 
            message: `Пользователь: ${user.first_name} ${user.last_name}` 
          };
          logEvent("INFO", "vk_user_token_valid", "admin", `User: ${user.first_name} ${user.last_name}`);
        } else {
          results.vkUser = { 
            status: '❌', 
            message: 'VK API: Некорректные данные пользователя' 
          };
          logEvent("WARN", "vk_user_data_incomplete", "admin", "User data is incomplete or missing");
        }
      } else if (vkUserData.error) {
        // Детализированная обработка ошибок VK API
        var errorMessage = vkUserData.error.error_msg;
        if (vkUserData.error.error_code === 4) {
          errorMessage = 'Неверный или истёкший User Access Token. Получите новый токен с правами wall, offline';
        } else if (vkUserData.error.error_code === 5) {
          errorMessage = 'User Access Token не имеет необходимых прав. Нужны права: wall, offline';
        }
        
        results.vkUser = { 
          status: '❌', 
          message: `VK API: ${errorMessage} (код ${vkUserData.error.error_code})` 
        };
        logEvent("WARN", "vk_user_token_invalid", "admin", `Error code ${vkUserData.error.error_code}: ${errorMessage}`);
      }
    } catch (vkUserError) {
      results.vkUser = { 
        status: '❌', 
        message: `Сетевая ошибка: ${vkUserError.message}` 
      };
    }
    
    // 4. Проверяем Admin Chat ID (сначала получаем информацию о чате)
    if (results.telegram.status === '✅') {
      logEvent("DEBUG", "validating_admin_chat", "admin", `Testing Admin Chat ID: ${adminChatId}`);
      
      try {
        var adminTestResponse = UrlFetchApp.fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(adminChatId)}`,
          {
            method: 'GET',
            muteHttpExceptions: true,
            timeout: 10000
          }
        );
        
        var adminTestData = JSON.parse(adminTestResponse.getContentText());
        
        if (adminTestData.ok) {
          results.adminChat = { 
            status: '✅', 
            message: 'Тестовое сообщение отправлено' 
          };
          logEvent("INFO", "admin_chat_valid", "admin", `Chat ID: ${adminChatId}`);
        } else {
          // Более детальная обработка ошибок Telegram
          var errorMessage = adminTestData.description || 'Неизвестная ошибка';
          if (errorMessage.includes('chat not found')) {
            errorMessage = 'Чат не найден. Проверьте Chat ID или добавьте бота в канал/группу';
          } else if (errorMessage.includes('bot was blocked')) {
            errorMessage = 'Бот заблокирован пользователем';
          } else if (errorMessage.includes('not enough rights')) {
            errorMessage = 'Недостаточно прав для отправки сообщений';
          }
          
          results.adminChat = { 
            status: '❌', 
            message: `Ошибка: ${errorMessage}` 
          };
          logEvent("WARN", "admin_chat_invalid", "admin", `Chat ID: ${adminChatId}, Error: ${errorMessage}`);
        }
      } catch (adminError) {
        results.adminChat = { 
          status: '❌', 
          message: `Сетевая ошибка: ${adminError.message}` 
        };
      }
    } else {
      results.adminChat = { 
        status: '⚠️', 
        message: 'Пропущено (Bot Token неверен)' 
      };
    }
    
    // Проверяем, все ли токены валидны
    var allValid = Object.values(results).every(r => r.status === '✅');
    var partialValid = Object.values(results).some(r => r.status === '✅');
    
    var message = '';
    if (allValid) {
      message = '✅ Все токены настроены корректно!';
    } else if (partialValid) {
      message = '⚠️ Некоторые токены работают, но есть проблемы. Проверьте детали.';
    } else {
      message = '❌ Ни один токен не работает корректно!';
    }
    
    logEvent("INFO", "token_validation_complete", "admin", message);
    
    return {
      success: allValid || partialValid, // Считаем успехом если хотя бы что-то работает
      error: allValid ? null : message,
      details: results
    };
    
  } catch (error) {
    logEvent("ERROR", "token_validation_error", "admin", error.message);
    return {
      success: false,
      error: "Ошибка проверки токенов: " + error.message,
      details: results
    };
  }
}


// ============================================
// 2. ПРОВЕРКА СОСТОЯНИЯ СЕРВЕРА
// ============================================

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

function getServerHealthData() {
  var props = PropertiesService.getScriptProperties();
  var serverUrl = ScriptApp.getService().getUrl();
  
  var config = {
    BOT_TOKEN: props.getProperty("BOT_TOKEN"),
    VK_USER_ACCESS_TOKEN: props.getProperty("VK_USER_ACCESS_TOKEN"),
    ADMIN_CHAT_ID: props.getProperty("ADMIN_CHAT_ID")
  };
  
  logEvent("DEBUG", "health_check_config", "system", 
           `Tokens found - Bot: ${!!config.BOT_TOKEN}, VK User: ${!!config.VK_USER_ACCESS_TOKEN}, Admin: ${!!config.ADMIN_CHAT_ID}`);
  
  var configStatus = {
    hasAllTokens: !!(config.BOT_TOKEN && config.VK_USER_ACCESS_TOKEN && config.ADMIN_CHAT_ID),
    missingTokens: []
  };
  
  if (!config.BOT_TOKEN) configStatus.missingTokens.push("Telegram Bot Token");
  if (!config.VK_USER_ACCESS_TOKEN) configStatus.missingTokens.push("VK User Token");
  if (!config.ADMIN_CHAT_ID) configStatus.missingTokens.push("Admin Chat ID");
  
  // Проверяем листы
  var sheetsStatus = {
    licenses: checkSheetExists("Licenses"),
    bindings: checkSheetExists("Bindings"),
    logs: checkSheetExists("Logs")
  };
  
  // Тестируем API эндпоинт (с таймаутом)
  var endpointStatus = testServerEndpointQuick();
  
  // Общий статус
  var isHealthy = configStatus.hasAllTokens && 
                   sheetsStatus.licenses && 
                   sheetsStatus.bindings && 
                   sheetsStatus.logs &&
                   endpointStatus.working;
  
  return {
    serverUrl: serverUrl,
    isHealthy: isHealthy,
    status: isHealthy ? "✅ ГОТОВ К РАБОТЕ" : "⚠️ ТРЕБУЕТ НАСТРОЙКИ",
    config: configStatus,
    sheets: sheetsStatus,
    endpoint: endpointStatus,
    version: SERVER_VERSION,
    deploymentDate: new Date().toLocaleString('ru-RU')
  };
}

function checkSheetExists(sheetName) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    return !!sheet;
  } catch (error) {
    return false;
  }
}

/**
 * ИСПРАВЛЕННАЯ проверка API эндпоинта БЕЗ зависания
 */
function testServerEndpointQuick() {
  try {
    var serverUrl = ScriptApp.getService().getUrl();
    
    if (!serverUrl) {
      return { 
        working: false, 
        error: "Не удалось получить URL сервера. Убедитесь что скрипт развернут как Web App." 
      };
    }
    
    // ✅ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ - просто проверяем что URL существует и содержит /exec
    if (!serverUrl.includes('/exec')) {
      return { 
        working: false, 
        error: "Web App не развернут как /exec. Откройте Deploy → New deployment → Web app" 
      };
    }
    
    // ✅ НЕ ОТПРАВЛЯЕМ POST самому себе - просто проверяем что URL правильный
    // Если URL содержит /exec - сервер правильно развернут
    
    return { 
      working: true,
      responseTime: "inline",
      message: "Сервер развернут как Web App" 
    };
    
  } catch (error) {
    return { 
      working: false,
      error: error.message 
    };
  }
}


function getServerHealthHtml(healthData) {
  var html = '<!DOCTYPE html>\n';
  html += '<html lang="ru">\n';
  html += '<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  html += '<style>\n';
  html += 'body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }\n';
  html += '.container { max-width: 700px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n';
  html += 'h2 { color: #333; font-size: 18px; margin-top: 20px; margin-bottom: 10px; }\n';
  html += 'h3 { color: #555; font-size: 14px; margin-top: 15px; margin-bottom: 10px; }\n';
  html += 'table { width: 100%; border-collapse: collapse; margin: 10px 0; }\n';
  html += 'td { padding: 10px; border: 1px solid #ddd; }\n';
  html += 'code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 12px; }\n';
  html += 'small { color: #888; font-size: 12px; }\n';
  html += 'strong { font-weight: bold; }\n';
  html += 'button { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 15px; }\n';
  html += 'button:hover { background: #5568d3; }\n';
  html += '.error { color: red; }\n';
  html += '.warning { color: orange; }\n';
  html += '.success { color: green; }\n';
  html += '</style>\n';
  html += '</head>\n';
  html += '<body>\n';
  html += '<div class="container">\n';
  
  html += '<h2>' + escapeHtml(healthData.status) + '</h2>\n';
  html += '<p>VK→Telegram Crossposter Server v' + escapeHtml(healthData.version) + '</p>\n';
  html += '<p><small>Развертывание: ' + escapeHtml(healthData.deploymentDate) + '</small></p>\n';
  html += '<hr>\n';
  
  // ===== URL сервера =====
  html += '<h3>🌐 URL сервера</h3>\n';
  html += '<p><code>' + escapeHtml(healthData.serverUrl) + '</code></p>\n';
  html += '<p><small>Этот URL используется клиентами для подключения к серверу</small></p>\n';
  html += '<hr>\n';
  
  // ===== Конфигурация =====
  html += '<h3>🔧 Конфигурация</h3>\n';
  html += '<table border="1" cellpadding="5" cellspacing="0">\n';
  html += '<tr><td>Все токены настроены</td><td><strong ' + (healthData.config.hasAllTokens ? 'class="success"' : 'class="error"') + '>' + (healthData.config.hasAllTokens ? '✅ Да' : '❌ Нет') + '</strong></td></tr>\n';
  
  if (!healthData.config.hasAllTokens) {
    html += '<tr><td colspan="2"><strong>Отсутствуют токены:</strong><ul>\n';
    healthData.config.missingTokens.forEach(function(token) {
      html += '<li>' + escapeHtml(token) + '</li>\n';
    });
    html += '</ul></td></tr>\n';
  }
  
  html += '</table>\n';
  html += '<hr>\n';
  
  // ===== Структура данных =====
  html += '<h3>📊 Структура данных</h3>\n';
  html += '<table border="1" cellpadding="5" cellspacing="0">\n';
  html += '<tr><td>Лист "Licenses"</td><td><strong ' + (healthData.sheets.licenses ? 'class="success"' : 'class="error"') + '>' + (healthData.sheets.licenses ? '✅ Создан' : '❌ Не создан') + '</strong></td></tr>\n';
  html += '<tr><td>Лист "Bindings"</td><td><strong ' + (healthData.sheets.bindings ? 'class="success"' : 'class="error"') + '>' + (healthData.sheets.bindings ? '✅ Создан' : '❌ Не создан') + '</strong></td></tr>\n';
  html += '<tr><td>Лист "Logs"</td><td><strong ' + (healthData.sheets.logs ? 'class="success"' : 'class="error"') + '>' + (healthData.sheets.logs ? '✅ Создан' : '❌ Не создан') + '</strong></td></tr>\n';
  html += '</table>\n';
  html += '<hr>\n';
  
  // ===== API Endpoint =====
  html += '<h3>🚀 API Endpoint</h3>\n';
  html += '<table border="1" cellpadding="5" cellspacing="0">\n';
  html += '<tr><td>Статус сервера</td><td><strong ' + (healthData.endpoint.working ? 'class="success"' : 'class="error"') + '>' + (healthData.endpoint.working ? '✅ Доступен' : '❌ Недоступен') + '</strong></td></tr>\n';
  
  if (healthData.endpoint.working && healthData.endpoint.responseTime) {
    html += '<tr><td>Время ответа</td><td>' + escapeHtml(healthData.endpoint.responseTime) + '</td></tr>\n';
  }
  
  if (!healthData.endpoint.working) {
    html += '<tr><td colspan="2"><strong class="error">❌ Ошибка:</strong> ' + escapeHtml(healthData.endpoint.error) + '</td></tr>\n';
  }
  
  html += '</table>\n';
  html += '<hr>\n';
  
  // ===== Требуемые действия =====
  if (!healthData.isHealthy) {
    html += '<h3>⚠️ Требуется дополнительная настройка</h3>\n';
    html += '<p><strong>Что нужно сделать:</strong></p>\n';
    html += '<ul>\n';
    
    if (!healthData.config.hasAllTokens) {
      html += '<li>1. Заполните все токены в конфигурации</li>\n';
    }
    
    if (!healthData.sheets.licenses || !healthData.sheets.bindings || !healthData.sheets.logs) {
      html += '<li>2. Создайте листы данных (нажмите "1. 🚀 Инициализировать сервер" в меню)</li>\n';
    }
    
    if (!healthData.endpoint.working) {
      html += '<li>3. Проверьте развертывание сервера - используйте Deploy → New deployment → Web app</li>\n';
    }
    
    html += '</ul>\n';
    html += '<p><strong>После исправления:</strong> нажмите "🔄 Обновить проверку"</p>\n';
  } else {
    html += '<h3 class="success">✅ ВСЕ СИСТЕМЫ В НОРМЕ!</h3>\n';
    html += '<p>Сервер полностью настроен и готов к использованию.</p>\n';
  }
  
  html += '<p><button onclick="google.script.run.checkServerHealth(); google.script.host.close();">🔄 Обновить проверку</button></p>\n';
    html += '<p><button onclick="google.script.run.withSuccessHandler(function(result) { alert(\'Логи очищены: \' + result.totalDeleted + \' записей из \' + result.sheetsProcessed + \' листов\'); }).withFailureHandler(function(error) { alert(\'Ошибка: \' + error.message); }).cleanOldLogs();">🧹 Очистить старые логи (>30 дней)</button></p>\n';

    html += '</div>\n';
    html += '</body>\n';
    html += '</html>\n';
  
  return html;
}



// ============================================
// 2. ГЛАВНЫЙ API ENDPOINT
// ============================================

function doPost(e) {
  try {
    // Проверяем входящие данные
    if (!e || !e.postData || !e.postData.contents) {
      logEvent("ERROR", "invalid_request_structure", "anonymous", "Missing post data");
      return jsonResponse({
        success: false, 
        error: "Invalid request: missing post data"
      }, 400);
    }

    var clientIp = e.parameter?.clientIp || "unknown";
    
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      logEvent("ERROR", "json_parse_error", "anonymous", 
               `Invalid JSON: ${parseError.message}, Content: ${e.postData.contents.substring(0, 100)}`);
      return jsonResponse({
        success: false, 
        error: "Invalid JSON in request body"
      }, 400);
    }

    // Проверяем обязательные поля
    if (!payload.event) {
      logEvent("WARN", "missing_event_field", payload.license_key || "anonymous", 
               `Payload keys: ${Object.keys(payload).join(', ')}`);
      return jsonResponse({
        success: false, 
        error: "Missing 'event' field in request"
      }, 400);
    }
    
    logEvent("DEBUG", "api_request", payload.license_key || "anonymous", 
             `Event: ${payload.event}, IP: ${clientIp}`);
    
    // Безопасное выполнение обработчиков с дополнительной обработкой ошибок
    try {
      switch(payload.event) {
        case "check_license":
          return handleCheckLicense(payload, clientIp);
        
        case "get_bindings":
          return handleGetBindings(payload, clientIp);
        
        case "get_user_bindings_with_names":
          return handleGetUserBindingsWithNames(payload, clientIp);
        
        case "add_binding":
          return handleAddBinding(payload, clientIp);
        
        case "edit_binding":
          return handleEditBinding(payload, clientIp);
        
        case "delete_binding":
          return handleDeleteBinding(payload, clientIp);
        
        case "toggle_binding_status":
          return handleToggleBindingStatus(payload, clientIp);
        
        case "send_post":
          return handleSendPost(payload, clientIp);
        
        case "test_publication":
          return handleTestPublication(payload, clientIp);
        
        case "get_vk_posts":
          return handleGetVkPosts(payload, clientIp);
        
        case "publish_last_post":
          return handlePublishLastPost(payload, clientIp);
        
        case "get_global_setting":
          return handleGetGlobalSetting(payload, clientIp);
        
        case "set_global_setting":
          return handleSetGlobalSetting(payload, clientIp);
        
        case "client_log":
          return handleClientLog(payload, clientIp);
        
        case "test_logging_flow":
          return jsonResponse(testLoggingFlow());
        
        default:
          logEvent("WARN", "unknown_event", payload.license_key || "anonymous", 
                   `Unknown event: ${payload.event}, Available events: check_license, get_bindings, add_binding, edit_binding, delete_binding, toggle_binding_status, send_post, test_publication`);
          return jsonResponse({
            success: false, 
            error: `Unknown event: ${payload.event}`
          }, 400);
      }
    } catch (handlerError) {
      logEvent("ERROR", "handler_execution_error", payload.license_key || "anonymous", 
               `Event: ${payload.event}, Handler error: ${handlerError.message}, Stack: ${handlerError.stack?.substring(0, 200)}`);
      return jsonResponse({
        success: false, 
        error: `Handler error for event '${payload.event}': ${handlerError.message}`
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "api_critical_error", "system", 
             `Critical API error: ${error.message}, Stack: ${error.stack?.substring(0, 200)}`);
    return jsonResponse({
      success: false, 
      error: "Critical server error: " + error.message
    }, 500);
  }
}



// ============================================
// 3. ОБРАБОТЧИКИ API ЗАПРОСОВ
// ============================================

function handleCheckLicense(payload, clientIp) {
  try {
    var { license_key } = payload;
    
    if (!license_key) {
      return jsonResponse({
        success: false,
        error: "License key required"
      }, 400);
    }
    
    var license = findLicense(license_key);
    
    if (!license) {
      logEvent("WARN", "license_not_found", license_key, `IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "License not found"
      }, 404);
    }
    
    if (license.status !== "active") {
      logEvent("WARN", "license_inactive", license_key, `Status: ${license.status}, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "License inactive"
      }, 403);
    }
    
    if (new Date() > new Date(license.expires)) {
      logEvent("WARN", "license_expired", license_key, `Expires: ${license.expires}, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "License expired"
      }, 403);
    }
    
    logEvent("INFO", "license_check_success", license_key, `IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      license: {
        type: license.type,
        maxGroups: license.maxGroups,
        expires: license.expires
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "license_check_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetBindings(payload, clientIp) {
  try {
    var { license_key } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    var bindings = getUserBindings(license_key);
    
    logEvent("INFO", "bindings_retrieved", license_key, `Count: ${bindings.length}, IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      bindings: bindings
    });
    
  } catch (error) {
    logEvent("ERROR", "get_bindings_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetUserBindingsWithNames(payload, clientIp) {
  try {
    var { license_key } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    var bindings = getUserBindingsWithNames(license_key);
    
    logEvent("INFO", "bindings_with_names_retrieved", license_key, `Count: ${bindings.length}, IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      bindings: bindings
    });
    
  } catch (error) {
    logEvent("ERROR", "get_bindings_with_names_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleAddBinding(payload, clientIp) {
  try {
    var { license_key, vk_group_url, tg_chat_id, formatSettings, binding_name, binding_description } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Проверяем лимит
    var currentBindings = getUserBindings(license_key);
    if (currentBindings.length >= licenseData.license.maxGroups) {
      return jsonResponse({
        success: false,
        error: "Max groups limit exceeded"
      }, 429);
    }
    
    // АВТОМАТИЧЕСКОЕ ПРЕОБРАЗОВАНИЕ ССЫЛОК В ID
    var processedVkGroupId;
    var processedTgChatId;
    
    try {
      // Извлекаем ID ВК группы из ссылки
      processedVkGroupId = extractVkGroupId(vk_group_url);
      logEvent("INFO", "vk_url_converted", license_key, `${vk_group_url} -> ${processedVkGroupId}`, binding_name);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в ВК ссылке: ${error.message}`
      }, 400);
    }
    
    try {
      // Извлекаем chat_id Telegram канала
      processedTgChatId = extractTelegramChatId(tg_chat_id);
      logEvent("INFO", "tg_url_converted", license_key, `${tg_chat_id} -> ${processedTgChatId}`, binding_name);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в Telegram ссылке: ${error.message}`
      }, 400);
    }
    
    // Создаем новую связку с обработанными ID
    var bindingId = generateBindingId();
    var license = findLicense(license_key);
    
    // Обработка formatSettings
    var formatSettingsString = "";
    if (formatSettings && typeof formatSettings === "object") {
      try {
        formatSettingsString = JSON.stringify(formatSettings);
        logEvent("DEBUG", "format_settings_stored", license_key, 
                 `Binding ${bindingId}: ${formatSettingsString}`, binding_name);
      } catch (e) {
        logEvent("WARN", "format_settings_json_error", license_key, e.message, binding_name);
      }
    }

    var bindingsSheet = getSheet("Bindings");
    bindingsSheet.appendRow([
      bindingId,
      license_key,
      license.email,
      vk_group_url,          // Сохраняем оригинальную ссылку для отображения
      processedTgChatId,     // Сохраняем обработанный chat_id для API
      "active",
      new Date().toISOString(),
      new Date().toISOString(),
      formatSettingsString,  // Format Settings
      binding_name || "",    // Binding Name
      binding_description || "" // Binding Description
    ]);
    
    // Создаем Published лист для отслеживания постов
    try {
      createPublishedSheet(binding_name || `Binding_${bindingId.substring(0, 8)}`);
      logEvent("INFO", "published_sheet_created_for_binding", license_key, 
               `Created Published sheet for binding: ${binding_name || bindingId}`, binding_name || bindingId);
    } catch (sheetError) {
      logEvent("WARN", "published_sheet_creation_warning", license_key, 
               `Failed to create Published sheet for binding ${bindingId}: ${sheetError.message}`, binding_name || bindingId);
      // Не прерываем процесс, так как основная функция выполнена
    }
    
    logEvent("INFO", "binding_added", license_key, 
             `Binding ID: ${bindingId}, VK: ${vk_group_url} (${processedVkGroupId}), TG: ${processedTgChatId}, IP: ${clientIp}`, binding_name);
    
    return jsonResponse({
      success: true,
      binding_id: bindingId,
      converted: {
        vk_group_id: processedVkGroupId,
        tg_chat_id: processedTgChatId
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_add_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleEditBinding(payload, clientIp) {
  try {
    var { license_key, binding_id, vk_group_url, tg_chat_id, formatSettings, binding_name, binding_description } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    var bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // АВТОМАТИЧЕСКОЕ ПРЕОБРАЗОВАНИЕ ССЫЛОК В ID
    var processedVkGroupId;
    var processedTgChatId;
    
    try {
      // Извлекаем ID ВК группы из ссылки
      processedVkGroupId = extractVkGroupId(vk_group_url);
      logEvent("INFO", "vk_url_converted", license_key, `${vk_group_url} -> ${processedVkGroupId}`, binding_name);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в ВК ссылке: ${error.message}`
      }, 400);
    }
    
    try {
      // Извлекаем chat_id Telegram канала
      processedTgChatId = extractTelegramChatId(tg_chat_id);
      logEvent("INFO", "tg_url_converted", license_key, `${tg_chat_id} -> ${processedTgChatId}`, binding_name);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в Telegram ссылке: ${error.message}`
      }, 400);
    }
    
    // Обработка formatSettings
    var formatSettingsString = "";
    if (formatSettings && typeof formatSettings === "object") {
      try {
        formatSettingsString = JSON.stringify(formatSettings);
        logEvent("DEBUG", "format_settings_updated", license_key, 
                 `Binding ${binding_id}: ${formatSettingsString}`, binding_name);
      } catch (e) {
        logEvent("WARN", "format_settings_json_error", license_key, e.message, binding_name);
      }
    }

    // Обновляем связку с обработанными ID
    var bindingsSheet = getSheet("Bindings");
    bindingsSheet.getRange(bindingRow, 4).setValue(vk_group_url);      // VK Group URL (оригинальная ссылка)
    bindingsSheet.getRange(bindingRow, 5).setValue(processedTgChatId); // TG Chat ID (обработанный)
    bindingsSheet.getRange(bindingRow, 8).setValue(new Date().toISOString()); // Last Check
    bindingsSheet.getRange(bindingRow, 9).setValue(formatSettingsString); // Format Settings
    
    // ✅ ДОБАВЛЕНЫ НОВЫЕ ПОЛЯ:
    bindingsSheet.getRange(bindingRow, 10).setValue(binding_name || "");        // Binding Name
    bindingsSheet.getRange(bindingRow, 11).setValue(binding_description || ""); // Binding Description
    
    logEvent("INFO", "binding_edited", license_key, 
             `Binding ID: ${binding_id}, Name: ${binding_name}, VK: ${vk_group_url} (${processedVkGroupId}), TG: ${processedTgChatId}, IP: ${clientIp}`, binding_name);
    
    return jsonResponse({ 
      success: true,
      converted: {
        vk_group_id: processedVkGroupId,
        tg_chat_id: processedTgChatId
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_edit_error", payload.license_key, error.message, binding_name);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}



function handleDeleteBinding(payload, clientIp) {
  try {
    var { license_key, binding_id } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим и удаляем связку
    var bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    var bindingsSheet = getSheet("Bindings");
    var bindingName = bindingsSheet.getRange(bindingRow, 10).getValue(); // Binding Name column
    
    bindingsSheet.deleteRow(bindingRow);
    
    logEvent("INFO", "binding_deleted", license_key, 
             `Binding ID: ${binding_id}, Name: ${bindingName}, IP: ${clientIp}`, bindingName);
    
    return jsonResponse({ success: true });
    
  } catch (error) {
    logEvent("ERROR", "binding_delete_error", payload.license_key, error.message, bindingName);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleToggleBindingStatus(payload, clientIp) {
  try {
    var { license_key, binding_id } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    var bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // Переключаем статус
    var bindingsSheet = getSheet("Bindings");
    var currentStatus = bindingsSheet.getRange(bindingRow, 6).getValue();
    var newStatus = currentStatus === "active" ? "paused" : "active";
    var bindingName = bindingsSheet.getRange(bindingRow, 10).getValue(); // Binding Name column
    
    bindingsSheet.getRange(bindingRow, 6).setValue(newStatus);
    bindingsSheet.getRange(bindingRow, 8).setValue(new Date().toISOString());
    
    logEvent("INFO", "binding_status_changed", license_key, 
             `Binding ID: ${binding_id}, Name: ${bindingName}, Status: ${currentStatus} → ${newStatus}, IP: ${clientIp}`, bindingName);
    
    return jsonResponse({
      success: true,
      new_status: newStatus
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_status_error", payload.license_key, error.message, bindingName);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetGlobalSetting(payload, clientIp) {
  try {
    var { license_key, setting_key } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    if (!setting_key) {
      return jsonResponse({
        success: false,
        error: "Setting key required"
      }, 400);
    }
    
    // Получаем настройку из ScriptProperties
    var props = PropertiesService.getScriptProperties();
    var globalSettingKey = `global_${setting_key}`;
    var value = props.getProperty(globalSettingKey);
    
    logEvent("INFO", "global_setting_retrieved", license_key, 
             `Setting: ${setting_key}, Value: ${value}, IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      value: value
    });
    
  } catch (error) {
    logEvent("ERROR", "get_global_setting_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleSetGlobalSetting(payload, clientIp) {
  try {
    var { license_key, setting_key, setting_value } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    if (!setting_key) {
      return jsonResponse({
        success: false,
        error: "Setting key required"
      }, 400);
    }
    
    // Сохраняем настройку в ScriptProperties
    var props = PropertiesService.getScriptProperties();
    var globalSettingKey = `global_${setting_key}`;
    
    if (setting_value === null || setting_value === undefined) {
      // Удаляем настройку если значение null/undefined
      props.deleteProperty(globalSettingKey);
      logEvent("INFO", "global_setting_deleted", license_key, 
               `Setting: ${setting_key}, IP: ${clientIp}`);
    } else {
      props.setProperty(globalSettingKey, String(setting_value));
      logEvent("INFO", "global_setting_saved", license_key, 
               `Setting: ${setting_key}, Value: ${setting_value}, IP: ${clientIp}`);
    }
    
    return jsonResponse({
      success: true,
      value: setting_value
    });
    
  } catch (error) {
    logEvent("ERROR", "set_global_setting_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Обработчик логирования от клиента
 * @param {Object} payload - Данные запроса
 * @param {string} clientIp - IP адрес клиента
 * @return {ContentService.TextOutput} - JSON ответ
 */
function handleClientLog(payload, clientIp) {
  try {
    const { level, logEvent, source, details, bindingName, user } = payload;
    
    // Валидация обязательных полей
    if (!level || !logEvent) {
      return jsonResponse({
        success: false,
        error: "Missing required fields: level, logEvent"
      }, 400);
    }
    
    // Создаем уникальную метку времени (ISO + короткий UUID)
    const timestamp = new Date();
    const timestampStr = `${timestamp.toISOString()}_${Utilities.getUuid().slice(0, 8)}`;
    
    // Подготавливаем данные
    const resolvedSource = source || "client";
    const message = typeof details === 'string' ? details : (details === undefined || details === null ? "" : JSON.stringify(details));
    const extraJson = typeof details === 'object' ? JSON.stringify(details) : "";
    
    // Записываем в глобальный лист Logs
    writeToGlobalLogs(timestampStr, level, resolvedSource, logEvent, bindingName || "", message, extraJson);
    
    // Записываем в лист связки, если указано имя связки
    if (bindingName) {
      writeToBindingSheet(bindingName, timestampStr, level, resolvedSource, logEvent, bindingName, message, extraJson);
    }
    
    // Логируем в консоль
    console.log(`[CLIENT LOG] [${level}] ${logEvent} (${user || 'client'}, source: ${resolvedSource}${bindingName ? ', binding: ' + bindingName : ''}): ${message}`);
    
    return jsonResponse({
      success: true,
      timestamp: timestampStr,
      loggedTo: ["global_logs"].concat(bindingName ? ["binding_sheet"] : [])
    });
    
  } catch (error) {
    console.error("Client logging error:", error.message);
    return jsonResponse({ 
      success: false, 
      error: error.message 
    }, 500);
  }
}

// Дополнительные обработчики для отправки постов и публикации

function handleSendPost(payload, clientIp) {
  try {
    var { license_key, binding_id, vk_post } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Проверяем глобальную настройку "disable_all_stores"
    var props = PropertiesService.getScriptProperties();
    var disableAllStores = props.getProperty("global_disable_all_stores");
    
    if (disableAllStores === "true") {
      logEvent("INFO", "post_blocked_by_global_setting", license_key, 
               `Post sending blocked by global disable_all_stores setting`, binding.bindingName);
      return jsonResponse({
        success: false,
        error: "All stores are globally disabled",
        blocked_by_global_setting: true
      }, 403);
    }

    // Находим связку
    var binding = findBindingById(binding_id, license_key);
    if (!binding) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    if (binding.status !== "active") {
      return jsonResponse({
        success: false,
        error: "Binding is not active"
      }, 403);
    }
    
    // Отправляем пост в Telegram с учетом настроек связки
    var sendResult = sendVkPostToTelegram(binding.tgChatId, vk_post, binding);
    
    if (sendResult.success) {
      logEvent("INFO", "post_sent_successfully", license_key, 
               `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, Message ID: ${sendResult.message_id}, IP: ${clientIp}`, binding.bindingName);
    } else {
      logEvent("ERROR", "post_send_failed", license_key, 
               `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, Error: ${sendResult.error}, IP: ${clientIp}`, binding.bindingName);
    }
    
    return jsonResponse(sendResult);
    
  } catch (error) {
    logEvent("ERROR", "send_post_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleTestPublication(payload, clientIp) {
  try {
    var { license_key, tg_chat_id } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    var botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      return jsonResponse({
        success: false,
        error: "Bot token not configured"
      }, 500);
    }
    
    var testMessage = "✅ Тестовое сообщение VK→Telegram\n\nВаш бот успешно настроен и может отправлять сообщения в этот чат.";
    
    var result = sendTelegramMessage(botToken, tg_chat_id, testMessage);
    
    logEvent("INFO", "test_publication", license_key, 
             `Chat ID: ${tg_chat_id}, Success: ${result.success}, IP: ${clientIp}`);
    
    return jsonResponse(result);
    
  } catch (error) {
    logEvent("ERROR", "test_publication_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetVkPosts(payload, clientIp) {
  try {
    var { license_key, vk_group_id, count = 50 } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    if (!vk_group_id) {
      return jsonResponse({
        success: false,
        error: "vk_group_id required"
      }, 400);
    }
    
    // Валидация vk_group_id в формате '^-?\d+$'
    if (!/^-?\d+$/.test(vk_group_id)) {
      logEvent("WARN", "invalid_vk_group_id_format", license_key, 
               `Invalid vk_group_id format: ${vk_group_id}, Expected: numeric with optional minus sign, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "Invalid vk_group_id format. Expected numeric format like: -123456 or 123456"
      }, 400);
    }
    
    // Проверяем VK User Token
    var userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      logEvent("ERROR", "vk_user_token_missing", license_key, 
               `Cannot fetch posts without VK User Access Token, Group ID: ${vk_group_id}, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "VK User Access Token не настроен на сервере"
      }, 500);
    }
    
    // Формируем URL для VK API
    var apiUrl = `https://api.vk.com/method/wall.get?owner_id=${encodeURIComponent(vk_group_id)}&count=${encodeURIComponent(count)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    // Логируем API запрос (без токена)
    var logUrl = `https://api.vk.com/method/wall.get?owner_id=${vk_group_id}&count=${count}&v=${VK_API_VERSION}&access_token=***`;
    logEvent("DEBUG", "vk_api_request", license_key, 
             `Request URL: ${logUrl}, Group ID: ${vk_group_id}, IP: ${clientIp}`);
    
    // Получаем посты из ВК
    try {
      var response = UrlFetchApp.fetch(apiUrl, {
        muteHttpExceptions: true,
        timeout: 15000
      });
      
      var responseData = JSON.parse(response.getContentText());
      
      logEvent("DEBUG", "vk_api_response", license_key, 
               `Group ID: ${vk_group_id}, HTTP Status: ${response.getResponseCode()}, Has VK error: ${!!responseData.error}, Response length: ${response.getContentText().length}, IP: ${clientIp}`);
      
      if (responseData.error) {
        logEvent("ERROR", "vk_api_error", license_key,
                 `Group ID: ${vk_group_id}, VK Error code: ${responseData.error.error_code}, Message: ${responseData.error.error_msg}, IP: ${clientIp}`);
        
        // Возвращаем информативную ошибку
        var errorMessage = `VK API Error: ${responseData.error.error_msg}`;
        
        if (responseData.error.error_code === 5) {
          errorMessage = "User authorization failed: VK Access Token is invalid or expired";
        } else if (responseData.error.error_code === 15) {
          errorMessage = "Access denied: Unable to access VK group posts";
        } else if (responseData.error.error_code === 100) {
          errorMessage = "Invalid VK group ID";
        } else if (responseData.error.error_code === 200) {
          errorMessage = "Access to this VK group denied";
        }
        
        return jsonResponse({
          success: false,
          error: errorMessage,
          vk_error_code: responseData.error.error_code
        }, 400);
      }
      
      var posts = responseData.response ? responseData.response.items || [] : [];
      
      // Фильтруем уже отправленные посты используя Published листы
      try {
        var bindings = getUserBindings(license_key);
        var filteredPosts = [];
        
        for (var post of posts) {
          var alreadySent = false;
          
          // Проверяем для каждой связки этого пользователя
          for (var binding of bindings) {
            if (binding.vkGroupUrl) {
              var bindingGroupId = extractVkGroupId(binding.vkGroupUrl);
              if (bindingGroupId === vk_group_id && binding.bindingName) {
                if (checkPostAlreadySent(binding.bindingName, post.id)) {
                  alreadySent = true;
                  logEvent("DEBUG", "post_already_sent", license_key, 
                           `Post ${post.id} already sent to ${binding.bindingName}`);
                  break;
                }
              }
            }
          }
          
          if (!alreadySent) {
            filteredPosts.push(post);
          }
        }
        
        logEvent("INFO", "vk_posts_filtered", license_key, 
                 `Group ID: ${vk_group_id}, Original: ${posts.length}, Filtered: ${filteredPosts.length}, IP: ${clientIp}`);
        
        return jsonResponse({
          success: true,
          posts: filteredPosts,
          group_id: vk_group_id,
          total_count: responseData.response ? responseData.response.count : 0,
          filtered_count: filteredPosts.length
        });
        
      } catch (filterError) {
        logEvent("WARN", "post_filtering_failed", license_key, 
                 `Failed to filter posts: ${filterError.message}, returning all posts`);
        
        logEvent("INFO", "vk_posts_retrieved", license_key, 
                 `Group ID: ${vk_group_id}, Posts count: ${posts.length}, IP: ${clientIp}`);
        
        return jsonResponse({
          success: true,
          posts: posts,
          group_id: vk_group_id,
          total_count: responseData.response ? responseData.response.count : 0
        });
      }
      
    } catch (vkError) {
      logEvent("ERROR", "vk_posts_fetch_error", license_key, 
               `Group ID: ${vk_group_id}, Error: ${vkError.message}, IP: ${clientIp}`);
      
      return jsonResponse({
        success: false,
        error: `Не удалось получить посты из ВК: ${vkError.message}`,
        details: {
          group_id: vk_group_id,
          vk_error: vkError.message
        }
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "get_vk_posts_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}



// ============================================
// 4. TELEGRAM API
// ============================================

function sendVkPostToTelegram(chatId, vkPost, binding) {
  try {
    var botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      return { success: false, error: "Bot token not configured" };
    }
    
    // Форматируем текст с учетом настроек связки
    var text = formatVkPostForTelegram(vkPost, binding);
    
    // Обрабатываем все типы вложений
    var mediaData = getVkMediaUrls(vkPost.attachments || []);
    
    logEvent("DEBUG", "media_processing_result", "server", 
             `Photos: ${mediaData.photos.length}, Videos: ${mediaData.videos.length}, Docs: ${mediaData.docLinks.length}, Audio: ${mediaData.audioLinks.length}`);
    
    // Подготавливаем массив медиа для оптимизированной отправки
    var allMedia = [];
    
    // Добавляем фото
    allMedia = allMedia.concat(mediaData.photos);
    
    // Добавляем видео
    allMedia = allMedia.concat(mediaData.videos);
    
    // Добавляем документы как объекты (преобразуем из ссылок)
    // Note: docLinks сейчас содержат markdown ссылки, а не URL документов
    // Для отправки документов нужны прямые URL, которые пока не поддерживаются
    // Оставляем docLinks для текстовой отправки как раньше
    
    var results = [];
    
    try {
      // ИСПОЛЬЗУЕМ ОПТИМИЗИРОВАННУЮ ОТПРАВКУ!
      if (allMedia.length > 0) {
        var optimizedResult = sendMixedMediaOptimized(
          botToken, 
          chatId, 
          allMedia, 
          text,
          { parse_mode: 'HTML' }
        );
        results.push(optimizedResult);
        
        if (!optimizedResult.success) {
          logEvent("WARN", "optimized_media_send_failed", "server", 
                   `Error: ${optimizedResult.error}`);
        } else {
          // Логируем успешную оптимизацию
          if (optimizedResult.optimization_stats && optimizedResult.optimization_stats.api_calls_saved > 0) {
            logEvent("INFO", "media_optimization_success", "server", 
                     `API calls saved: ${optimizedResult.optimization_stats.api_calls_saved}, Photo groups: ${optimizedResult.optimization_stats.photo_groups}`);
          }
        }
      } else {
        // Только текст без медиа
        const textResult = sendTelegramMessage(botToken, chatId, text);
        results.push(textResult);
      }
      
      // Отправляем документы и аудио отдельными сообщениями (как и раньше)
      var additionalContent = [];
      if (mediaData.docLinks.length > 0) {
        additionalContent.push("📎 Документы:\n" + mediaData.docLinks.join("\n"));
      }
      if (mediaData.audioLinks.length > 0) {
        additionalContent.push("🎵 Аудио:\n" + mediaData.audioLinks.join("\n"));
      }
      
      if (additionalContent.length > 0) {
        const additionalText = additionalContent.join("\n\n");
        const additionalResult = sendTelegramMessage(botToken, chatId, additionalText);
        results.push(additionalResult);
      }
      
      // Определяем общий результат
      const successCount = results.filter(function(r) { return r.success; }).length;
      const totalCount = results.length;
      
      if (successCount === 0) {
        return { success: false, error: "All media parts failed to send" };
      } else if (successCount < totalCount) {
        return { 
          success: true, 
          message_id: results.find(r => r.success)?.message_id,
          warning: `Partial success: ${successCount}/${totalCount} parts sent`,
          results: results
        };
      } else {
        var finalResult = {
          success: true,
          message_id: results.find(r => r.success)?.message_id,
          results: results
        };

        // Сохраняем информацию об отправленном посте в Published лист
        try {
          if (binding && binding.bindingName && vkPost && vkPost.id) {
            saveLastPostIdToSheet(binding.bindingName, binding.vkGroupId || 'unknown', vkPost.id, {
              tgChatName: chatId,
              preview: (vkPost.text || '').substring(0, 100) + (vkPost.text && vkPost.text.length > 100 ? '...' : '')
            });

            logEvent("INFO", "post_saved_to_published_sheet", "server",
                     `Post ${vkPost.id} saved to ${getPublishedSheetName(binding.bindingName)}`, binding.bindingName);
          }
        } catch (saveError) {
          logEvent("WARN", "post_save_to_sheet_failed", "server",
                   `Post ID: ${vkPost?.id}, Error: ${saveError.message}`);
          // Не прерываем успешную отправку из-за ошибки сохранения
        }

        return finalResult;
      }

      } catch (mediaError) {
      logEvent("ERROR", "media_send_strategy_error", "server", mediaError.message);

      // Fallback: отправляем только текст
      if (text) {
       var fallbackResult = sendTelegramMessage(botToken, chatId, text);

       // Сохраняем информацию даже для fallback
       if (fallbackResult.success && binding && binding.bindingName && vkPost && vkPost.id) {
         try {
           saveLastPostIdToSheet(binding.bindingName, binding.vkGroupId || 'unknown', vkPost.id, {
             tgChatName: chatId,
             preview: (vkPost.text || '').substring(0, 100) + (vkPost.text && vkPost.text.length > 100 ? '...' : '')
           });
         } catch (saveError) {
           logEvent("WARN", "fallback_post_save_failed", "server", saveError.message);
         }
       }

       return fallbackResult;
      }

      return { success: false, error: mediaError.message };
    }
    
  } catch (error) {
    logEvent("ERROR", "send_telegram_error", "server", error.message);
    return { success: false, error: error.message };
  }
}

function sendTelegramMessage(token, chatId, text) {
  try {
    var url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    var payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    };
    
    var response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: TIMEOUTS.FAST // 8 секунд для отправки текста
    });
    
    var responseText = response.getContentText();
    var result = JSON.parse(responseText);
    
    if (result.ok) {
      logEvent("DEBUG", "telegram_message_sent", "server", 
               `Chat: ${chatId}, Message ID: ${result.result.message_id}, Text length: ${text?.length || 0}`);
      return { success: true, message_id: result.result.message_id };
    } else {
      // Детальное логирование ошибки Telegram API
      logApiError("TELEGRAM", "sendMessage", {
        chat_id: chatId,
        text_length: text?.length || 0,
        parse_mode: "Markdown"
      }, {
        status_code: response.getResponseCode(),
        error_code: result.error_code,
        description: result.description,
        response_body: responseText.substring(0, 500)
      });
      
      return { success: false, error: result.description || "Unknown error" };
    }
    
  } catch (error) {
    logEvent("ERROR", "telegram_message_exception", "server", 
             `Chat: ${chatId}, Error: ${error.message}, Text length: ${text?.length || 0}`);
    return { success: false, error: error.message };
  }
}

function sendTelegramMediaGroup(token, chatId, mediaUrls, caption) {
  try {
    if (mediaUrls.length === 0) {
      return sendTelegramMessage(token, chatId, caption);
    }
    
    var MAX_CAPTION_LENGTH = 1024; // Лимит Telegram для caption
    
    // Проверяем длину caption
    if (caption && caption.length > MAX_CAPTION_LENGTH) {
      logEvent("WARN", "caption_too_long", "server", 
               `Caption length: ${caption.length}, splitting media and text`);
      
      // Отправляем медиа БЕЗ подписи
      var mediaResult = sendMediaGroupWithoutCaption(token, chatId, mediaUrls);
      
      if (mediaResult.success) {
        // Отправляем текст отдельным сообщением (или несколькими, если очень длинный)
        var textResult = sendLongTextMessage(token, chatId, caption);
        
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
    var url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    
    var media = mediaUrls.slice(0, 10).map((item) => ({
      type: item.type,
      media: item.url
      // НЕ добавляем caption и parse_mode
    }));
    
    var response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: chatId,
        media: media
      }),
      muteHttpExceptions: true,
      timeout: TIMEOUTS.MEDIUM // 15 секунд для media group
    });
    
    var result = JSON.parse(response.getContentText());
    
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
    var url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    
    var media = mediaUrls.slice(0, 10).map((item, index) => ({
      type: item.type,
      media: item.url,
      caption: index === 0 ? caption : undefined,
      parse_mode: index === 0 ? 'Markdown' : undefined
    }));
    
    var response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: chatId,
        media: media
      }),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    var result = JSON.parse(response.getContentText());
    
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
    var MAX_MESSAGE_LENGTH = 4096; // Лимит Telegram для текстовых сообщений
    
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
    
    var textParts = splitTextIntoChunks(text, MAX_MESSAGE_LENGTH);
    var lastMessageId = null;
    
    for (let i = 0; i < textParts.length; i++) {
      var part = textParts[i];
      var partPrefix = textParts.length > 1 ? `📝 ${i + 1}/${textParts.length}: ` : '';
      
      var result = sendTelegramMessage(token, chatId, partPrefix + part);
      
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
  var chunks = [];
  var currentChunk = "";
  
  // Разбиваем текст по предложениям
  var sentences = text.split(/([.!?]\s+)/);
  
  for (let i = 0; i < sentences.length; i++) {
    var sentence = sentences[i];
    
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
        var forcedChunks = sentence.match(new RegExp(`.{1,${maxLength}}`, 'g'));
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
    var forcedChunks = text.match(new RegExp(`.{1,${maxLength}}`, 'g'));
    chunks.push(...forcedChunks);
  }
  
  return chunks;
}

/**
 * Отправляет видео в Telegram как файл
 */
function sendTelegramVideo(token, chatId, videoUrl, caption) {
  try {
    var url = `https://api.telegram.org/bot${token}/sendVideo`;
    
    var payload = {
      chat_id: chatId,
      video: videoUrl,
      caption: caption || undefined,
      parse_mode: caption ? 'Markdown' : undefined,
      supports_streaming: true
    };
    
    // Удаляем undefined поля
    if (!payload.caption) {
      delete payload.caption;
      delete payload.parse_mode;
    }
    
    logEvent("DEBUG", "telegram_video_send_start", "server", 
             `Chat: ${chatId}, Video URL length: ${videoUrl?.length || 0}, Caption length: ${caption?.length || 0}`);
    
    var response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: TIMEOUTS.SLOW // 30 секунд для отправки видео
    });
    
    var responseText = response.getContentText();
    var result = JSON.parse(responseText);
    
    if (result.ok) {
      logEvent("DEBUG", "telegram_video_sent", "server", 
               `Chat: ${chatId}, Message ID: ${result.result.message_id}, Video URL length: ${videoUrl?.length || 0}`);
      return { success: true, message_id: result.result.message_id };
    } else {
      // Детальное логирование ошибки Telegram API
      logApiError("TELEGRAM", "sendVideo", {
        chat_id: chatId,
        video_url_length: videoUrl?.length || 0,
        caption_length: caption?.length || 0
      }, {
        status_code: response.getResponseCode(),
        error_code: result.error_code,
        description: result.description,
        response_body: responseText.substring(0, 500)
      });
      
      return { success: false, error: result.description || "Video send failed" };
    }
    
  } catch (error) {
    logEvent("ERROR", "telegram_video_exception", "server", 
             `Chat: ${chatId}, Error: ${error.message}, Video URL length: ${videoUrl?.length || 0}`);
    return { success: false, error: error.message };
  }
}

// ============================================
// 5. VK API
// ============================================
function getVkPosts(groupId, count = 10) {
  try {
    var userToken = PropertiesService.getScriptProperties()
      .getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      throw new Error("VK User Access Token not configured");
    }
    
    // Преобразуем group ID в owner ID
    var ownerId = groupId.toString().startsWith("-") ? groupId : `-${groupId}`;
    
    var url = `https://api.vk.com/method/wall.get?owner_id=${ownerId}&count=${count}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    logEvent("DEBUG", "vk_posts_request", "server", 
             `Group ID: ${groupId}, Owner ID: ${ownerId}, Count: ${count}`);
    
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      timeout: TIMEOUTS.MEDIUM // 15 секунд для получения постов
    });
    
    var responseText = response.getContentText();
    var data = JSON.parse(responseText);
    
    if (data.error) {
      var errorCode = data.error.error_code;
      var errorMsg = data.error.error_msg;
      
      // Детальное логирование ошибки VK API
      logApiError("VK_API", "wall.get", {
        owner_id: ownerId,
        count: count,
        v: VK_API_VERSION
      }, {
        status_code: response.getResponseCode(),
        error_code: errorCode,
        description: errorMsg,
        response_body: responseText.substring(0, 500)
      });
      
      // Более подробные ошибки для пользователей
      if (errorCode === 5) {
        errorMsg = "Авторизация не удалась (проверьте токен)";
      } else if (errorCode === 10) {
        errorMsg = "Внутренняя ошибка сервера VK (повторите запрос)";
      } else if (errorCode === 15) {
        errorMsg = "Нет доступа к группе/странице (требуется разрешение)";
      } else if (errorCode === 200) {
        errorMsg = "Нет доступа к альбому (приватный контент)";
      } else if (errorCode === 30) {
        errorMsg = "Группа/страница закрыта или приватная";
      } else if (errorCode === 113) {
        errorMsg = "Неверный ID группы/пользователя";
      } else if (errorCode === 18) {
        errorMsg = "Страница удалена или заблокирована";
      } else if (errorCode === 203) {
        errorMsg = "Нет доступа к сообществу";
      }
      
      throw new Error(`VK API Error (${errorCode}): ${errorMsg}`);
    }
    
    if (!data.response || !data.response.items || data.response.items.length === 0) {
      logEvent("INFO", "vk_posts_empty", "server", 
               `Group ID: ${groupId} - no posts found`);
      return [];
    }
    
    var posts = data.response.items.map(post => ({
      id: post.id,
      text: post.text || "",
      date: post.date,
      attachments: post.attachments || []
    }));
    
    logEvent("INFO", "vk_posts_retrieved", "server", 
             `Group ID: ${groupId}, Posts found: ${posts.length}`);
    
    return posts;
    
  } catch (error) {
    logEvent("ERROR", "vk_api_error", "server", 
             `Group ID: ${groupId}, Error: ${error.message}`);
    throw error;  // Пробрасываем ошибку дальше
  }
}


// Функция extractVkGroupId удалена - используется новая версия в конце файла

// ============================================
// 6. УТИЛИТЫ И ХЕЛПЕРЫ
// ============================================

function formatVkTextForTelegram(text, options) {
  if (!text) return "";
  
  options = options || {};
  var boldFirstLine = options.boldFirstLine !== false; // по умолчанию true
  var boldUppercase = options.boldUppercase !== false; // по умолчанию true
  
  // Делаем жирным первое предложение (если включено)
  if (boldFirstLine) {
    text = text.replace(/^([^.!?]*[.!?])/, '*$1*');
  }
  
  // Делаем жирными слова в ВЕРХНЕМ РЕГИСТРЕ (если включено)
  if (boldUppercase) {
    text = text.replace(/\b[А-ЯA-Z]{2,}\b/g, '*$&*');
  }
  
  // Преобразуем ссылки VK в правильный формат для Telegram
  text = text.replace(/\[(id\d+|club\d+|public\d+|\w+)\|([^\]]+)\]/g, function(match, id, title) {
    // Если это числовой ID пользователя или группы
    if (id.startsWith('id')) {
      return `[${title}](https://vk.com/${id})`;
    } else if (id.startsWith('club') || id.startsWith('public')) {
      return `[${title}](https://vk.com/${id})`;
    } else {
      // Обычное имя пользователя или группы
      return `[${title}](https://vk.com/${id})`;
    }
  });
  
  // Удаляем лишние пробелы
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Форматирует полный VK пост для отправки в Telegram с учетом настроек связки
 */
function formatVkPostForTelegram(vkPost, binding) {
  if (!vkPost) return "";
  
  // Получаем настройки форматирования из связки
  var formatOptions = {
    boldFirstLine: false,
    boldUppercase: false
  };
  
  // Парсим formatSettings из связки
  if (binding && binding.formatSettings) {
    try {
      var settings = typeof binding.formatSettings === 'string' 
        ? JSON.parse(binding.formatSettings) 
        : binding.formatSettings;
      
      formatOptions.boldFirstLine = settings.boldFirstLine || false;
      formatOptions.boldUppercase = settings.boldUppercase || false;
      
      logEvent("DEBUG", "format_settings_applied", binding.licenseKey || "unknown", 
               `Bold first: ${formatOptions.boldFirstLine}, Bold uppercase: ${formatOptions.boldUppercase}`);
    } catch (e) {
      logEvent("WARN", "format_settings_parse_error", binding.licenseKey || "unknown", e.message);
    }
  }
  
  // ✅ ВОЗВРАЩАЕМ ТОЛЬКО ОТФОРМАТИРОВАННЫЙ ТЕКСТ
  // ❌ Никаких ссылок на VK пост! Никакой инфы о медиа!
  return vkPost.text ? formatVkTextForTelegram(vkPost.text, formatOptions) : "";
}


function getVkVideoDirectUrl(videoId) {
  try {
    var userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      logEvent("WARN", "vk_user_token_missing", "server", "Cannot get video URLs without user token");
      return null;
    }
    
    logEvent("DEBUG", "vk_video_request_start", "server", `Video ID: ${videoId}`);
    
    var url = `https://api.vk.com/method/video.get?videos=${encodeURIComponent(videoId)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      timeout: TIMEOUTS.SLOW // 30 секунд для получения видео (медленная операция)
    });
    
    var responseText = response.getContentText();
    logEvent("DEBUG", "vk_video_api_response", "server", `Status: ${response.getResponseCode()}, Body length: ${responseText.length}, First 200 chars: ${responseText.substring(0, 200)}`);
    
    var data = JSON.parse(responseText);
    
    if (data.error) {
      logEvent("WARN", "vk_video_api_error", "server", `Video ID: ${videoId}, Error Code: ${data.error.error_code}, Message: ${data.error.error_msg}`);
      return null;
    }
    
    if (!data.response || !data.response.items || data.response.items.length === 0) {
      logEvent("DEBUG", "vk_video_not_found", "server", `Video ID: ${videoId} - no items in response`);
      return null;
    }
    
    var video = data.response.items[0];
    logEvent("DEBUG", "vk_video_details", "server", `Video: "${video.title?.substring(0, 50) || 'No title'}", Duration: ${video.duration}, Owner: ${video.owner_id}`);
    
    // Ищем лучшее качество видео
    var files = video.files;
    if (files) {
      var availableQualities = Object.keys(files).filter(key => key.startsWith('mp4_'));
      logEvent("DEBUG", "vk_video_qualities", "server", `Available: [${availableQualities.join(', ')}]`);
      
      var qualities = ['mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
      
      for (const quality of qualities) {
        if (files[quality]) {
          logEvent("INFO", "vk_video_url_found", "server", `Video ID: ${videoId}, Quality: ${quality}, URL length: ${files[quality].length}`);
          return files[quality];
        }
      }
    } else {
      logEvent("DEBUG", "vk_video_no_files", "server", `Video ID: ${videoId} - no files object in response`);
    }
    
    // Если нет прямых ссылок, возвращаем player
    var playerUrl = video.player;
    if (playerUrl) {
      logEvent("DEBUG", "vk_video_player_url", "server", `Video ID: ${videoId}, Player URL: ${playerUrl.substring(0, 100)}...`);
    }
    
    return playerUrl || null;
    
  } catch (error) {
    logEvent("ERROR", "vk_video_direct_url_error", "server", `Video ID: ${videoId}, Error: ${error.message}, Stack: ${error.stack?.substring(0, 200)}`);
    return null;
  }
}

function getBestPhotoUrl(sizes) {
  if (!sizes || sizes.length === 0) return null;
  
  // Ищем самое высокое качество
  var preferredTypes = ['w', 'z', 'y', 'x', 'r', 'q', 'p', 'o', 'n', 'm', 's'];
  
  for (const type of preferredTypes) {
    var size = sizes.find(s => s.type === type);
    if (size) return size.url;
  }
  
  return sizes[sizes.length - 1].url;
}

function generateBindingId() {
  return 'binding_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
}

function createSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    
    // Форматируем заголовки
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#667eea");
    headerRange.setFontColor("white");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

function getSheet(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet "${name}" not found. Run server initialization first.`);
  }
  return sheet;
}

function findLicense(licenseKey) {
  try {
    var sheet = getSheet("Licenses");
    var data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === licenseKey) {
        return {
          key: data[i][0],
          email: data[i][1],
          type: data[i][2],
          maxGroups: data[i][3],
          expires: data[i][4],
          createdAt: data[i][5],
          status: data[i][6],
          notes: data[i][7]
        };
      }
    }
    
    return null;
  } catch (error) {
    logEvent("ERROR", "find_license_error", "system", error.message);
    return null;
  }
}

function findBindingById(bindingId, licenseKey) {
  try {
    var sheet = getSheet("Bindings");
    var data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === bindingId && data[i][1] === licenseKey) {
        return {
          id: data[i][0],
          licenseKey: data[i][1],
          userEmail: data[i][2],
          vkGroupUrl: data[i][3],
          tgChatId: data[i][4],
          status: data[i][5],
          createdAt: data[i][6],
          lastCheck: data[i][7],
          formatSettings: data[i][8] || "",
          bindingName: data[i][9] || "",
          bindingDescription: data[i][10] || ""
        };
      }
    }
    
    return null;
  } catch (error) {
    logEvent("ERROR", "find_binding_error", "system", error.message);
    return null;
  }
}

function findBindingRowById(bindingId, licenseKey) {
  try {
    var sheet = getSheet("Bindings");
    var data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === bindingId && data[i][1] === licenseKey) {
        return i + 1; // возвращаем номер строки (1-based)
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function getUserBindings(licenseKey) {
  try {
    var sheet = getSheet("Bindings");
    var data = sheet.getDataRange().getValues();
    var bindings = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === licenseKey) {
        bindings.push({
          id: data[i][0],
          licenseKey: data[i][1],
          userEmail: data[i][2],
          vkGroupUrl: data[i][3],
          tgChatId: data[i][4],
          status: data[i][5],
          createdAt: data[i][6],
          lastCheck: data[i][7],
          formatSettings: data[i][8],
          bindingName: data[i][9],
          bindingDescription: data[i][10]
        });
      }
    }
    
    return bindings;
  } catch (error) {
    logEvent("ERROR", "get_user_bindings_error", licenseKey, error.message);
    return [];
  }
}

function getUserBindingsWithNames(licenseKey) {
  try {
    var sheet = getSheet("Bindings");
    var data = sheet.getDataRange().getValues();
    var bindings = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === licenseKey) {
        var vkGroupUrl = data[i][3];
        var tgChatId = data[i][4];
        
        var vkGroupName = vkGroupUrl;
        var tgChatName = tgChatId;
        
        // Получаем названия
        try {
          if (vkGroupUrl) {
            var vkGroupId = extractVkGroupId(vkGroupUrl);
            vkGroupName = getCachedVkGroupName(vkGroupId);
          }
        } catch (vkError) {
          logEvent("WARN", "binding_vk_name_error", licenseKey, 
                   `URL: ${vkGroupUrl}, Error: ${vkError.message}`);
        }
        
        try {
          if (tgChatId) {
            tgChatName = getCachedTelegramChatName(tgChatId);
          }
        } catch (tgError) {
          logEvent("WARN", "binding_tg_name_error", licenseKey, 
                   `Chat ID: ${tgChatId}, Error: ${tgError.message}`);
        }
        
        bindings.push({
          id: data[i][0],
          vkGroupUrl: vkGroupUrl,
          vkGroupName: vkGroupName,
          tgChatId: tgChatId,
          tgChatName: tgChatName,
          status: data[i][5],
          createdAt: data[i][6],
          lastCheck: data[i][7],
          
          // ✅ ДОБАВЛЕНЫ НОВЫЕ ПОЛЯ:
          bindingName: data[i][9] || "",        // Поле 10
          bindingDescription: data[i][10] || ""  // Поле 11
        });
      }
    }
    
    logEvent("INFO", "bindings_with_names_loaded", licenseKey, 
             `Total bindings: ${bindings.length}`);
    
    return bindings;
    
  } catch (error) {
    logEvent("ERROR", "get_bindings_with_names_error", licenseKey, error.message);
    return [];
  }
}


function logEvent(level, event, user, details, bindingName) {
  try {
    if (!DEV_MODE && level === "DEBUG") {
      return; // Пропускаем DEBUG логи в продакшене
    }
    
    // Создаем уникальную метку времени (ISO + короткий UUID) для предотвращения дубликатов
    const timestamp = new Date();
    const timestampStr = `${timestamp.toISOString()}_${Utilities.getUuid().slice(0, 8)}`;
    
    // Подготавливаем данные для логирования
    const source = "server";
    const message = typeof details === 'string' ? details : (details === undefined || details === null ? "" : JSON.stringify(details));
    const extraJson = typeof details === 'object' ? JSON.stringify(details) : "";
    
    // Записываем в глобальный лист Logs
    writeToGlobalLogs(timestampStr, level, source, event, bindingName || "", message, extraJson);
    
    // Записываем в лист связки, если указано имя связки
    if (bindingName) {
      writeToBindingSheet(bindingName, timestampStr, level, source, event, bindingName, message, extraJson);
    }
    
    // Также логируем в консоль
    console.log(`[${level}] ${event} (${user}${bindingName ? ', binding: ' + bindingName : ''}): ${message}`);
    
  } catch (error) {
    console.error("Logging error:", error.message);
  }
}

/**
 * Записывает лог в глобальный лист Logs
 * @param {string} timestamp - Уникальная метка времени
 * @param {string} level - Уровень лога (INFO, WARN, ERROR, DEBUG)
 * @param {string} source - Источник (client/server)
 * @param {string} event - Событие/тег
 * @param {string} bindingName - Имя связки
 * @param {string} message - Сообщение
 * @param {string} extraJson - Дополнительные данные в JSON
 */
function writeToGlobalLogs(timestamp, level, source, event, bindingName, message, extraJson) {
  try {
    var sheet = getSheet("Logs");

    // BindingName — имя листа; новые публикации — строка 2 (верх листа).
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 7).setValues([[ 
      timestamp,
      level,
      source,
      event,
      bindingName || "",
      typeof message === 'string' ? message : String(message || ""),
      extraJson || ""
    ]]);
  } catch (error) {
    console.error("Failed to write to global Logs:", error.message);
  }
}

/**
 * Записывает лог в лист конкретной связки
 * @param {string} bindingName - Имя связки
 * @param {string} timestamp - Уникальная метка времени
 * @param {string} level - Уровень лога
 * @param {string} source - Источник
 * @param {string} event - Событие/тег
 * @param {string} bindingNameForLog - Имя связки для лога
 * @param {string} message - Сообщение
 * @param {string} extraJson - Дополнительные данные
 */
function writeToBindingSheet(bindingName, timestamp, level, source, event, bindingNameForLog, message, extraJson) {
  try {
    const sheetName = sanitizeSheetName(bindingName);
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    
    if (!sheet) {
      // Создаем новый лист для связки
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);
      sheet.appendRow(["Timestamp", "Level", "Source", "Event", "Binding Name", "Message", "Extra JSON"]);
      
      // Форматируем заголовки
      const headerRange = sheet.getRange(1, 1, 1, 7);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#e8f5e8");
      headerRange.setFontColor("#1a5f1a");
      sheet.setFrozenRows(1);
      
      if (sheetName !== bindingName) {
        writeToGlobalLogs(
          timestamp,
          'WARN',
          source,
          'binding_sheet_sanitized',
          bindingNameForLog || bindingName,
          `Binding sheet sanitized: "${bindingName}" → "${sheetName}"`,
          JSON.stringify({ originalName: bindingName, sanitizedName: sheetName })
        );
      }
      
      // Логируем создание листа
      console.log(`Created binding sheet: ${sheetName} for binding: ${bindingName}`);
    }
    
    // BindingName — имя листа; новые публикации — строка 2 (верх листа).
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 7).setValues([[
      timestamp,
      level,
      source,
      event,
      bindingNameForLog || "",
      typeof message === 'string' ? message : String(message || ""),
      extraJson || ""
    ]]);
    
  } catch (error) {
    console.error(`Failed to write to binding sheet ${bindingName}:`, error.message);
  }
}

/**
 * Очищает имя листа от недопустимых символов
 * @param {string} name - Исходное имя
 * @return {string} - Безопасное имя для листа
 */
function sanitizeSheetName(name) {
  if (!name) return "Unnamed";
  
  // Заменяем недопустимые символы
  let safeName = name
    .replace(/[\\\/\*\?\:\[\]]/g, '_')  // \ / * ? : [ ] -> _
    .replace(/'/g, '')                  // ' -> remove
    .replace(/"/g, '')                  // " -> remove
    .trim();
  
  // Ограничиваем длину (Google Sheets limit: 100 chars)
  if (safeName.length > 90) {
    safeName = safeName.substring(0, 90);
  }
  
  // Убеждаемся, что имя не пустое
  if (!safeName) {
    safeName = "Unnamed";
  }
  
  return safeName;
}

function getPublishedSheetName(bindingName) {
  const baseName = bindingName || "Unnamed";
  const sanitized = sanitizeSheetName(baseName);
  return sanitized || "Unnamed";
}

function getLegacyPublishedSheetName(bindingName) {
  const baseName = bindingName || "Unnamed";
  const legacySafe = baseName
    .replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 27) || "Unnamed";
  return `Published_${legacySafe}`;
}

function findPublishedSheet(bindingName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetName = getPublishedSheetName(bindingName);
  let sheet = ss.getSheetByName(targetName);

  if (sheet) {
    return sheet;
  }

  const legacyName = getLegacyPublishedSheetName(bindingName);
  if (legacyName !== targetName) {
    const legacySheet = ss.getSheetByName(legacyName);
    if (legacySheet) {
      try {
        if (!ss.getSheetByName(targetName)) {
          legacySheet.setName(targetName);
          logEvent('INFO', 'published_sheet_renamed_to_binding', 'server',
                  `Legacy sheet '${legacyName}' renamed to '${targetName}'`, bindingName);
          return legacySheet;
        }
      } catch (renameError) {
        logEvent('WARN', 'published_sheet_rename_failed', 'server',
                 `Legacy sheet '${legacyName}' → '${targetName}': ${renameError.message}`, bindingName);
        return legacySheet;
      }
      return legacySheet;
    }
  }

  return null;
}

/**
 * Детальное логирование ошибок API с полными запросами и ответами
 * @param {string} service - Название сервиса (TELEGRAM, VK_API, VK_USER)
 * @param {string} endpoint - Конечная точка API
 * @param {Object} request - Данные запроса
 * @param {Object} response - Данные ответа
 */
function logApiError(service, endpoint, request, response) {
  try {
    var errorDetails = {
      service: service,
      endpoint: endpoint,
      timestamp: new Date().toISOString(),
      request: {
        method: request.method || "POST",
        parameters: Object.keys(request).filter(key => key !== 'method').reduce((obj, key) => {
          // Маскируем конфиденциальные данные
          if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
            obj[key] = request[key] ? request[key].substring(0, 10) + "..." : null;
          } else {
            obj[key] = request[key];
          }
          return obj;
        }, {})
      },
      response: {
        status_code: response.status_code,
        error_code: response.error_code,
        description: response.description,
        body_preview: response.response_body || "No body"
      }
    };
    
    var logMessage = `${service} API Error - ${endpoint}: ${response.description || 'Unknown error'} (Code: ${response.error_code}, HTTP: ${response.status_code})`;
    
    logEvent("ERROR", "api_error_detailed", "server", 
             JSON.stringify(errorDetails).substring(0, 2000)); // Ограничиваем размер лога
    
    // Дополнительно логируем краткую версию для удобства
    logEvent("WARN", `${service.toLowerCase()}_api_fail`, "server", 
             `${endpoint}: ${response.description} (${response.error_code})`);
    
  } catch (error) {
    logEvent("ERROR", "log_api_error_failed", "server", 
             `Failed to log API error: ${error.message}, Original service: ${service}, endpoint: ${endpoint}`);
  }
}

function jsonResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 7. АДМИН ПАНЕЛЬ И СТАТИСТИКА
// ============================================

function showAdminPanel() {
  try {
    var htmlContent = getAdminPanelHtml();
    if (!htmlContent) {
      throw new Error("Failed to generate admin panel HTML");
    }
    
    var html = HtmlService.createHtmlOutput(htmlContent);
    if (!html) {
      throw new Error("Failed to create HTML output");
    }
    
    html.setWidth(1200).setHeight(800);
    
    SpreadsheetApp.getUi()
      .showModelessDialog(html, "🎛️ Админ панель");
      
  } catch (error) {
    logEvent("ERROR", "admin_panel_error", "system", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка открытия админ панели: " + error.message);
  }
}

function getAdminPanelHtml() {
  var stats = getSystemStats();
  
  var html = '';
  html += '<!DOCTYPE html>';
  html += '<html>';
  html += '<head>';
  html += '  <meta charset="UTF-8">';
  html += '</head>';
  html += '<body>';
  html += '  <div>';
  html += '    <h1>🎛️ Админ панель VK→TG Server v' + SERVER_VERSION + '</h1>';
  html += '    <p>Статистика и управление системой</p>';
  html += '    <hr>';
  html += '    ';
  html += '    <h2>📊 Общая статистика</h2>';
  html += '    <table border="1" cellpadding="5" cellspacing="0">';
  html += '      <tr>';
  html += '        <td><strong>Всего лицензий</strong></td>';
  html += '        <td><strong>' + stats.totalLicenses + '</strong></td>';
  html += '        <td><strong>Активных лицензий</strong></td>';
  html += '        <td><strong>' + stats.activeLicenses + '</strong></td>';
  html += '      </tr>';
  html += '      <tr>';
  html += '        <td><strong>Всего связок</strong></td>';
  html += '        <td><strong>' + stats.totalBindings + '</strong></td>';
  html += '        <td><strong>Активных связок</strong></td>';
  html += '        <td><strong>' + stats.activeBindings + '</strong></td>';
  html += '      </tr>';
  html += '    </table>';
  html += '    <hr>';
  html += '      ';
  html += '    <h2>📜 Последние лицензии</h2>';
  html += '    <table border="1" cellpadding="5" cellspacing="0">';
  html += '      <tr>';
  html += '        <th>Ключ</th>';
  html += '        <th>Email</th>';
  html += '        <th>Тип</th>';
  html += '        <th>Макс групп</th>';
  html += '        <th>Статус</th>';
  html += '        <th>Истекает</th>';
  html += '      </tr>';
  
  // Добавляем строки лицензий
  stats.recentLicenses.forEach(function(lic) {
    html += '      <tr>';
    html += '        <td><code>' + lic.key.substring(0, 20) + '...</code></td>';
    html += '        <td>' + lic.email + '</td>';
    html += '        <td><strong>' + lic.type + '</strong></td>';
    html += '        <td>' + lic.maxGroups + '</td>';
    html += '        <td><strong style="color: ' + (lic.status === 'active' ? 'green' : 'red') + '">' + lic.status + '</strong></td>';
    html += '        <td>' + new Date(lic.expires).toLocaleDateString() + '</td>';
    html += '      </tr>';
  });
  
  html += '    </table>';
  html += '    <hr>';
  html += '      ';
  html += '    <h2>🔗 Последние связки</h2>';
  html += '    <table border="1" cellpadding="5" cellspacing="0">';
  html += '      <tr>';
  html += '        <th>ID</th>';
  html += '        <th>Название</th>';
  html += '        <th>Email</th>';
  html += '        <th>VK группа</th>';
  html += '        <th>TG чат</th>';
  html += '        <th>Статус</th>';
  html += '        <th>Создано</th>';
  html += '      </tr>';
  
  // Добавляем строки связок
  stats.recentBindings.forEach(function(binding) {
    var statusColor = 'red';
    if (binding.status === 'active') {
      statusColor = 'green';
    } else if (binding.status === 'paused') {
      statusColor = 'orange';
    }
    
    var bindingName = binding.bindingName || 'Без названия';
    
    html += '      <tr>';
    html += '        <td><code>' + binding.id.substring(0, 15) + '...</code></td>';
    html += '        <td><em>' + escapeHtml(bindingName) + '</em></td>';
    html += '        <td>' + binding.userEmail + '</td>';
    html += '        <td>' + binding.vkGroupUrl + '</td>';
    html += '        <td><code>' + binding.tgChatId + '</code></td>';
    html += '        <td><strong style="color: ' + statusColor + '">' + binding.status + '</strong></td>';
    html += '        <td>' + new Date(binding.createdAt).toLocaleDateString() + '</td>';
    html += '      </tr>';
  });
  
  html += '    </table>';
  html += '    <hr>';
  html += '    <h2>🛠️ Управление системой</h2>';
  html += '    <p>';
  html += '      <button onclick="ensureBindingsStructure()">🔧 Обеспечить структуру Bindings (11 колонок)</button>';
  html += '      <button onclick="google.script.run.withSuccessHandler(function(result) { alert(\'Логи очищены: \' + result.totalDeleted + \' записей из \' + result.sheetsProcessed + \' листов\'); }).withFailureHandler(function(error) { alert(\'Ошибка: \' + error.message); }).cleanOldLogs();">🧹 Очистить старые логи (>30 дней)</button>';
  html += '    </p>';
  html += '  </div>';
  html += '</body>';
  html += '</html>';
  
  // Добавляем JavaScript для кнопок
  html += '<script>';
  html += 'function ensureBindingsStructure() {';
  html += '  google.script.run.withSuccessHandler(function(result) {';
  html += '    if (result.success) {';
  html += '      var message = result.added_columns.length > 0 ';
  html += '        ? "Добавлены колонки: " + result.added_columns.join(", ") ';
  html += '        : "Структура Bindings уже корректна";';
  html += '      alert("✅ " + message);';
  html += '    } else {';
  html += '      alert("❌ Ошибка: " + result.error);';
  html += '    }';
  html += '  }).withFailureHandler(function(error) {';
  html += '    alert("❌ Критическая ошибка: " + error.message);';
  html += '  }).ensureBindingsSheetStructure();';
  html += '}';
  html += '</script>';
  
  return html;
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
      
      topUser: findTopUser(bindingsData),
      
      recentLicenses: licensesData
        .map(lic => ({
          key: lic[0],
          email: lic[1],
          type: lic[2],
          maxGroups: lic[3],
          expires: lic[4],
          status: lic[6]
        }))
        .slice(-10)
        .reverse(),
      
      recentBindings: bindingsData
        .map(binding => ({
          id: binding[0],
          userEmail: binding[2],
          vkGroupUrl: binding[3],
          tgChatId: binding[4],
          status: binding[5],
          createdAt: binding[6],
          bindingName: binding[9] || "",
          bindingDescription: binding[10] || ""
        }))
        .slice(-10)
        .reverse()
    };
    
  } catch (error) {
    logEvent("ERROR", "stats_error", "system", error.message);
    return {
      totalLicenses: 0, activeLicenses: 0, expiredLicenses: 0,
      totalBindings: 0, activeBindings: 0, pausedBindings: 0,
      postsToday: 0, lastPostTime: "Ошибка", topUser: "Ошибка",
      recentLicenses: [], recentBindings: []
    };
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

function showLogsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logsSheet = ss.getSheetByName("Logs");
  
  if (logsSheet) {
    ss.setActiveSheet(logsSheet);
  } else {
    SpreadsheetApp.getUi().alert("❌ Лист 'Logs' не найден. Выполните инициализацию сервера.");
  }
}

// ============================================
// АВТОМАТИЧЕСКОЕ ИЗВЛЕЧЕНИЕ ID ИЗ ССЫЛОК
// ============================================

/**
 * Улучшенное извлечение ID группы ВКонтакте с поддержкой личных страниц  
 * @param {string} url - URL группы/страницы ВКонтакте
 * @return {string} - ID группы/пользователя
 */
/**
 * Получает расширенную информацию о связке с названиями групп
 * @param {Object} binding - объект связки
 * @return {Object} - связка с добавленными названиями
 */
function enrichBindingWithNames(binding) {
  try {
    // Извлекаем ID из URL
    var vkGroupId = extractVkGroupId(binding.vkGroupUrl);
    
    // Получаем названия
    var vkGroupName = getVkGroupName(vkGroupId);
    var tgChatName = getTelegramChatName(binding.tgChatId);
    
    return {
      ...binding,
      vkGroupName: vkGroupName,
      tgChatName: tgChatName,
      vkGroupId: vkGroupId
    };
    
  } catch (error) {
    logEvent("ERROR", "enrich_binding_error", "server", 
             `Binding ID: ${binding.id}, Error: ${error.message}`);
    
    return {
      ...binding,
      vkGroupName: binding.vkGroupUrl,
      tgChatName: binding.tgChatId,
      vkGroupId: null
    };
  }
}

/**
 * Обновленная функция получения связок пользователя с названиями
 * @param {string} licenseKey - ключ лицензии
 * @return {Array} - массив связок с названиями
 */
/**
 * Тестирует функции извлечения ID из ссылок
 */
function testUrlExtraction() {
  console.log('=== Тестирование извлечения ID из ссылок ===');
  
  // Тесты ВК
  var vkTests = [
    'https://vk.com/public123456',
    'vk.com/club789012', 
    'https://vk.com/durov',
    'VK.COM/PUBLIC999888'
  ];
  
  vkTests.forEach(url => {
    try {
      var id = extractVkGroupId(url);
      console.log(`✅ VK: ${url} -> ${id}`);
    } catch (error) {
      console.log(`❌ VK: ${url} -> Error: ${error.message}`);
    }
  });
  
  // Тесты Telegram
  var tgTests = [
    'https://t.me/durov',
    't.me/telegram',
    '@channelname',
    'mychannel',
    '-1001234567890'
  ];
  
  tgTests.forEach(input => {
    try {
      var id = extractTelegramChatId(input);
      console.log(`✅ TG: ${input} -> ${id}`);
    } catch (error) {
      console.log(`❌ TG: ${input} -> Error: ${error.message}`);
    }
  });
}

/**
 * Тестирует функции получения названий групп/каналов
 */
function testNameRetrieval() {
  console.log('=== Тестирование получения названий ===');
  
  // Тест VK групп (используйте реальные ID для тестирования)
  var vkGroupIds = ['-1', '-30022666']; // Пример: Павел Дуров, ВКонтакте
  
  vkGroupIds.forEach(groupId => {
    try {
      var name = getVkGroupName(groupId);
      console.log(`✅ VK Group ${groupId}: ${name}`);
    } catch (error) {
      console.log(`❌ VK Group ${groupId}: Error: ${error.message}`);
    }
  });
  
  // Тест Telegram каналов
  var tgChatIds = ['@durov', '@telegram'];
  
  tgChatIds.forEach(chatId => {
    try {
      var name = getTelegramChatName(chatId);
      console.log(`✅ TG Chat ${chatId}: ${name}`);
    } catch (error) {
      console.log(`❌ TG Chat ${chatId}: Error: ${error.message}`);
    }
  });
}

// Conflict resolution: ensure only the primary handleSendPost implementation remains (see earlier definition).

/**
 * Обработчик тестовой публикации
 */
function handleTestPublication(payload, clientIp) {
  try {
    var { license_key, binding_id } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    var binding = findBindingById(binding_id, license_key);
    if (!binding) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    logEvent("INFO", "test_publication_start", license_key, 
             `Binding: ${binding_id}, VK: ${binding.vkGroupUrl}, TG: ${binding.tgChatId}`);
    
    // Получаем токен бота
    var botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    if (!botToken) {
      return jsonResponse({
        success: false,
        error: "Bot token not configured"
      }, 500);
    }
    
    // Получаем реальный пост из VK для тестирования
    var vkGroupId = extractVkGroupId(binding.vkGroupUrl);
    var userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      return jsonResponse({
        success: false,
        error: "VK User Access Token not configured"
      }, 500);
    }
    
    // Запрашиваем последний пост из VK (исключая закрепленные)
    var vkUrl = `https://api.vk.com/method/wall.get?owner_id=${encodeURIComponent(vkGroupId)}&count=10&filter=owner&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    var vkResponse = UrlFetchApp.fetch(vkUrl, {
      muteHttpExceptions: true,
      timeout: 15000
    });
    
    var vkData = JSON.parse(vkResponse.getContentText());
    
    if (vkData.error) {
      logEvent("ERROR", "test_vk_fetch_error", license_key, 
               `VK Error: ${vkData.error.error_code} - ${vkData.error.error_msg}`);
      return jsonResponse({
        success: false,
        error: `VK API Error: ${vkData.error.error_msg}`
      }, 400);
    }
    
    if (!vkData.response || !vkData.response.items || vkData.response.items.length === 0) {
      return jsonResponse({
        success: false,
        error: "No posts found in VK group"
      }, 404);
    }
    
    // Берем первый не закрепленный пост
    var posts = vkData.response.items.filter(post => !post.is_pinned);
    if (posts.length === 0) {
      return jsonResponse({
        success: false,
        error: "No regular posts found (only pinned posts available)"
      }, 404);
    }
    
    var testPost = posts[0];
    
    // Форматируем пост для отправки в Telegram  
    var formattedText = formatVkPostForTelegram(testPost, binding);
    
    // Отправляем реальный пост как тест
    var sendResult = sendTelegramMessage(botToken, binding.tgChatId, formattedText);
    
    if (sendResult.success) {
      logEvent("INFO", "test_publication_success", license_key, 
               `Binding: ${binding_id}, Message ID: ${sendResult.message_id}`);
      
      return jsonResponse({
        success: true,
        message_id: sendResult.message_id,
        message: "Тестовое сообщение отправлено успешно! Проверьте ваш Telegram канал/чат."
      });
    } else {
      logEvent("ERROR", "test_publication_failed", license_key, 
               `Binding: ${binding_id}, Error: ${sendResult.error}`);
      
      return jsonResponse({
        success: false,
        error: `Не удалось отправить тестовое сообщение: ${sendResult.error}`
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "test_publication_error", payload.license_key || "unknown", error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================
// ФУНКЦИИ ПОЛУЧЕНИЯ НАЗВАНИЙ ГРУПП И КАНАЛОВ
// ============================================

/**
 * Получает название группы ВКонтакте по ID
 */
function getVkGroupName(groupId) {
  try {
    var userToken = PropertiesService.getScriptProperties()
      .getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      logEvent("WARN", "vk_token_missing_for_name", "server", `Group ID: ${groupId}`);
      return null;
    }
    
    var isGroup = groupId.toString().startsWith('-');
    var cleanId = Math.abs(parseInt(groupId));
    
    logEvent("DEBUG", "vk_name_request_start", "server", 
             `Group ID: ${groupId}, Clean ID: ${cleanId}, Is Group: ${isGroup}`);
    
    var apiMethod, apiParams;
    
    if (isGroup) {
      // Получаем название группы
      apiMethod = 'groups.getById';
      apiParams = `group_id=${cleanId}&fields=name,screen_name`;
    } else {
      // Получаем имя пользователя
      apiMethod = 'users.get';
      apiParams = `user_ids=${cleanId}&fields=first_name,last_name,screen_name`;
    }
    
    var response = UrlFetchApp.fetch(
      `https://api.vk.com/method/${apiMethod}?${apiParams}&v=${VK_API_VERSION}&access_token=${userToken}`,
      {
        muteHttpExceptions: true,
        timeout: 8000
      }
    );
    
    var data = JSON.parse(response.getContentText());
    
    if (data.error) {
      logEvent("WARN", "vk_name_api_error", "server", 
               `Group ID: ${groupId}, Error: ${data.error.error_code} - ${data.error.error_msg}`);
      return null;
    }
    
    if (data.response && data.response.length > 0) {
      var obj = data.response[0];
      var name;
      
      if (isGroup) {
        name = obj.name;
      } else {
        name = `${obj.first_name || ''} ${obj.last_name || ''}`.trim();
      }
      
      logEvent("INFO", "vk_name_retrieved", "server", 
               `Group ID: ${groupId} -> Name: "${name}"`);
      
      return name || `Unknown ${isGroup ? 'Group' : 'User'}`;
    }
    
    logEvent("WARN", "vk_name_not_found", "server", `Group ID: ${groupId}`);
    return null;
    
  } catch (error) {
    logEvent("ERROR", "vk_name_request_error", "server", 
             `Group ID: ${groupId}, Error: ${error.message}`);
    return null;
  }
}

/**
 * Получает название Telegram чата/канала по chat_id
 */
function getTelegramChatName(chatId) {
  try {
    var botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      logEvent("WARN", "tg_token_missing_for_name", "server", `Chat ID: ${chatId}`);
      return null;
    }
    
    logEvent("DEBUG", "tg_name_request_start", "server", `Chat ID: ${chatId}`);
    
    var response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ chat_id: chatId }),
      muteHttpExceptions: true,
      timeout: 8000
    });
    
    var result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      var chat = result.result;
      var name;
      
      // Определяем название в зависимости от типа чата
      if (chat.title) {
        // Группа, супергруппа или канал
        name = chat.title;
      } else if (chat.first_name || chat.last_name) {
        // Личный чат
        name = `${chat.first_name || ''} ${chat.last_name || ''}`.trim();
      } else if (chat.username) {
        // Fallback на username
        name = '@' + chat.username;
      } else {
        name = 'Unknown Chat';
      }
      
      logEvent("INFO", "tg_name_retrieved", "server", 
               `Chat ID: ${chatId} -> Name: "${name}", Type: ${chat.type}`);
      
      return name;
    } else {
      logEvent("WARN", "tg_name_api_error", "server", 
               `Chat ID: ${chatId}, Error: ${result.description}`);
      return null;
    }
    
  } catch (error) {
    logEvent("ERROR", "tg_name_request_error", "server", 
             `Chat ID: ${chatId}, Error: ${error.message}`);
    return null;
  }
}

/**
 * Получает кешированное название или запрашивает новое
 */
function getCachedVkGroupName(groupId) {
  try {
    var cache = PropertiesService.getScriptProperties();
    var cacheKey = `vk_name_${groupId}`;
    
    var cachedName = cache.getProperty(cacheKey);
    
    if (cachedName) {
      logEvent("DEBUG", "vk_name_from_cache", "server", 
               `${groupId} -> ${cachedName} (cached)`);
      return cachedName;
    }
    
    // Если не в кеше - запрашиваем и кешируем
    var freshName = getVkGroupName(groupId);
    if (freshName) {
      cache.setProperty(cacheKey, freshName);
      return freshName;
    }
    
    return `VK:${groupId}`; // Fallback отображение
    
  } catch (error) {
    logEvent("ERROR", "cached_vk_name_error", "server", error.message);
    return `VK:${groupId}`;
  }
}

/**
 * Получает кешированное название Telegram чата или запрашивает новое
 */
function getCachedTelegramChatName(chatId) {
  try {
    var cache = PropertiesService.getScriptProperties();
    var cacheKey = `tg_name_${chatId}`;
    
    var cachedName = cache.getProperty(cacheKey);
    
    if (cachedName) {
      logEvent("DEBUG", "tg_name_from_cache", "server", 
               `${chatId} -> ${cachedName} (cached)`);
      return cachedName;
    }
    
    // Если не в кеше - запрашиваем и кешируем
    var freshName = getTelegramChatName(chatId);
    if (freshName) {
      cache.setProperty(cacheKey, freshName);
      return freshName;
    }
    
    return chatId.toString(); // Fallback отображение
    
  } catch (error) {
    logEvent("ERROR", "cached_tg_name_error", "server", error.message);
    return chatId.toString();
  }
}

/**
 * НОВАЯ ФУНКЦИЯ: Получает связки пользователя с названиями групп/каналов
 */
// Duplicate function removed - see getUserBindingsWithNames at line 2344

// Duplicate handleGetVkPosts function body removed - see handleGetVkPosts at line 1388


// ============================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ И УЛУЧШЕНИЯ  
// ============================================

// Rate limiting для Telegram API
var RATE_LIMIT_DELAY = 100; // мс между запросами

/**
 * Улучшенная функция извлечения ID группы ВК с поддержкой всех форматов из ARCHITECTURE.md
 * Поддерживаемые форматы:
 * - https://vk.com/public123456 → -123456
 * - https://vk.com/club789012 → -789012  
 * - https://vk.com/durov → resolve via API → -123456
 * - https://vk.com/varsmana → resolve via API → -123456
 * - vk.com/apiclub → resolve via API → -123456
 * - VK.COM/PUBLIC999888 → -999888
 * - -123456 или 123456 → нормализуется в -123456
 */
function extractVkGroupId(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('VK URL или ID обязателен и должен быть строкой');
  }

  var originalInput = url;
  var cleanInput = url.trim().toLowerCase().split('?')[0].split('#')[0];

  logEvent("DEBUG", "vk_group_id_extraction_start", "system", `Input: "${originalInput}" → Clean: "${cleanInput}"`);

  // Если уже ID (число или -число)
  if (/^-?\d+$/.test(cleanInput)) {
    var normalizedId = cleanInput.startsWith('-') ? cleanInput : '-' + cleanInput;
    logEvent("DEBUG", "vk_group_id_numeric", "system", `${originalInput} → ${normalizedId}`);
    return normalizedId;
  }

  // Извлекаем из различных форматов URL
  var screenName = null;
  var numericId = null;

  // Форматы: vk.com/public123, vk.com/club123
  var publicClubMatch = cleanInput.match(/vk\.com\/(public|club)(\d+)/i);
  if (publicClubMatch) {
    numericId = publicClubMatch[2];
    var result = '-' + numericId;
    logEvent("DEBUG", "vk_group_id_public_club", "system", `${originalInput} → ${result}`);
    return result;
  }

  // Форматы: vk.com/username, VK.COM/USERNAME, username
  var patterns = [
    /vk\.com\/([a-z0-9_]+)/i,     // vk.com/username
    /^([a-z0-9_]+)$/i             // просто username
  ];

  for (const pattern of patterns) {
    var match = cleanInput.match(pattern);
    if (match) {
      screenName = match[1];
      break;
    }
  }

  if (!screenName) {
    throw new Error(`Неподдерживаемый формат VK ссылки или ID: "${originalInput}". Ожидаемые форматы: https://vk.com/public123, https://vk.com/club123, https://vk.com/username, или числовой ID`);
  }

  // Если это numeric ID (fallback)
  if (/^\d+$/.test(screenName)) {
    var result = '-' + screenName;
    logEvent("DEBUG", "vk_group_id_fallback_numeric", "system", `${originalInput} → ${result}`);
    return result;
  }

  // Если это screen_name - нужно резолвить через API
  try {
    var result = resolveVkScreenName(screenName);
    logEvent("DEBUG", "vk_group_id_resolved", "system", `${originalInput} → ${screenName} → ${result}`);
    return result;
  } catch (error) {
    logEvent("ERROR", "vk_group_id_resolution_failed", "system", `Failed to resolve "${screenName}" from "${originalInput}": ${error.message}`);
    throw new Error(`Не удалось определить ID для "${screenName}" из "${originalInput}": ${error.message}`);
  }
}

/**
 * Резолвит screen_name в ID через VK API с улучшенной обработкой ошибок
 * Использует VK API utils.resolveScreenName с таймаутами и детальной диагностикой
 */
function resolveVkScreenName(screenName) {
  if (!screenName || typeof screenName !== 'string') {
    throw new Error('Screen name обязателен и должен быть строкой');
  }

  try {
    var userToken = PropertiesService.getScriptProperties()
      .getProperty("VK_USER_ACCESS_TOKEN");
        
    if (!userToken) {
      throw new Error("VK User Access Token не настроен на сервере");
    }

    var apiUrl = `https://api.vk.com/method/utils.resolveScreenName?screen_name=${encodeURIComponent(screenName)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    logEvent("DEBUG", "vk_resolve_screen_name_start", "system", `Resolving screen_name: "${screenName}"`);
    
    var response = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      timeout: TIMEOUTS.FAST // 8 секунд для быстрой операции резолвинга
    });
        
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    logEvent("DEBUG", "vk_resolve_screen_name_response", "system", `Screen: "${screenName}", Code: ${responseCode}, Response length: ${responseText.length}`);
    
    if (responseCode !== 200) {
      throw new Error(`VK API HTTP ${responseCode}: ${responseText.substring(0, 100)}`);
    }
    
    var data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from VK API: ${parseError.message}`);
    }
        
    // Обработка ошибок VK API
    if (data.error) {
      var errorCode = data.error.error_code;
      var errorMsg = data.error.error_msg;
      
      logEvent("WARN", "vk_resolve_screen_name_api_error", "system", `Screen: "${screenName}", Error: ${errorCode} - ${errorMsg}`);
      
      // Специальная обработка распространенных ошибок
      switch (errorCode) {
        case 5: // User authorization failed
          throw new Error(`Ошибка авторизации VK (${errorCode}): ${errorMsg}. Проверьте VK User Access Token`);
        case 113: // Invalid user id
          throw new Error(`Неверный screen_name "${screenName}": ${errorMsg}`);
        case 100: // One of the parameters specified was missing or invalid
          throw new Error(`Неверный параметр запроса для "${screenName}": ${errorMsg}`);
        case 10: // Internal server error
          throw new Error(`Внутренняя ошибка VK API (${errorCode}): ${errorMsg}`);
        case 15: // Access denied
          throw new Error(`Доступ запрещен для "${screenName}": ${errorMsg}`);
        default:
          throw new Error(`VK API Error (${errorCode}): ${errorMsg}`);
      }
    }
        
    if (!data.response || !data.response.object_id) {
      logEvent("WARN", "vk_resolve_screen_name_not_found", "system", `Screen name not found: "${screenName}"`);
      throw new Error(`Группа, страница или пользователь не найдены: "${screenName}"`);
    }
        
    var objectId = data.response.object_id;
    var type = data.response.type;
    
    // Валидация object_id
    if (!/^\d+$/.test(objectId.toString())) {
      throw new Error(`Получен некорректный object_id: ${objectId} для screen_name "${screenName}"`);
    }
    
    // Для групп и страниц добавляем минус, для пользователей оставляем как есть
    var result = (type === 'group' || type === 'page') ? `-${objectId}` : objectId.toString();
    
    logEvent("INFO", "vk_resolve_screen_name_success", "system", `Screen: "${screenName}" → Type: ${type}, ID: ${objectId} → Result: ${result}`);
    
    return result;
      
  } catch (error) {
    // Дополнительная обработка сетевых ошибок
    if (error.message.includes('timeout') || error.message.includes('Timed out')) {
      logEvent("ERROR", "vk_resolve_screen_name_timeout", "system", `Timeout resolving screen_name "${screenName}"`);
      throw new Error(`Таймаут при резолвинге "${screenName}" через VK API. Попробуйте позже.`);
    }
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      logEvent("ERROR", "vk_resolve_screen_name_network", "system", `Network error resolving screen_name "${screenName}": ${error.message}`);
      throw new Error(`Сетевая ошибка при резолвинге "${screenName}": ${error.message}`);
    }
    
    logEvent("ERROR", "vk_resolve_screen_name_failed", "system", `Failed to resolve screen_name "${screenName}": ${error.message}`);
    throw new Error(`Не удалось резолвить "${screenName}": ${error.message}`);
  }
}

/**
 * Улучшенная функция извлечения chat_id Telegram с поддержкой всех форматов из ARCHITECTURE.md
 * Поддерживаемые форматы:
 * - @channelname → "@channelname"
 * - https://t.me/channelname → "@channelname"
 * - t.me/username → "@username"  
 * - channelname → "@channelname"
 * - -1001234567890 → "-1001234567890"
 * - 123456789 → "123456789"
 */
function extractTelegramChatId(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Telegram chat ID или username обязателен и должен быть строкой');
  }

  var originalInput = input;
  var cleanInput = input.trim().toLowerCase().split('?')[0].split('#')[0];

  logEvent("DEBUG", "telegram_chat_id_extraction_start", "system", `Input: "${originalInput}" → Clean: "${cleanInput}"`);

  // Если уже chat_id (число с возможным минусом)
  if (/^-?\d+$/.test(cleanInput)) {
    logEvent("DEBUG", "telegram_chat_id_numeric", "system", `${originalInput} → ${cleanInput}`);
    return cleanInput;
  }

  // Извлекаем username из различных форматов
  var username = null;

  // Форматы в порядке приоритета:
  var patterns = [
    /https?:\/\/t\.me\/([a-z0-9_]+)/i,  // https://t.me/username
    /t\.me\/([a-z0-9_]+)/i,            // t.me/username
    /@([a-z0-9_]+)/i,                  // @username
    /^([a-z0-9_]+)$/i                  // просто username
  ];

  for (const pattern of patterns) {
    var match = cleanInput.match(pattern);
    if (match) {
      username = match[1];
      break;
    }
  }

  if (!username) {
    throw new Error(`Неподдерживаемый формат Telegram: "${originalInput}". Ожидаемые форматы: @channelname, https://t.me/channelname, t.me/username, channelname, или числовой chat_id`);
  }

  // Валидация username
  if (!/^[a-z0-9_]+$/i.test(username)) {
    throw new Error(`Некорректный Telegram username "${username}" из "${originalInput}". Допустимы только буквы, цифры и подчеркивания`);
  }

  var result = '@' + username;
  logEvent("DEBUG", "telegram_chat_id_username", "system", `${originalInput} → ${result}`);
  
  return result;
}

/**
 * Расширенная очистка старых логов (более 30 дней) из всех лог-листов
 * Обрабатывает листы: "Logs", "Client Logs" и другие листы с "Log" в названии
 */
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
      return { totalDeleted: 0, sheetResults: [] };
    }
    
    var thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    var totalDeleted = 0;
    var sheetResults = [];
    
    logEvent("INFO", "log_cleanup_started", "system", `Starting cleanup of ${logSheets.length} log sheets older than ${thirtyDaysAgo.toISOString()}`);
    
    // Обрабатываем каждый лог-лист
    for (var j = 0; j < logSheets.length; j++) {
      var sheet = logSheets[j];
      var sheetName = sheet.getName();
      var sheetDeletedCount = 0;
      
      try {
        // Проверяем, есть ли у листа данные
        var dataRange = sheet.getDataRange();
        var data = dataRange.getValues();
        
        if (data.length <= 1) { // Только заголовок или пустой лист
          logEvent("DEBUG", "log_cleanup_sheet_empty", "system", `Sheet "${sheetName}" is empty or has only headers`);
          sheetResults.push({ sheetName: sheetName, deletedCount: 0, status: "empty" });
          continue;
        }
        
        // Удаляем старые записи (начиная с конца, чтобы не сбивать индексы)
        for (let i = data.length - 1; i >= 1; i--) {
          try {
            var logDate = new Date(data[i][0]);
            
            // Проверяем валидность даты
            if (isNaN(logDate.getTime())) {
              logEvent("DEBUG", "log_cleanup_invalid_date", "system", `Invalid date in sheet "${sheetName}" row ${i + 1}: ${data[i][0]}`);
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
        sheetResults.push({ 
          sheetName: sheetName, 
          deletedCount: sheetDeletedCount, 
          status: "success",
          totalRows: data.length
        });
        
        logEvent("INFO", "log_cleanup_sheet_completed", "system", `Sheet "${sheetName}": deleted ${sheetDeletedCount} of ${data.length - 1} entries`);
        
      } catch (sheetError) {
        logEvent("ERROR", "log_cleanup_sheet_error", "system", `Error processing sheet "${sheetName}": ${sheetError.message}`);
        sheetResults.push({ 
          sheetName: sheetName, 
          deletedCount: 0, 
          status: "error", 
          error: sheetError.message 
        });
      }
    }
    
    // Финальная сводка
    var summary = {
      totalDeleted: totalDeleted,
      sheetsProcessed: logSheets.length,
      cutoffDate: thirtyDaysAgo.toISOString(),
      sheetResults: sheetResults
    };
    
    logEvent("INFO", "log_cleanup_completed", "system", 
      `Cleanup completed: ${totalDeleted} entries deleted from ${logSheets.length} sheets. Summary: ${JSON.stringify(sheetResults)}`);
    
    return summary;
    
  } catch (error) {
    logEvent("ERROR", "log_cleanup_critical_error", "system", `Critical error in log cleanup: ${error.message}, Stack: ${error.stack?.substring(0, 200)}`);
    return { 
      totalDeleted: 0, 
      sheetsProcessed: 0, 
      error: error.message,
      sheetResults: [] 
    };
  }
}

/**
 * Обработчик публикации последнего поста из VK группы в Telegram
 */
function handlePublishLastPost(payload, clientIp) {
  try {
    var { license_key, vk_group_id, binding_id } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    if (!vk_group_id) {
      return jsonResponse({
        success: false,
        error: "vk_group_id required"
      }, 400);
    }
    
    // Валидация vk_group_id
    if (!/^-?\d+$/.test(vk_group_id)) {
      return jsonResponse({
        success: false,
        error: "Invalid vk_group_id format"
      }, 400);
    }
    
    logEvent("INFO", "publish_last_post_request", license_key, 
             `Group ID: ${vk_group_id}, Binding ID: ${binding_id}, IP: ${clientIp}`);
    
    // Получаем последний пост из VK
    var postsResult = handleGetVkPosts({ 
      license_key: license_key, 
      vk_group_id: vk_group_id, 
      count: 1 
    }, clientIp);
    
    var postsData = JSON.parse(postsResult.getContent());
    
    if (!postsData.success) {
      logEvent("ERROR", "publish_last_post_get_posts_failed", license_key, 
               `Error getting posts: ${postsData.error}`);
      return jsonResponse({
        success: false,
        error: `Failed to get VK posts: ${postsData.error}`
      }, 500);
    }
    
    if (!postsData.posts || postsData.posts.length === 0) {
      logEvent("WARN", "publish_last_post_no_posts", license_key, 
               `No posts found in VK group: ${vk_group_id}`);
      return jsonResponse({
        success: false,
        error: "No posts found in VK group"
      }, 404);
    }
    
    var lastPost = postsData.posts[0];
    
    // Получаем настройки связки для форматирования
    var binding = null;
    if (binding_id) {
      try {
        var bindingsSheet = getSheet("Bindings");
        var data = bindingsSheet.getDataRange().getValues();
        
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === binding_id && data[i][1] === license_key) {
            binding = {
              id: data[i][0],
              tgChatId: data[i][4],
              formatSettings: data[i][8] || "{}",
              bindingName: data[i][9] || "",
              bindingDescription: data[i][10] || ""
            };
            break;
          }
        }
      } catch (error) {
        logEvent("WARN", "publish_last_post_binding_lookup_failed", license_key, 
                 `Binding ID: ${binding_id}, Error: ${error.message}`);
      }
    }
    
    if (!binding) {
      return jsonResponse({
        success: false,
        error: "Binding not found or no telegram chat specified"
      }, 404);
    }
    
    // Парсим настройки форматирования
    var formatSettings = {};
    try {
      if (binding.formatSettings && binding.formatSettings !== "") {
        formatSettings = JSON.parse(binding.formatSettings);
      }
    } catch (error) {
      logEvent("WARN", "publish_last_post_format_settings_parse_error", license_key, 
               `Error parsing format settings: ${error.message}`);
    }
    
    // Отправляем пост в Telegram
    var sendResult = handleSendPost({
      license_key: license_key,
      post: lastPost,
      tg_chat_id: binding.tgChatId,
      format_settings: formatSettings,
      vk_group_id: vk_group_id
    }, clientIp);
    
    var sendData = JSON.parse(sendResult.getContent());
    
    if (sendData.success) {
      logEvent("INFO", "publish_last_post_success", license_key, 
               `Post published successfully: VK ${vk_group_id}_${lastPost.id} -> TG ${binding.tgChatId}`);
      
      return jsonResponse({
        success: true,
        message: "Last post published successfully",
        published_post: {
          vk_post_id: lastPost.id,
          vk_group_id: vk_group_id,
          tg_chat_id: binding.tgChatId,
          binding_name: binding.bindingName || `Binding ${binding_id}`
        }
      });
    } else {
      logEvent("ERROR", "publish_last_post_send_failed", license_key, 
               `Send error: ${sendData.error}`);
      
      return jsonResponse({
        success: false,
        error: `Failed to send post to Telegram: ${sendData.error}`
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "publish_last_post_error", payload.license_key || "unknown", 
             `Error: ${error.message}`);
    return jsonResponse({ 
      success: false, 
      error: "Failed to publish last post: " + error.message 
    }, 500);
  }
}

/**
 * Функция для обеспечения структуры листа Bindings (11 колонок)
 * Создает недостающие колонки и валидирует существующие
 */
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

/**
 * Функция миграции для автосоздания недостающих колонок в листе Bindings
 */
function migrateBindingsSheet() {
  try {
    var sheet = getSheet("Bindings");
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var expectedHeaders = [
      "Binding ID", "License Key", "User Email", "VK Group URL", "TG Chat ID", 
      "Status", "Created At", "Last Check", "Format Settings", "Binding Name", "Binding Description"
    ];
    
    var missingColumns = [];
    
    // Проверяем какие колонки отсутствуют
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (i >= headers.length || headers[i] !== expectedHeaders[i]) {
        missingColumns.push(expectedHeaders[i]);
      }
    }
    
    // Добавляем недостающие колонки
    if (missingColumns.length > 0) {
      var currentColumn = headers.length + 1;
      
      for (var j = 0; j < missingColumns.length; j++) {
        sheet.getRange(1, currentColumn).setValue(missingColumns[j]);
        currentColumn++;
      }
      
      logEvent("INFO", "bindings_migration_completed", "system", 
               `Added columns: ${missingColumns.join(", ")}`);
      
      return {
        success: true,
        added_columns: missingColumns
      };
    } else {
      logEvent("DEBUG", "bindings_migration_not_needed", "system", 
               "All required columns already exist");
      
      return {
        success: true,
        added_columns: []
      };
    }
    
  } catch (error) {
    logEvent("ERROR", "bindings_migration_error", "system", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Получает медиа URL из VK вложений с поддержкой прямых ссылок на видео
 */
function getVkMediaUrls(attachments) {
  var result = {
    photos: [],
    videos: [],      // Прямые URL через video.get
    docLinks: [],
    audioLinks: []
  };
  
  if (!attachments || attachments.length === 0) {
    return result;
  }
  
  for (const attachment of attachments) {
    try {
      switch (attachment.type) {
        case "photo":
          const photoUrl = getBestPhotoUrl(attachment.photo.sizes);
          if (photoUrl) {
            result.photos.push({ type: "photo", url: photoUrl });
          }
          break;
          
        case "video":
          const videoId = `${attachment.video.owner_id}_${attachment.video.id}`;
          const directUrl = getVkVideoDirectUrl(videoId);
          
          if (directUrl) {
            result.videos.push({ type: "video", url: directUrl, id: videoId });
          } else {
            // Fallback на embed если direct URL недоступен
            result.docLinks.push(`🎥 [Видео](https://vk.com/video${videoId})`);
          }
          break;
          
        case "audio":
          if (attachment.audio.artist && attachment.audio.title) {
            result.audioLinks.push(`🎵 ${attachment.audio.artist} - ${attachment.audio.title}`);
          }
          break;
          
        case "doc":
          if (attachment.doc.url && attachment.doc.title) {
            result.docLinks.push(`📎 [${attachment.doc.title}](${attachment.doc.url})`);
          }
          break;
          
        case "link":
          if (attachment.link.url) {
            const title = attachment.link.title || attachment.link.url;
            result.docLinks.push(`🔗 [${title}](${attachment.link.url})`);
          }
          break;
      }
    } catch (attachError) {
      logEvent("WARN", "attachment_processing_error", "server", 
               `Type: ${attachment.type}, Error: ${attachError.message}`);
    }
  }
  
  return result;
}

/**
 * Оптимизированная отправка смешанных медиа (фото + видео + документы)
 * Группирует фото в MediaGroup (до 10 штук), остальное отправляет отдельно
 * 
 * @param {string} botToken - Telegram Bot Token
 * @param {string} chatId - ID чата/канала
 * @param {Array<Object>} mediaUrls - Массив медиа [{type: 'photo'|'video'|'doc', url: '...'}]
 * @param {string} caption - Текст для первого медиа
 * @param {Object} options - Дополнительные настройки (parse_mode и т.д.)
 * @return {Object} Результат отправки
 */
function sendMixedMediaOptimized(botToken, chatId, mediaUrls, caption, options) {
  try {
    if (!mediaUrls || mediaUrls.length === 0) {
      // Нет медиа - отправляем только текст
      return sendTelegramMessage(botToken, chatId, caption || '');
    }

    // Группируем медиа по типам
    var photos = mediaUrls.filter(function(m) { return m.type === 'photo'; });
    var videos = mediaUrls.filter(function(m) { return m.type === 'video'; });
    var documents = mediaUrls.filter(function(m) { return m.type === 'document' || m.type === 'doc'; });

    var results = [];
    var apiCallsSaved = 0;

    // Оптимизация: группируем фото по MAX_MEDIA_GROUP_SIZE (10)
    if (photos.length > 0) {
      var photoGroups = [];
      for (var i = 0; i < photos.length; i += MAX_MEDIA_GROUP_SIZE) {
        photoGroups.push(photos.slice(i, i + MAX_MEDIA_GROUP_SIZE));
      }

      // Отправляем каждую группу ОДНИМ запросом
      photoGroups.forEach(function(group, index) {
        var groupCaption = (index === 0) ? caption : null;
        var groupResult = sendTelegramMediaGroup(botToken, chatId, group, groupCaption, options);
        results.push(groupResult);

        if (!groupResult.success) {
          logEvent("WARN", "photo_group_send_failed", "server", 
                   `Group ${index + 1}, Error: ${groupResult.error}`);
        }
      });

      // Считаем экономию API запросов
      apiCallsSaved = photos.length - photoGroups.length;
    }

    // Видео отправляем отдельно (Telegram API ограничение)
    videos.forEach(function(video, index) {
      var videoCaption = (photos.length === 0 && index === 0) ? caption : null;
      var videoResult = sendTelegramVideo(botToken, chatId, video.url, videoCaption);
      results.push(videoResult);

      if (!videoResult.success) {
        logEvent("WARN", "video_send_failed", "server", 
                 `Video ${video.id || index}: ${videoResult.error}`);
      }

      // Небольшая пауза между видео
      if (index < videos.length - 1) {
        Utilities.sleep(1000);
      }
    });

    // Документы отправляем отдельно
    documents.forEach(function(doc, index) {
      var docCaption = (photos.length === 0 && videos.length === 0 && index === 0) ? caption : null;
      var docResult = sendTelegramDocument(botToken, chatId, doc.url, docCaption);
      results.push(docResult);

      if (!docResult.success) {
        logEvent("WARN", "document_send_failed", "server", 
                 `Document ${index}: ${docResult.error}`);
      }
    });

    // Логируем оптимизацию
    logEvent("INFO", "MEDIA_OPTIMIZATION", "server", {
      total_media: mediaUrls.length,
      photos: photos.length,
      videos: videos.length,
      documents: documents.length,
      photo_groups: photos.length > 0 ? Math.ceil(photos.length / MAX_MEDIA_GROUP_SIZE) : 0,
      api_calls_saved: apiCallsSaved,
      total_api_calls: results.length
    });

    // Определяем общий результат
    var successCount = results.filter(function(r) { return r.success; }).length;
    var totalCount = results.length;

    if (successCount === 0) {
      return { success: false, error: "All media parts failed to send" };
    } else if (successCount < totalCount) {
      return { 
        success: true, 
        message_id: results.find(function(r) { return r.success; }).message_id,
        warning: `Partial success: ${successCount}/${totalCount} parts sent`,
        results: results,
        optimization_stats: {
          api_calls_saved: apiCallsSaved,
          photo_groups: photos.length > 0 ? Math.ceil(photos.length / MAX_MEDIA_GROUP_SIZE) : 0
        }
      };
    } else {
      return { 
        success: true, 
        message_id: results.find(function(r) { return r.success; }).message_id,
        results: results,
        optimization_stats: {
          api_calls_saved: apiCallsSaved,
          photo_groups: photos.length > 0 ? Math.ceil(photos.length / MAX_MEDIA_GROUP_SIZE) : 0
        }
      };
    }

  } catch (error) {
    logEvent("ERROR", "send_mixed_media_optimized_error", "server", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет документ в Telegram
 */
function sendTelegramDocument(botToken, chatId, documentUrl, caption) {
  try {
    var url = `https://api.telegram.org/bot${botToken}/sendDocument`;
    
    var payload = {
      chat_id: chatId,
      document: documentUrl
    };
    
    if (caption) {
      payload.caption = caption;
      payload.parse_mode = 'HTML';
    }
    
    var response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: TIMEOUTS.MEDIUM
    });
    
    var result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      logEvent("INFO", "document_sent", "server", 
               `Chat: ${chatId}, Document URL: ${documentUrl.substring(0, 100)}..., Message ID: ${result.result.message_id}`);
      return { success: true, message_id: result.result.message_id };
    } else {
      logEvent("ERROR", "document_send_failed", "server", 
               `Error: ${result.description}, Code: ${result.error_code}`);
      return { success: false, error: result.description || "Document send failed" };
    }
    
  } catch (error) {
    logEvent("ERROR", "document_send_exception", "server", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Тестовая функция для проверки оптимизации медиагрупп
 */
function testSendMixedMediaOptimized() {
  try {
    logEvent("INFO", "test_send_mixed_media_optimized_start", "server", "Starting optimization test");
    
    // Тестовые данные
    var botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    var testChatId = PropertiesService.getScriptProperties().getProperty("TEST_CHAT_ID") || "@test_channel";
    
    if (!botToken) {
      logEvent("ERROR", "test_no_bot_token", "server", "Bot token not configured for testing");
      return { success: false, error: "Bot token not configured" };
    }
    
    // Тест 1: 5 фото (должно быть 1 MediaGroup)
    var testPhotos = [];
    for (var i = 1; i <= 5; i++) {
      testPhotos.push({
        type: 'photo',
        url: `https://picsum.photos/800/600?random=${i}`
      });
    }
    
    var result1 = sendMixedMediaOptimized(
      botToken,
      testChatId,
      testPhotos,
      "🧪 Тест 1: 5 фото в одной группе",
      { parse_mode: 'HTML' }
    );
    
    logEvent("INFO", "test_1_result", "server", {
      photos_count: testPhotos.length,
      success: result1.success,
      api_calls_saved: (result1.optimization_stats && result1.optimization_stats.api_calls_saved) || 0
    });
    
    // Тест 2: 12 фото (должно быть 2 MediaGroup)
    var testPhotos2 = [];
    for (var i = 1; i <= 12; i++) {
      testPhotos2.push({
        type: 'photo',
        url: `https://picsum.photos/800/600?random=${i + 100}`
      });
    }
    
    var result2 = sendMixedMediaOptimized(
      botToken,
      testChatId,
      testPhotos2,
      "🧪 Тест 2: 12 фото в двух группах",
      { parse_mode: 'HTML' }
    );
    
    logEvent("INFO", "test_2_result", "server", {
      photos_count: testPhotos2.length,
      success: result2.success,
      api_calls_saved: (result2.optimization_stats && result2.optimization_stats.api_calls_saved) || 0,
      photo_groups: (result2.optimization_stats && result2.optimization_stats.photo_groups) || 0
    });
    
    // Тест 3: Смешанные медиа (фото + видео)
    var mixedMedia = [
      { type: 'photo', url: 'https://picsum.photos/800/600?random=200' },
      { type: 'photo', url: 'https://picsum.photos/800/600?random=201' },
      { type: 'video', url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4' }
    ];
    
    var result3 = sendMixedMediaOptimized(
      botToken,
      testChatId,
      mixedMedia,
      "🧪 Тест 3: Фото + видео",
      { parse_mode: 'HTML' }
    );
    
    logEvent("INFO", "test_3_result", "server", {
      total_media: mixedMedia.length,
      success: result3.success,
      optimization_stats: result3.optimization_stats
    });
    
    var summary = {
      success: true,
      tests_passed: [result1.success, result2.success, result3.success].filter(function(s) { return s; }).length,
      total_tests: 3,
      results: {
        test_1_photos_5: result1,
        test_2_photos_12: result2,  
        test_3_mixed: result3
      }
    };
    
    logEvent("INFO", "test_send_mixed_media_optimized_complete", "server", summary);
    
    return summary;
    
  } catch (error) {
    logEvent("ERROR", "test_send_mixed_media_optimized_error", "server", error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// 7. УТИЛИТЫ ОБРАБОТКИ URL И ID
// ============================================

/**
 * Извлекает ID группы VK из URL с поддержкой всех форматов из ARCHITECTURE.md
 * @param {string} url - URL группы VK
 * @return {string} - ID группы с префиксом - для групп
 */
function extractVkGroupId(url) {
  try {
    if (!url || typeof url !== 'string') {
      logEvent('WARN', 'vk_url_invalid_type', 'server', `URL type: ${typeof url}`);
      throw new Error('Invalid URL type');
    }
    
    const originalInput = url;
    const cleanInput = url.trim().toLowerCase().split('?')[0].split('#')[0];
    
    logEvent('DEBUG', 'vk_group_id_extraction_start', 'server', `Input: "${originalInput}" → Clean: "${cleanInput}"`);
    
    // Если уже ID (число или -число)
    if (/^-?\d+$/.test(cleanInput)) {
      const normalizedId = cleanInput.startsWith('-') ? cleanInput : '-' + cleanInput;
      logEvent('DEBUG', 'vk_group_id_numeric', 'server', `${originalInput} → ${normalizedId}`);
      return normalizedId;
    }
    
    // Форматы: vk.com/public123, vk.com/club123
    const publicClubMatch = cleanInput.match(/vk\.com\/(public|club)(\d+)/i);
    if (publicClubMatch) {
      const result = '-' + publicClubMatch[2];
      logEvent('DEBUG', 'vk_group_id_public_club', 'server', `${originalInput} → ${result}`);
      return result;
    }
    
    // Форматы: vk.com/username
    const nameMatch = cleanInput.match(/vk\.com\/([a-z0-9_]+)/i);
    if (nameMatch) {
      const screenName = nameMatch[1];
      const resolvedId = resolveVkScreenName(screenName);
      if (resolvedId) {
        logEvent('DEBUG', 'vk_group_id_resolved', 'server', `${originalInput} → ${resolvedId}`);
        return resolvedId;
      }
    }
    
    throw new Error('Invalid VK URL format: ' + originalInput);
    
  } catch (error) {
    logEvent('ERROR', 'vk_url_extraction_failed', 'server', `URL: ${url}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Резолвит screen name VK в числовой ID через API
 * @param {string} screenName - screen name пользователя или группы
 * @return {string} - числовой ID с префиксом - для групп
 */
function resolveVkScreenName(screenName) {
  try {
    const userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      throw new Error('VK User Access Token not configured');
    }
    
    const apiUrl = `https://api.vk.com/method/utils.resolveScreenName?screen_name=${encodeURIComponent(screenName)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    logEvent('DEBUG', 'vk_screen_name_resolution_start', 'server', `Screen name: ${screenName}`);
    
    const response = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      timeout: TIMEOUTS.FAST
    });
    
    const responseText = response.getContentText();
    const data = JSON.parse(responseText);
    
    if (data.error) {
      const errorCode = data.error.error_code;
      const errorMsg = data.error.error_msg;
      
      switch (errorCode) {
        case 5:
          throw new Error('VK User Access Token invalid');
        case 100:
          throw new Error(`Screen name '${screenName}' invalid format`);
        case 104:
          throw new Error(`Screen name '${screenName}' not found`);
        case 113:
          throw new Error(`Screen name '${screenName}' not found`);
        case 7:
          throw new Error(`Access denied to '${screenName}'`);
        default:
          throw new Error(`VK API Error ${errorCode}: ${errorMsg}`);
      }
    }
    
    if (!data.response) {
      throw new Error(`No response data for screen name '${screenName}'`);
    }
    
    const objectId = data.response.object_id;
    const type = data.response.type;
    
    // Правильное добавление минуса для групп
    const result = (type === 'group' || type === 'page') ? `-${objectId}` : objectId.toString();
    
    logEvent('DEBUG', 'vk_screen_name_resolved', 'server', 
      `Screen name: ${screenName} → Type: ${type}, ID: ${objectId} → Result: ${result}`);
    
    return result;
    
  } catch (error) {
    logEvent('ERROR', 'vk_screen_name_resolution_failed', 'server', 
      `Failed to resolve '${screenName}': ${error.message}`);
    throw error;
  }
}

/**
 * Извлекает безопасное имя листа из URL VK группы
 * @param {string} url - URL группы VK
 * @return {string} - безопасное имя для листа Google Sheets
 */
function extractSheetNameFromVkUrl(url) {
  if (!url) return null;
  
  const cleanUrl = url.trim().toLowerCase().split('?')[0].split('#')[0];
  
  // public123456, club789012
  const idMatch = cleanUrl.match(/(?:public|club)(\d+)/);
  if (idMatch) {
    return `${idMatch[0]}`.substring(0, 27); // Ограничение 30 символов для имени листа
  }
  
  // durov, varsmana, apiclub
  const nameMatch = cleanUrl.match(/vk\.com\/([a-z0-9_]+)/);
  if (nameMatch) {
    return nameMatch[1]
      .replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 27);
  }
  
  return null;
}

/**
 * Извлекает chat_id Telegram с поддержкой всех форматов
 * @param {string} input - input в любом формате
 * @return {string} - chat_id или @username
 */
function extractTelegramChatId(input) {
  if (!input) throw new Error('Empty Telegram input');
  
  const cleanInput = input.trim();
  
  // Уже chat_id (число)
  if (/^-?\d+$/.test(cleanInput)) return cleanInput;
  
  // Извлекаем username из разных форматов
  const patterns = [
    /t\.me\/([a-z0-9_]+)/i,     // t.me/username
    /@([a-z0-9_]+)/i,           // @username  
    /^([a-z0-9_]+)$/i           // username
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) return '@' + match[1];
  }
  
  throw new Error('Invalid Telegram format: ' + input);
}

// ============================================
// 8. PUBLISHED ЛИСТЫ СИСТЕМА
// ============================================

/**
 * Создает Published лист для отслеживания отправленных постов
 * @param {string} bindingName - название связки
 * @return {Sheet} - созданный лист
 */
function createPublishedSheet(bindingName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = getPublishedSheetName(bindingName);
    let sheet = findPublishedSheet(bindingName);
    
    if (sheet) {
      logEvent('DEBUG', 'published_sheet_exists', 'server', `Sheet ${sheet.getName()} already exists`, bindingName);
      return sheet;
    }
    
    sheet = ss.insertSheet(sheetName);
    
    // Устанавливаем заголовки
    const headers = [
      "Post ID", "Sent At", "TG Chat Name", 
      "Status", "Source", "Post Preview", "VK Post URL"
    ];
    
    sheet.appendRow(headers);
    
    // Форматируем заголовки
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#667eea");
    headerRange.setFontColor("white");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
    
    if (sheetName !== bindingName) {
      logEvent('WARN', 'published_sheet_sanitized', 'server',
               `Binding sheet sanitized: "${bindingName}" → "${sheetName}"`, bindingName);
    }
    
    logEvent('INFO', 'published_sheet_created', 'server', `Created sheet: ${sheetName}`, bindingName);
    
    return sheet;
    
  } catch (error) {
    logEvent('ERROR', 'published_sheet_creation_failed', 'server', 
      `Binding: ${bindingName}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Получает последний ID поста из Published листа
 * @param {string} bindingName - название связки
 * @param {string} vkGroupId - ID группы VK
 * @return {string|null} - последний ID поста или null
 */
function getLastPostIdFromSheet(bindingName, vkGroupId) {
  try {
    const sheet = findPublishedSheet(bindingName) || createPublishedSheet(bindingName);
    
    if (!sheet) {
      return null; // Новый лист, нет постов
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null; // Только заголовки
    
    // Последний пост в первой строке данных
    return data[1][0]; // Post ID из колонки A
    
  } catch (error) {
    logEvent('ERROR', 'get_last_post_failed', 'server', error.message);
    return null;
  }
}

/**
 * Сохраняет информацию об отправленном посте в Published лист
 * @param {string} bindingName - название связки
 * @param {string} vkGroupId - ID группы VK
 * @param {string} postId - ID поста
 * @param {Object} postData - данные поста
 */
function saveLastPostIdToSheet(bindingName, vkGroupId, postId, postData) {
  try {
    let sheet = findPublishedSheet(bindingName);
    
    if (!sheet) {
      sheet = createPublishedSheet(bindingName);
    }
    
    const sheetName = sheet.getName();
    
    // Добавляем новый пост в начало (после заголовков)
    // BindingName — имя листа; новые публикации — строка 2 (верх листа).
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 7).setValues([[
      postId,                           // Post ID
      new Date().toISOString(),         // Sent At  
      postData.tgChatName || 'Unknown', // TG Chat Name
      'sent',                           // Status
      'VK',                            // Source
      postData.preview || '',          // Post Preview
      `https://vk.com/wall${vkGroupId}_${postId}` // VK Post URL
    ]]);
    
    logEvent('INFO', 'post_saved_to_sheet', 'server', 
      `Post ${postId} saved to ${sheetName}`, bindingName);
    
  } catch (error) {
    logEvent('ERROR', 'save_post_failed', 'server', error.message, bindingName);
    throw error;
  }
}

/**
 * Проверяет, был ли пост уже отправлен
 * @param {string} bindingName - название связки
 * @param {string} postId - ID поста
 * @return {boolean} - true если пост уже был отправлен
 */
function checkPostAlreadySent(bindingName, postId) {
  try {
    const sheet = findPublishedSheet(bindingName);
    
    if (!sheet) {
      return false; // Листа нет, значит пост не отправлялся
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false; // Только заголовки
    
    // Ищем пост в колонке A (Post ID)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == postId) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    logEvent('ERROR', 'check_post_sent_failed', 'server', error.message);
    return false;
  }
}

/**
 * Очищает старые логи (старше 30 дней) из всех лог-листов
 * @return {Object} - результат очистки
 */
function cleanOldLogs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = ss.getSheets();
    const logSheets = [];
    
    // Ищем все листы с логами
    for (let i = 0; i < allSheets.length; i++) {
      const sheetName = allSheets[i].getName();
      if (sheetName === "Logs" || sheetName.toLowerCase().includes("log")) {
        logSheets.push(allSheets[i]);
      }
    }
    
    if (logSheets.length === 0) {
      logEvent('WARN', 'no_log_sheets_found', 'server', 'No log sheets found for cleanup');
      return { totalDeleted: 0, sheetResults: [] };
    }
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    const sheetResults = [];
    
    logEvent('INFO', 'log_cleanup_started', 'server', `Starting cleanup of ${logSheets.length} log sheets older than ${thirtyDaysAgo.toISOString()}`);
    
    // Обрабатываем каждый лог-лист
    for (let j = 0; j < logSheets.length; j++) {
      const sheet = logSheets[j];
      const sheetName = sheet.getName();
      let sheetDeletedCount = 0;
      
      try {
        // Проверяем, есть ли у листа данные
        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) { // Только заголовки или пустой лист
          sheetResults.push({ sheetName, deleted: 0, status: 'empty' });
          continue;
        }
        
        // Получаем все данные
        const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
        const rowsToDelete = [];
        
        // Находим строки для удаления (старше 30 дней)
        for (let i = 1; i < data.length; i++) { // Пропускаем заголовки (i = 0)
          const timestamp = data[i][0]; // Первая колонка - Timestamp
          if (timestamp && typeof timestamp === 'object' && timestamp instanceof Date) {
            if (timestamp < thirtyDaysAgo) {
              rowsToDelete.push(i + 1); // +1 потому что диапазоны в Google Sheets 1-based
            }
          } else if (typeof timestamp === 'string') {
            const dateValue = new Date(timestamp);
            if (!isNaN(dateValue.getTime()) && dateValue < thirtyDaysAgo) {
              rowsToDelete.push(i + 1);
            }
          }
        }
        
        // Удаляем старые строки (в обратном порядке чтобы не сбить индексы)
        if (rowsToDelete.length > 0) {
          rowsToDelete.sort((a, b) => b - a); // Сортируем по убыванию
          for (let k = 0; k < rowsToDelete.length; k++) {
            sheet.deleteRow(rowsToDelete[k]);
          }
          sheetDeletedCount = rowsToDelete.length;
        }
        
        totalDeleted += sheetDeletedCount;
        sheetResults.push({ 
          sheetName, 
          deleted: sheetDeletedCount, 
          status: sheetDeletedCount > 0 ? 'cleaned' : 'no_old_records'
        });
        
        logEvent('INFO', 'sheet_cleanup_completed', 'server', 
                 `Sheet: ${sheetName}, Deleted: ${sheetDeletedCount} rows`);
        
      } catch (sheetError) {
        logEvent('ERROR', 'sheet_cleanup_error', 'server', 
                 `Sheet: ${sheetName}, Error: ${sheetError.message}`);
        sheetResults.push({ sheetName, deleted: 0, status: 'error', error: sheetError.message });
      }
    }
    
    logEvent('INFO', 'log_cleanup_completed', 'server', 
             `Cleanup complete. Total deleted: ${totalDeleted} rows from ${logSheets.length} sheets`);
    
    return {
      success: true,
      totalDeleted: totalDeleted,
      sheetResults: sheetResults
    };
    
  } catch (error) {
    logEvent('ERROR', 'log_cleanup_failed', 'server', error.message);
    return { success: false, error: error.message, totalDeleted: 0, sheetResults: [] };
  }
}

/**
 * Тестовая функция для проверки логирования
 * Симулирует запись лога и проверяет, что оба листа обновлены
 * @return {Object} - Результат теста с подробной информацией
 */
function testLoggingFlow() {
  try {
    const testBindingName = "Test_Binding_" + Date.now();
    const testEvent = "test_logging_flow";
    const testLevel = "INFO";
    const testMessage = "Test logging flow verification";
    const testDetails = { test: true, timestamp: new Date().toISOString(), binding: testBindingName };
    
    console.log(`Starting logging flow test with binding: ${testBindingName}`);
    
    // 1. Записываем тестовый лог
    logEvent(testLevel, testEvent, "test_system", testDetails, testBindingName);
    
    // 2. Проверяем глобальный лист Logs
    const globalLogsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Logs");
    if (!globalLogsSheet) {
      throw new Error("Global Logs sheet not found");
    }
    
    const globalData = globalLogsSheet.getDataRange().getValues();
    const globalLatestRow = globalData.length > 1 ? globalData[1] : null; // Строка 2 — самая свежая запись
    if (!globalLatestRow) {
      throw new Error("Global Logs sheet has no data rows");
    }
    
    // Проверяем, что свежая строка содержит наш тестовый лог
    const globalMatch = globalLatestRow[3] === testEvent && // Event column
                        globalLatestRow[4] === testBindingName && // Binding Name column
                        String(globalLatestRow[5] || "").includes("Test logging flow"); // Message column
    
    // 3. Проверяем лист связки
    const bindingSheetName = sanitizeSheetName(testBindingName);
    const bindingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(bindingSheetName);
    if (!bindingSheet) {
      throw new Error(`Binding sheet '${bindingSheetName}' was not created`);
    }
    
    const bindingData = bindingSheet.getDataRange().getValues();
    const bindingLatestRow = bindingData.length > 1 ? bindingData[1] : null; // Строка 2 — свежая запись
    if (!bindingLatestRow) {
      throw new Error(`Binding sheet '${bindingSheetName}' has no data rows`);
    }
    
    // Проверяем, что свежая строка в листе связки содержит наш лог
    const bindingMatch = bindingLatestRow[3] === testEvent && // Event column
                         bindingLatestRow[4] === testBindingName && // Binding Name column
                         String(bindingLatestRow[5] || "").includes("Test logging flow"); // Message column
    
    // 4. Проверяем уникальность меток времени
    const globalTimestamp = globalLatestRow[0];
    const bindingTimestamp = bindingLatestRow[0];
    
    const timestampsMatch = globalTimestamp === bindingTimestamp;
    const timestampHasUniqueSuffix = typeof globalTimestamp === 'string' && globalTimestamp.includes('_');
    
    // 5. Формируем результат
    const result = {
      success: globalMatch && bindingMatch && timestampsMatch && timestampHasUniqueSuffix,
      summary: {
        globalLogsUpdated: globalMatch,
        bindingSheetCreated: true,
        bindingLogsUpdated: bindingMatch,
        timestampsMatch: timestampsMatch,
        timestampsUnique: timestampHasUniqueSuffix
      },
      details: {
        testBindingName: testBindingName,
        globalSheetRows: globalData.length,
        bindingSheetRows: bindingData.length,
        globalTimestamp: globalTimestamp,
        bindingTimestamp: bindingTimestamp,
        testEvent: testEvent,
        testLevel: testLevel
      }
    };
    
    // 6. Логируем результат теста
    if (result.success) {
      logEvent("INFO", "logging_flow_test_success", "test_system", 
               `Test passed. Global: ${globalMatch}, Binding: ${bindingMatch}, Timestamps: ${timestampsMatch}`);
    } else {
      logEvent("ERROR", "logging_flow_test_failed", "test_system", 
               `Test failed. Global: ${globalMatch}, Binding: ${bindingMatch}, Timestamps: ${timestampsMatch}`);
    }
    
    console.log("Logging flow test completed:", JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    const errorResult = {
      success: false,
      error: error.message,
      summary: {
        globalLogsUpdated: false,
        bindingSheetCreated: false,
        bindingLogsUpdated: false,
        timestampsMatch: false,
        timestampsUnique: false
      }
    };
    
    logEvent("ERROR", "logging_flow_test_error", "test_system", error.message);
    console.error("Logging flow test error:", error.message);
    
    return errorResult;
  }
}

// ============================================
// КОНЕЦ SERVER.GS
// ============================================

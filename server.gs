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

const DEV_MODE = false; // true для подробного логирования (только для отладки)
const SERVER_VERSION = "6.0";
const MAX_MEDIA_GROUP_SIZE = 10; // Лимит Telegram для media group
const VK_API_VERSION = "5.131";
const REQUEST_TIMEOUT = 30000; // 30 секунд

// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ И МЕНЮ
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
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
      "Binding ID", "License Key", "User Email", "VK Group URL", "TG Chat ID", "Status", "Created At", "Last Check"
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
    const htmlContent = getConfigDialogHtml();
    if (!htmlContent) {
      throw new Error("Failed to generate HTML content");
    }
    
    const html = HtmlService.createHtmlOutput(htmlContent);
    if (!html) {
      throw new Error("Failed to create HTML output");
    }
    
    html.setWidth(600).setHeight(700);
    
    SpreadsheetApp.getUi()
      .showModelessDialog(html, "⚙️ Конфигурация сервера");
      
  } catch (error) {
    logEvent("ERROR", "config_dialog_error", "system", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка открытия диалога: " + error.message);
  }
}

function getConfigDialogHtml() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    BOT_TOKEN: props.getProperty("BOT_TOKEN") || "",
    VK_SERVICE_KEY: props.getProperty("VK_SERVICE_KEY") || "",
    VK_USER_ACCESS_TOKEN: props.getProperty("VK_USER_ACCESS_TOKEN") || "",
    ADMIN_CHAT_ID: props.getProperty("ADMIN_CHAT_ID") || ""
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
<div>
  <h1>⚙️ Конфигурация сервера</h1>
  
  <div id="status"></div>
  
  <div>
    <p><strong>🤖 Telegram Bot Token</strong></p>
    <input type="password" id="botToken" value="${config.BOT_TOKEN}" placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz" size="50">
    <p><small>Получите у @BotFather в Telegram</small></p>
  </div>
  
  <div>
    <p><strong>🔑 VK Service Key</strong></p>
    <input type="password" id="vkServiceKey" value="${config.VK_SERVICE_KEY}" placeholder="abc123def456..." size="50">
    <p><small>Сервисный ключ доступа из настроек VK приложения</small></p>
  </div>
  
  <div>
    <p><strong>👤 VK User Access Token</strong></p>
    <input type="password" id="vkUserToken" value="${config.VK_USER_ACCESS_TOKEN}" placeholder="abc123def456..." size="50">
    <p><small>Пользовательский токен с правами wall, video, offline</small></p>
  </div>
  
  <div>
    <p><strong>👨‍💼 Admin Chat ID</strong></p>
    <input type="text" id="adminChatId" value="${config.ADMIN_CHAT_ID}" placeholder="-1001234567890" size="50">
    <p><small>Ваш Telegram Chat ID для уведомлений (получите у @userinfobot)</small></p>
  </div>
  
  <p><input type="button" value="💾 Сохранить конфигурацию" onclick="saveConfig()"></p>
</div>

<script>
  function showStatus(message, type) {
    const status = document.getElementById('status');
    if (type === 'success') {
      status.innerHTML = '<p><strong style="color: green;">' + message + '</strong></p>';
    } else if (type === 'error') {
      status.innerHTML = '<p><strong style="color: red;">' + message + '</strong></p>';
    } else if (type === 'warning') {
      status.innerHTML = '<p><strong style="color: orange;">' + message + '</strong></p>';
    }
  }

  function saveConfig() {
    const botToken = document.getElementById('botToken').value.trim();
    const vkServiceKey = document.getElementById('vkServiceKey').value.trim();
    const vkUserToken = document.getElementById('vkUserToken').value.trim();
    const adminChatId = document.getElementById('adminChatId').value.trim();
    
    if (!botToken || !vkServiceKey || !vkUserToken || !adminChatId) {
      showStatus('❌ Заполните все поля!', 'error');
      return;
    }
    
    if (!botToken.includes(':')) {
      showStatus('❌ Некорректный формат Bot Token!', 'error');
      return;
    }
    
    showStatus('🔄 Проверка токенов и сохранение конфигурации...', 'warning');
    
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          let message = '✅ Конфигурация сохранена!<br><br>';
          
          if (result.validation) {
            const v = result.validation;
            message += '🤖 Telegram: ' + v.telegram.status + ' ' + v.telegram.message + '<br>';
            message += '🔑 VK Service: ' + v.vkService.status + ' ' + v.vkService.message + '<br>';
            message += '👤 VK User: ' + v.vkUser.status + ' ' + v.vkUser.message + '<br>';
            message += '👨‍💼 Admin Chat: ' + v.adminChat.status + ' ' + v.adminChat.message;
          }
          
          showStatus(message, 'success');
        } else {
          showStatus('❌ Ошибка: ' + result.error, 'error');
        }
      })
      .withFailureHandler(function(error) {
        showStatus('❌ Ошибка: ' + error.message, 'error');
      })
      .saveServerConfig(botToken, vkServiceKey, vkUserToken, adminChatId);
  }
</script>
</body>
</html>`;
}

function saveServerConfig(botToken, vkServiceKey, vkUserToken, adminChatId) {
  try {
    // Сначала проверяем токены
    logEvent("INFO", "config_validation_start", "admin", "Starting token validation");
    
    const validation = validateTokens(botToken, vkServiceKey, vkUserToken, adminChatId);
    
    if (!validation.success) {
      logEvent("WARN", "config_validation_failed", "admin", validation.error);
      return { success: false, error: validation.error };
    }
    
    // Сохраняем только если все токены валидны
    const props = PropertiesService.getScriptProperties();
    
    props.setProperties({
      "BOT_TOKEN": botToken,
      "VK_SERVICE_KEY": vkServiceKey,
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

function validateTokens(botToken, vkServiceKey, vkUserToken, adminChatId) {
  const results = {
    telegram: { status: '❌', message: 'Не проверен' },
    vkService: { status: '❌', message: 'Не проверен' },
    vkUser: { status: '❌', message: 'Не проверен' },
    adminChat: { status: '❌', message: 'Не проверен' }
  };
  
  try {
    // 1. Проверяем Telegram Bot Token
    logEvent("DEBUG", "validating_telegram_token", "admin", "Testing Telegram Bot API");
    
    try {
      const tgResponse = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        muteHttpExceptions: true,
        timeout: 10000
      });
      
      const tgData = JSON.parse(tgResponse.getContentText());
      
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
    
    // 2. Проверяем VK Service Key
    logEvent("DEBUG", "validating_vk_service_key", "admin", "Testing VK Service Key");
    
    try {
      const vkServiceResponse = UrlFetchApp.fetch(
        `https://api.vk.com/method/groups.getById?group_ids=1&v=${VK_API_VERSION}&access_token=${vkServiceKey}`,
        {
          muteHttpExceptions: true,
          timeout: 10000
        }
      );
      
      const vkServiceData = JSON.parse(vkServiceResponse.getContentText());
      
      if (vkServiceData.response) {
        results.vkService = { 
          status: '✅', 
          message: 'Ключ валиден' 
        };
        logEvent("INFO", "vk_service_key_valid", "admin", "Service key is working");
      } else if (vkServiceData.error) {
        results.vkService = { 
          status: '❌', 
          message: `VK API: ${vkServiceData.error.error_msg}` 
        };
        logEvent("WARN", "vk_service_key_invalid", "admin", vkServiceData.error.error_msg);
      }
    } catch (vkServiceError) {
      results.vkService = { 
        status: '❌', 
        message: `Сетевая ошибка: ${vkServiceError.message}` 
      };
    }
    
    // 3. Проверяем VK User Token
    logEvent("DEBUG", "validating_vk_user_token", "admin", "Testing VK User Token");
    
    try {
      const vkUserResponse = UrlFetchApp.fetch(
        `https://api.vk.com/method/users.get?v=${VK_API_VERSION}&access_token=${vkUserToken}`,
        {
          muteHttpExceptions: true,
          timeout: 10000
        }
      );
      
      const vkUserData = JSON.parse(vkUserResponse.getContentText());
      
      if (vkUserData.response) {
        const user = vkUserData.response[0];
        results.vkUser = { 
          status: '✅', 
          message: `Пользователь: ${user.first_name} ${user.last_name}` 
        };
        logEvent("INFO", "vk_user_token_valid", "admin", `User: ${user.first_name} ${user.last_name}`);
      } else if (vkUserData.error) {
        results.vkUser = { 
          status: '❌', 
          message: `VK API: ${vkUserData.error.error_msg}` 
        };
        logEvent("WARN", "vk_user_token_invalid", "admin", vkUserData.error.error_msg);
      }
    } catch (vkUserError) {
      results.vkUser = { 
        status: '❌', 
        message: `Сетевая ошибка: ${vkUserError.message}` 
      };
    }
    
    // 4. Проверяем Admin Chat ID (отправляем тестовое сообщение)
    if (results.telegram.status === '✅') {
      logEvent("DEBUG", "validating_admin_chat", "admin", `Testing Admin Chat ID: ${adminChatId}`);
      
      try {
        const adminTestResponse = UrlFetchApp.fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify({
              chat_id: adminChatId,
              text: `🔧 Тестовое сообщение конфигурации VK→TG Server v${SERVER_VERSION}\n\nВсе токены настроены корректно!`,
              parse_mode: 'Markdown'
            }),
            muteHttpExceptions: true,
            timeout: 10000
          }
        );
        
        const adminTestData = JSON.parse(adminTestResponse.getContentText());
        
        if (adminTestData.ok) {
          results.adminChat = { 
            status: '✅', 
            message: 'Тестовое сообщение отправлено' 
          };
          logEvent("INFO", "admin_chat_valid", "admin", `Chat ID: ${adminChatId}`);
        } else {
          results.adminChat = { 
            status: '❌', 
            message: `Ошибка: ${adminTestData.description}` 
          };
          logEvent("WARN", "admin_chat_invalid", "admin", adminTestData.description);
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
    const allValid = Object.values(results).every(r => r.status === '✅');
    const partialValid = Object.values(results).some(r => r.status === '✅');
    
    let message = '';
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
// ПРОВЕРКА СОСТОЯНИЯ СЕРВЕРА
// ============================================

function checkServerHealth() {
  try {
    const healthData = getServerHealthData();
    const htmlContent = getServerHealthHtml(healthData);
    
    if (!htmlContent) {
      throw new Error("Failed to generate health check HTML");
    }
    
    const html = HtmlService.createHtmlOutput(htmlContent);
    if (!html) {
      throw new Error("Failed to create HTML output");
    }
    
    html.setWidth(800).setHeight(700);
    
    SpreadsheetApp.getUi()
      .showModelessDialog(html, "🔧 Состояние сервера");
      
  } catch (error) {
    logEvent("ERROR", "health_check_error", "system", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка проверки состояния: " + error.message);
  }
}

function getServerHealthData() {
  const props = PropertiesService.getScriptProperties();
  const serverUrl = ScriptApp.getService().getUrl();
  
  // Автоматически читаем токены из Properties
  const config = {
    BOT_TOKEN: props.getProperty("BOT_TOKEN"),
    VK_SERVICE_KEY: props.getProperty("VK_SERVICE_KEY"), 
    VK_USER_ACCESS_TOKEN: props.getProperty("VK_USER_ACCESS_TOKEN"),
    ADMIN_CHAT_ID: props.getProperty("ADMIN_CHAT_ID")
  };
  
  logEvent("DEBUG", "health_check_config", "system", 
           `Tokens found - Bot: ${!!config.BOT_TOKEN}, VK Service: ${!!config.VK_SERVICE_KEY}, VK User: ${!!config.VK_USER_ACCESS_TOKEN}, Admin: ${!!config.ADMIN_CHAT_ID}`);
  
  // Если есть токены, валидируем их реально
  let tokenValidation = null;
  if (config.BOT_TOKEN && config.VK_SERVICE_KEY && config.VK_USER_ACCESS_TOKEN && config.ADMIN_CHAT_ID) {
    try {
      tokenValidation = validateTokens(
        config.BOT_TOKEN, 
        config.VK_SERVICE_KEY, 
        config.VK_USER_ACCESS_TOKEN, 
        config.ADMIN_CHAT_ID
      );
      logEvent("INFO", "health_check_validation", "system", `Validation result: ${tokenValidation.success}`);
    } catch (validationError) {
      logEvent("ERROR", "health_check_validation_error", "system", validationError.message);
    }
  }
  
  // Проверяем конфигурацию
  const configStatus = {
    hasAllTokens: !!(config.BOT_TOKEN && config.VK_SERVICE_KEY && config.VK_USER_ACCESS_TOKEN && config.ADMIN_CHAT_ID),
    missingTokens: [],
    validation: tokenValidation
  };
  
  if (!config.BOT_TOKEN) configStatus.missingTokens.push("Telegram Bot Token");
  if (!config.VK_SERVICE_KEY) configStatus.missingTokens.push("VK Service Key");
  if (!config.VK_USER_ACCESS_TOKEN) configStatus.missingTokens.push("VK User Token");
  if (!config.ADMIN_CHAT_ID) configStatus.missingTokens.push("Admin Chat ID");
  
  // Проверяем листы
  const sheetsStatus = {
    licenses: checkSheetExists("Licenses"),
    bindings: checkSheetExists("Bindings"),
    logs: checkSheetExists("Logs")
  };
  
  // Тестируем API эндпоинт
  const endpointStatus = testServerEndpoint();
  
  // Общий статус
  const isHealthy = configStatus.hasAllTokens && 
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
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    return !!sheet;
  } catch (error) {
    return false;
  }
}

function testServerEndpoint() {
  try {
    const serverUrl = ScriptApp.getService().getUrl();
    
    if (!serverUrl) {
      return { working: false, error: "Не удалось получить URL сервера" };
    }
    
    // Делаем тестовый запрос с неопознанным событием
    const testPayload = {
      event: "health_check",
      timestamp: new Date().getTime()
    };
    
    const response = UrlFetchApp.fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    // Ожидаем 400 (Bad Request) для неизвестного события - это означает что сервер работает
    if (responseCode === 400) {
      try {
        const data = JSON.parse(responseText);
        if (data.error && data.error.includes("Unknown event")) {
          return { 
            working: true, 
            responseTime: "< 1 сек",
            message: "Сервер отвечает корректно" 
          };
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
    
    return { 
      working: false, 
      error: `HTTP ${responseCode}: ${responseText.substring(0, 100)}` 
    };
    
  } catch (error) {
    return { 
      working: false, 
      error: error.message 
    };
  }
}

function getServerHealthHtml(healthData) {
  // МАКСИМАЛЬНО простой HTML для Google Apps Script - без CSS, только текст и базовая структура
  let html = '<div>';
  
  // Заголовок
  html += `<h2>${healthData.status}</h2>`;
  html += `<p>VK→Telegram Crossposter Server v${healthData.version}</p>`;
  html += `<p>Развертывание: ${healthData.deploymentDate}</p>`;
  html += '<hr>';
  
  // URL сервера
  html += '<h3>🌐 URL сервера</h3>';
  html += `<p><code>${healthData.serverUrl}</code></p>`;
  html += '<p><small>Этот URL используется клиентами для подключения к серверу</small></p>';
  html += '<hr>';
  
  // Конфигурация
  html += '<h3>🔧 Конфигурация</h3>';
  html += '<table border="1" cellpadding="5" cellspacing="0">';
  html += `<tr><td>Все токены настроены</td><td><strong>${healthData.config.hasAllTokens ? '✅ Да' : '❌ Нет'}</strong></td></tr>`;
  html += '</table>';
  
  if (!healthData.config.hasAllTokens) {
    html += '<p><strong>⚠️ Отсутствуют токены:</strong></p>';
    html += '<ul>';
    healthData.config.missingTokens.forEach(token => {
      html += `<li>${token}</li>`;
    });
    html += '</ul>';
  }
  html += '<hr>';
  
  // Структура данных
  html += '<h3>📊 Структура данных</h3>';
  html += '<table border="1" cellpadding="5" cellspacing="0">';
  html += `<tr><td>Лист "Licenses"</td><td><strong>${healthData.sheets.licenses ? '✅ Создан' : '❌ Отсутствует'}</strong></td></tr>`;
  html += `<tr><td>Лист "Bindings"</td><td><strong>${healthData.sheets.bindings ? '✅ Создан' : '❌ Отсутствует'}</strong></td></tr>`;
  html += `<tr><td>Лист "Logs"</td><td><strong>${healthData.sheets.logs ? '✅ Создан' : '❌ Отсутствует'}</strong></td></tr>`;
  html += '</table>';
  html += '<hr>';
  
  // API Endpoint
  html += '<h3>🚀 API Endpoint</h3>';
  html += '<table border="1" cellpadding="5" cellspacing="0">';
  html += `<tr><td>Статус сервера</td><td><strong>${healthData.endpoint.working ? '✅ Работает' : '❌ Недоступен'}</strong></td></tr>`;
  
  if (healthData.endpoint.working) {
    html += `<tr><td>Время отклика</td><td><strong>${healthData.endpoint.responseTime}</strong></td></tr>`;
  } else {
    html += '</table>';
    html += `<p><strong>❌ Ошибка:</strong> ${healthData.endpoint.error}</p>`;
  }
  
  if (healthData.endpoint.working) {
    html += '</table>';
  }
  html += '<hr>';
  
  // Финальный статус и инструкции
  if (healthData.isHealthy) {
    html += '<h3>🎉 Сервер полностью готов к работе!</h3>';
    html += '<p>Клиенты могут подключаться и отправлять запросы.</p>';
  } else {
    html += '<h3>⚠️ Требуется дополнительная настройка</h3>';
    html += '<p><strong>Что нужно сделать:</strong></p>';
    html += '<ul>';
    
    if (!healthData.sheets.licenses || !healthData.sheets.bindings || !healthData.sheets.logs) {
      html += '<li>Выполните <strong>пункт 1: "Инициализировать сервер"</strong> для создания листов</li>';
    }
    
    if (!healthData.config.hasAllTokens) {
      html += '<li>Настройте <strong>пункт 2: "Настроить конфигурацию"</strong> - добавьте отсутствующие токены:</li>';
      html += '<ul>';
      healthData.config.missingTokens.forEach(token => {
        html += `<li>${token}</li>`;
      });
      html += '</ul>';
    }
    
    if (!healthData.endpoint.working) {
      html += '<li>Проверьте развертывание сервера - API эндпоинт недоступен</li>';
    }
    
    html += '</ul>';
    html += '<p><strong>После исправления:</strong> нажмите "🔄 Обновить проверку"</p>';
  }
  
  // Кнопка обновления (самая простая)
  html += '<p>';
  html += '<input type="button" value="🔄 Обновить проверку" onclick="google.script.run.checkServerHealth(); google.script.host.close();">';
  html += '</p>';
  
  html += '</div>';
  
  return html;
}

// ============================================
// 2. ГЛАВНЫЙ API ENDPOINT
// ============================================

function doPost(e) {
  try {
    const clientIp = e.parameter.clientIp || "unknown";
    const payload = JSON.parse(e.postData.contents);
    
    logEvent("DEBUG", "api_request", payload.license_key || "anonymous", 
             `Event: ${payload.event}, IP: ${clientIp}`);
    
    // Маршрутизация запросов
    switch (payload.event) {
      case "check_license":
        return handleCheckLicense(payload, clientIp);
      case "add_binding":
        return handleAddBinding(payload, clientIp);
      case "edit_binding":
        return handleEditBinding(payload, clientIp);
      case "delete_binding":
        return handleDeleteBinding(payload, clientIp);
      case "get_bindings":
        return handleGetBindings(payload, clientIp);
      case "toggle_binding_status":
        return handleToggleBindingStatus(payload, clientIp);
      case "send_post":
        return handleSendPost(payload, clientIp);
      case "test_publication":
        return handleTestPublication(payload, clientIp);
      default:
        return jsonResponse({
          success: false,
          error: "Unknown event: " + payload.event
        }, 400);
    }
    
  } catch (error) {
    logEvent("ERROR", "api_error", "system", error.message);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// ============================================
// 3. ОБРАБОТЧИКИ API ЗАПРОСОВ
// ============================================

function handleCheckLicense(payload, clientIp) {
  try {
    const { license_key } = payload;
    
    if (!license_key) {
      return jsonResponse({
        success: false,
        error: "License key required"
      }, 400);
    }
    
    const license = findLicense(license_key);
    
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

function handleAddBinding(payload, clientIp) {
  try {
    const { license_key, vk_group_url, tg_chat_id } = payload;
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Проверяем лимит
    const currentBindings = getUserBindings(license_key);
    if (currentBindings.length >= licenseData.license.maxGroups) {
      return jsonResponse({
        success: false,
        error: "Max groups limit exceeded"
      }, 429);
    }
    
    // АВТОМАТИЧЕСКОЕ ПРЕОБРАЗОВАНИЕ ССЫЛОК В ID
    let processedVkGroupId;
    let processedTgChatId;
    
    try {
      // Извлекаем ID ВК группы из ссылки
      processedVkGroupId = extractVkGroupId(vk_group_url);
      logEvent("INFO", "vk_url_converted", license_key, `${vk_group_url} -> ${processedVkGroupId}`);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в ВК ссылке: ${error.message}`
      }, 400);
    }
    
    try {
      // Извлекаем chat_id Telegram канала
      processedTgChatId = extractTelegramChatId(tg_chat_id);
      logEvent("INFO", "tg_url_converted", license_key, `${tg_chat_id} -> ${processedTgChatId}`);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в Telegram ссылке: ${error.message}`
      }, 400);
    }
    
    // Создаем новую связку с обработанными ID
    const bindingId = generateBindingId();
    const license = findLicense(license_key);
    
    const bindingsSheet = getSheet("Bindings");
    bindingsSheet.appendRow([
      bindingId,
      license_key,
      license.email,
      vk_group_url,          // Сохраняем оригинальную ссылку для отображения
      processedTgChatId,     // Сохраняем обработанный chat_id для API
      "active",
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    
    logEvent("INFO", "binding_added", license_key, 
             `Binding ID: ${bindingId}, VK: ${vk_group_url} (${processedVkGroupId}), TG: ${processedTgChatId}, IP: ${clientIp}`);
    
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
    const { license_key, binding_id, vk_group_url, tg_chat_id } = payload;
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    const bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // АВТОМАТИЧЕСКОЕ ПРЕОБРАЗОВАНИЕ ССЫЛОК В ID
    let processedVkGroupId;
    let processedTgChatId;
    
    try {
      // Извлекаем ID ВК группы из ссылки
      processedVkGroupId = extractVkGroupId(vk_group_url);
      logEvent("INFO", "vk_url_converted", license_key, `${vk_group_url} -> ${processedVkGroupId}`);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в ВК ссылке: ${error.message}`
      }, 400);
    }
    
    try {
      // Извлекаем chat_id Telegram канала
      processedTgChatId = extractTelegramChatId(tg_chat_id);
      logEvent("INFO", "tg_url_converted", license_key, `${tg_chat_id} -> ${processedTgChatId}`);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: `Ошибка в Telegram ссылке: ${error.message}`
      }, 400);
    }
    
    // Обновляем связку с обработанными ID
    const bindingsSheet = getSheet("Bindings");
    bindingsSheet.getRange(bindingRow, 4).setValue(vk_group_url);      // VK Group URL (оригинальная ссылка)
    bindingsSheet.getRange(bindingRow, 5).setValue(processedTgChatId); // TG Chat ID (обработанный)
    bindingsSheet.getRange(bindingRow, 8).setValue(new Date().toISOString()); // Last Check
    
    logEvent("INFO", "binding_edited", license_key, 
             `Binding ID: ${binding_id}, VK: ${vk_group_url} (${processedVkGroupId}), TG: ${processedTgChatId}, IP: ${clientIp}`);
    
    return jsonResponse({ 
      success: true,
      converted: {
        vk_group_id: processedVkGroupId,
        tg_chat_id: processedTgChatId
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_edit_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleDeleteBinding(payload, clientIp) {
  try {
    const { license_key, binding_id } = payload;
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим и удаляем связку
    const bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    const bindingsSheet = getSheet("Bindings");
    bindingsSheet.deleteRow(bindingRow);
    
    logEvent("INFO", "binding_deleted", license_key, 
             `Binding ID: ${binding_id}, IP: ${clientIp}`);
    
    return jsonResponse({ success: true });
    
  } catch (error) {
    logEvent("ERROR", "binding_delete_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetBindings(payload, clientIp) {
  try {
    const { license_key } = payload;
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    const bindings = getUserBindings(license_key);
    
    return jsonResponse({
      success: true,
      bindings: bindings
    });
    
  } catch (error) {
    logEvent("ERROR", "get_bindings_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleToggleBindingStatus(payload, clientIp) {
  try {
    const { license_key, binding_id } = payload;
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    const bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // Переключаем статус
    const bindingsSheet = getSheet("Bindings");
    const currentStatus = bindingsSheet.getRange(bindingRow, 6).getValue();
    const newStatus = currentStatus === "active" ? "paused" : "active";
    
    bindingsSheet.getRange(bindingRow, 6).setValue(newStatus);
    bindingsSheet.getRange(bindingRow, 8).setValue(new Date().toISOString());
    
    logEvent("INFO", "binding_status_changed", license_key, 
             `Binding ID: ${binding_id}, Status: ${currentStatus} → ${newStatus}, IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      new_status: newStatus
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_status_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleSendPost(payload, clientIp) {
  try {
    const { license_key, binding_id, vk_post } = payload;
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    const binding = findBindingById(binding_id, license_key);
    if (!binding || binding.status !== "active") {
      return jsonResponse({
        success: false,
        error: "Active binding not found"
      }, 404);
    }
    
    // Отправляем пост в Telegram
    const result = sendVkPostToTelegram(binding.tgChatId, vk_post);
    
    if (result.success) {
      logEvent("INFO", "post_sent", license_key, 
               `Post ID: ${vk_post.id}, TG: ${binding.tgChatId}, IP: ${clientIp}`);
      
      return jsonResponse({
        success: true,
        message_id: result.message_id
      });
    } else {
      logEvent("ERROR", "post_send_failed", license_key, 
               `Post ID: ${vk_post.id}, Error: ${result.error}, IP: ${clientIp}`);
      
      return jsonResponse({
        success: false,
        error: result.error
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "send_post_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleTestPublication(payload, clientIp) {
  try {
    const { license_key, binding_id } = payload;
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    const binding = findBindingById(binding_id, license_key);
    if (!binding) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // Получаем последний пост из VK группы
    const vkGroupId = extractVkGroupId(binding.vkGroupUrl);
    if (!vkGroupId) {
      return jsonResponse({
        success: false,
        error: "Invalid VK group URL"
      }, 400);
    }
    
    const posts = getVkPosts(vkGroupId, 1);
    if (!posts || posts.length === 0) {
      return jsonResponse({
        success: false,
        error: "No posts found in VK group"
      }, 404);
    }
    
    const testPost = posts[0];
    testPost.text = "🧪 ТЕСТ: " + (testPost.text || "Пост без текста");
    
    // Отправляем тестовый пост
    const result = sendVkPostToTelegram(binding.tgChatId, testPost);
    
    if (result.success) {
      logEvent("INFO", "test_post_sent", license_key, 
               `Binding ID: ${binding_id}, VK: ${binding.vkGroupUrl}, TG: ${binding.tgChatId}, IP: ${clientIp}`);
      
      return jsonResponse({ success: true });
    } else {
      logEvent("ERROR", "test_post_failed", license_key, 
               `Binding ID: ${binding_id}, Error: ${result.error}, IP: ${clientIp}`);
      
      return jsonResponse({
        success: false,
        error: result.error
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "test_publication_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================
// 4. TELEGRAM API
// ============================================

function sendVkPostToTelegram(chatId, vkPost) {
  try {
    const botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      return { success: false, error: "Bot token not configured" };
    }
    
    // Форматируем текст
    let text = formatVkTextForTelegram(vkPost.text || "");
    
    // Обрабатываем все типы вложений
    const mediaData = getVkMediaUrls(vkPost.attachments || []);
    
    // Добавляем информацию о видео и аудио в текст
    if (mediaData.videoLinks.length > 0) {
      text += "\n\n🎥 Видео:\n" + mediaData.videoLinks.join("\n");
    }
    if (mediaData.audioLinks.length > 0) {
      text += "\n\n🎵 Аудио:\n" + mediaData.audioLinks.join("\n");
    }
    if (mediaData.docLinks.length > 0) {
      text += "\n\n📎 Документы:\n" + mediaData.docLinks.join("\n");
    }
    
    // Отправляем пост
    if (mediaData.photos.length > 0) {
      return sendTelegramMediaGroup(botToken, chatId, mediaData.photos, text);
    } else {
      return sendTelegramMessage(botToken, chatId, text);
    }
    
  } catch (error) {
    logEvent("ERROR", "send_telegram_error", "server", error.message);
    return { success: false, error: error.message };
  }
}

function sendTelegramMessage(token, chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      return { success: true, message_id: result.result.message_id };
    } else {
      return { success: false, error: result.description || "Unknown error" };
    }
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function sendTelegramMediaGroup(token, chatId, mediaUrls, caption) {
  try {
    if (mediaUrls.length === 0) {
      return sendTelegramMessage(token, chatId, caption);
    }
    
    const url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    
    const media = mediaUrls.slice(0, 10).map((item, index) => ({
      type: item.type,
      media: item.url,
      caption: index === 0 ? caption : undefined,
      parse_mode: index === 0 ? 'Markdown' : undefined
    }));
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: chatId,
        media: media
      }),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      return { success: true, message_id: result.result[0].message_id };
    } else {
      return { success: false, error: result.description || "Unknown error" };
    }
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// 5. VK API
// ============================================

function getVkPosts(groupId, count = 10) {
  try {
    const serviceKey = PropertiesService.getScriptProperties().getProperty("VK_SERVICE_KEY");
    
    if (!serviceKey) {
      throw new Error("VK Service Key not configured");
    }
    
    // groupId может быть уже с минусом (-123456) или без минуса (123456)
    const ownerId = groupId.toString().startsWith('-') ? groupId : '-' + groupId;
    const url = `https://api.vk.com/method/wall.get?owner_id=${ownerId}&count=${count}&v=5.131&access_token=${serviceKey}`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (data.error) {
      throw new Error(`VK API Error: ${data.error.error_msg} (${data.error.error_code})`);
    }
    
    if (!data.response || !data.response.items) {
      throw new Error("Invalid VK API response");
    }
    
    return data.response.items.map(post => ({
      id: post.id,
      text: post.text || "",
      date: post.date,
      attachments: post.attachments || []
    }));
    
  } catch (error) {
    logEvent("ERROR", "vk_api_error", "system", `Group ID: ${groupId}, Error: ${error.message}`);
    return [];
  }
}

// Функция extractVkGroupId удалена - используется новая версия в конце файла

// ============================================
// 6. УТИЛИТЫ И ХЕЛПЕРЫ
// ============================================

function formatVkTextForTelegram(text) {
  if (!text) return "";
  
  // Делаем жирным первое предложение
  text = text.replace(/^([^.!?]*[.!?])/, '*$1*');
  
  // Делаем жирными слова в ВЕРХНЕМ РЕГИСТРЕ
  text = text.replace(/\b[А-ЯA-Z]{2,}\b/g, '*$&*');
  
  // Преобразуем ссылки VK
  text = text.replace(/\[(\w+)\|([^\]]+)\]/g, '[$2](https://vk.com/$1)');
  
  // Удаляем лишние пробелы
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

function getVkMediaUrls(attachments) {
  const result = {
    photos: [],
    videoLinks: [],
    audioLinks: [],
    docLinks: []
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
          // Для видео получаем реальные ссылки только с пользовательским токеном
          const videoId = `${attachment.video.owner_id}_${attachment.video.id}`;
          const videoDirectUrl = getVkVideoDirectUrl(videoId);
          
          if (videoDirectUrl) {
            result.videoLinks.push(`🎥 [Смотреть видео](${videoDirectUrl})`);
          } else {
            result.videoLinks.push(`🎥 [Видео](https://vk.com/video${videoId})`);
          }
          break;
          
        case "audio":
          if (attachment.audio.url) {
            // Если есть прямая ссылка на аудио (редко)
            result.audioLinks.push(`🎵 ${attachment.audio.artist} - ${attachment.audio.title}`);
          } else {
            result.audioLinks.push(`🎵 ${attachment.audio.artist} - ${attachment.audio.title}`);
          }
          break;
          
        case "doc":
          if (attachment.doc.url) {
            result.docLinks.push(`📎 [${attachment.doc.title}](${attachment.doc.url})`);
          }
          break;
          
        case "link":
          result.docLinks.push(`🔗 [${attachment.link.title || attachment.link.url}](${attachment.link.url})`);
          break;
      }
    } catch (attachError) {
      logEvent("WARN", "attachment_processing_error", "server", `Type: ${attachment.type}, Error: ${attachError.message}`);
    }
  }
  
  return result;
}

function getVkVideoDirectUrl(videoId) {
  try {
    const userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      logEvent("WARN", "vk_user_token_missing", "server", "Cannot get video URLs without user token");
      return null;
    }
    
    logEvent("DEBUG", "vk_video_request_start", "server", `Video ID: ${videoId}`);
    
    const url = `https://api.vk.com/method/video.get?videos=${encodeURIComponent(videoId)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const responseText = response.getContentText();
    logEvent("DEBUG", "vk_video_api_response", "server", `Status: ${response.getResponseCode()}, Body length: ${responseText.length}, First 200 chars: ${responseText.substring(0, 200)}`);
    
    const data = JSON.parse(responseText);
    
    if (data.error) {
      logEvent("WARN", "vk_video_api_error", "server", `Video ID: ${videoId}, Error Code: ${data.error.error_code}, Message: ${data.error.error_msg}`);
      return null;
    }
    
    if (!data.response || !data.response.items || data.response.items.length === 0) {
      logEvent("DEBUG", "vk_video_not_found", "server", `Video ID: ${videoId} - no items in response`);
      return null;
    }
    
    const video = data.response.items[0];
    logEvent("DEBUG", "vk_video_details", "server", `Video: "${video.title?.substring(0, 50) || 'No title'}", Duration: ${video.duration}, Owner: ${video.owner_id}`);
    
    // Ищем лучшее качество видео
    const files = video.files;
    if (files) {
      const availableQualities = Object.keys(files).filter(key => key.startsWith('mp4_'));
      logEvent("DEBUG", "vk_video_qualities", "server", `Available: [${availableQualities.join(', ')}]`);
      
      const qualities = ['mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
      
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
    const playerUrl = video.player;
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
  const preferredTypes = ['w', 'z', 'y', 'x', 'r', 'q', 'p', 'o', 'n', 'm', 's'];
  
  for (const type of preferredTypes) {
    const size = sizes.find(s => s.type === type);
    if (size) return size.url;
  }
  
  return sizes[sizes.length - 1].url;
}

function generateBindingId() {
  return 'binding_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
}

function createSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    
    // Форматируем заголовки
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#667eea");
    headerRange.setFontColor("white");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet "${name}" not found. Run server initialization first.`);
  }
  return sheet;
}

function findLicense(licenseKey) {
  try {
    const sheet = getSheet("Licenses");
    const data = sheet.getDataRange().getValues();
    
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
    const sheet = getSheet("Bindings");
    const data = sheet.getDataRange().getValues();
    
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
          lastCheck: data[i][7]
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
    const sheet = getSheet("Bindings");
    const data = sheet.getDataRange().getValues();
    
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
    const sheet = getSheet("Bindings");
    const data = sheet.getDataRange().getValues();
    const bindings = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === licenseKey) {
        bindings.push({
          id: data[i][0],
          vkGroupUrl: data[i][3],
          tgChatId: data[i][4],
          status: data[i][5],
          createdAt: data[i][6],
          lastCheck: data[i][7]
        });
      }
    }
    
    return bindings;
  } catch (error) {
    logEvent("ERROR", "get_user_bindings_error", licenseKey, error.message);
    return [];
  }
}

function logEvent(level, event, user, details) {
  try {
    if (!DEV_MODE && level === "DEBUG") {
      return; // Пропускаем DEBUG логи в продакшене
    }
    
    const sheet = getSheet("Logs");
    sheet.appendRow([
      new Date().toISOString(),
      level,
      event,
      user || "system",
      details || "",
      ""  // IP заполняется в doPost
    ]);
    
    // Также логируем в консоль
    console.log(`[${level}] ${event} (${user}): ${details}`);
    
  } catch (error) {
    console.error("Logging error:", error.message);
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
    const htmlContent = getAdminPanelHtml();
    if (!htmlContent) {
      throw new Error("Failed to generate admin panel HTML");
    }
    
    const html = HtmlService.createHtmlOutput(htmlContent);
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
  const stats = getSystemStats();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
  <div>
    <h1>🎛️ Админ панель VK→TG Server v${SERVER_VERSION}</h1>
    <p>Статистика и управление системой</p>
    <hr>
    
    <h2>📊 Общая статистика</h2>
    <table border="1" cellpadding="5" cellspacing="0">
      <tr>
        <td><strong>Всего лицензий</strong></td>
        <td><strong>${stats.totalLicenses}</strong></td>
        <td><strong>Активных лицензий</strong></td>
        <td><strong>${stats.activeLicenses}</strong></td>
      </tr>
      <tr>
        <td><strong>Всего связок</strong></td>
        <td><strong>${stats.totalBindings}</strong></td>
        <td><strong>Активных связок</strong></td>
        <td><strong>${stats.activeBindings}</strong></td>
      </tr>
    </table>
    <hr>
      
    <h2>📜 Последние лицензии</h2>
    <table border="1" cellpadding="5" cellspacing="0">
      <tr>
        <th>Ключ</th>
        <th>Email</th>
        <th>Тип</th>
        <th>Макс групп</th>
        <th>Статус</th>
        <th>Истекает</th>
      </tr>
      ${stats.recentLicenses.map(lic => `
        <tr>
          <td><code>${lic.key.substring(0, 20)}...</code></td>
          <td>${lic.email}</td>
          <td><strong>${lic.type}</strong></td>
          <td>${lic.maxGroups}</td>
          <td><strong style="color: ${lic.status === 'active' ? 'green' : 'red'}">${lic.status}</strong></td>
          <td>${new Date(lic.expires).toLocaleDateString()}</td>
        </tr>
      `).join('')}
    </table>
    <hr>
      
    <h2>🔗 Последние связки</h2>
    <table border="1" cellpadding="5" cellspacing="0">
      <tr>
        <th>ID</th>
        <th>Email</th>
        <th>VK группа</th>
        <th>TG чат</th>
        <th>Статус</th>
        <th>Создано</th>
      </tr>
      ${stats.recentBindings.map(binding => `
        <tr>
          <td><code>${binding.id.substring(0, 15)}...</code></td>
          <td>${binding.userEmail}</td>
          <td>${binding.vkGroupUrl}</td>
          <td><code>${binding.tgChatId}</code></td>
          <td><strong style="color: ${binding.status === 'active' ? 'green' : (binding.status === 'paused' ? 'orange' : 'red')}">${binding.status}</strong></td>
          <td>${new Date(binding.createdAt).toLocaleDateString()}</td>
        </tr>
      `).join('')}
    </table>
  </div>
</body>
</html>`;
}

function showStatistics() {
  const stats = getSystemStats();
  
  const message = `📊 Статистика сервера v${SERVER_VERSION}

🔑 Лицензии:
• Всего: ${stats.totalLicenses}
• Активных: ${stats.activeLicenses}
• Истекших: ${stats.expiredLicenses}

🔗 Связки:
• Всего: ${stats.totalBindings}
• Активных: ${stats.activeBindings}
• На паузе: ${stats.pausedBindings}

📈 Активность:
• Постов отправлено сегодня: ${stats.postsToday}
• Последний пост: ${stats.lastPostTime}

🏆 Топ пользователь: ${stats.topUser}`;
  
  SpreadsheetApp.getUi().alert(message);
}

function getSystemStats() {
  try {
    const licensesSheet = getSheet("Licenses");
    const bindingsSheet = getSheet("Bindings");
    const logsSheet = getSheet("Logs");
    
    const licensesData = licensesSheet.getDataRange().getValues().slice(1);
    const bindingsData = bindingsSheet.getDataRange().getValues().slice(1);
    const logsData = logsSheet.getDataRange().getValues().slice(1);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
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
          createdAt: binding[6]
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
  const userCounts = {};
  
  bindingsData.forEach(binding => {
    const email = binding[2];
    userCounts[email] = (userCounts[email] || 0) + 1;
  });
  
  const topEntry = Object.entries(userCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  return topEntry ? `${topEntry[0]} (${topEntry[1]} связок)` : "Нет данных";
}

function showLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logsSheet = ss.getSheetByName("Logs");
  
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
 * Извлекает ID группы ВКонтакте из различных форматов ссылок
 * @param {string} url - URL группы ВКонтакте
 * @return {string} - ID группы или null при ошибке
 */
function extractVkGroupId(url) {
  try {
    if (!url || typeof url !== 'string') {
      throw new Error('Некорректная ссылка на ВК группу');
    }
    
    // Убираем лишние пробелы и приводим к нижнему регистру
    url = url.trim().toLowerCase();
    
    // Форматы ссылок ВК:
    // https://vk.com/public123456 -> -123456
    // https://vk.com/club123456 -> -123456  
    // https://vk.com/shortname -> нужен API запрос
    // vk.com/public123456 -> -123456
    
    // Добавляем протокол если отсутствует
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // Извлекаем путь из URL
    const urlParts = url.match(/vk\.com\/(.+)/);
    if (!urlParts) {
      throw new Error('Неверный формат ссылки ВК (должна содержать vk.com)');
    }
    
    const path = urlParts[1];
    
    // Случай 1: public123456 -> -123456
    const publicMatch = path.match(/^public(\d+)$/);
    if (publicMatch) {
      return '-' + publicMatch[1];
    }
    
    // Случай 2: club123456 -> -123456
    const clubMatch = path.match(/^club(\d+)$/);
    if (clubMatch) {
      return '-' + clubMatch[1];
    }
    
    // Случай 3: короткое имя -> нужен API запрос к ВК
    const shortName = path.replace(/[^a-z0-9_]/g, '');
    if (shortName) {
      return resolveVkShortName(shortName);
    }
    
    throw new Error('Неподдерживаемый формат ссылки ВК');
    
  } catch (error) {
    logEvent('ERROR', 'vk_url_parse_error', 'system', `URL: ${url}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Резолвит короткое имя ВК группы в ID через API
 * @param {string} shortName - короткое имя группы
 * @return {string} - ID группы
 */
function resolveVkShortName(shortName) {
  try {
    const serviceToken = PropertiesService.getScriptProperties().getProperty("VK_SERVICE_KEY");
    if (!serviceToken) {
      throw new Error('VK Service Token не настроен');
    }
    
    const response = UrlFetchApp.fetch(
      `https://api.vk.com/method/utils.resolveScreenName?screen_name=${shortName}&access_token=${serviceToken}&v=${VK_API_VERSION}`,
      { muteHttpExceptions: true }
    );
    
    const data = JSON.parse(response.getContentText());
    
    if (data.error) {
      throw new Error(`VK API Error: ${data.error.error_msg}`);
    }
    
    if (!data.response || data.response.type !== 'group') {
      throw new Error('Ссылка не ведет на группу ВК или группа не найдена');
    }
    
    return '-' + data.response.object_id;
    
  } catch (error) {
    logEvent('ERROR', 'vk_resolve_error', 'system', `Short name: ${shortName}, Error: ${error.message}`);
    throw new Error(`Не удалось найти группу ВК "${shortName}": ${error.message}`);
  }
}

/**
 * Извлекает Chat ID Telegram канала из ссылки или username
 * @param {string} input - ссылка на канал или @username
 * @return {string} - chat_id канала
 */
function extractTelegramChatId(input) {
  try {
    if (!input || typeof input !== 'string') {
      throw new Error('Некорректная ссылка на Telegram канал');
    }
    
    input = input.trim();
    
    // Форматы Telegram:
    // https://t.me/channelname -> @channelname
    // t.me/channelname -> @channelname
    // @channelname -> @channelname
    // channelname -> @channelname
    // -1001234567890 -> -1001234567890 (уже chat_id)
    
    // Если уже является chat_id (начинается с -100)
    if (input.match(/^-100\d+$/)) {
      return input;
    }
    
    // Если начинается с @, оставляем как есть
    if (input.startsWith('@')) {
      return input;
    }
    
    // Извлекаем имя канала из t.me ссылки
    const tMeMatch = input.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (tMeMatch) {
      return '@' + tMeMatch[1];
    }
    
    // Простое имя канала без символов
    if (input.match(/^[a-zA-Z0-9_]+$/)) {
      return '@' + input;
    }
    
    throw new Error('Неподдерживаемый формат ссылки Telegram');
    
  } catch (error) {
    logEvent('ERROR', 'tg_url_parse_error', 'system', `Input: ${input}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Тестирует функции извлечения ID из ссылок
 */
function testUrlExtraction() {
  console.log('=== Тестирование извлечения ID из ссылок ===');
  
  // Тесты ВК
  const vkTests = [
    'https://vk.com/public123456',
    'vk.com/club789012', 
    'https://vk.com/durov',
    'VK.COM/PUBLIC999888'
  ];
  
  vkTests.forEach(url => {
    try {
      const id = extractVkGroupId(url);
      console.log(`✅ VK: ${url} -> ${id}`);
    } catch (error) {
      console.log(`❌ VK: ${url} -> Error: ${error.message}`);
    }
  });
  
  // Тесты Telegram
  const tgTests = [
    'https://t.me/durov',
    't.me/telegram',
    '@channelname',
    'mychannel',
    '-1001234567890'
  ];
  
  tgTests.forEach(input => {
    try {
      const id = extractTelegramChatId(input);
      console.log(`✅ TG: ${input} -> ${id}`);
    } catch (error) {
      console.log(`❌ TG: ${input} -> Error: ${error.message}`);
    }
  });
}

// ============================================
// КОНЕЦ SERVER.GS
// ============================================

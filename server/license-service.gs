/**
 * VK→Telegram Crossposter - LICENSE SERVICE MODULE
 * Управление лицензиями, конфигурацией и проверкой здоровья сервера
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// ОБРАБОТКА ЛИЦЕНЗИЙ
// ============================================

/**
 * Обработка запроса на проверку лицензии
 * @param {Object} payload - Данные запроса
 * @param {string} payload.license_key - Ключ лицензии
 * @param {string} clientIp - IP адрес клиента
 * @returns {ContentService.TextOutput} - JSON ответ
 * @returns {boolean} returns.success - Успешность проверки
 * @returns {Object} [returns.license] - Информация о лицензии
 * @returns {string} [returns.error] - Сообщение об ошибке
 */
function handleCheckLicense(payload, clientIp) {
  try {
    var license_key = payload.license_key;
    
    if (!license_key) {
      return jsonResponse({ success: false, error: 'License key required' }, 400);
    }

    var license = findLicense(license_key);
    if (!license) {
      logEvent('WARN', 'license_not_found', license_key, `IP: ${clientIp}`);
      return jsonResponse({ success: false, error: 'License not found' }, 404);
    }

    if (license.status !== 'active') {
      logEvent('WARN', 'license_inactive', license_key, `Status: ${license.status}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: 'License inactive' }, 403);
    }

    if (new Date() > new Date(license.expires)) {
      logEvent('WARN', 'license_expired', license_key, `Expires: ${license.expires}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: 'License expired' }, 403);
    }

    logEvent('INFO', 'license_check_success', license_key, `IP: ${clientIp}`);
    return jsonResponse({ 
      success: true, 
      license: {
        type: license.type,
        maxGroups: license.maxGroups,
        expires: license.expires
      }
    });
    
  } catch (error) {
    logEvent('ERROR', 'license_check_error', payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Поиск лицензии по ключу
 * @param {string} licenseKey - Лицензионный ключ
 * @returns {LicenseRecord|null} - Объект лицензии или null
 */
function findLicense(licenseKey) {
  try {
    var sheet = getSheet('Licenses');
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
    logEvent('ERROR', 'find_license_error', 'system', error.message);
    return null;
  }
}

// ============================================
// КОНФИГУРАЦИЯ СЕРВЕРА
// ============================================

/**
 * Показывает диалог конфигурации сервера
 * @returns {void}
 */
function showConfigDialog() {
  try {
    var htmlContent = getConfigDialogHtml();
    if (!htmlContent) {
      throw new Error('Failed to generate HTML content');
    }

    var html = HtmlService.createHtmlOutput(htmlContent);
    if (!html) {
      throw new Error('Failed to create HTML output');
    }

    html.setWidth(600).setHeight(700);
    SpreadsheetApp.getUi()
      .showModelessDialog(html, '⚙️ Настройка сервера');

  } catch (error) {
    logEvent('ERROR', 'config_dialog_error', 'system', error.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка диалога конфигурации: ' + error.message);
  }
}

/**
 * Генерирует HTML для диалога конфигурации
 * @returns {string} - HTML контент
 */
function getConfigDialogHtml() {
  var props = PropertiesService.getScriptProperties();
  var config = {
    BOT_TOKEN: props.getProperty('BOT_TOKEN') || '',
    VK_USER_ACCESS_TOKEN: props.getProperty('VK_USER_ACCESS_TOKEN') || '',
    ADMIN_CHAT_ID: props.getProperty('ADMIN_CHAT_ID') || ''
  };

  var html = `<!DOCTYPE html>
<html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 500px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 0 auto; }
        h1 { color: #333; font-size: 20px; margin-top: 0; margin-bottom: 20px; }
        label { display: block; margin-top: 15px; font-weight: bold; color: #555; margin-bottom: 5px; }
        input { width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 13px; }
        small { display: block; margin-top: 3px; color: #888; font-size: 12px; }
        button { background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 20px; width: 100%; font-weight: bold; }
        button:hover { background: #5568d3; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        .status { margin-top: 15px; padding: 12px; border-radius: 4px; background: #f0f0f0; display: none; }
        .error { background: #fee; border-left: 4px solid #f00; color: #c33; }
        .success { background: #efe; border-left: 4px solid #0f0; color: #030; }
        .warning { background: #ffe; border-left: 4px solid #fa0; color: #880; }
        .info { background: #eef; border-left: 4px solid #00f; color: #003; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚙️ Настройка сервера</h1>
        <div id="status" class="status"></div>
        
        <label>Telegram Bot Token:</label>
        <input type="password" id="botToken" value="${escapeHtml(config.BOT_TOKEN)}" placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz">
        <small>Получите у @BotFather: /start → /newbot</small>
        
        <label>VK User Token:</label>
        <input type="password" id="vkUserToken" value="${escapeHtml(config.VK_USER_ACCESS_TOKEN)}" placeholder="abc123def456...">
        <small>Права: wall, video, offline</small>
        
        <label>Admin Chat ID:</label>
        <input type="text" id="adminChatId" value="${escapeHtml(config.ADMIN_CHAT_ID)}" placeholder="-1001234567890">
        <small>@userinfobot для получения ID</small>
        
        <button id="saveBtn" onclick="saveAndCloseConfig()">💾 Сохранить</button>
    </div>
    
    <script>
        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.innerHTML = message;
            status.className = 'status ' + type;
            status.style.display = 'block';
        }
        
        function saveAndCloseConfig() {
            const botToken = document.getElementById('botToken').value.trim();
            const vkUserToken = document.getElementById('vkUserToken').value.trim();
            const adminChatId = document.getElementById('adminChatId').value.trim();
            
            const btn = document.getElementById('saveBtn');
            
            if (!botToken || !vkUserToken || !adminChatId) {
                showStatus('❌ Заполните все поля!', 'error');
                return;
            }
            
            btn.disabled = true;
            btn.textContent = '⏳ Сохранение...';
            showStatus('🔄 Проверка токенов...', 'info');
            
            try {
                google.script.run
                    .withSuccessHandler(function(result) {
                        if (result.success) {
                            let message = '<strong>✅ Настройки сохранены!</strong><br><br>';
                            if (result.validation) {
                                const v = result.validation;
                                message += '🤖 Telegram: ' + v.telegram.status + ' ' + v.telegram.message + '<br>';
                                message += '👤 VK User: ' + v.vkUser.status + ' ' + v.vkUser.message + '<br>';
                                message += '💬 Admin Chat: ' + v.adminChat.status + ' ' + v.adminChat.message + '<br>';
                            }
                            showStatus(message, 'success');
                            setTimeout(function() {
                                google.script.host.close();
                            }, 2000);
                        } else {
                            showStatus('<strong>❌ Ошибка:</strong> ' + result.error, 'error');
                            btn.disabled = false;
                            btn.textContent = '💾 Сохранить';
                        }
                    })
                    .withFailureHandler(function(error) {
                        showStatus('<strong>❌ Ошибка:</strong> ' + error.message, 'error');
                        btn.disabled = false;
                        btn.textContent = '💾 Сохранить';
                    })
                    .saveServerConfig(botToken, vkUserToken, adminChatId);
            } catch (error) {
                showStatus('<strong>❌ Ошибка:</strong> ' + error.message, 'error');
                btn.disabled = false;
                btn.textContent = '💾 Сохранить';
            }
        }
    </script>
</body>
</html>`;

  return html;
}

/**
 * Сохранение конфигурации сервера с валидацией токенов
 * @param {string} botToken - Telegram Bot Token
 * @param {string} vkUserToken - VK User Access Token
 * @param {string} adminChatId - Admin Chat ID
 * @returns {Object} - Результат сохранения
 */
function saveServerConfig(botToken, vkUserToken, adminChatId) {
  try {
    // 1. Проверяем заполненность полей
    if (!botToken || !botToken.trim()) {
      logEvent('WARN', 'config_empty_bot_token', 'admin', 'Bot token is empty');
      return { success: false, error: 'Заполните Telegram Bot Token' };
    }
    
    if (!vkUserToken || !vkUserToken.trim()) {
      logEvent('WARN', 'config_empty_vk_token', 'admin', 'VK token is empty');
      return { success: false, error: 'Заполните VK User Access Token' };
    }
    
    if (!adminChatId || !adminChatId.trim()) {
      logEvent('WARN', 'config_empty_admin_id', 'admin', 'Admin chat ID is empty');
      return { success: false, error: 'Заполните Admin Chat ID' };
    }

    // 2. Валидируем токены
    logEvent('INFO', 'config_validation_start', 'admin', 'Starting token validation');
    var validation = validateTokens(botToken, vkUserToken, adminChatId);
    if (!validation.success) {
      logEvent('WARN', 'config_validation_failed', 'admin', validation.error);
      return { success: false, error: validation.error };
    }

    // 3. Сохраняем в Properties
    var props = PropertiesService.getScriptProperties();
    props.setProperties({
      'BOT_TOKEN': botToken,
      'VK_USER_ACCESS_TOKEN': vkUserToken,
      'ADMIN_CHAT_ID': adminChatId
    });

    logEvent('INFO', 'config_updated', 'admin', 'Server configuration updated and validated');
    return { 
      success: true, 
      validation: validation.details 
    };

  } catch (error) {
    logEvent('ERROR', 'config_save_failed', 'admin', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// ПРОВЕРКА ЗДОРОВЬЯ СЕРВЕРА
// ============================================

/**
 * Проверка здоровья сервера с отображением диалога
 */
function checkServerHealth() {
  try {
    var healthData = getServerHealthData();
    var htmlContent = getServerHealthHtml(healthData);
    
    if (!htmlContent) {
      throw new Error('Failed to generate health check HTML');
    }

    var html = HtmlService.createHtmlOutput(htmlContent);
    html.setWidth(800).setHeight(700);
    SpreadsheetApp.getUi()
      .showModelessDialog(html, '❤️ Проверка здоровья сервера');

  } catch (error) {
    logEvent('ERROR', 'health_check_error', 'system', error.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка проверки здоровья: ' + error.message);
  }
}

/**
 * Получение данных о здоровье сервера
 * @returns {Object} - Данные о состоянии сервера
 */
function getServerHealthData() {
  var props = PropertiesService.getScriptProperties();
  var serverUrl = ScriptApp.getService().getUrl();
  
  var config = {
    BOT_TOKEN: props.getProperty('BOT_TOKEN') || '',
    VK_USER_ACCESS_TOKEN: props.getProperty('VK_USER_ACCESS_TOKEN') || '',
    ADMIN_CHAT_ID: props.getProperty('ADMIN_CHAT_ID') || ''
  };

  logEvent('DEBUG', 'health_check_config', 'system', 
          `Tokens found - Bot: ${!!config.BOT_TOKEN}, VK User: ${!!config.VK_USER_ACCESS_TOKEN}, Admin: ${!!config.ADMIN_CHAT_ID}`);

  var configStatus = {
    hasAllTokens: !!(config.BOT_TOKEN && config.VK_USER_ACCESS_TOKEN && config.ADMIN_CHAT_ID),
    missingTokens: []
  };
  
  if (!config.BOT_TOKEN) configStatus.missingTokens.push('Telegram Bot Token');
  if (!config.VK_USER_ACCESS_TOKEN) configStatus.missingTokens.push('VK User Token');
  if (!config.ADMIN_CHAT_ID) configStatus.missingTokens.push('Admin Chat ID');

  var sheetsStatus = {
    licenses: checkSheetExists('Licenses'),
    bindings: checkSheetExists('Bindings'),
    logs: checkSheetExists('Logs')
  };

  var endpointStatus = testServerEndpointQuick();
  var isHealthy = configStatus.hasAllTokens && sheetsStatus.licenses && sheetsStatus.bindings && sheetsStatus.logs && endpointStatus.working;

  return {
    serverUrl: serverUrl,
    isHealthy: isHealthy,
    status: isHealthy ? '✅ Сервер работает' : '⚠️ Требуется настройка',
    config: configStatus,
    sheets: sheetsStatus,
    endpoint: endpointStatus,
    version: SERVER_VERSION,
    deploymentDate: new Date().toLocaleString('ru-RU')
  };
}

/**
 * Проверяет существование листа
 * @param {string} sheetName - Название листа
 * @returns {boolean} - true если лист существует
 */
function checkSheetExists(sheetName) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    return !!sheet;
  } catch (error) {
    return false;
  }
}

/**
 * Быстрая проверка API endpoint
 * @returns {Object} - Результат проверки
 */
function testServerEndpointQuick() {
  try {
    var serverUrl = ScriptApp.getService().getUrl();
    
    if (!serverUrl) {
      return {
        working: false,
        error: 'Отсутствует URL сервиса. Web App не настроен.',
        message: 'Настройте URL через Deploy → New deployment → Web app'
      };
    }
    
    if (!serverUrl.includes('/exec')) {
      return {
        working: false,
        error: 'Web App URL не содержит "/exec". Deploy New deployment → Web app',
        message: 'POST запросы работают только с URL, содержащими "/exec"'
      };
    }

    return {
      working: true,
      responseTime: 'inline',
      message: 'Web App настроен корректно'
    };
    
  } catch (error) {
    return {
      working: false,
      error: error.message
    };
  }
}

/**
 * Генерирует HTML для отображения состояния здоровья сервера
 * @param {Object} healthData - Данные о состоянии
 * @returns {string} - HTML контент
 */
function getServerHealthHtml(healthData) {
  var html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 700px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h2 { color: #333; font-size: 18px; margin-top: 20px; margin-bottom: 10px; }
        h3 { color: #555; font-size: 14px; margin-top: 15px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        td { padding: 10px; border: 1px solid #ddd; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
        small { color: #888; font-size: 12px; }
        strong { font-weight: bold; }
        button { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 15px; }
        button:hover { background: #5568d3; }
        .error { color: red; }
        .warning { color: orange; }
        .success { color: green; }
    </style>
</head>
<body>
    <div class="container">
        <h2>${escapeHtml(healthData.status)}</h2>
        <p>VK→Telegram Crossposter Server v${escapeHtml(healthData.version)}</p>
        <p><small>${escapeHtml(healthData.deploymentDate)}</small></p>
        <hr>
        
        <!-- Server URL -->
        <h3>🌐 Server URL</h3>
        <p><code>${escapeHtml(healthData.serverUrl)}</code></p>
        <p><small>Этот URL используется клиентами для API запросов</small></p>
        <hr>
        
        <!-- Configuration Status -->
        <h3>⚙️ Конфигурация</h3>
        <table border="1" cellpadding="5" cellspacing="0">
            <tr><td><strong>Токены</strong></td><td><strong class="${healthData.config.hasAllTokens ? 'success' : 'error'}">${healthData.config.hasAllTokens ? '✅ Настроены' : '❌ Отсутствуют'}</strong></td></tr>
        </table>`;
        
  if (!healthData.config.hasAllTokens) {
    html += `        <tr><td colspan="2"><strong>Отсутствуют:</strong><ul>`;
    healthData.config.missingTokens.forEach(function(token) {
      html += `<li>${escapeHtml(token)}</li>`;
    });
    html += `</ul></td></tr>`;
  }
  
  html += `        </table>
        <hr>
        
        <!-- Sheets Status -->
        <h3>📊 Структура листов</h3>
        <table border="1" cellpadding="5" cellspacing="0">
            <tr><td>Licenses</td><td><strong class="${healthData.sheets.licenses ? 'success' : 'error'}">${healthData.sheets.licenses ? '✅' : '❌'}</strong></td></tr>
            <tr><td>Bindings</td><td><strong class="${healthData.sheets.bindings ? 'success' : 'error'}">${healthData.sheets.bindings ? '✅' : '❌'}</strong></td></tr>
            <tr><td>Logs</td><td><strong class="${healthData.sheets.logs ? 'success' : 'error'}">${healthData.sheets.logs ? '✅' : '❌'}</strong></td></tr>
        </table>
        <hr>
        
        <!-- API Endpoint Status -->
        <h3>🔌 API Endpoint</h3>
        <table border="1" cellpadding="5" cellspacing="0">
            <tr><td><strong>Статус</strong></td><td><strong class="${healthData.endpoint.working ? 'success' : 'error'}">${healthData.endpoint.working ? '✅ Работает' : '❌ Проблемы'}</strong></td></tr>`;
            
  if (healthData.endpoint.working && healthData.endpoint.responseTime) {
    html += `            <tr><td>Время ответа</td><td>${escapeHtml(healthData.endpoint.responseTime)}</td></tr>`;
  }
  
  if (!healthData.endpoint.working) {
    html += `            <tr><td colspan="2"><strong class="error">Ошибка:</strong> ${escapeHtml(healthData.endpoint.error)}</td></tr>`;
  }
  
  html += `        </table>
        <hr>`;
        
  if (!healthData.isHealthy) {
    html += `        <h3>🔧 Требуемые действия</h3>
        <p><strong>Для полной работы сервера выполните:</strong></p>
        <ul>`;
        
    if (!healthData.config.hasAllTokens) {
      html += `            <li>1. Настройте токены через меню "Настройка сервера"</li>`;
    }
    
    if (!healthData.sheets.licenses || !healthData.sheets.bindings || !healthData.sheets.logs) {
      html += `            <li>2. Запустите инициализацию через меню "1. Инициализация сервера"</li>`;
    }
    
    if (!healthData.endpoint.working) {
      html += `            <li>3. Настройте Web App: Extensions → Apps Script → Deploy → New deployment → Web app</li>`;
    }
    
    html += `        </ul>
        <p><strong>После выполнения действий запустите проверку повторно.</strong></p>`;
  } else {
    html += `        <h3 class="success">🎉 Сервер готов к работе!</h3>
        <p>Все компоненты настроены корректно. Сервер готов обрабатывать запросы от клиентов.</p>`;
  }
  
  html += `        <p><button onclick="google.script.run.checkServerHealth(); google.script.host.close();">🔄 Обновить проверку</button></p>
        <p><button onclick="google.script.run.withSuccessHandler(function(result) { alert(result.totalDeleted + ' записей удалено из ' + result.sheetsProcessed + ' листов'); }).withFailureHandler(function(error) { alert('Ошибка: ' + error.message); }).cleanOldLogs(30);">🧹 Очистить логи (30+ дней)</button></p>
    </div>
</body>
</html>`;

  return html;
}

// ============================================
// СИСТЕМНАЯ СТАТИСТИКА
// ============================================

/**
 * Получение системной статистики сервера
 * @returns {Object} - Статистика сервера
 */
function getSystemStats() {
  try {
    var licensesSheet = getSheet('Licenses');
    var bindingsSheet = getSheet('Bindings');
    var logsSheet = getSheet('Logs');
    
    var licensesData = licensesSheet.getDataRange().getValues().slice(1);
    var bindingsData = bindingsSheet.getDataRange().getValues().slice(1);
    var logsData = logsSheet.getDataRange().getValues().slice(1);
    
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      totalLicenses: licensesData.length,
      activeLicenses: licensesData.filter(lic => lic[6] === 'active').length,
      expiredLicenses: licensesData.filter(lic => new Date(lic[4]) < now).length,
      totalBindings: bindingsData.length,
      activeBindings: bindingsData.filter(b => b[5] === 'active').length,
      pausedBindings: bindingsData.filter(b => b[5] === 'paused').length,
      postsToday: logsData.filter(log => log[2] === 'post_sent' && new Date(log[0]) >= today).length,
      lastPostTime: logsData
        .filter(log => log[2] === 'post_sent')
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))[0]?.[0] || 'Никогда',
      topUser: findTopUser(bindingsData),
      recentLicenses: licensesData
        .map(lic => ({ key: lic[0], email: lic[1], type: lic[2], maxGroups: lic[3], expires: lic[4], status: lic[6] }))
        .slice(-10)
        .reverse(),
      recentBindings: bindingsData
        .map(function(bindingRow) {
          var bindingObject = buildBindingObjectFromRow(bindingRow);
          if (bindingObject) {
            return {
              id: bindingObject.id,
              userEmail: bindingObject.userEmail,
              vkGroupUrl: bindingObject.vkGroupUrl,
              tgChatId: bindingObject.tgChatId,
              status: bindingObject.status,
              createdAt: bindingObject.createdAt,
              bindingName: bindingObject.bindingName,
              bindingDescription: bindingObject.bindingDescription
            };
          }
          
          var fallbackName = resolveBindingName(bindingRow[9], {
            bindingId: bindingRow[0],
            vkGroupUrl: bindingRow[3],
            processedTgChatId: bindingRow[4]
          });
          
          return {
            id: bindingRow[0],
            userEmail: bindingRow[2],
            vkGroupUrl: bindingRow[3],
            tgChatId: bindingRow[4],
            status: bindingRow[5],
            createdAt: bindingRow[6],
            bindingName: fallbackName,
            bindingDescription: sanitizeBindingText(bindingRow[10])
          };
        })
        .slice(-10)
        .reverse()
    };
    
  } catch (error) {
    logEvent('ERROR', 'stats_error', 'system', error.message);
    return {
      totalLicenses: 0,
      activeLicenses: 0,
      expiredLicenses: 0,
      totalBindings: 0,
      activeBindings: 0,
      pausedBindings: 0,
      postsToday: 0,
      lastPostTime: 'Ошибка',
      topUser: 'Неизвестно',
      recentLicenses: [],
      recentBindings: []
    };
  }
}

/**
 * Находит топового пользователя по количеству связок
 * @param {Array} bindingsData - Данные связок
 * @returns {string} - Email топового пользователя
 */
function findTopUser(bindingsData) {
  var userCounts = {};
  
  bindingsData.forEach(binding => {
    var email = binding[2];
    userCounts[email] = (userCounts[email] || 0) + 1;
  });
  
  var topEntry = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])[0];
    
  return topEntry ? `${topEntry[0]} (${topEntry[1]})` : 'Нет';
}

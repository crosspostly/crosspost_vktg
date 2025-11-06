/**
 * VK→Telegram Crossposter - LICENSE SECURITY MODULE
 * Функции валидации токенов и безопасности
 * 
 * Размер: ~300 строк
 * Зависимости: utils-core.gs
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// SECURITY
// ============================================

function validateTokens(botToken, vkUserToken, adminChatId) {
  const results = {
    telegram: { status: '❌', message: 'Не проверен' },
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
    
    // 2. Проверяем VK User Token
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
      
      if (vkUserData.response && vkUserData.response.length > 0) {
        const user = vkUserData.response[0];
        results.vkUser = { 
          status: '✅', 
          message: `Пользователь: ${user.first_name} ${user.last_name}` 
        };
        logEvent("INFO", "vk_user_token_valid", "admin", `VK User: ${user.first_name} ${user.last_name}`);
      } else {
        results.vkUser = { 
          status: '❌', 
          message: `Ошибка: ${vkUserData.error?.error_msg || 'Неизвестная ошибка'}` 
        };
        logEvent("WARN", "vk_user_token_invalid", "admin", vkUserData.error?.error_msg || 'Unknown error');
      }
    } catch (vkError) {
      results.vkUser = { 
        status: '❌', 
        message: `Сетевая ошибка: ${vkError.message}` 
      };
    }
    
    // 3. Проверяем Admin Chat ID
    logEvent("DEBUG", "validating_admin_chat", "admin", "Testing admin chat access");
    
    if (results.telegram.status === '✅') {
      try {
        const adminTestResponse = UrlFetchApp.fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify({
              chat_id: adminChatId,
              text: '🔧 Тестовое сообщение от VK→TG сервера\n\nЕсли вы видите это сообщение, то Admin Chat ID настроен правильно!',
              disable_web_page_preview: true
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
          // Более детальная обработка ошибок Telegram
          let errorMessage = adminTestData.description || 'Неизвестная ошибка';
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
// CONFIG DIALOG
// ============================================

function getConfigDialogHtml() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    BOT_TOKEN: props.getProperty("BOT_TOKEN") || "",
    VK_USER_ACCESS_TOKEN: props.getProperty("VK_USER_ACCESS_TOKEN") || "",
    ADMIN_CHAT_ID: props.getProperty("ADMIN_CHAT_ID") || ""
  };
  
  let html = '<!DOCTYPE html>\n';
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
/**
 * VK→Telegram Crossposter - LICENSE CONFIG MODULE
 * Функции конфигурации и валидации токенов
 * 
 * Размер: ~300 строк
 * Зависимости: utils-core.gs, utils-stats.gs, license-core.gs
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// CONFIG MANAGEMENT
// ============================================

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
    
    const validation = validateTokens(botToken, vkUserToken, adminChatId);
    
    if (!validation.success) {
      logEvent("WARN", "config_validation_failed", "admin", validation.error);
      return { success: false, error: validation.error };
    }
    
    // ========== 3. СОХРАНЯЕМ КОНФИГ ==========
    const props = PropertiesService.getScriptProperties();
    
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

function getServerHealthData() {
  try {
    const props = PropertiesService.getScriptProperties();
    const stats = getSystemStats();
    
    return {
      server: {
        version: SERVER_VERSION,
        uptime: new Date().toISOString(),
        environment: ScriptApp.getScriptId().substring(0, 8) + '...'
      },
      configuration: {
        botToken: !!props.getProperty("BOT_TOKEN"),
        vkUserToken: !!props.getProperty("VK_USER_ACCESS_TOKEN"),
        adminChatId: !!props.getProperty("ADMIN_CHAT_ID")
      },
      statistics: stats,
      sheets: {
        licenses: stats.totalLicenses,
        bindings: stats.totalBindings,
        logs: "Available"
      }
    };
    
  } catch (error) {
    logEvent("ERROR", "health_data_error", "system", error.message);
    return {
      server: { version: SERVER_VERSION, status: "error" },
      configuration: { status: "error" },
      statistics: { status: "error" },
      error: error.message
    };
  }
}

function getServerHealthHtml(healthData) {
  let html = '<!DOCTYPE html>\n';
  html += '<html lang="ru">\n';
  html += '<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  html += '<style>\n';
  html += 'body { font-family: Arial, sans-serif; margin:0; padding:20px; background: #f5f5f5; }\n';
  html += '.container { max-width: 800px; background: white; padding:20px; border-radius:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin:0 auto; }\n';
  html += 'h1, h2 { color: #333; }\n';
  html += 'h1 { font-size: 24px; margin-top: 0; }\n';
  html += 'h2 { font-size: 18px; margin-top: 30px; border-bottom: 2px solid #667eea; padding-bottom:5px; }\n';
  html += '.status { padding: 8px 12px; border-radius: 4px; font-weight: bold; }\n';
  html += '.status.ok { background: #d4edda; color: #155724; }\n';
  html += '.status.error { background: #f8d7da; color: #721c24; }\n';
  html += '.status.warning { background: #fff3cd; color: #856404; }\n';
  html += 'table { width: 100%; border-collapse: collapse; margin: 10px 0; }\n';
  html += 'th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }\n';
  html += 'th { background: #f8f9fa; font-weight: bold; }\n';
  html += '.number { font-size: 24px; font-weight: bold; color: #667eea; }\n';
  html += '</style>\n';
  html += '</head>\n';
  html += '<body>\n';
  html += '<div class="container">\n';
  html += '<h1>🔧 Состояние сервера</h1>\n';
  
  // Server Information
  html += '<h2>🖥️ Сервер</h2>\n';
  html += '<table>\n';
  html += '<tr><th>Версия</th><td>' + healthData.server.version + '</td></tr>\n';
  html += '<tr><th>Uptime</th><td>' + new Date(healthData.server.uptime).toLocaleString() + '</td></tr>\n';
  html += '<tr><th>Environment</th><td>' + healthData.server.environment + '</td></tr>\n';
  html += '</table>\n';
  
  // Configuration Status
  html += '<h2>⚙️ Конфигурация</h2>\n';
  html += '<table>\n';
  html += '<tr><th>Bot Token</th><td><span class="status ' + (healthData.configuration.botToken ? 'ok' : 'error') + '">' + (healthData.configuration.botToken ? '✅ Настроен' : '❌ Отсутствует') + '</span></td></tr>\n';
  html += '<tr><th>VK Token</th><td><span class="status ' + (healthData.configuration.vkUserToken ? 'ok' : 'error') + '">' + (healthData.configuration.vkUserToken ? '✅ Настроен' : '❌ Отсутствует') + '</span></td></tr>\n';
  html += '<tr><th>Admin Chat</th><td><span class="status ' + (healthData.configuration.adminChatId ? 'ok' : 'error') + '">' + (healthData.configuration.adminChatId ? '✅ Настроен' : '❌ Отсутствует') + '</span></td></tr>\n';
  html += '</table>\n';
  
  // Statistics
  html += '<h2>📊 Статистика</h2>\n';
  html += '<table>\n';
  html += '<tr><th>Лицензии</th><td><span class="number">' + healthData.statistics.totalLicenses + '</span><br><small>(' + healthData.statistics.activeLicenses + ' активных)</small></td></tr>\n';
  html += '<tr><th>Связки</th><td><span class="number">' + healthData.statistics.totalBindings + '</span><br><small>(' + healthData.statistics.activeBindings + ' активных)</small></td></tr>\n';
  html += '<tr><th>Постов сегодня</th><td><span class="number">' + healthData.statistics.postsToday + '</span></td></tr>\n';
  html += '</table>\n';
  
  html += '</div>\n';
  html += '</body>\n';
  html += '</html>\n';
  
  return html;
}
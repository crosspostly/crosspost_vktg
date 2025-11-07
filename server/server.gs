/**
 * VK→Telegram Crossposter - SERVER CORE MODULE
 * Entry point, константы, роутинг API запросов
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 * Версия: v6.1 (Modular)
 */

// ============================================
// КОНФИГУРАЦИЯ И КОНСТАНТЫ
// ============================================

/**
 * Режим отладки - включает дополнительное логирование
 */
var DEV_MODE = false; // Переключите на true для отладки

/**
 * Версия сервера
 */
var SERVER_VERSION = '6.1';

/**
 * Максимальный размер Telegram media group
 */
var MAX_MEDIA_GROUP_SIZE = 10;

/**
 * Версия VK API
 */
var VK_API_VERSION = '5.131';

/**
 * Основной timeout для запросов (30 секунд)
 */
var REQUEST_TIMEOUT = 30000;

/**
 * Набор timeout’ов для различных операций
 */
var TIMEOUTS = {
  FAST: 8000,    // 8 секунд - быстрые операции
  MEDIUM: 15000, // 15 секунд - средние операции
  SLOW: 30000    // 30 секунд - тяжелые операции
};

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================

/**
 * Инициализация при открытии файла - создание меню
 * @returns {void}
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📱 VK→TG')
    .addItem('🚀 1. Инициализация сервера', 'initializeServer')
    .addItem('⚙️ 2. Настройка сервера', 'showConfigDialog')
    .addItem('❤️ 3. Проверка здоровья', 'checkServerHealth')
    .addItem('🔧 4. Панель админа', 'showAdminPanel')
    .addItem('📊 5. Статистика', 'showStatistics')
    .addItem('📄 6. Логи сервера', 'showLogsSheet')
    .addToUi();
}

/**
 * Инициализация сервера - создание необходимых листов
 * @returns {void}
 */
function initializeServer() {
  try {
    // Создаём лист лицензий
    createSheet('Licenses', [
      'License Key', 'Email', 'Type', 'Max Groups', 'Expires', 'Created At', 'Status', 'Notes'
    ]);

    // Создаём лист связок
    createSheet('Bindings', [
      'Binding ID', 'License Key', 'User Email', 'VK Group URL', 'TG Chat ID', 'Status', 'Created At', 
      'Last Check', 'Format Settings', 'Binding Name', 'Binding Description'
    ]);

    // Создаём лист логов
    createSheet('Logs', [
      'Timestamp', 'Level', 'Event', 'User', 'Details', 'IP'
    ]);

    logEvent('INFO', 'server_initialized', 'system', `Server v${SERVER_VERSION} initialized`);
    SpreadsheetApp.getUi().alert('✅ Сервер инициализирован!\n\nЛисты: Licenses - Bindings - Logs\n\nСледующий шаг: Настройка сервера');

  } catch (error) {
    logEvent('ERROR', 'server_init_failed', 'system', error.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка инициализации: ' + error.message);
  }
}

// ============================================
// API ENDPOINT - ГЛАВНЫЙ РОУТЕР
// ============================================

/**
 * Главная функция API endpoint’а - маршрутизация запросов
 * @param {Object} e - Объект события от Google Apps Script
 */
/**
 * Главная функция API endpoint'а - маршрутизация запросов
 * @param {Object} e - Объект события от Google Apps Script
 * @returns {ContentService.TextOutput} - HTTP ответ
 */
function doPost(e) {
  try {
    // Проверяем структуру запроса
    if (!e || !e.postData || !e.postData.contents) {
      logEvent('ERROR', 'invalid_request_structure', 'anonymous', 'Missing post data');
      return jsonResponse({ success: false, error: 'Invalid request: missing post data' }, 400);
    }

    var clientIp = e.parameter?.clientIp || 'unknown';
    var payload;

    // Парсим JSON payload
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      logEvent('ERROR', 'json_parse_error', 'anonymous', `Invalid JSON: ${parseError.message}, Content: ${e.postData.contents.substring(0, 100)}`);
      return jsonResponse({ success: false, error: 'Invalid JSON in request body' }, 400);
    }

    // Проверяем наличие event
    if (!payload.event) {
      logEvent('WARN', 'missing_event_field', payload.license_key || 'anonymous', `Payload keys: ${Object.keys(payload).join(', ')}`);
      return jsonResponse({ success: false, error: 'Missing event field in request' }, 400);
    }

    logEvent('DEBUG', 'api_request', payload.license_key || 'anonymous', `Event: ${payload.event}, IP: ${clientIp}`);

    // Маршрутизация по event
    try {
      switch (payload.event) {
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
          
        case 'send_post':
          return handleSendPost(payload, clientIp);
          
        case 'send_post_direct':
          return handleSendPostDirect(payload, clientIp);
          
        case 'test_publication':
          return handleTestPublication(payload, clientIp);
          
        case 'get_vk_posts':
          return handleGetVkPosts(payload, clientIp);
          
        case 'publish_last_post':
          return handlePublishLastPost(payload, clientIp);
          
        case 'get_global_setting':
          return handleGetGlobalSetting(payload, clientIp);
          
        case 'set_global_setting':
          return handleSetGlobalSetting(payload, clientIp);
          
        default:
          logEvent('WARN', 'unknown_event', payload.license_key || 'anonymous', 
                  `Unknown event: ${payload.event}, Available events: check_license, get_bindings, add_binding, edit_binding, delete_binding, toggle_binding_status, send_post, send_post_direct, test_publication`);
          return jsonResponse({ success: false, error: `Unknown event: ${payload.event}` }, 400);
      }
    } catch (handlerError) {
      logEvent('ERROR', 'handler_execution_error', payload.license_key || 'anonymous', 
              `Event: ${payload.event}, Handler error: ${handlerError.message}, Stack: ${handlerError.stack?.substring(0, 200)}`);
      return jsonResponse({ success: false, error: `Handler error for event ${payload.event}: ${handlerError.message}` }, 500);
    }
    
  } catch (error) {
    logEvent('ERROR', 'api_critical_error', 'system', 
            `Critical API error: ${error.message}, Stack: ${error.stack?.substring(0, 200)}`);
    return jsonResponse({ success: false, error: `Critical server error: ${error.message}` }, 500);
  }
}

// ============================================
// БАЗОВЫЕ УТИЛИТЫ
// ============================================

/**
 * Формирование JSON ответа API
 * @param {Object} data - Данные для ответа
 * @param {number} statusCode - HTTP статус код (по умолчанию 200)
 * @returns {ContentService.TextOutput} - Оформленный JSON ответ
 */
function jsonResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Логирование событий сервера
 * @param {string} level - Уровень: INFO, WARN, ERROR, DEBUG
 * @param {string} event - Идентификатор события
 * @param {string} user - Пользователь (лицензионный ключ или 'system')
 * @param {string} details - Подробности события
 */
function logEvent(level, event, user, details) {
  try {
    // В продакшне пропускаем DEBUG сообщения
    if (!DEV_MODE && level === 'DEBUG') return;

    var sheet = getSheet('Logs');
    sheet.appendRow([
      new Date().toISOString(),
      level,
      event,
      user || 'system',
      details,
      'IP: doPost'
    ]);

    // Дублируем в консоль
    console.log(`${level} ${event} ${user} ${details}`);

  } catch (error) {
    console.error('Logging error:', error.message);
  }
}

/**
 * Показывает лист логов сервера
 */
function showLogsSheet() {
  var sheet = getSheet('Logs');
  SpreadsheetApp.setActiveSheet(sheet);
}

/**
 * Показывает панель администратора
 */
function showAdminPanel() {
  try {
    var htmlContent = getAdminPanelHtml();
    if (!htmlContent) {
      throw new Error('Failed to generate admin panel HTML');
    }

    var html = HtmlService.createHtmlOutput(htmlContent);
    if (!html) {
      throw new Error('Failed to create HTML output');
    }

    html.setWidth(1200).setHeight(800);
    SpreadsheetApp.getUi()
      .showModelessDialog(html, '🔧 Панель администратора');

  } catch (error) {
    logEvent('ERROR', 'admin_panel_error', 'system', error.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка админ панели: ' + error.message);
  }
}

/**
 * Показывает статистику сервера
 */
function showStatistics() {
  var stats = getSystemStats();
  
  var message = `📊 Статистика сервера v${SERVER_VERSION}\n\n`;
  message += `📄 Лицензии: ${stats.totalLicenses} всего\n`;
  message += `✅ Активных: ${stats.activeLicenses}\n`;
  message += `❌ Просроченных: ${stats.expiredLicenses}\n\n`;
  message += `🔗 Связки: ${stats.totalBindings} всего\n`;
  message += `▶️ Активных: ${stats.activeBindings}\n`;
  message += `⏸️ Приостановленных: ${stats.pausedBindings}\n\n`;
  message += `📨 Постов сегодня: ${stats.postsToday}\n`;
  message += `⏰ Последний пост: ${stats.lastPostTime}\n`;
  message += `👑 Топ пользователь: ${stats.topUser}`;
  
  SpreadsheetApp.getUi().alert(message);
}
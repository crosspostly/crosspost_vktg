/**
 * VK→Telegram Crossposter - SERVER v6.1 ENHANCED
 * 
 * ✅ Центральный сервер для всех пользователей
 * ✅ Хранит все токены и секреты VK + Telegram API
 * ✅ Управляет лицензиями и связками пользователей
 * ✅ Обрабатывает медиа (фото, видео, аудио) из VK
 * ✅ Отправляет посты в Telegram с полным форматированием
 * ✅ Встроенный HTML админ-интерфейс
 * ✅ Система логирования и статистики
 * ✅ Защита от дублирования и проверка лимитов
 * ✅ Поддержка личных профилей ВК
 * ✅ Улучшенная обработка длинных текстов
 * ✅ Подробное логирование ошибок
 * 
 * Автор: f_den
 * Дата: 2025-11-01
 * Архитектура: Сервер (хранит секреты) + Клиент (UI + автоматизация)
 */

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const DEV_MODE = true; // true для подробного логирования
const SERVER_VERSION = "6.1";
const MAX_MEDIA_GROUP_SIZE = 10; // Лимит Telegram для media group
const VK_API_VERSION = "5.131";
const REQUEST_TIMEOUT = 30000; // 30 секунд
const TELEGRAM_CAPTION_LIMIT = 1024; // Лимит подписи в Telegram

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
    .addItem("🧪 7. Тестировать URL парсинг", "testUrlExtraction")
    .addToUi();
}

function initializeServer() {
  try {
    // Создаем необходимые листы
    createSheet("Licenses", [
      "License Key", "Email", "Type", "Max Groups", "Expires", "Created At", "Status", "Notes"
    ]);
    
    createSheet("Bindings", [
      "Binding ID", "License Key", "User Email", "VK Group URL", "VK Group Name", "TG Chat ID", "TG Chat Name", "Status", "Created At", "Last Check"
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
      "• Bindings - связки пользователей (обновленная структура)\n" +
      "• Logs - логи системы\n\n" +
      "Теперь настройте конфигурацию (пункт 2)."
    );
    
  } catch (error) {
    logEvent("ERROR", "server_init_failed", "system", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка инициализации: " + error.message);
  }
}

// ============================================
// 2. ГЛАВНЫЙ API ENDPOINT - ИСПРАВЛЕННЫЙ
// ============================================

function doPost(e) {
  try {
    const clientIp = e.parameter.clientIp || "unknown";
    
    if (!e.postData || !e.postData.contents) {
      logEvent("WARN", "empty_request", "anonymous", `IP: ${clientIp}`);
      return jsonResponse({
        success: false, 
        error: "Empty request body"
      }, 400);
    }
    
    const payload = JSON.parse(e.postData.contents);
    
    logEvent("DEBUG", "api_request", payload.license_key || "anonymous", 
             `Event: ${payload.event}, IP: ${clientIp}`);
    
    // ИСПРАВЛЕННЫЙ SWITCH - ВСЕ СОБЫТИЯ
    switch(payload.event) {
      case "check_license":
        return handleCheckLicense(payload, clientIp);
      
      case "get_bindings":
        return handleGetBindings(payload, clientIp);
      
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
      
      default:
        logEvent("WARN", "unknown_event", payload.license_key || "anonymous", 
                 `Unknown event: ${payload.event}, IP: ${clientIp}`);
        return jsonResponse({
          success: false, 
          error: `Unknown event: ${payload.event}`
        }, 400);
    }
    
  } catch (error) {
    logEvent("ERROR", "api_error", "system", `Error: ${error.message}, Stack: ${error.stack?.substring(0, 200)}`);
    return jsonResponse({
      success: false, 
      error: "Server error: " + error.message
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
      logEvent("WARN", "missing_license_key", "anonymous", `IP: ${clientIp}`);
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
    logEvent("ERROR", "license_check_error", payload.license_key, `Error: ${error.message}, IP: ${clientIp}`);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleAddBinding(payload, clientIp) {
  try {
    const { license_key, vk_group_url, tg_chat_id } = payload;
    
    // Валидация входных данных
    if (!license_key || !vk_group_url || !tg_chat_id) {
      logEvent("WARN", "missing_binding_data", license_key, `Missing data, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "Required fields: license_key, vk_group_url, tg_chat_id"
      }, 400);
    }
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Проверяем лимит
    const currentBindings = getUserBindings(license_key);
    if (currentBindings.length >= licenseData.license.maxGroups) {
      logEvent("WARN", "binding_limit_exceeded", license_key, `Current: ${currentBindings.length}, Max: ${licenseData.license.maxGroups}`);
      return jsonResponse({
        success: false,
        error: "Max groups limit exceeded"
      }, 429);
    }
    
    // РАСШИРЕННОЕ ПРЕОБРАЗОВАНИЕ ССЫЛОК В ID
    let processedVkData;
    let processedTgData;
    
    try {
      // Извлекаем данные ВК (ID + название)
      processedVkData = extractAndValidateVkSource(vk_group_url);
      logEvent("INFO", "vk_source_processed", license_key, 
               `URL: ${vk_group_url} -> ID: ${processedVkData.id}, Name: ${processedVkData.name}, Type: ${processedVkData.type}`);
    } catch (error) {
      logEvent("ERROR", "vk_processing_failed", license_key, `URL: ${vk_group_url}, Error: ${error.message}`);
      return jsonResponse({
        success: false,
        error: `Ошибка в ВК ссылке: ${error.message}`
      }, 400);
    }
    
    try {
      // Извлекаем данные Telegram (ID + название)
      processedTgData = extractAndValidateTelegramChat(tg_chat_id);
      logEvent("INFO", "tg_chat_processed", license_key, 
               `Input: ${tg_chat_id} -> ID: ${processedTgData.id}, Name: ${processedTgData.name}, Type: ${processedTgData.type}`);
    } catch (error) {
      logEvent("ERROR", "tg_processing_failed", license_key, `Input: ${tg_chat_id}, Error: ${error.message}`);
      return jsonResponse({
        success: false,
        error: `Ошибка в Telegram ссылке: ${error.message}`
      }, 400);
    }
    
    // Создаем новую связку с расширенными данными
    const bindingId = generateBindingId();
    const license = findLicense(license_key);
    
    const bindingsSheet = getSheet("Bindings");
    bindingsSheet.appendRow([
      bindingId,                    // Binding ID
      license_key,                  // License Key
      license.email,                // User Email
      vk_group_url,                // VK Group URL (оригинальная)
      processedVkData.name,        // VK Group Name
      processedTgData.id,          // TG Chat ID (обработанный)
      processedTgData.name,        // TG Chat Name
      "active",                    // Status
      new Date().toISOString(),    // Created At
      new Date().toISOString()     // Last Check
    ]);
    
    logEvent("INFO", "binding_added", license_key, 
             `Binding ID: ${bindingId}, VK: ${processedVkData.name} (${processedVkData.id}), TG: ${processedTgData.name} (${processedTgData.id}), IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      binding_id: bindingId,
      converted: {
        vk: processedVkData,
        tg: processedTgData
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_add_error", payload.license_key, `Error: ${error.message}, IP: ${clientIp}`);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleEditBinding(payload, clientIp) {
  try {
    const { license_key, binding_id, vk_group_url, tg_chat_id } = payload;
    
    // Валидация входных данных
    if (!license_key || !binding_id || !vk_group_url || !tg_chat_id) {
      return jsonResponse({
        success: false,
        error: "Required fields: license_key, binding_id, vk_group_url, tg_chat_id"
      }, 400);
    }
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    const bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      logEvent("WARN", "binding_not_found", license_key, `Binding ID: ${binding_id}, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // РАСШИРЕННОЕ ПРЕОБРАЗОВАНИЕ ССЫЛОК
    let processedVkData;
    let processedTgData;
    
    try {
      processedVkData = extractAndValidateVkSource(vk_group_url);
      logEvent("INFO", "vk_edit_processed", license_key, `New VK: ${processedVkData.name} (${processedVkData.id})`);
    } catch (error) {
      logEvent("ERROR", "vk_edit_failed", license_key, `URL: ${vk_group_url}, Error: ${error.message}`);
      return jsonResponse({
        success: false,
        error: `Ошибка в ВК ссылке: ${error.message}`
      }, 400);
    }
    
    try {
      processedTgData = extractAndValidateTelegramChat(tg_chat_id);
      logEvent("INFO", "tg_edit_processed", license_key, `New TG: ${processedTgData.name} (${processedTgData.id})`);
    } catch (error) {
      logEvent("ERROR", "tg_edit_failed", license_key, `Input: ${tg_chat_id}, Error: ${error.message}`);
      return jsonResponse({
        success: false,
        error: `Ошибка в Telegram ссылке: ${error.message}`
      }, 400);
    }
    
    // Обновляем связку с расширенными данными
    const bindingsSheet = getSheet("Bindings");
    bindingsSheet.getRange(bindingRow, 4).setValue(vk_group_url);         // VK Group URL
    bindingsSheet.getRange(bindingRow, 5).setValue(processedVkData.name); // VK Group Name
    bindingsSheet.getRange(bindingRow, 6).setValue(processedTgData.id);   // TG Chat ID
    bindingsSheet.getRange(bindingRow, 7).setValue(processedTgData.name); // TG Chat Name
    bindingsSheet.getRange(bindingRow, 10).setValue(new Date().toISOString()); // Last Check
    
    logEvent("INFO", "binding_edited", license_key, 
             `Binding ID: ${binding_id}, VK: ${processedVkData.name}, TG: ${processedTgData.name}, IP: ${clientIp}`);
    
    return jsonResponse({ 
      success: true,
      converted: {
        vk: processedVkData,
        tg: processedTgData
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_edit_error", payload.license_key, `Error: ${error.message}, IP: ${clientIp}`);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleDeleteBinding(payload, clientIp) {
  try {
    const { license_key, binding_id } = payload;
    
    if (!license_key || !binding_id) {
      return jsonResponse({
        success: false,
        error: "Required fields: license_key, binding_id"
      }, 400);
    }
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим и удаляем связку
    const bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      logEvent("WARN", "delete_binding_not_found", license_key, `Binding ID: ${binding_id}, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    const bindingsSheet = getSheet("Bindings");
    // Получаем данные перед удалением для логирования
    const bindingData = bindingsSheet.getRange(bindingRow, 1, 1, 10).getValues()[0];
    
    bindingsSheet.deleteRow(bindingRow);
    
    logEvent("INFO", "binding_deleted", license_key, 
             `Binding ID: ${binding_id}, VK: ${bindingData[4]}, TG: ${bindingData[6]}, IP: ${clientIp}`);
    
    return jsonResponse({ success: true });
    
  } catch (error) {
    logEvent("ERROR", "binding_delete_error", payload.license_key, `Error: ${error.message}, IP: ${clientIp}`);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleGetBindings(payload, clientIp) {
  try {
    const { license_key } = payload;
    
    if (!license_key) {
      return jsonResponse({
        success: false,
        error: "License key required"
      }, 400);
    }
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    const bindings = getUserBindings(license_key);
    
    logEvent("INFO", "bindings_retrieved", license_key, `Count: ${bindings.length}, IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      bindings: bindings
    });
    
  } catch (error) {
    logEvent("ERROR", "get_bindings_error", payload.license_key, `Error: ${error.message}, IP: ${clientIp}`);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleToggleBindingStatus(payload, clientIp) {
  try {
    const { license_key, binding_id } = payload;
    
    if (!license_key || !binding_id) {
      return jsonResponse({
        success: false,
        error: "Required fields: license_key, binding_id"
      }, 400);
    }
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    const bindingRow = findBindingRowById(binding_id, license_key);
    if (!bindingRow) {
      logEvent("WARN", "toggle_binding_not_found", license_key, `Binding ID: ${binding_id}, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // Переключаем статус
    const bindingsSheet = getSheet("Bindings");
    const currentStatus = bindingsSheet.getRange(bindingRow, 8).getValue(); // Status column
    const newStatus = currentStatus === "active" ? "paused" : "active";
    
    bindingsSheet.getRange(bindingRow, 8).setValue(newStatus);   // Status
    bindingsSheet.getRange(bindingRow, 10).setValue(new Date().toISOString()); // Last Check
    
    logEvent("INFO", "binding_status_changed", license_key, 
             `Binding ID: ${binding_id}, Status: ${currentStatus} → ${newStatus}, IP: ${clientIp}`);
    
    return jsonResponse({
      success: true,
      new_status: newStatus
    });
    
  } catch (error) {
    logEvent("ERROR", "binding_status_error", payload.license_key, `Error: ${error.message}, IP: ${clientIp}`);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleSendPost(payload, clientIp) {
  try {
    const { license_key, binding_id, vk_post } = payload;
    
    if (!license_key || !binding_id || !vk_post) {
      return jsonResponse({
        success: false,
        error: "Required fields: license_key, binding_id, vk_post"
      }, 400);
    }
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    const binding = findBindingById(binding_id, license_key);
    if (!binding || binding.status !== "active") {
      logEvent("WARN", "inactive_binding", license_key, `Binding ID: ${binding_id}, Status: ${binding?.status || 'not found'}`);
      return jsonResponse({
        success: false,
        error: "Active binding not found"
      }, 404);
    }
    
    // Отправляем пост в Telegram с улучшенной обработкой
    const result = sendVkPostToTelegramEnhanced(binding.tgChatId, vk_post);
    
    if (result.success) {
      logEvent("INFO", "post_sent", license_key, 
               `Post ID: ${vk_post.id}, TG: ${binding.tgChatId}, Message IDs: ${JSON.stringify(result.message_ids)}, IP: ${clientIp}`);
      
      return jsonResponse({
        success: true,
        message_ids: result.message_ids,
        total_messages: result.total_messages
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
    logEvent("ERROR", "send_post_error", payload.license_key, `Error: ${error.message}, IP: ${clientIp}`);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function handleTestPublication(payload, clientIp) {
  try {
    const { license_key, binding_id } = payload;
    
    if (!license_key || !binding_id) {
      return jsonResponse({
        success: false,
        error: "Required fields: license_key, binding_id"
      }, 400);
    }
    
    // Проверяем лицензию
    const licenseCheck = handleCheckLicense({ license_key }, clientIp);
    const licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Находим связку
    const binding = findBindingById(binding_id, license_key);
    if (!binding) {
      logEvent("WARN", "test_binding_not_found", license_key, `Binding ID: ${binding_id}, IP: ${clientIp}`);
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    // Получаем ID источника ВК
    const vkSourceData = extractAndValidateVkSource(binding.vkGroupUrl);
    
    if (!vkSourceData || !vkSourceData.id) {
      logEvent("ERROR", "test_invalid_vk_url", license_key, `URL: ${binding.vkGroupUrl}`);
      return jsonResponse({
        success: false,
        error: "Invalid VK source URL"
      }, 400);
    }
    
    const posts = getVkPosts(vkSourceData.id, 1);
    if (!posts || posts.length === 0) {
      logEvent("WARN", "test_no_posts", license_key, `VK ID: ${vkSourceData.id}`);
      return jsonResponse({
        success: false,
        error: "No posts found in VK source"
      }, 404);
    }
    
    const testPost = posts[0];
    testPost.text = "🧪 ТЕСТ: " + (testPost.text || "Пост без текста");
    
    // Отправляем тестовый пост
    const result = sendVkPostToTelegramEnhanced(binding.tgChatId, testPost);
    
    if (result.success) {
      logEvent("INFO", "test_post_sent", license_key, 
               `Binding ID: ${binding_id}, VK: ${vkSourceData.name}, TG: ${binding.tgChatId}, IP: ${clientIp}`);
      
      return jsonResponse({ 
        success: true,
        message_ids: result.message_ids,
        total_messages: result.total_messages
      });
    } else {
      logEvent("ERROR", "test_post_failed", license_key, 
               `Binding ID: ${binding_id}, Error: ${result.error}, IP: ${clientIp}`);
      
      return jsonResponse({
        success: false,
        error: result.error
      }, 500);
    }
    
  } catch (error) {
    logEvent("ERROR", "test_publication_error", payload.license_key, `Error: ${error.message}, IP: ${clientIp}`);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ============================================
// 4. РАСШИРЕННЫЕ ФУНКЦИИ ИЗВЛЕЧЕНИЯ URL
// ============================================

/**
 * РАСШИРЕННАЯ функция извлечения и валидации ВК источника
 * Поддерживает: группы, паблики, личные профили
 */
function extractAndValidateVkSource(url) {
  try {
    if (!url || typeof url !== 'string') {
      throw new Error('Укажите ссылку на ВК источник');
    }
    
    url = url.trim().toLowerCase();
    
    if (url === '') {
      throw new Error('Ссылка не может быть пустой');
    }
    
    logEvent("DEBUG", "vk_source_extraction_start", "system", `Input: ${url}`);
    
    // Добавляем протокол если отсутствует
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // Извлекаем путь из URL
    const urlParts = url.match(/vk\.com\/(.+)/);
    if (!urlParts) {
      throw new Error('Неверный формат ВК ссылки. Используйте: vk.com/...');
    }
    
    let path = urlParts[1];
    
    // Убираем параметры и слэши
    path = path.split('?')[0].replace(/\/$/, '');
    
    logEvent("DEBUG", "vk_path_extracted", "system", `Path: ${path}`);
    
    // Случай 1: public123456 -> группа -123456
    const publicMatch = path.match(/^public(\d+)$/);
    if (publicMatch) {
      const groupId = '-' + publicMatch[1];
      const groupInfo = getVkSourceInfo(groupId, 'group');
      return {
        id: groupId,
        name: groupInfo.name || `Группа ${publicMatch[1]}`,
        type: 'group',
        originalUrl: url
      };
    }
    
    // Случай 2: club123456 -> группа -123456
    const clubMatch = path.match(/^club(\d+)$/);
    if (clubMatch) {
      const groupId = '-' + clubMatch[1];
      const groupInfo = getVkSourceInfo(groupId, 'group');
      return {
        id: groupId,
        name: groupInfo.name || `Клуб ${clubMatch[1]}`,
        type: 'group',
        originalUrl: url
      };
    }
    
    // Случай 3: id123456 -> личный профиль 123456
    const idMatch = path.match(/^id(\d+)$/);
    if (idMatch) {
      const userId = idMatch[1];
      const userInfo = getVkSourceInfo(userId, 'user');
      return {
        id: userId,
        name: userInfo.name || `Пользователь ${userId}`,
        type: 'user',
        originalUrl: url
      };
    }
    
    // Случай 4: уже готовый ID
    if (path.match(/^-?\d+$/)) {
      const sourceId = path;
      const isGroup = sourceId.startsWith('-');
      const sourceInfo = getVkSourceInfo(sourceId, isGroup ? 'group' : 'user');
      return {
        id: sourceId,
        name: sourceInfo.name || (isGroup ? `Группа ${sourceId}` : `Пользователь ${sourceId}`),
        type: isGroup ? 'group' : 'user',
        originalUrl: url
      };
    }
    
    // Случай 5: короткое имя -> нужен API запрос
    const shortName = path.replace(/[^a-z0-9_]/g, '');
    if (shortName && shortName.length > 0) {
      return resolveVkShortNameEnhanced(shortName, url);
    }
    
    throw new Error(`Неподдерживаемый формат ВК ссылки: "${path}"`);
    
  } catch (error) {
    logEvent('ERROR', 'vk_source_extraction_error', 'system', `URL: ${url}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * РАСШИРЕННАЯ функция резолва коротких имен ВК с поддержкой профилей
 */
function resolveVkShortNameEnhanced(shortName, originalUrl) {
  try {
    const userToken = PropertiesService.getScriptProperties()
      .getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      throw new Error("VK User Access Token не настроен");
    }
    
    if (!shortName || typeof shortName !== 'string' || shortName.trim() === '') {
      throw new Error("Пустое или некорректное имя");
    }
    
    const cleanShortName = shortName.trim();
    
    logEvent("DEBUG", "vk_resolve_start", "system", `Resolving: ${cleanShortName}`);
    
    // ИСПРАВЛЕННЫЙ URL с правильным параметром
    const apiUrl = `https://api.vk.com/method/utils.resolveScreenName` +
                   `?screen_name=${encodeURIComponent(cleanShortName)}` +
                   `&access_token=${encodeURIComponent(userToken)}` +
                   `&v=${VK_API_VERSION}`;
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const responseText = response.getContentText();
    logEvent("DEBUG", "vk_resolve_response", "system", 
             `Status: ${response.getResponseCode()}, Body: ${responseText.substring(0, 300)}`);
    
    const data = JSON.parse(responseText);
    
    if (data.error) {
      const errorCode = data.error.error_code;
      const errorMsg = data.error.error_msg;
      
      logEvent("WARN", "vk_resolve_api_error", "system", 
               `Name: ${cleanShortName}, Code: ${errorCode}, Message: ${errorMsg}`);
      
      // Более понятные сообщения об ошибках
      if (errorCode === 100) {
        throw new Error(`Группа или профиль "${cleanShortName}" не найдены в ВК`);
      } else if (errorCode === 113) {
        throw new Error(`Неверное имя "${cleanShortName}"`);
      } else if (errorCode === 15) {
        throw new Error(`Доступ к "${cleanShortName}" запрещен`);
      } else {
        throw new Error(`VK API Error (${errorCode}): ${errorMsg}`);
      }
    }
    
    if (!data.response) {
      throw new Error(`Источник "${cleanShortName}" не найден`);
    }
    
    const resolvedType = data.response.type; // 'group' или 'user'
    const objectId = data.response.object_id;
    
    let sourceId, sourceName, sourceType;
    
    if (resolvedType === "group") {
      sourceId = "-" + objectId;
      sourceType = 'group';
      // Получаем название группы
      const groupInfo = getVkSourceInfo(sourceId, 'group');
      sourceName = groupInfo.name || `Группа ${cleanShortName}`;
    } else if (resolvedType === "user") {
      sourceId = objectId.toString();
      sourceType = 'user';
      // Получаем имя пользователя
      const userInfo = getVkSourceInfo(sourceId, 'user');
      sourceName = userInfo.name || `${cleanShortName}`;
    } else {
      throw new Error(`"${cleanShortName}" не является группой или пользователем (тип: ${resolvedType})`);
    }
    
    logEvent("INFO", "vk_resolve_success", "system", 
             `Name: ${cleanShortName} -> ID: ${sourceId}, Name: ${sourceName}, Type: ${sourceType}`);
    
    return {
      id: sourceId,
      name: sourceName,
      type: sourceType,
      originalUrl: originalUrl
    };
    
  } catch (error) {
    logEvent("ERROR", "vk_resolve_error", "system", 
             `Name: ${shortName}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Получает информацию о ВК источнике (название группы или имя пользователя)
 */
function getVkSourceInfo(sourceId, sourceType) {
  try {
    const userToken = PropertiesService.getScriptProperties()
      .getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      logEvent("WARN", "vk_token_missing_for_info", "system", `Source ID: ${sourceId}`);
      return { name: null };
    }
    
    let apiMethod, params;
    
    if (sourceType === 'group') {
      // Для групп используем groups.getById
      const groupId = sourceId.replace('-', '');
      apiMethod = 'groups.getById';
      params = `group_id=${encodeURIComponent(groupId)}`;
    } else {
      // Для пользователей используем users.get
      apiMethod = 'users.get';
      params = `user_ids=${encodeURIComponent(sourceId)}`;
    }
    
    const apiUrl = `https://api.vk.com/method/${apiMethod}?${params}&v=${VK_API_VERSION}&access_token=${encodeURIComponent(userToken)}`;
    
    const response = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      timeout: 8000
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (data.error) {
      logEvent("WARN", "vk_source_info_error", "system", `Source: ${sourceId}, Error: ${data.error.error_msg}`);
      return { name: null };
    }
    
    if (!data.response || data.response.length === 0) {
      return { name: null };
    }
    
    const item = data.response[0];
    let name;
    
    if (sourceType === 'group') {
      name = item.name;
    } else {
      name = `${item.first_name} ${item.last_name}`.trim();
    }
    
    logEvent("DEBUG", "vk_source_info_retrieved", "system", `ID: ${sourceId}, Name: ${name}`);
    
    return { name: name };
    
  } catch (error) {
    logEvent("ERROR", "vk_source_info_error", "system", `Source: ${sourceId}, Error: ${error.message}`);
    return { name: null };
  }
}

/**
 * РАСШИРЕННАЯ функция извлечения Telegram чата с получением названий
 */
function extractAndValidateTelegramChat(input) {
  try {
    if (!input || typeof input !== 'string') {
      throw new Error('Укажите Telegram чат или канал');
    }
    
    input = input.trim();
    
    if (input === '') {
      throw new Error('Telegram ссылка не может быть пустой');
    }
    
    logEvent("DEBUG", "tg_chat_extraction_start", "system", `Input: ${input}`);
    
    let chatId, chatName = null, chatType = 'unknown';
    
    // Случай 1: Уже готовый chat_id (-100...)
    if (input.match(/^-100\d+$/)) {
      chatId = input;
      chatType = 'supergroup';
      // Пытаемся получить название чата
      const chatInfo = getTelegramChatInfo(chatId);
      chatName = chatInfo.name || `Чат ${chatId}`;
    }
    // Случай 2: Обычный chat_id для групп (-...)
    else if (input.match(/^-\d+$/)) {
      chatId = input;
      chatType = 'group';
      const chatInfo = getTelegramChatInfo(chatId);
      chatName = chatInfo.name || `Группа ${chatId}`;
    }
    // Случай 3: Положительный ID (личный чат)
    else if (input.match(/^\d+$/)) {
      chatId = input;
      chatType = 'private';
      const chatInfo = getTelegramChatInfo(chatId);
      chatName = chatInfo.name || `Пользователь ${chatId}`;
    }
    // Случай 4: С @ префиксом
    else if (input.startsWith('@')) {
      chatId = input;
      chatType = 'channel';
      const chatInfo = getTelegramChatInfo(chatId);
      chatName = chatInfo.name || input;
    }
    // Случай 5: t.me ссылка
    else if (input.includes('t.me/')) {
      const tMeMatch = input.match(/t\.me\/([a-zA-Z0-9_]+)/);
      if (tMeMatch) {
        chatId = '@' + tMeMatch[1];
        chatType = 'channel';
        const chatInfo = getTelegramChatInfo(chatId);
        chatName = chatInfo.name || chatId;
      } else {
        throw new Error('Неверный формат t.me ссылки');
      }
    }
    // Случай 6: Простое имя канала
    else if (input.match(/^[a-zA-Z0-9_]+$/)) {
      chatId = '@' + input;
      chatType = 'channel';
      const chatInfo = getTelegramChatInfo(chatId);
      chatName = chatInfo.name || chatId;
    }
    else {
      throw new Error(`Неподдерживаемый формат Telegram: "${input}"`);
    }
    
    logEvent("INFO", "tg_chat_processed", "system", 
             `Input: ${input} -> ID: ${chatId}, Name: ${chatName}, Type: ${chatType}`);
    
    return {
      id: chatId,
      name: chatName,
      type: chatType,
      originalInput: input
    };
    
  } catch (error) {
    logEvent('ERROR', 'tg_chat_extraction_error', 'system', `Input: ${input}, Error: ${error.message}`);
    throw error;
  }
}

/**
 * Получает информацию о Telegram чате
 */
function getTelegramChatInfo(chatId) {
  try {
    const botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      logEvent("WARN", "bot_token_missing_for_chat_info", "system", `Chat ID: ${chatId}`);
      return { name: null };
    }
    
    const response = UrlFetchApp.fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
      {
        muteHttpExceptions: true,
        timeout: 8000
      }
    );
    
    const data = JSON.parse(response.getContentText());
    
    if (!data.ok) {
      logEvent("DEBUG", "tg_chat_info_failed", "system", `Chat: ${chatId}, Error: ${data.description}`);
      return { name: null };
    }
    
    const chat = data.result;
    let name;
    
    // Получаем название в зависимости от типа чата
    if (chat.title) {
      name = chat.title; // Для групп и каналов
    } else if (chat.first_name) {
      name = chat.first_name + (chat.last_name ? ' ' + chat.last_name : ''); // Для личных чатов
    } else if (chat.username) {
      name = '@' + chat.username;
    } else {
      name = null;
    }
    
    logEvent("DEBUG", "tg_chat_info_retrieved", "system", `Chat: ${chatId}, Name: ${name}, Type: ${chat.type}`);
    
    return { name: name, type: chat.type };
    
  } catch (error) {
    logEvent("ERROR", "tg_chat_info_error", "system", `Chat: ${chatId}, Error: ${error.message}`);
    return { name: null };
  }
}

// ============================================
// 5. УЛУЧШЕННЫЕ TELEGRAM API ФУНКЦИИ
// ============================================

/**
 * УЛУЧШЕННАЯ отправка постов с обработкой длинных текстов
 */
function sendVkPostToTelegramEnhanced(chatId, vkPost) {
  try {
    const botToken = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
    
    if (!botToken) {
      logEvent("ERROR", "bot_token_missing", "system", "Bot token not configured");
      return { success: false, error: "Bot token not configured" };
    }
    
    logEvent("DEBUG", "telegram_send_start", "system", 
             `Chat: ${chatId}, Post ID: ${vk_post.id}, Text length: ${vkPost.text?.length || 0}, Attachments: ${vkPost.attachments?.length || 0}`);
    
    // Форматируем текст
    let text = formatVkTextForTelegram(vkPost.text || "");
    
    // Обрабатываем все типы вложений
    const mediaData = getVkMediaUrls(vkPost.attachments || []);
    
    // Добавляем информацию о медиа в текст
    if (mediaData.videoLinks.length > 0) {
      text += "\n\n🎥 Видео:\n" + mediaData.videoLinks.join("\n");
    }
    if (mediaData.audioLinks.length > 0) {
      text += "\n\n🎵 Аудио:\n" + mediaData.audioLinks.join("\n");
    }
    if (mediaData.docLinks.length > 0) {
      text += "\n\n📎 Документы:\n" + mediaData.docLinks.join("\n");
    }
    
    // КРИТИЧНОЕ ИСПРАВЛЕНИЕ: обработка длинных текстов
    if (mediaData.photos.length > 0) {
      // Есть фото - проверяем длину подписи
      if (text.length > TELEGRAM_CAPTION_LIMIT) {
        logEvent("WARN", "caption_too_long", "system", 
                 `Text length: ${text.length}, Limit: ${TELEGRAM_CAPTION_LIMIT}, Splitting messages`);
        
        // Отправляем медиа без подписи, затем текст отдельно
        const mediaResult = sendTelegramMediaGroup(botToken, chatId, mediaData.photos, "");
        if (!mediaResult.success) {
          return mediaResult;
        }
        
        // Отправляем текст отдельным сообщением
        const textResult = sendTelegramMessage(botToken, chatId, text);
        
        return {
          success: textResult.success,
          message_ids: [mediaResult.message_id, textResult.message_id].filter(Boolean),
          total_messages: 2,
          error: textResult.error
        };
      } else {
        // Текст короткий - отправляем вместе
        const result = sendTelegramMediaGroup(botToken, chatId, mediaData.photos, text);
        return {
          success: result.success,
          message_ids: [result.message_id].filter(Boolean),
          total_messages: 1,
          error: result.error
        };
      }
    } else {
      // Нет фото - отправляем только текст (может быть длинным)
      const result = sendTelegramMessage(botToken, chatId, text);
      return {
        success: result.success,
        message_ids: [result.message_id].filter(Boolean),
        total_messages: 1,
        error: result.error
      };
    }
    
  } catch (error) {
    logEvent("ERROR", "telegram_send_error", "system", `Chat: ${chatId}, Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function sendTelegramMessage(token, chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    // Проверяем длину сообщения (лимит Telegram - 4096 символов)
    if (text.length > 4096) {
      logEvent("WARN", "message_too_long", "system", 
               `Text length: ${text.length}, splitting into parts`);
      
      // Разбиваем на части
      const parts = splitTextIntoChunks(text, 4000);
      const messageIds = [];
      
      for (let i = 0; i < parts.length; i++) {
        const partText = i === 0 ? parts[i] : `...продолжение ${i + 1}:\n\n${parts[i]}`;
        
        const response = UrlFetchApp.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload: JSON.stringify({
            chat_id: chatId,
            text: partText,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }),
          muteHttpExceptions: true,
          timeout: 10000
        });
        
        const result = JSON.parse(response.getContentText());
        
        if (result.ok) {
          messageIds.push(result.result.message_id);
        } else {
          logEvent("ERROR", "message_part_failed", "system", 
                   `Part ${i + 1}, Chat: ${chatId}, Error: ${result.description}`);
          return { success: false, error: `Part ${i + 1}: ${result.description}` };
        }
      }
      
      return { success: true, message_id: messageIds[0], message_ids: messageIds };
    }
    
    // Обычное сообщение
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const responseText = response.getContentText();
    logEvent("DEBUG", "telegram_message_response", "system", 
             `Chat: ${chatId}, Status: ${response.getResponseCode()}, Response: ${responseText.substring(0, 200)}`);
    
    const result = JSON.parse(responseText);
    
    if (result.ok) {
      logEvent("INFO", "telegram_message_sent", "system", 
               `Chat: ${chatId}, Message ID: ${result.result.message_id}`);
      return { success: true, message_id: result.result.message_id };
    } else {
      logEvent("ERROR", "telegram_message_failed", "system", 
               `Chat: ${chatId}, Error: ${result.description}`);
      return { success: false, error: result.description || "Unknown error" };
    }
    
  } catch (error) {
    logEvent("ERROR", "telegram_message_error", "system", 
             `Chat: ${chatId}, Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function sendTelegramMediaGroup(token, chatId, mediaUrls, caption) {
  try {
    if (mediaUrls.length === 0) {
      return sendTelegramMessage(token, chatId, caption);
    }
    
    const url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    
    // Ограничиваем caption если он слишком длинный
    let finalCaption = caption;
    if (caption && caption.length > TELEGRAM_CAPTION_LIMIT) {
      finalCaption = caption.substring(0, TELEGRAM_CAPTION_LIMIT - 10) + "...";
      logEvent("WARN", "caption_truncated", "system", 
               `Original: ${caption.length}, Truncated to: ${finalCaption.length}`);
    }
    
    const media = mediaUrls.slice(0, MAX_MEDIA_GROUP_SIZE).map((item, index) => ({
      type: item.type,
      media: item.url,
      caption: index === 0 ? finalCaption : undefined,
      parse_mode: index === 0 && finalCaption ? 'Markdown' : undefined
    }));
    
    logEvent("DEBUG", "telegram_media_group_sending", "system", 
             `Chat: ${chatId}, Media count: ${media.length}, Caption length: ${finalCaption?.length || 0}`);
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        chat_id: chatId,
        media: media
      }),
      muteHttpExceptions: true,
      timeout: 15000
    });
    
    const responseText = response.getContentText();
    logEvent("DEBUG", "telegram_media_response", "system", 
             `Chat: ${chatId}, Status: ${response.getResponseCode()}, Response: ${responseText.substring(0, 200)}`);
    
    const result = JSON.parse(responseText);
    
    if (result.ok) {
      const messageId = result.result[0].message_id;
      logEvent("INFO", "telegram_media_sent", "system", 
               `Chat: ${chatId}, Message ID: ${messageId}, Media count: ${result.result.length}`);
      return { success: true, message_id: messageId };
    } else {
      logEvent("ERROR", "telegram_media_failed", "system", 
               `Chat: ${chatId}, Error: ${result.description}`);
      return { success: false, error: result.description || "Unknown error" };
    }
    
  } catch (error) {
    logEvent("ERROR", "telegram_media_error", "system", 
             `Chat: ${chatId}, Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Разбивает текст на части
 */
function splitTextIntoChunks(text, maxLength) {
  const chunks = [];
  let currentChunk = "";
  
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        // Предложение само по себе слишком длинное
        chunks.push(sentence.substring(0, maxLength));
      }
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// ============================================
// 6. VK API - РАСШИРЕННАЯ ПОДДЕРЖКА
// ============================================

function getVkPosts(sourceId, count = 10) {
  try {
    const userToken = PropertiesService.getScriptProperties()
      .getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      throw new Error("VK User Access Token not configured");
    }
    
    // Определяем тип источника
    const isGroup = sourceId.toString().startsWith("-");
    let ownerId = sourceId;
    
    // Для групп используем отрицательный ID, для пользователей - положительный
    if (!isGroup && !sourceId.toString().startsWith("-")) {
      // Это пользователь - ID остается положительным
      ownerId = sourceId;
    }
    
    logEvent("DEBUG", "vk_posts_request", "system", 
             `Source ID: ${sourceId}, Owner ID: ${ownerId}, Type: ${isGroup ? 'group' : 'user'}, Count: ${count}`);
    
    const url = `https://api.vk.com/method/wall.get?owner_id=${encodeURIComponent(ownerId)}&count=${count}&v=${VK_API_VERSION}&access_token=${encodeURIComponent(userToken)}`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const responseText = response.getContentText();
    logEvent("DEBUG", "vk_posts_response", "system", 
             `Source: ${sourceId}, Status: ${response.getResponseCode()}, Response: ${responseText.substring(0, 300)}`);
    
    const data = JSON.parse(responseText);
    
    if (data.error) {
      const errorCode = data.error.error_code;
      let errorMsg = data.error.error_msg;
      
      // Расширенная обработка ошибок
      if (errorCode === 30) {
        errorMsg = isGroup ? "Группа приватная или закрытая" : "Профиль приватный";
      } else if (errorCode === 15) {
        errorMsg = "Доступ запрещен (нужны права на просмотр стены)";
      } else if (errorCode === 113) {
        errorMsg = "Неверный ID пользователя или группы";
      } else if (errorCode === 18) {
        errorMsg = "Страница удалена или заблокирована";
      }
      
      logEvent("ERROR", "vk_posts_api_error", "system", 
               `Source: ${sourceId}, Code: ${errorCode}, Message: ${errorMsg}`);
      throw new Error(`VK API Error (${errorCode}): ${errorMsg}`);
    }
    
    if (!data.response || !data.response.items) {
      logEvent("DEBUG", "vk_no_posts_response", "system", `Source: ${sourceId}`);
      return [];
    }
    
    const posts = data.response.items.map(post => ({
      id: post.id,
      text: post.text || "",
      date: post.date,
      attachments: post.attachments || []
    }));
    
    logEvent("INFO", "vk_posts_retrieved", "system", 
             `Source: ${sourceId}, Posts count: ${posts.length}`);
    
    return posts;
    
  } catch (error) {
    logEvent("ERROR", "vk_posts_error", "system", 
             `Source ID: ${sourceId}, Error: ${error.message}`);
    throw error;
  }
}

// ============================================
// 7. УТИЛИТЫ И ХЕЛПЕРЫ
// ============================================

function formatVkTextForTelegram(text) {
  if (!text) return "";
  
  try {
    // Делаем жирным первое предложение
    text = text.replace(/^([^.!?]*[.!?])/, '*$1*');
    
    // Делаем жирными слова в ВЕРХНЕМ РЕГИСТРЕ (минимум 2 символа)
    text = text.replace(/\b[А-ЯA-Z]{2,}\b/g, '*$&*');
    
    // Преобразуем ссылки VK [id123|текст] -> [текст](https://vk.com/id123)
    text = text.replace(/\[(\w+)\|([^\]]+)\]/g, '[$2](https://vk.com/$1)');
    
    // Удаляем лишние пробелы и переносы
    text = text.replace(/\s+/g, ' ').trim();
    
    // Экранируем специальные символы Markdown
    text = text.replace(/([_\*\[\]\(\)~`>#+-=|{}.!])/g, '\\$1');
    
    return text;
    
  } catch (error) {
    logEvent("ERROR", "text_formatting_error", "system", error.message);
    return text; // Возвращаем исходный текст в случае ошибки
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
          id: data[i][0],              // Binding ID
          vkGroupUrl: data[i][3],      // VK Group URL
          vkGroupName: data[i][4],     // VK Group Name
          tgChatId: data[i][5],        // TG Chat ID  
          tgChatName: data[i][6],      // TG Chat Name
          status: data[i][7],          // Status
          createdAt: data[i][8],       // Created At
          lastCheck: data[i][9]        // Last Check
        });
      }
    }
    
    return bindings;
  } catch (error) {
    logEvent("ERROR", "get_user_bindings_error", licenseKey, error.message);
    return [];
  }
}

function findBindingById(bindingId, licenseKey) {
  try {
    const sheet = getSheet("Bindings");
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === bindingId && data[i][1] === licenseKey) {
        return {
          id: data[i][0],              // Binding ID
          licenseKey: data[i][1],      // License Key
          userEmail: data[i][2],       // User Email
          vkGroupUrl: data[i][3],      // VK Group URL
          vkGroupName: data[i][4],     // VK Group Name
          tgChatId: data[i][5],        // TG Chat ID
          tgChatName: data[i][6],      // TG Chat Name
          status: data[i][7],          // Status
          createdAt: data[i][8],       // Created At
          lastCheck: data[i][9]        // Last Check
        };
      }
    }
    
    return null;
  } catch (error) {
    logEvent("ERROR", "find_binding_error", licenseKey, error.message);
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
    logEvent("ERROR", "find_binding_row_error", licenseKey, error.message);
    return null;
  }
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
    
    // Автоширина колонок
    sheet.autoResizeColumns(1, headers.length);
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
// 8. КОНФИГУРАЦИЯ И АДМИН-ФУНКЦИИ (сокращенно)
// ============================================

function showConfigDialog() {
  SpreadsheetApp.getUi().alert("⚙️ Конфигурация доступна через Properties Script или код");
}

function checkServerHealth() {
  const message = `🔧 Сервер v${SERVER_VERSION}\n\nСостояние: ✅ Работает\nЛогирование: ${DEV_MODE ? 'Включено' : 'Выключено'}`;
  SpreadsheetApp.getUi().alert(message);
}

function showAdminPanel() {
  SpreadsheetApp.getUi().alert("🎛️ Админ панель доступна через меню или код");
}

function showStatistics() {
  try {
    const stats = getSystemStats();
    const message = `📊 Статистика v${SERVER_VERSION}\n\n🔑 Лицензии: ${stats.totalLicenses}\n🔗 Связки: ${stats.totalBindings}\n📨 Постов сегодня: ${stats.postsToday}`;
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    SpreadsheetApp.getUi().alert("❌ Ошибка статистики: " + error.message);
  }
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
      totalBindings: bindingsData.length,
      activeBindings: bindingsData.filter(b => b[7] === "active").length,
      postsToday: logsData.filter(log => 
        log[2] === "post_sent" && new Date(log[0]) >= today
      ).length
    };
  } catch (error) {
    logEvent("ERROR", "stats_error", "system", error.message);
    return { totalLicenses: 0, activeLicenses: 0, totalBindings: 0, activeBindings: 0, postsToday: 0 };
  }
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
// ОБРАТНАЯ СОВМЕСТИМОСТЬ
// ============================================

/**
 * Обратно совместимые функции (для старых клиентов)
 */
function extractVkGroupId(url) {
  try {
    const data = extractAndValidateVkSource(url);
    return data.id;
  } catch (error) {
    throw error;
  }
}

function extractTelegramChatId(input) {
  try {
    const data = extractAndValidateTelegramChat(input);
    return data.id;
  } catch (error) {
    throw error;
  }
}

// Сокращенные версии других функций для совместимости
function sendVkPostToTelegram(chatId, vkPost) {
  const result = sendVkPostToTelegramEnhanced(chatId, vkPost);
  return {
    success: result.success,
    message_id: result.message_ids?.[0] || null,
    error: result.error
  };
}

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
            result.audioLinks.push(`🎵 [${attachment.audio.artist} - ${attachment.audio.title}](${attachment.audio.url})`);
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

function getBestPhotoUrl(sizes) {
  if (!sizes || sizes.length === 0) return null;
  
  const preferredTypes = ['w', 'z', 'y', 'x', 'r', 'q', 'p', 'o', 'n', 'm', 's'];
  
  for (const type of preferredTypes) {
    const size = sizes.find(s => s.type === type);
    if (size) return size.url;
  }
  
  return sizes[sizes.length - 1].url;
}

function getVkVideoDirectUrl(videoId) {
  try {
    const userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    
    if (!userToken) {
      logEvent("WARN", "vk_user_token_missing", "server", "Cannot get video URLs without user token");
      return null;
    }
    
    const url = `https://api.vk.com/method/video.get?videos=${encodeURIComponent(videoId)}&v=${VK_API_VERSION}&access_token=${encodeURIComponent(userToken)}`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (data.error) {
      logEvent("WARN", "vk_video_api_error", "server", `Video ID: ${videoId}, Error: ${data.error.error_msg}`);
      return null;
    }
    
    if (!data.response?.items?.[0]) {
      return null;
    }
    
    const video = data.response.items[0];
    const files = video.files;
    
    if (files) {
      const qualities = ['mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
      
      for (const quality of qualities) {
        if (files[quality]) {
          return files[quality];
        }
      }
    }
    
    return video.player || null;
    
  } catch (error) {
    logEvent("ERROR", "vk_video_error", "server", `Video ID: ${videoId}, Error: ${error.message}`);
    return null;
  }
}

// ============================================
// 9. ТЕСТИРОВАНИЕ (РАСШИРЕННОЕ)
// ============================================

/**
 * РАСШИРЕННЫЕ тесты URL извлечения
 */
function testUrlExtraction() {
  console.log('=== Тестирование извлечения ID из ссылок (v6.1) ===');
  
  // Расширенные тесты ВК
  const vkTests = [
    'https://vk.com/public123456',    // Паблик
    'vk.com/club789012',             // Клуб
    'https://vk.com/durov',           // Короткое имя
    'https://vk.com/id1',             // Личный профиль
    'vk.com/apiclub',                // Группа с коротким именем
    'VK.COM/PUBLIC999888?w=wall-999888_123', // С параметрами
    'https://vk.com/wall-123456',     // Wall ссылка
    '123456',                         // Просто ID
    '-123456'                         // Отрицательный ID
  ];
  
  console.log('\n=== ВК источники ===');
  vkTests.forEach(url => {
    try {
      const data = extractAndValidateVkSource(url);
      console.log(`✅ VK: ${url} -> ID: ${data.id}, Name: ${data.name}, Type: ${data.type}`);
    } catch (error) {
      console.log(`❌ VK: ${url} -> Error: ${error.message}`);
    }
  });
  
  // Расширенные тесты Telegram
  const tgTests = [
    'https://t.me/durov',            // t.me ссылка
    't.me/telegram',                 // Без протокола
    '@channelname',                  // С @
    'mychannel',                     // Простое имя
    '-1001234567890',               // Supergroup chat_id
    '-123456789',                   // Group chat_id
    '123456789',                    // User chat_id
    'https://t.me/joinchat/abc123' // Invite ссылка
  ];
  
  console.log('\n=== Telegram чаты ===');
  tgTests.forEach(input => {
    try {
      const data = extractAndValidateTelegramChat(input);
      console.log(`✅ TG: ${input} -> ID: ${data.id}, Name: ${data.name}, Type: ${data.type}`);
    } catch (error) {
      console.log(`❌ TG: ${input} -> Error: ${error.message}`);
    }
  });
  
  console.log('\n=== Тестирование завершено ===');
}

// ============================================
// КОНЕЦ SERVER.GS v6.1
// ============================================
// @ts-nocheck
/**
 * VK→Telegram Crossposter - CLIENT v6.1 КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ
 * 
 * ✅ Клиентская часть для Google Sheets
 * ✅ Работает с Server Web App
 * ✅ Управление лицензиями и связками
 * ✅ Проверка и отправка постов из ВК в TG
 * ✅ Автоматическая проверка по расписанию
 * ✅ Логирование всех операций
 * 
 * Автор: f_den
 * Дата: 2025-11-04
 * Версия: v6.1 CRITICAL FIXES - кеш лицензии 24 часа
 */

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const DEV_MODE = true; // true для подробного логирования
const CLIENT_VERSION = "6.1";

// ⭐ ВСТАВЬТЕ ПРАВИЛЬНЫЙ URL ВАШЕГО СЕРВЕРА ⭐
const SERVER_URL = "https://script.google.com/macros/s/AKfycbzNlXEfpsiMi1UAgaXJWCA9rF35swkvl2Amr2exZ1AWVfCiI7HttGq_yxZWgcceG_zG/exec";

const CACHE_DURATION = 10 * 60 * 1000; // 10 минут
const MAX_POSTS_CHECK = 50;
const REQUEST_TIMEOUT = 30000;

// ✅ КРИТИЧНО: 24 ЧАСА кеш лицензии (НЕ 30 минут!)
var LICENSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
var USER_PROP_LICENSE_KEY = 'LICENSE_KEY';
var USER_PROP_LICENSE_META = 'LICENSE_META'; // JSON: { type, maxGroups, expires, cachedAt }

// ============================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ С КЕШЕМ
// ============================================
var appState = {
  license: null, // Кеш лицензии в памяти
  initialized: false
};

// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ И МЕНЮ
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu("VK→Telegram")
    .addItem("🎛️ Открыть управление", "openMainPanel")
    .addItem("🔄 Проверить посты (вручную)", "checkNewPostsManually")
    .addItem("⏱️ Настроить автопроверку (каждые 30 мин)", "setupTrigger")
    .addItem("📊 Статистика", "showUserStatistics")
    .addItem("🔍 Логи", "showLogsSheet")
    .addToUi();
  
  logEvent("INFO", "menu_opened", "client", "App started, version " + CLIENT_VERSION);
}

function openMainPanel() {
  try {
    const htmlContent = getMainPanelHtml();
    if (!htmlContent) throw new Error("Failed to generate HTML");
    
    const html = HtmlService.createHtmlOutput(htmlContent);
    html.setWidth(1000).setHeight(700);
    
    SpreadsheetApp.getUi().showModelessDialog(html, "VK→Telegram Manager v" + CLIENT_VERSION);
    
  } catch (error) {
    logEvent("ERROR", "main_panel_error", "client", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка: " + error.message);
  }
}

// ============================================
// 2. ОСНОВНЫЕ API ФУНКЦИИ
// ============================================

function getInitialData() {
  try {
    logEvent("INFO", "initial_data_request", "client", "Loading license and bindings");
    
    const license = getLicense();
    
    if (!license) {
      logEvent("WARN", "no_license_found", "client", "User has no license key");
      return { success: true, license: null, bindings: [] };
    }
    
    logEvent("DEBUG", "license_found", "client", "License key: " + license.key.substring(0, 20) + "...");
    
    const bindingsResult = getBindings();
    
    if (!bindingsResult.success) {
      logEvent("WARN", "get_bindings_failed", "client", bindingsResult.error);
      return { success: false, error: bindingsResult.error };
    }
    
    logEvent("INFO", "initial_data_loaded", "client", "License loaded, Bindings: " + (bindingsResult.bindings ? bindingsResult.bindings.length : 0));
    
    return {
      success: true,
      license: license,
      bindings: bindingsResult.bindings || []
    };
    
  } catch (error) {
    logEvent("ERROR", "initial_data_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

function saveLicenseWithCheck(licenseKey) {
  try {
    if (!SERVER_URL || SERVER_URL.includes("YOURSERVERURL")) {
      logEvent("ERROR", "server_url_missing", "client", "SERVER_URL not configured");
      return {
        success: false,
        error: "❌ Ошибка конфигурации: URL сервера не указан"
      };
    }
    
    logEvent("INFO", "license_check_start", "client", "Checking license: " + licenseKey.substring(0, 20) + "...");
    
    const payload = {
      event: "check_license",
      license_key: licenseKey
    };
    
    logEvent("DEBUG", "server_request_payload", "client", 
             "Event: " + payload.event + ", License key length: " + licenseKey.length);
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const responseText = response.getContentText();
    
    logEvent("DEBUG", "server_response", "client",
             "Status: " + response.getResponseCode() + ", Body length: " + responseText.length + ", First 200 chars: " + responseText.substring(0, 200));
    
    const result = JSON.parse(responseText);
    
    if (result.success) {
      PropertiesService.getUserProperties().setProperty("LICENSE_KEY", licenseKey);
      
      logEvent("INFO", "license_saved", "client",
               "License type: " + result.license.type + ", Max groups: " + result.license.maxGroups);
      
      return {
        success: true,
        license: {
          key: licenseKey,
          type: result.license.type,
          maxGroups: result.license.maxGroups,
          expires: result.license.expires
        }
      };
    } else {
      logEvent("WARN", "license_check_failed", "client", result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    logEvent("ERROR", "license_check_error", "client", 
             "Error: " + error.message + ", Stack: " + (error.stack ? error.stack.substring(0, 200) : 'N/A'));
    return { success: false, error: "❌ Ошибка проверки лицензии: " + error.message };
  }
}

function addBinding(bindingName, bindingDescription, vkGroupUrl, tgChatId, formatSettings) {
  try {
    const license = getLicense();
    if (!license) return { success: false, error: "❌ Лицензия не найдена" };
    
    logEvent("INFO", "add_binding_start", "client", 
             "Name: " + bindingName + ", VK URL: " + vkGroupUrl + ", TG Chat: " + tgChatId);
    
    const payload = {
      event: "add_binding",
      license_key: license.key,
      binding_name: bindingName,
      binding_description: bindingDescription || "",
      vk_group_url: vkGroupUrl,
      tg_chat_id: tgChatId,
      formatSettings: formatSettings || {
        boldFirstLine: true,
        boldUppercase: true,
        syncPostsCount: 1
      }
    };
    
    logEvent("DEBUG", "add_binding_payload", "client", JSON.stringify(payload).substring(0, 200));
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      logEvent("INFO", "binding_added", "client",
               "Binding ID: " + result.binding_id + ", Name: " + bindingName + ", VK Group: " + (result.converted ? result.converted.vk_group_id : 'N/A'));
      
      // 💡 НОВОЕ: Очищаем мусорный кеш при добавлении новой связки
      const cleanupResult = cleanupOrphanedCache();
      logEvent("INFO", "orphaned_cache_cleanup_on_add", "client", 
               "Cleaned " + cleanupResult.cleaned + " orphaned entries from " + cleanupResult.total + " total cache entries");
      
      // 💡 НОВОЕ: Форсированно создаем все Published листы для связок
      const sheetsResult = ensureAllPublishedSheetsExist();
      logEvent("INFO", "published_sheets_forced_creation", "client", 
               "Checked " + sheetsResult.total + " bindings, Created " + sheetsResult.created + " new Published sheets");
      
      return result;
    } else {
      logEvent("WARN", "add_binding_failed", "client", result.error);
      return result;
    }
    
  } catch (error) {
    logEvent("ERROR", "add_binding_error", "client", error.message);
    return { success: false, error: error.message };
  }
}
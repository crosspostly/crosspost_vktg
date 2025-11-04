// @ts-nocheck
/**
 * VK→Telegram Crossposter - CLIENT v6.1 PRODUCTION
 * 
 * ✅ Клиентская часть для Google Sheets
 * ✅ Работает с Server Web App  
 * ✅ Управление лицензиями и связками
 * ✅ Проверка и отправка постов из ВК в TG
 * ✅ Автоматическая проверка по расписанию
 * ✅ Логирование всех операций
 * ✅ НОВОЕ: Кеширование лицензий 24 часа
 * ✅ НОВОЕ: Обработка VK гиперссылок [url|текст]
 * 
 * Автор: f_den
 * Дата: 2025-11-04
 * Версия: v6.1 PRODUCTION - кеш лицензии 24 часа
 * Примечание: Не требует VK Access Token! Всё на сервере.
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
    
    const license = getLicenseCached();
    
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
// @ts-nocheck
/**
 * VK→Telegram Crossposter - CLIENT v6.0 ИСПРАВЛЕННЫЙ (PRODUCTION-READY)
 * 
 * ✅ Клиентская часть для Google Sheets
 * ✅ Работает с Server Web App
 * ✅ Управление лицензиями и связками
 * ✅ Проверка и отправка постов из ВК в TG
 * ✅ Автоматическая проверка по расписанию
 * ✅ Логирование всех операций
 * 
 * Автор: f_den
 * Дата: 2025-11-01
 * Примечание: Не требует VK Access Token! Всё на сервере.
 */

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const DEV_MODE = true; // true для подробного логирования
const CLIENT_VERSION = "6.0";

// ⭐ ВСТАВЬТЕ ПРАВИЛЬНЫЙ URL ВАШЕГО СЕРВЕРА ⭐
const SERVER_URL = "https://script.google.com/macros/s/AKfycbzNlXEfpsiMi1UAgaXJWCA9rF35swkvl2Amr2exZ1AWVfCiI7HttGq_yxZWgcceG_zG/exec";

const CACHE_DURATION = 10 * 60 * 1000; // 10 минут
const MAX_POSTS_CHECK = 50;
const REQUEST_TIMEOUT = 30000;
var LICENSE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 минут
var USER_PROP_LICENSE_KEY = 'LICENSE_KEY';
var USER_PROP_LICENSE_META = 'LICENSE_META'; // JSON: { type, maxGroups, expires, cachedAt }

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
    .addSeparator()
    .addItem("🛠️ Мигрировать Published листы", "runPublishedSheetsMigration")
    .addItem("🧹 Очистить старые логи (>30 дней)", "cleanOldLogs")
    .addToUi();
  
  logEvent("INFO", "menu_opened", "client", `App started, version ${CLIENT_VERSION}`);
}

function runPublishedSheetsMigration() {
  try {
    const result = migrateAndEnsurePublishedSheets();
    
    const message = result.success 
      ? `✅ Миграция Published листов завершена!\n\nОбработано связок: ${result.total}\nСоздано листов: ${result.created}\nПереименовано: ${result.migrated}\nПроверено: ${result.validated}`
      : `❌ Ошибка миграции: ${result.error}`;
    
    SpreadsheetApp.getUi().alert(message);
    
  } catch (error) {
    logEvent("ERROR", "published_migration_ui_error", "client", error.message);
    SpreadsheetApp.getUi().alert(`❌ Ошибка: ${error.message}`);
  }
}

// ============================================
// КОНЕЦ CLIENT.GS
// ============================================

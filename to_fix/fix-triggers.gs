/**
 * ИСПРАВЛЕНИЕ 2: Enhanced setupTrigger с обработкой ошибок авторизации
 * Заменить функцию setupTrigger в client (примерно строки 600-630)
 */

function setupTrigger() {
  try {
    logEvent("INFO", "trigger_setup_start", "client", "Setting up 30-minute trigger");
    
    // Проверяем права доступа ПЕРЕД попыткой получить триггеры
    try {
      // Пробуем получить список триггеров - если нет прав, будет ошибка
      const testTriggers = ScriptApp.getProjectTriggers();
      logEvent("DEBUG", "trigger_permission_check_passed", "client", 
               `Current triggers count: ${testTriggers.length}`);
    } catch (permissionError) {
      logEvent("ERROR", "trigger_permission_denied", "client", 
               `Permission error: ${permissionError.message}`);
      
      SpreadsheetApp.getUi().alert(
        "❌ Ошибка авторизации триггеров!\n\n" +
        "Необходимо предоставить дополнительные разрешения:\n\n" +
        "1. Перейдите в редактор Apps Script\n" +
        "2. Нажмите 'Выполнить' для любой функции\n" +
        "3. Предоставьте разрешения когда будет запрос\n" +
        "4. Попробуйте снова настроить триггер\n\n" +
        "Требуемое разрешение:\n" +
        "https://www.googleapis.com/auth/script.scriptapp"
      );
      return;
    }
    
    // Удаляем старые триггеры
    const existingTriggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    existingTriggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === "checkNewPosts") {
        try {
          ScriptApp.deleteTrigger(trigger);
          deletedCount++;
          logEvent("DEBUG", "old_trigger_deleted", "client", 
                   `Trigger ID: ${trigger.getUniqueId()}`);
        } catch (deleteError) {
          logEvent("WARN", "trigger_delete_failed", "client", 
                   `Delete error: ${deleteError.message}`);
        }
      }
    });
    
    if (deletedCount > 0) {
      logEvent("INFO", "old_triggers_cleaned", "client", `Deleted ${deletedCount} old triggers`);
    }
    
    // Создаем новый триггер
    try {
      const newTrigger = ScriptApp.newTrigger("checkNewPosts")
        .timeBased()
        .everyMinutes(30)
        .create();
      
      logEvent("INFO", "trigger_created_successfully", "client", 
               `Trigger ID: ${newTrigger.getUniqueId()}, Function: checkNewPosts, Interval: 30 min`);
      
      // Сохраняем информацию о триггере в свойствах
      PropertiesService.getUserProperties().setProperties({
        "TRIGGER_ID": newTrigger.getUniqueId(),
        "TRIGGER_CREATED": new Date().toISOString(),
        "TRIGGER_FUNCTION": "checkNewPosts",
        "TRIGGER_INTERVAL": "30"
      });
      
      SpreadsheetApp.getUi().alert(
        "✅ Автопроверка настроена успешно!\n\n" +
        "📋 Детали:\n" +
        "• Функция: checkNewPosts\n" +
        "• Интервал: каждые 30 минут\n" +
        "• Триггер ID: " + newTrigger.getUniqueId().substring(0, 20) + "...\n\n" +
        "🔍 Проверить статус можно:\n" +
        "Apps Script → Триггеры (левое меню)\n\n" +
        "📈 Логи автопроверки будут в листе 'Logs'"
      );
      
    } catch (createError) {
      logEvent("ERROR", "trigger_creation_failed", "client", 
               `Create error: ${createError.message}`);
      
      // Детальная обработка ошибок создания триггера
      let errorMessage = "❌ Ошибка создания триггера: " + createError.message;
      
      if (createError.message.includes("authorization")) {
        errorMessage += "\n\n🔐 Решение:\n" +
          "1. Откройте Apps Script редактор\n" +
          "2. Выберите любую функцию и нажмите 'Выполнить'\n" +
          "3. Предоставьте все запрашиваемые разрешения\n" +
          "4. Попробуйте настроить триггер снова";
      } else if (createError.message.includes("quota")) {
        errorMessage += "\n\n⚠️ Превышен лимит триггеров.\n" +
          "Максимум: 20 триггеров на проект.\n" +
          "Удалите ненужные триггеры в Apps Script → Триггеры";
      }
      
      SpreadsheetApp.getUi().alert(errorMessage);
    }
    
  } catch (error) {
    logEvent("ERROR", "trigger_setup_critical_error", "client", 
             `Critical error: ${error.message}, Stack: ${error.stack}`);
    
    SpreadsheetApp.getUi().alert(
      "❌ Критическая ошибка настройки триггера!\n\n" +
      "Ошибка: " + error.message + "\n\n" +
      "🛠️ Попробуйте:\n" +
      "1. Перезагрузить страницу\n" +
      "2. Попробовать снова\n" +
      "3. Обратиться к администратору"
    );
  }
}

/**
 * ДОПОЛНЕНИЕ: Функция проверки статуса триггеров
 */
function checkTriggersStatus() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const checkNewPostsTriggers = triggers.filter(t => t.getHandlerFunction() === "checkNewPosts");
    
    logEvent("INFO", "triggers_status_checked", "client", 
             `Total triggers: ${triggers.length}, checkNewPosts triggers: ${checkNewPostsTriggers.length}`);
    
    if (checkNewPostsTriggers.length === 0) {
      return {
        status: "not_configured",
        message: "Автопроверка не настроена",
        details: "Нет активных триггеров для функции checkNewPosts"
      };
    } else if (checkNewPostsTriggers.length === 1) {
      const trigger = checkNewPostsTriggers[0];
      const createdTime = PropertiesService.getUserProperties().getProperty("TRIGGER_CREATED");
      
      return {
        status: "active",
        message: "Автопроверка активна",
        details: `Триггер ID: ${trigger.getUniqueId()}\nСоздан: ${createdTime || 'неизвестно'}\nИнтервал: 30 минут`
      };
    } else {
      return {
        status: "multiple",
        message: `Найдено ${checkNewPostsTriggers.length} триггеров`,
        details: "Рекомендуется удалить лишние триггеры"
      };
    }
    
  } catch (error) {
    logEvent("ERROR", "triggers_status_check_error", "client", error.message);
    return {
      status: "error", 
      message: "Ошибка проверки триггеров",
      details: error.message
    };
  }
}

/**
 * ДОПОЛНЕНИЕ: Удаление всех триггеров checkNewPosts
 */
function removeAllTriggers() {
  try {
    if (!confirm("Удалить ВСЕ триггеры автопроверки?\n\nЭто остановит автоматический кросспостинг.")) {
      return;
    }
    
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === "checkNewPosts") {
        try {
          ScriptApp.deleteTrigger(trigger);
          deletedCount++;
          logEvent("INFO", "trigger_removed", "client", `ID: ${trigger.getUniqueId()}`);
        } catch (deleteError) {
          logEvent("ERROR", "trigger_removal_failed", "client", deleteError.message);
        }
      }
    });
    
    // Очищаем сохраненную информацию о триггерах
    PropertiesService.getUserProperties().deleteProperty("TRIGGER_ID");
    PropertiesService.getUserProperties().deleteProperty("TRIGGER_CREATED");
    PropertiesService.getUserProperties().deleteProperty("TRIGGER_FUNCTION");
    PropertiesService.getUserProperties().deleteProperty("TRIGGER_INTERVAL");
    
    SpreadsheetApp.getUi().alert(
      `✅ Удалено триггеров: ${deletedCount}\n\n` +
      "Автопроверка остановлена.\n" +
      "Для возобновления используйте 'Настроить автопроверку'."
    );
    
    logEvent("INFO", "all_triggers_removed", "client", `Total deleted: ${deletedCount}`);
    
  } catch (error) {
    logEvent("ERROR", "remove_triggers_error", "client", error.message);
    SpreadsheetApp.getUi().alert("❌ Ошибка удаления триггеров: " + error.message);
  }
}
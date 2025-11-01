/**
 * ИСПРАВЛЕНИЕ 6: Updated HTML Interface для отображения названий групп
 * Заменить функцию updateBindingsSection в client HTML интерфейсе
 */

// Найти в client в HTML секции JavaScript функцию updateBindingsSection и заменить на:

function updateBindingsSection() {
  if (!appState.license) return;

  const bindings = appState.bindings;
  const activeBindings = bindings.filter(b => b.status === "active").length;
  const pausedBindings = bindings.filter(b => b.status === "paused").length;

  appState.stats = { active: activeBindings, paused: pausedBindings, total: bindings.length };

  document.getElementById("active-bindings").textContent = activeBindings;
  document.getElementById("paused-bindings").textContent = pausedBindings;
  document.getElementById("total-bindings").textContent = bindings.length;

  const statsGrid = document.getElementById("bindings-stats");
  if (bindings.length === 0) {
    statsGrid.style.display = "none";
  } else {
    statsGrid.style.display = "grid";
  }

  const bindingsList = document.getElementById("bindings-list");
  if (bindings.length === 0) {
    bindingsList.innerHTML = '<div class="empty-state">Нет связок<br><br>Добавьте первую связку для начала кросспостинга</div>';
  } else {
    bindingsList.innerHTML = bindings.map(binding => {
      const isPaused = binding.status === "paused";
      
      // ОБНОВЛЕНИЕ: Используем названия если они есть, иначе URL/ID
      const displayVkName = binding.vkGroupName || binding.vkGroupUrl || 'N/A';
      const displayTgName = binding.tgChatName || binding.tgChatId || 'N/A';
      
      // Обрезаем длинные названия для лучшего отображения
      const vkNameDisplay = displayVkName.length > 50 ? 
        displayVkName.substring(0, 47) + '...' : displayVkName;
      const tgNameDisplay = displayTgName.length > 30 ? 
        displayTgName.substring(0, 27) + '...' : displayTgName;
      
      return `
        <div class="binding-item ${isPaused ? 'paused' : ''}" style="margin-bottom: 12px;">
          <div class="binding-header">
            <div class="binding-info">
              <div class="binding-vk" title="${escapeHtml(displayVkName)}">
                📰 ${escapeHtml(vkNameDisplay)}
              </div>
              <div class="binding-tg" title="${escapeHtml(displayTgName)}">
                📱 ${escapeHtml(tgNameDisplay)}
              </div>
              ${binding.vkGroupUrl !== displayVkName ? 
                `<div class="binding-url" style="font-size: 10px; color: #999; margin-top: 2px;">
                  🔗 ${escapeHtml(binding.vkGroupUrl?.substring(0, 40) + '...' || 'N/A')}
                </div>` : ''
              }
            </div>
            <div class="binding-actions">
              <button class="btn-small btn-success" onclick="testBinding('${binding.id}')" title="Отправить тестовый пост">🧪</button>
              <button class="btn-small btn-warning" onclick="toggleBinding('${binding.id}')" title="${binding.status === 'active' ? 'Пауза' : 'Включить'}">${binding.status === 'active' ? '⏸️' : '▶️'}</button>
              <button class="btn-small btn-secondary" onclick="editBinding('${binding.id}')" title="Редактировать">✏️</button>
              <button class="btn-small btn-danger" onclick="deleteBinding('${binding.id}')" title="Удалить">🗑️</button>
            </div>
          </div>
          <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span class="binding-status status-${binding.status}">${binding.status === 'active' ? 'АКТИВНА' : 'ПАУЗА'}</span>
            <small style="color: #999; font-size: 10px;">
              ${binding.createdAt ? 'Создано: ' + new Date(binding.createdAt).toLocaleDateString('ru-RU') : ''}
            </small>
          </div>
        </div>
      `;
    }).join("");
  }

  const addButton = document.getElementById("add-binding-btn");
  if (bindings.length >= appState.license.maxGroups) {
    addButton.disabled = true;
    addButton.textContent = "❌ Лимит достигнут";
  } else {
    addButton.disabled = false;
    addButton.textContent = "➕ Добавить связку";
  }
}

// Добавить вспомогательную функцию для HTML escaping:
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * ДОПОЛНЕНИЕ: Обновленная функция для отображения модального окна редактирования
 */

function editBinding(bindingId) {
  const binding = appState.bindings.find(b => b.id === bindingId);
  if (!binding) {
    showMessage("bindings", "error", "❌ Связка не найдена");
    return;
  }

  appState.currentEditingId = bindingId;
  document.getElementById("modal-title").textContent = "✏️ Редактировать связку";
  
  // ОБНОВЛЕНИЕ: Показываем как название, так и оригинальный URL для редактирования
  document.getElementById("modal-vk-url").value = binding.vkGroupUrl || "";
  document.getElementById("modal-tg-chat").value = binding.tgChatId || "";
  
  // Добавляем подсказку с текущими названиями
  const modalMessage = document.getElementById("modal-message");
  if (binding.vkGroupName && binding.vkGroupName !== binding.vkGroupUrl) {
    modalMessage.innerHTML = `
      <div style="background: #e7f3ff; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 12px;">
        <strong>📋 Текущие названия:</strong><br>
        📰 ВК: ${escapeHtml(binding.vkGroupName)}<br>
        📱 TG: ${escapeHtml(binding.tgChatName)}
      </div>
    `;
    modalMessage.className = "message";
    modalMessage.style.display = "block";
  }
  
  document.getElementById("submit-binding-btn").textContent = "✅ Сохранить изменения";
  openModal();
  logMessageToConsole("Edit binding dialog opened for ID: " + bindingId + " (VK: " + binding.vkGroupName + ")");
}

/**
 * ДОПОЛНЕНИЕ: Функция обновления кеша названий (можно вызывать вручную)
 */

function refreshGroupNames() {
  if (!confirm("Обновить названия всех групп и каналов?\n\nЭто может занять некоторое время.")) {
    return;
  }

  showMessage("bindings", "loading", "🔄 Обновление названий...");
  logMessageToConsole("Manual group names refresh initiated");

  google.script.run
    .withSuccessHandler(function(result) {
      if (result && result.success) {
        const message = `✅ Названия обновлены!\n\nОбновлено: ${result.cached} названий`;
        showMessage("bindings", "success", message);
        
        // Перезагружаем связки чтобы показать новые названия
        refreshBindings();
        
        logMessageToConsole("Group names refresh completed: " + result.cached + " names updated");
      } else {
        showMessage("bindings", "error", "❌ " + (result?.error || "Ошибка обновления"));
        logMessageToConsole("Group names refresh failed: " + (result?.error || "Unknown error"));
      }
    })
    .withFailureHandler(function(error) {
      showMessage("bindings", "error", "❌ Ошибка: " + error.message);
      logMessageToConsole("Group names refresh error: " + error.message);
    })
    .cacheGroupNames();
}

/**
 * ДОПОЛНЕНИЕ: CSS стили для улучшенного отображения
 * Добавить в <style> секцию HTML:
 */

/*
.binding-url {
  font-family: 'Courier New', monospace;
  word-break: break-all;
}

.binding-item.paused .binding-vk,
.binding-item.paused .binding-tg {
  opacity: 0.7;
}

.binding-info {
  min-width: 0; /* Позволяет тексту обрезаться */
  flex: 1;
}

.binding-vk, .binding-tg {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-actions {
  flex-shrink: 0; /* Кнопки не сжимаются */
}
*/

/**
 * ДОПОЛНЕНИЕ: Добавить кнопку обновления названий в интерфейс
 * Добавить после кнопки "Добавить связку":
 */

/*
<button class="btn-secondary" onclick="refreshGroupNames()" 
        style="margin-top: 8px; font-size: 12px;" 
        title="Обновить названия всех групп и каналов">
  🔄 Обновить названия
</button>
*/

/**
 * ДОПОЛНЕНИЕ: Обновленная функция создания связки с валидацией
 */

function submitBinding() {
  const vkUrl = document.getElementById("modal-vk-url").value.trim();
  const tgChat = document.getElementById("modal-tg-chat").value.trim();

  if (!vkUrl || !tgChat) {
    showModalMessage("error", "❌ Заполните все поля");
    return;
  }

  // Предварительная валидация форматов на клиенте
  if (!isValidVkUrl(vkUrl)) {
    showModalMessage("error", "❌ Некорректный формат ссылки ВК");
    return;
  }

  if (!isValidTelegramId(tgChat)) {
    showModalMessage("error", "❌ Некорректный формат Telegram ID");
    return;
  }

  showModalMessage("loading", "🔄 Сохранение...");
  document.getElementById("submit-binding-btn").disabled = true;

  const isEdit = !!appState.currentEditingId;
  const action = isEdit ? "editBinding" : "addBinding";
  const params = isEdit 
    ? [appState.currentEditingId, vkUrl, tgChat] 
    : [vkUrl, tgChat];

  google.script.run
    .withSuccessHandler(function(result) {
      document.getElementById("submit-binding-btn").disabled = false;
      
      if (result && result.success) {
        closeModal();
        refreshBindings();
        
        // Показываем информацию о преобразованных ID если есть
        let message = isEdit ? "✅ Связка обновлена!" : "✅ Связка добавлена!";
        
        if (result.converted) {
          message += `\n\n🔄 Преобразовано:\n📰 ВК: ${result.converted.vk_group_id}\n📱 TG: ${result.converted.tg_chat_id}`;
        }
        
        showMessage("bindings", "success", message);
        logMessageToConsole("Binding " + (isEdit ? "updated" : "added") + " successfully");
      } else {
        const errorMsg = result?.error || "Неизвестная ошибка";
        showModalMessage("error", errorMsg);
        logMessageToConsole("Binding operation failed: " + errorMsg);
      }
    })
    .withFailureHandler(function(error) {
      document.getElementById("submit-binding-btn").disabled = false;
      showModalMessage("error", "❌ Ошибка: " + error.message);
      logMessageToConsole("Binding operation error: " + error.message);
    })
    [action](...params);
}

/**
 * Клиентская валидация ссылок ВК
 */
function isValidVkUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const cleanUrl = url.trim().toLowerCase();
  
  // Простые паттерны для быстрой проверки
  const vkPatterns = [
    /vk\.com\/(public|club|id)\d+/,
    /vk\.com\/[a-z0-9_]+/,
    /vk\.cc\/[a-z0-9_]+/,
    /^-?\d+$/
  ];
  
  return vkPatterns.some(pattern => pattern.test(cleanUrl));
}

/**
 * Клиентская валидация Telegram ID
 */
function isValidTelegramId(id) {
  if (!id || typeof id !== 'string') return false;
  
  const cleanId = id.trim();
  
  // Простые паттерны для быстрой проверки
  const telegramPatterns = [
    /^-?\d+$/,                        // Числовой ID
    /^@[a-zA-Z0-9_]+$/,              // @username
    /t\.me\/[a-zA-Z0-9_]+/,          // t.me ссылка
    /telegram\.me\/[a-zA-Z0-9_]+/,   // telegram.me ссылка
    /^[a-zA-Z0-9_]+$/                // Простое имя
  ];
  
  return telegramPatterns.some(pattern => pattern.test(cleanId));
}

/**
 * ДОПОЛНЕНИЕ: Обновленная статус-секция с информацией о триггерах
 */

function updateStatusSection() {
  if (!appState.license) return;

  const statusContent = document.getElementById("status-content");
  const serverStatus = SERVER_URL ? "✅ Подключен" : "❌ Ошибка подключения";

  statusContent.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;">
      <div><strong>🌐 Сервер:</strong> ${serverStatus}</div>
      <div><strong>⏱️ Авто-проверка:</strong> ⚙️ Настраивается</div>
      <div><strong>📈 Статистика:</strong> ${appState.stats.total} связок (${appState.stats.active} активных)</div>
      <div><strong>🔑 Лицензия:</strong> ${appState.license.type}</div>
    </div>

    <div style="margin-top: 16px; padding: 12px; background: #f8f9fa; border-radius: 6px; font-size: 13px; color: #666;">
      <strong>💡 Подсказка:</strong> Используйте "🔄 Проверить посты" для тестирования или "⏱️ Авто-проверка" для настройки автоматической проверки каждые 30 минут.
    </div>
    
    <div style="margin-top: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
      <button class="btn-secondary" onclick="manualCheck()">🔄 Проверить посты</button>
      <button class="btn-secondary" onclick="setupAutoCheck()">⏱️ Авто-проверка</button>
    </div>
    
    <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
      <button class="btn-secondary" onclick="refreshGroupNames()" style="font-size: 12px;">🔄 Обновить названия</button>
      <button class="btn-secondary" onclick="checkTriggersStatusUI()" style="font-size: 12px;">⚙️ Статус триггеров</button>
    </div>
  `;
}

/**
 * Проверка статуса триггеров через UI
 */
function checkTriggersStatusUI() {
  showMessage("status", "loading", "🔄 Проверка статуса триггеров...");
  
  google.script.run
    .withSuccessHandler(function(result) {
      if (result) {
        const statusIcon = {
          'active': '✅',
          'not_configured': '❌',
          'multiple': '⚠️',
          'error': '❌'
        }[result.status] || '❓';
        
        const message = `${statusIcon} ${result.message}\n\n${result.details}`;
        showMessage("status", result.status === 'active' ? "success" : "warning", message);
        
        logMessageToConsole("Triggers status checked: " + result.status);
      } else {
        showMessage("status", "error", "❌ Ошибка проверки статуса");
      }
    })
    .withFailureHandler(function(error) {
      showMessage("status", "error", "❌ Ошибка: " + error.message);
      logMessageToConsole("Triggers status check error: " + error.message);
    })
    .checkTriggersStatus();
}
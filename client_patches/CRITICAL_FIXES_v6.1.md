# 🚨 КРИТИЧНЫЕ ИСПРАВЛЕНИЯ CLIENT.GS v6.1

## ⚡ СРОЧНЫЕ ЗАМЕНЫ В ФАЙЛЕ client.gs:

### 1. КОНФИГУРАЦИЯ (строки 21-22):
```javascript
// СТАРОЕ:
const CLIENT_VERSION = "6.0";

// НОВОЕ:
const CLIENT_VERSION = "6.1";
```

### 2. ДОБАВИТЬ ПОСЛЕ `const REQUEST_TIMEOUT = 30000;` (строка ~28):
```javascript
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
```

### 3. TEMPLATE LITERALS ИСПРАВЛЕНИЯ:

**В функции onOpen() (строка ~41):**
```javascript
// СТАРОЕ:
logEvent("INFO", "menu_opened", "client", `App started, version ${CLIENT_VERSION}`);

// НОВОЕ:
logEvent("INFO", "menu_opened", "client", "App started, version " + CLIENT_VERSION);
```

**В функции openMainPanel() (строка ~52):**
```javascript
// СТАРОЕ:
SpreadsheetApp.getUi().showModelessDialog(html, `VK→Telegram Manager v${CLIENT_VERSION}`);

// НОВОЕ:
SpreadsheetApp.getUi().showModelessDialog(html, "VK→Telegram Manager v" + CLIENT_VERSION);
```

**В функции showUserStatistics() (строка ~587):**
```javascript
// СТАРОЕ:
const message = `📊 Статистика VK→Telegram Manager v${CLIENT_VERSION}\n\n` +
  `🔑 Лицензия: ${license.key.substring(0, 20)}...\n` +
  `🔗 Связок: ${bindings.length} (${activeBindings} активных, ${pausedBindings} на паузе)\n` +
  `✉️ Отправлено постов: ${totalPostsSent}\n` +
  `⏱️ Авто-проверка: ${triggerCount > 0 ? '✅ Включена' : '❌ Выключена'}\n` +
  `📁 Листов отслеживания: ${sheets.length}\n` +
  `🌐 Сервер: ${SERVER_URL.substring(0, 50)}...\n`;

// НОВОЕ:
const message = "📊 Статистика VK→Telegram Manager v" + CLIENT_VERSION + "\n\n" +
  "🔑 Лицензия: " + license.key.substring(0, 20) + "...\n" +
  "🔗 Связок: " + bindings.length + " (" + activeBindings + " активных, " + pausedBindings + " на паузе)\n" +
  "✉️ Отправлено постов: " + totalPostsSent + "\n" +
  "⏱️ Авто-проверка: " + (triggerCount > 0 ? "✅ Включена" : "❌ Выключена") + "\n" +
  "📁 Листов отслеживания: " + sheets.length + "\n" +
  "🌐 Сервер: " + SERVER_URL.substring(0, 50) + "...\n";
```

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ:

### КОММИТ 4: Замена getLicense() на getLicenseCached() 
- [ ] В getInitialData(): `const license = getLicenseCached();`
- [ ] В addBinding(): `const license = getLicenseCached();` 
- [ ] В editBinding(): `const license = getLicenseCached();`
- [ ] В deleteBinding(): `const license = getLicenseCached();`
- [ ] В всех остальных функциях заменить getLicense() на getLicenseCached()

### КОММИТ 5: Интеграция новых функций
- [ ] Добавить функции из client_patches/functions_added_v6.1.js в конец файла
- [ ] Обновить processVkLinks() в sendPostToServer()
- [ ] Обновить markPostAsSent() для работы с bindingName

### КОММИТ 6: Merge в main
- [ ] Создать PR feature/client-license-cache-and-publish-fixes → main
- [ ] Протестировать работу кеширования
- [ ] Проверить обработку VK гиперссылок

---

**⚠️ ВАЖНО**: Template literals в HTML/JavaScript коде ВАЛИДНЫ и НЕ требуют исправления!
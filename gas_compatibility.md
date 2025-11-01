# 🚨 Google Apps Script Compatibility Guide

> **Критически важное руководство для избежания ошибок времени выполнения в Google Apps Script**

Этот документ описывает строгие правила совместимости с Google Apps Script (GAS) runtime. **Нарушение этих правил приведет к критическим ошибкам в продакшене.**

---

## ❌ ЗАПРЕЩЕННЫЕ КОНСТРУКЦИИ

### 1. **Template Literals с вложенными выражениями в HTML**

❌ **НЕПРАВИЛЬНО:**
```javascript
function getHtml() {
  return `
    <div>
      <h1>${title}</h1>
      <p>Count: ${data.items.length}</p>
      ${data.items.map(item => `<span>${item.name}</span>`).join('')}
    </div>
  `;
}
```

✅ **ПРАВИЛЬНО:**
```javascript
function getHtml() {
  var html = '';
  html += '<div>';
  html += '  <h1>' + title + '</h1>';
  html += '  <p>Count: ' + data.items.length + '</p>';
  
  data.items.forEach(function(item) {
    html += '<span>' + item.name + '</span>';
  });
  
  html += '</div>';
  
  return html;
}
```

### 2. **Arrow Functions в циклах обработки данных**

❌ **НЕПРАВИЛЬНО:**
```javascript
data.forEach(item => {
  html += `<div>${item.name}</div>`;
});

const filtered = items.filter(item => item.active);
```

✅ **ПРАВИЛЬНО:**
```javascript
data.forEach(function(item) {
  html += '<div>' + item.name + '</div>';
});

var filtered = items.filter(function(item) {
  return item.active;
});
```

### 3. **Destructuring Assignment**

❌ **НЕПРАВИЛЬНО:**
```javascript
const { name, email } = user;
const [first, second] = array;
```

✅ **ПРАВИЛЬНО:**
```javascript
var name = user.name;
var email = user.email;
var first = array[0];
var second = array[1];
```

### 4. **const/let в глобальной области**

❌ **НЕПРАВИЛЬНО:**
```javascript
const API_URL = "https://api.example.com";
let currentUser = null;
```

✅ **ПРАВИЛЬНО:**
```javascript
var API_URL = "https://api.example.com";
var currentUser = null;
```

### 5. **Spread Operator**

❌ **НЕПРАВИЛЬНО:**
```javascript
const newArray = [...oldArray, newItem];
const newObject = { ...oldObject, key: value };
```

✅ **ПРАВИЛЬНО:**
```javascript
var newArray = oldArray.slice();
newArray.push(newItem);

var newObject = {};
for (var key in oldObject) {
  newObject[key] = oldObject[key];
}
newObject.key = value;
```

---

## ✅ РАЗРЕШЕННЫЕ КОНСТРУКЦИИ

### 1. **Простые Template Literals (только статический HTML)**

✅ **БЕЗОПАСНО:**
```javascript
function getStaticHtml() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial; }
      </style>
    </head>
    <body>
      <div id="container"></div>
      <script>
        console.log("Static content only");
      </script>
    </body>
    </html>
  `;
}
```

### 2. **String Concatenation для динамического HTML**

✅ **РЕКОМЕНДУЕТСЯ:**
```javascript
function getDynamicHtml(title, items) {
  var html = '<!DOCTYPE html><html><body>';
  html += '<h1>' + title + '</h1>';
  html += '<ul>';
  
  items.forEach(function(item) {
    html += '<li>' + item.name + ' - ' + item.price + '</li>';
  });
  
  html += '</ul></body></html>';
  return html;
}
```

### 3. **Traditional Function Declarations**

✅ **СТАБИЛЬНО:**
```javascript
function processData(data) {
  return data.filter(function(item) {
    return item.status === 'active';
  }).map(function(item) {
    return {
      id: item.id,
      name: item.name,
      formatted: item.name + ' (' + item.id + ')'
    };
  });
}
```

### 4. **Proper Variable Declarations**

✅ **НАДЕЖНО:**
```javascript
function handleRequest() {
  var result = {};
  var errors = [];
  var success = true;
  
  try {
    // Логика обработки
    result.data = processRequest();
  } catch (error) {
    success = false;
    errors.push(error.message);
  }
  
  return {
    success: success,
    result: result,
    errors: errors
  };
}
```

---

## 🔧 ПРАКТИЧЕСКИЕ РЕКОМЕНДАЦИИ

### HTML Generation Pattern

```javascript
function generateComplexHtml(data) {
  var html = [];
  
  html.push('<!DOCTYPE html>');
  html.push('<html><head><meta charset="UTF-8"></head><body>');
  
  // Заголовок
  html.push('<header>');
  html.push('  <h1>' + escapeHtml(data.title) + '</h1>');
  html.push('</header>');
  
  // Основной контент
  html.push('<main>');
  if (data.items && data.items.length > 0) {
    html.push('  <ul>');
    data.items.forEach(function(item, index) {
      html.push('    <li id="item-' + index + '">');
      html.push('      <strong>' + escapeHtml(item.name) + '</strong>');
      html.push('      <span class="price">$' + item.price + '</span>');
      html.push('    </li>');
    });
    html.push('  </ul>');
  } else {
    html.push('  <p>Нет данных для отображения</p>');
  }
  html.push('</main>');
  
  html.push('</body></html>');
  
  return html.join('\n');
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### Error-Safe API Calls

```javascript
function makeServerRequest(payload) {
  try {
    logEvent("DEBUG", "api_request_start", "client", "Payload: " + JSON.stringify(payload).substring(0, 100));
    
    var response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: 30000
    });
    
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    logEvent("DEBUG", "api_response", "client", "Code: " + responseCode + ", Length: " + responseText.length);
    
    if (responseCode !== 200) {
      throw new Error("HTTP " + responseCode + ": " + responseText.substring(0, 200));
    }
    
    var result = JSON.parse(responseText);
    
    if (result.success) {
      logEvent("INFO", "api_request_success", "client", "Operation completed");
      return result;
    } else {
      logEvent("WARN", "api_request_failed", "client", "Error: " + result.error);
      return result;
    }
    
  } catch (error) {
    logEvent("ERROR", "api_request_error", "client", "Error: " + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

## 🚫 КРИТИЧЕСКИЕ ОШИБКИ В ПРОШЛОМ

### Ошибка #1: Nested Template Literals
**Файлы:** `server.gs` functions `getServerHealthHtml()`, `getAdminPanelHtml()`
**Проблема:** Nested `${expression}` внутри template literals
**Симптом:** Runtime error при вызове HTML generation функций
**Решение:** Конвертация в string concatenation

### Ошибка #2: VK API Token Fields  
**Файлы:** `server.gs` multiple functions
**Проблема:** Использование `VK_SERVICE_KEY` вместо `VK_APP_SECRET`
**Симптом:** VK API authentication failures
**Решение:** Обновление названий полей токенов

---

## ✅ ПРОВЕРОЧНЫЙ ЧЕК-ЛИСТ

Перед коммитом проверьте:

- [ ] **Нет template literals с `${...}` в HTML generation функциях**
- [ ] **Все циклы используют `function() {}` вместо arrow functions**  
- [ ] **Все переменные объявлены через `var`**
- [ ] **Нет destructuring assignments**
- [ ] **Нет spread operators**
- [ ] **HTML экранирован через escapeHtml()**
- [ ] **Все API вызовы имеют timeout и error handling**
- [ ] **Логирование добавлено для debugging**

---

## 🛠 БЫСТРЫЙ FIX REFERENCE

### Replace Template Literals:
```bash
# Find all template literals in HTML functions
grep -n "\${" *.gs

# Pattern to replace:
# FIND: `<tag>${expression}</tag>`  
# REPLACE: '<tag>' + expression + '</tag>'
```

### Replace Arrow Functions:
```bash  
# Find arrow functions
grep -n "=>" *.gs

# Pattern to replace:
# FIND: items.forEach(item => {...})
# REPLACE: items.forEach(function(item) {...})
```

### Replace const/let:
```bash
# Find const/let declarations  
grep -n "^const\|^let" *.gs

# Pattern to replace:
# FIND: const VARIABLE = value;
# REPLACE: var VARIABLE = value;
```

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

- [Google Apps Script JavaScript Features](https://developers.google.com/apps-script/guides/v8-runtime)
- [HTML Service Best Practices](https://developers.google.com/apps-script/guides/html-service-best-practices)  
- [URL Fetch Service](https://developers.google.com/apps-script/reference/url-fetch)

---

**⚠️ ВАЖНО:** Это руководство основано на реальных проблемах, которые возникали в этом проекте. Следование этим правилам предотвратит 99% ошибок времени выполнения в GAS.

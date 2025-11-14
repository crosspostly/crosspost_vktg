# 📚 LIBRARY EXTRACTION PLAN → УНИВЕРСАЛЬНАЯ БИБЛИОТЕКА МОДУЛЕЙ

**Дата создания:** 6 ноября 2025, 07:00 MSK
**Источник:** crosspost_vktg v6.0 Production-Ready codebase
**Цель:** Извлечь универсальные модули для переиспользования в других проектах
**Принцип:** Создать библиотеку готовых блоков для ускорения разработки

---

## 🎯 КОНЦЕПЦИЯ

### **От монолита к библиотеке**

Текущий проект **crosspost_vktg** содержит множество универсальных компонентов, которые можно переиспользовать в других проектах:
- ✅ Логирование и мониторинг
- ✅ Лицензирование и аутентификация  
- ✅ Работа с Google Sheets
- ✅ VK API интеграция
- ✅ Telegram API интеграция
- ✅ Кеширование и оптимизация
- ✅ Published/Sent tracking система

**ЗАДАЧА:** Не разбивать текущий проект на модули, а **ИЗВЛЕЧЬ** переиспользуемые компоненты в отдельную библиотеку.

---

## 📁 АРХИТЕКТУРА БИБЛИОТЕКИ

### **Структура верхнего уровня:**

```
gas-reusable-lib/  (Google Apps Script Reusable Library)
├── core/              # Базовые утилиты
│   ├── gas-logger.gs
│   ├── gas-sheets-manager.gs
│   ├── gas-validator.gs
│   ├── gas-cache-manager.gs
│   └── gas-utils.gs
├── integrations/      # API интеграции
│   ├── vk-api-client.gs
│   ├── telegram-api-client.gs
│   └── README.md
├── storage/           # Системы хранения
│   ├── published-tracker.gs
│   ├── bindings-manager.gs
│   └── README.md
├── auth/              # Аутентификация
│   ├── license-system.gs
│   ├── token-manager.gs
│   └── README.md
├── templates/         # Готовые шаблоны
│   ├── crossposting-template.gs
│   ├── bot-template.gs
│   └── README.md
└── README.md          # Главная документация
```

---

## 🔧 МОДУЛИ ДЛЯ ИЗВЛЕЧЕНИЯ

### **1. CORE UTILITIES**

#### **Модуль: `gas-logger.gs`**

**Что извлечь из crosspost_vktg:**
```javascript
// Из utils.gs и license-service.gs:
function logEvent(level, event, user, details, ip)
function logApiError(service, endpoint, request, response)
function cleanOldLogs()
// + Структура Logs листа
```

**Унифицированная версия:**
```javascript
/**
 * Universal Logger for Google Apps Script
 * Supports multiple logging levels and automatic cleanup
 */
class GASLogger {
  constructor(config = {}) {
    this.sheetName = config.sheetName || 'Logs';
    this.retention = config.retention || 30; // days
    this.levels = config.levels || ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    this.maxRows = config.maxRows || 10000;
  }
  
  /**
   * Log event with level, user, and details
   */
  log(level, event, user, details, ip = null) {
    const sheet = this._getOrCreateSheet();
    const timestamp = new Date();
    
    sheet.appendRow([
      timestamp,
      level,
      event,
      user || 'system',
      JSON.stringify(details),
      ip || this._getClientIp()
    ]);
    
    // Auto-cleanup if needed
    if (sheet.getLastRow() > this.maxRows) {
      this.clean(this.retention);
    }
  }
  
  /**
   * Log API errors with request/response details
   */
  error(service, endpoint, request, response) {
    this.log('ERROR', `${service}_api_error`, 'system', {
      endpoint: endpoint,
      request: request,
      response: response,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Clean logs older than N days
   */
  clean(days = this.retention) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(this.sheetName);
    if (!sheet) return;
    
    const data = sheet.getDataRange().getValues();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let deleteCount = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      if (new Date(data[i][0]) < cutoffDate) {
        sheet.deleteRow(i + 1);
        deleteCount++;
      }
    }
    
    return { deleted: deleteCount, remaining: sheet.getLastRow() - 1 };
  }
  
  _getOrCreateSheet() {
    // Implementation...
  }
  
  _getClientIp() {
    // Implementation...
  }
}

// Factory function for easy usage
function createLogger(config) {
  return new GASLogger(config);
}
```

**Применение в других проектах:**
- Любой Apps Script проект с логированием
- Интеграции с внешними API
- Административные панели
- Системы мониторинга

**Пример использования:**
```javascript
// В новом проекте:
const logger = createLogger({ 
  sheetName: 'AppLogs',
  retention: 60 
});

logger.log('INFO', 'user_login', userId, { action: 'login_success' });
logger.error('VK_API', '/wall.get', request, response);
```

---

#### **Модуль: `gas-sheets-manager.gs`**

**Что извлечь:**
```javascript
function createSheet(name, headers)
function getSheet(name)
function ensureSheetExists(name, headers)
function sanitizeSheetName(name)
// + Auto-migration логика из bindings
```

**Унифицированная версия:**
```javascript
class GASSheetsManager {
  constructor(spreadsheet = SpreadsheetApp.getActiveSpreadsheet()) {
    this.ss = spreadsheet;
  }
  
  /**
   * Create sheet with headers and formatting
   */
  create(name, headers, formatting = {}) {
    const safeName = this.sanitizeName(name);
    let sheet = this.ss.getSheetByName(safeName);
    
    if (!sheet) {
      sheet = this.ss.insertSheet(safeName);
      if (headers && headers.length > 0) {
        sheet.appendRow(headers);
        // Apply formatting
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground(formatting.headerBg || '#4285f4');
        headerRange.setFontColor(formatting.headerColor || '#ffffff');
      }
    }
    return sheet;
  }
  
  /**
   * Auto-migrate sheet structure
   */
  migrate(sheetName, targetColumns) {
    const sheet = this.ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() === 0) return false;
    
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missingColumns = targetColumns.filter(col => !currentHeaders.includes(col));
    
    if (missingColumns.length > 0) {
      const lastCol = sheet.getLastColumn();
      missingColumns.forEach((col, index) => {
        sheet.getRange(1, lastCol + index + 1).setValue(col);
      });
      return { migrated: true, added: missingColumns };
    }
    return { migrated: false };
  }
  
  /**
   * Batch operations for performance
   */
  batchWrite(sheetName, data, startRow = 2) {
    const sheet = this.get(sheetName);
    if (!sheet || data.length === 0) return;
    
    const range = sheet.getRange(startRow, 1, data.length, data[0].length);
    range.setValues(data);
  }
  
  get(name) {
    return this.ss.getSheetByName(name);
  }
  
  sanitizeName(name) {
    return name.replace(/[\[\]\*\?\/\\:]/g, '_').substring(0, 100);
  }
}
```

---

### **2. INTEGRATIONS**

#### **Модуль: `vk-api-client.gs`** ⭐ **КЛЮЧЕВОЙ МОДУЛЬ**

**Что извлечь:**
```javascript
// VK API методы:
getVkPosts(groupId, count)
getVkMediaUrls(attachments) 
getVkVideoDirectUrl(videoId)  // ⚡ Уникальная функция!
getBestPhotoUrl(sizes)

// Utilities:
extractVkGroupId(url)
resolveVkScreenName(screenName)
getVkGroupName(groupId)
formatVkTextForTelegram(text)
processVkLinks(text)
```

**Унифицированная версия:**
```javascript
class VKClient {
  constructor(userToken, apiVersion = '5.131') {
    this.token = userToken;
    this.version = apiVersion;
    this.baseUrl = 'https://api.vk.com/method';
    this.cache = new Map();
  }
  
  // Group methods
  groups = {
    getById: (groupId) => this._call('groups.getById', { group_id: Math.abs(groupId) }),
    
    getWall: (groupId, options = {}) => {
      const params = {
        owner_id: groupId,
        count: options.count || 10,
        offset: options.offset || 0,
        filter: options.filter || 'all'
      };
      return this._call('wall.get', params);
    },
    
    resolve: (screenName) => {
      return this._call('utils.resolveScreenName', { screen_name: screenName });
    }
  };
  
  // Video methods - KEY FEATURE!
  video = {
    get: (videoId, ownerId) => {
      const params = { videos: `${ownerId}_${videoId}` };
      return this._call('video.get', params);
    },
    
    /**
     * Get direct video URL - unique feature from crosspost_vktg!
     * Finds the best quality available
     */
    getDirectUrl: async (videoId) => {
      try {
        const [ownerId, postId] = videoId.split('_');
        const response = await this.get(postId, ownerId);
        
        if (!response || !response.items || response.items.length === 0) {
          return null;
        }
        
        const video = response.items[0];
        const qualities = ['player', 'mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
        
        for (const quality of qualities) {
          if (video.files && video.files[quality]) {
            return video.files[quality];
          }
        }
        
        return video.player || null;
      } catch (error) {
        Logger.log(`VK Video URL error: ${error.message}`);
        return null;
      }
    }
  };
  
  // Utilities
  utils = {
    extractId: (url) => {
      // Extract VK group/user ID from URL
      const patterns = [
        /vk\.com\/(?:club|public)(\d+)/,
        /vk\.com\/([a-zA-Z0-9_]+)/
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          if (match[1].match(/^\d+$/)) {
            return -parseInt(match[1]);
          }
          return match[1]; // screen_name
        }
      }
      return null;
    },
    
    formatTextForTelegram: (vkText) => {
      if (!vkText) return '';
      
      let formatted = vkText;
      // Remove VK-specific formatting
      formatted = formatted.replace(/\[club(\d+)\|([^\]]+)\]/g, '$2');
      formatted = formatted.replace(/\[id(\d+)\|([^\]]+)\]/g, '$2');
      // Convert links
      formatted = formatted.replace(/\[([^|]+)\|([^\]]+)\]/g, '$2 ($1)');
      
      return formatted;
    }
  };
  
  // Internal API call method
  async _call(method, params = {}) {
    const url = `${this.baseUrl}/${method}`;
    const payload = {
      ...params,
      access_token: this.token,
      v: this.version
    };
    
    const options = {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(url, options);
      const json = JSON.parse(response.getContentText());
      
      if (json.error) {
        throw new Error(`VK API Error: ${json.error.error_msg}`);
      }
      
      return json.response;
    } catch (error) {
      Logger.log(`VK API call failed: ${error.message}`);
      throw error;
    }
  }
}
```

**Применение:**
- Любые интеграции VK → другие платформы
- VK боты
- Аналитика VK групп
- Парсинг VK контента

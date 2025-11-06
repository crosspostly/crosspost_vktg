# VK→Telegram Crossposter - Архитектурная документация

## 🚫 КРИТИЧЕСКОЕ ПРАВИЛО

**ЕДИНСТВЕННЫЙ источник правды** по состоянию постинга для каждого сообщества VK — это **ЛИСТ Published_{BindingName}** в таблице пользователя.

**НИКАКОГО кеширования** в PropertiesService / CacheService для:
- Параметров сообществ VK
- Последних ID постов
- Дедупликации постов
- Превью и ссылок на посты

**Абсолютно. Любые операции — ЧИТАТЬ/ПИСАТЬ ТОЛЬКО В ЛИСТЫ Published.**

---

## 🏗️ Общая архитектура системы

### Компоненты системы
1. **CLIENT.gs** - Клиентская часть (Google Sheets UI + автоматизация)
2. **SERVER.gs** - Серверная часть (Google Apps Script Web App)
3. **Published листы** - Система отслеживания отправленных постов

### Принципы работы
- **Serverless архитектура**: Весь код выполняется в Google Apps Script
- **Централизованное управление**: Один сервер для всех пользователей
- **Безопасность**: Все токены VK и Telegram хранятся только на сервере
- **Лицензионная система**: Контроль доступа через лицензионные ключи

---

## 🔄 Поток данных

```
VK API ← SERVER.gs → Telegram API
   ↑         ↓           ↓
   └── USER TOKEN    BOT TOKEN
           ↑             ↓
      CLIENT.gs ←→ Google Sheets
           ↑             ↓
      USER LICENSE → Published листы
```

### Процесс кросспостинга
1. **CLIENT**: Триггер каждые 30 минут вызывает `checkNewPosts()`
2. **CLIENT**: Извлекает `vk_group_id` из URL и вызывает `handleGetVkPosts(vk_group_id)`
3. **SERVER**: Валидирует `vk_group_id` и получает посты из VK API с User Token
4. **CLIENT**: Сравнивает с последними ID в Published листах формата `Published_{BindingName}`
5. **SERVER**: Отправляет новые посты в Telegram через оптимизированную медиа-стратегию
6. **CLIENT**: Записывает отправленные посты в Published листы с VK Post URL
7. **SERVER**: Кеширует названия VK/TG для производительности (`getCachedVkGroupName`, `getCachedTelegramChatName`)

---

## 💾 Система хранения данных

### 🧭 Правила Published и логирования
- Для каждой связки создаётся лист с именем, **строго равным bindingName** (никаких приставок или суффиксов).
- Новые записи добавляются **сразу после заголовка** (строка 2), чтобы самые свежие посты и логи всегда были **видны наверху листа**.
- Dev note: `sheet.insertRowAfter(1)` → BindingName — имя листа; новые публикации — строка 2 (верх листа).

### ✅ Оптимизированное хранение с гибридным подходом

**Текущая стратегия:** Основные данные хранятся в Published листах, временный кеш используется для оптимизации производительности:

```javascript
// ✅ Основное хранение - Published листы:
function getLastPostIdFromSheet(bindingName, vkGroupId)
function saveLastPostIdToSheet(bindingName, vkGroupId, postId)

// ✅ Временный кеш - для названий групп/каналов:
function getCachedVkGroupName(vkGroupId)      // CacheService TTL 6 часов
function getCachedTelegramChatName(chatId)   // CacheService TTL 6 часов
```

**Назначение кеша:**
- **Названия VK групп**: предотвращает повторные API вызовы к groups.getById
- **Названия TG каналов**: избегает излишних запросов к getChat
- **НЕ кешируется**: ID постов, дедупликация, состояние публикации

### ✅ Трёхуровневая система без Properties кеша

#### Уровень 1: Память (CacheService) - Временное хранение
- **Логи системы**: `SYSTEM_LOGS` с TTL 24 часа
- **Статус автообработки**: `AUTO_PROCESSING_STATUS`
- **Время жизни**: До 6 часов (лимит Google Apps Script)

#### Уровень 2: Published листы - Постоянное хранение постов
- **Формат имени**: `bindingName` (строго без приставок и суффиксов, допускается только безопасная очистка символов)
- **Колонки**: Post ID, Sent At, TG Chat Name, Status, Source, Post Preview, VK Post URL
- **Назначение**: Дедупликация постов, статистика, аудит отправок

#### Уровень 3: Сервер - Централизованные данные
- **Лист Licenses**: Управление лицензиями пользователей
- **Лист Bindings**: Связки VK→Telegram с настройками форматирования, включая `Binding Name` и `Binding Description`
- **Лист Logs**: Системные логи сервера
- **ScriptProperties**: Конфигурация токенов (BOT_TOKEN, VK_USER_ACCESS_TOKEN)
- **Миграция данных**: `migrateBindingsSheet()` для обновления структуры листов

---

## 🚫 КРИТИЧНО #12: VK ВИДЕО — ПРЯМЫЕ ФАЙЛЫ

### ❌ Проблема
- Отправляются embed ссылки `video_ext.php` вместо прямых файлов
- Нет поддержки прямого скачивания видео для Telegram

### ✅ Решение через VK API video.get
**Метод:** `video.get` ([документация](https://dev.vk.com/method/video.get))

**Запрос:**
```
GET https://api.vk.com/method/video.get
Параметры:
- videos: "{owner_id}_{video_id}" (например: "-22822305_456242110")
- v: "5.131"
- access_token: USER_TOKEN (обязательно!)

Ответ содержит поле files:
{
  "response": {
    "items": [{
      "files": {
        "mp4_720": "https://vk.com/video_file_720p_url",
        "mp4_480": "https://vk.com/video_file_480p_url", 
        "mp4_360": "https://vk.com/video_file_360p_url",
        "hls": "https://vk.com/hls_stream_url"
      }
    }]
  }
}
```

**Приоритет качества:** `mp4_720` → `mp4_480` → `mp4_360` → `hls` (крайний случай)

### Реализация в SERVER.gs

```javascript
function getVkVideoDirectUrl(videoId) {
  try {
    const userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    if (!userToken) return null;
    
    const response = UrlFetchApp.fetch(
      `https://api.vk.com/method/video.get?videos=${encodeURIComponent(videoId)}&v=5.131&access_token=${userToken}`,
      { muteHttpExceptions: true, timeout: 15000 }
    );
    
    const data = JSON.parse(response.getContentText());
    if (data.error || !data.response?.items?.[0]?.files) return null;
    
    const files = data.response.items[0].files;
    const qualities = ['mp4_720', 'mp4_480', 'mp4_360', 'hls'];
    
    for (const quality of qualities) {
      if (files[quality]) return files[quality];
    }
    
    return null;
  } catch (error) {
    logEvent("ERROR", "video_direct_url_error", "server", `Video ${videoId}: ${error.message}`);
    return null;
  }
}
```

### Отправка в Telegram
**Метод:** `sendVideo` ([документация](https://core.telegram.org/bots/api#sendvideo))

**Формат запроса:**
```
POST https://api.telegram.org/bot<TOKEN>/sendVideo
Content-Type: application/json

{
  "chat_id": "-1001234567890",
  "video": "https://direct_video_url.mp4",
  "caption": "Текст поста",
  "parse_mode": "Markdown",
  "supports_streaming": true
}
```

**Для больших файлов (>50MB):** использовать multipart/form-data вместо URL

---

## 🚫 КРИТИЧНО #13: МЕДИАГРУППЫ И СМЕШАННЫЙ КОНТЕНТ

### ❌ Проблема
- Фото отправляются по одному
- Смешанные вложения дробятся на много сообщений

### ✅ Стратегия "минимум сообщений"

#### Telegram ограничения:
- **MediaGroup**: только фото/видео ОДНОГО типа (только фото ИЛИ только видео)
- **Максимум**: 10 элементов в MediaGroup
- **Caption**: только у первого элемента MediaGroup
- **Смешанный контент**: требует несколько запросов

#### Оптимальная стратегия отправки:

1. **Только фото** (1-10 шт):
   ```
   1 запрос: sendMediaGroup(photos[], caption в первом)
   ```

2. **Только видео** (1 шт):
   ```  
   1 запрос: sendVideo(direct_url, caption)
   ```

3. **Только видео** (>1 шт):
   ```
   N запросов: sendVideo для каждого (caption только в первом)
   ```

4. **Фото + видео**:
   ```
   Вариант A (1 видео + ≤9 фото):
   - sendVideo(video_url, caption) 
   - sendMediaGroup(photos[], без caption)
   
   Вариант B (>1 видео):
   - sendVideo для каждого видео
   - sendMediaGroup(photos[], без caption)
   ```

5. **Документы/аудио**:
   ```
   Отдельные запросы: sendDocument(), sendAudio()
   ```

### Реализация в SERVER.gs

## Оптимизация MediaGroup ✅

**sendMixedMediaOptimized()** - реализована
- Группирует до 10 фото в один MediaGroup
- Экономия API запросов: вместо N запросов = 1 запрос
- Производительность: ускорение отправки в N раз
- Использование: автоматически в sendVkPostToTelegram()

**Пример работы:**
- 10 фото = 1 API запрос (экономия 90%)
- 20 фото = 2 API запроса (экономия 90%)

```javascript
function sendMixedMediaOptimized(botToken, chatId, mediaUrls, caption, options) {
  // Группирует фото по MAX_MEDIA_GROUP_SIZE (10)
  // Отправляет каждую группу ОДНИМ запросом
  // Видео и документы отправляет отдельно
  // Возвращает статистику оптимизации
}
```

### Предыдущая реализация (сохранена для совместимости)

```javascript
function sendMixedMediaOptimized(botToken, chatId, mediaData, caption) {
  const { photos, videos, docLinks, audioLinks } = mediaData;
  const results = [];
  
  try {
    // 1. Видео первыми (с caption только у первого)
    for (let i = 0; i < videos.length; i++) {
      const videoCaption = (i === 0 && !photos.length) ? caption : null;
      const result = sendTelegramVideo(botToken, chatId, videos[i].url, videoCaption);
      results.push(result);
    }
    
    // 2. Фото группой (caption только если не было видео)
    if (photos.length > 0) {
      const photoCaption = videos.length === 0 ? caption : null;
      const result = sendTelegramMediaGroup(botToken, chatId, photos, photoCaption);
      results.push(result);
    }
    
    // 3. Текст отдельно если был только в caption и медиа его "съело"
    if (caption && videos.length === 0 && photos.length === 0) {
      const result = sendTelegramMessage(botToken, chatId, caption);
      results.push(result);
    }
    
    // 4. Документы и аудио отдельными сообщениями
    // (реализация sendDocument/sendAudio...)
    
    return {
      success: results.every(r => r.success),
      message_ids: results.filter(r => r.success).map(r => r.message_id),
      errors: results.filter(r => !r.success).map(r => r.error)
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function sendTelegramVideo(token, chatId, videoUrl, caption) {
  const payload = {
    chat_id: chatId,
    video: videoUrl,
    caption: caption || undefined,
    parse_mode: caption ? 'Markdown' : undefined,
    supports_streaming: true
  };
  
  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: 30000
  });
  
  const result = JSON.parse(response.getContentText());
  
  return result.ok 
    ? { success: true, message_id: result.result.message_id }
    : { success: false, error: result.description };
}
```

### Обновлённый getVkMediaUrls()

```javascript
function getVkMediaUrls(attachments) {
  const result = {
    photos: [],
    videos: [],      // ← Изменено: direct URLs через video.get
    docLinks: [],
    audioLinks: []
  };
  
  for (const attachment of attachments) {
    switch (attachment.type) {
      case "photo":
        const photoUrl = getBestPhotoUrl(attachment.photo.sizes);
        if (photoUrl) result.photos.push({ type: "photo", url: photoUrl });
        break;
        
      case "video":
        const videoId = `${attachment.video.owner_id}_${attachment.video.id}`;
        const directUrl = getVkVideoDirectUrl(videoId);  // ← Ключевое изменение!
        
        if (directUrl) {
          result.videos.push({ type: "video", url: directUrl, id: videoId });
        } else {
          // Fallback на embed если direct URL недоступен
          result.docLinks.push(`🎥 [Видео](https://vk.com/video${videoId})`);
        }
        break;
        
      // ... остальные типы без изменений
    }
  }
  
  return result;
}
```

---

## 🔗 URL Processing и извлечение ID

### CLIENT: extractSheetNameFromVkUrl()
**Назначение:** Создание безопасных имён листов из VK URL

**Поддерживаемые форматы:**
```
✅ https://vk.com/public123456 → "public123456"
✅ https://vk.com/club789012 → "club789012"  
✅ https://vk.com/durov → "durov"
✅ https://vk.com/varsmana → "varsmana"
✅ vk.com/apiclub → "apiclub"
✅ VK.COM/PUBLIC999888 → "public999888"
```

**Требования:**
- Удаление спецсимволов для Google Sheets: `[^\w\s\-_а-яА-ЯёЁ]`
- Замена пробелов на подчёркивания: `\s+` → `_`
- Лимит длины: 27 символов (для `Published_Name`)
- Fallback на VK Group ID если screen_name недоступен

**Пример реализации:**
```javascript
function extractSheetNameFromVkUrl(url) {
  if (!url) return null;
  
  const cleanUrl = url.trim().toLowerCase().split('?')[0].split('#')[0];
  
  // public123456, club789012
  const idMatch = cleanUrl.match(/(?:public|club)(\d+)/);
  if (idMatch) return `${idMatch[0]}`;
  
  // durov, varsmana, apiclub
  const nameMatch = cleanUrl.match(/vk\.com\/([a-z0-9_]+)/);
  if (nameMatch) {
    return nameMatch[1]
      .replace(/[^\w\s\-_а-яА-ЯёЁ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 27);
  }
  
  return null;
}
```

### SERVER: extractVkGroupId() + resolveVkScreenName()
**Назначение:** Точное извлечение VK Group ID через API

**VK API utils.resolveScreenName** ([документация](https://dev.vk.com/method/utils.resolveScreenName)):
```
GET https://api.vk.com/method/utils.resolveScreenName
Параметры:
- screen_name: "durov", "apiclub", "varsmana"
- v: "5.131" 
- access_token: USER_TOKEN

Ответ:
{
  "response": {
    "type": "group",  // user, group, event, page
    "object_id": 123456
  }
}
```

**Логика преобразования:**
- Для групп: добавляем минус → `-123456`
- Для пользователей: оставляем как есть → `123456`

**Пример реализации:**
```javascript
function resolveVkScreenName(screenName) {
  const userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
  
  const response = UrlFetchApp.fetch(
    `https://api.vk.com/method/utils.resolveScreenName?screen_name=${screenName}&v=5.131&access_token=${userToken}`,
    { muteHttpExceptions: true, timeout: 10000 }
  );
  
  const data = JSON.parse(response.getContentText());
  
  if (data.error) throw new Error(`VK API Error: ${data.error.error_msg}`);
  if (!data.response) throw new Error(`Not found: ${screenName}`);
  
  const objectId = data.response.object_id;
  const type = data.response.type;
  
  return (type === 'group' || type === 'page') ? `-${objectId}` : objectId.toString();
}
```

### CLIENT: extractTelegramChatId()
**Назначение:** Обработка всех Telegram форматов

**Поддерживаемые форматы:**
```
✅ @channelname → "@channelname"
✅ https://t.me/channelname → "@channelname"
✅ t.me/username → "@username"  
✅ channelname → "@channelname"
✅ -1001234567890 → "-1001234567890"
✅ 123456789 → "123456789"
```

**Пример реализации:**
```javascript
function extractTelegramChatId(input) {
  if (!input) throw new Error('Empty Telegram input');
  
  const cleanInput = input.trim();
  
  // Уже chat_id (число)
  if (/^-?\d+$/.test(cleanInput)) return cleanInput;
  
  // Извлекаем username из разных форматов
  const patterns = [
    /t\.me\/([a-z0-9_]+)/i,  // t.me/username
    /@([a-z0-9_]+)/i,        // @username
    /^([a-z0-9_]+)$/i        // username
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) return '@' + match[1];
  }
  
  throw new Error('Invalid Telegram format: ' + input);
}
```

---

## 🔄 Обновлённые API Endpoints

### Основные изменения в API:
- **handleGetVkPosts()**: теперь принимает `vk_group_id` (не только `vk_group_url`)
- **handlePublishLastPost()**: новый endpoint для публикации последнего поста
- **getUserBindingsWithNames()**: возвращает связки с кешированными названиями

### Enhanced API Flow:
```javascript
// CLIENT → SERVER запросы
POST /exec
{
  "event": "get_vk_posts",
  "license_key": "...",
  "vk_group_id": "-123456",  // ← НОВОЕ: прямой ID вместо URL
  "count": 50
}

POST /exec  
{
  "event": "publish_last_post",  // ← НОВЫЙ endpoint
  "license_key": "...",
  "vk_group_id": "-123456",
  "binding_id": "binding_123"
}
```

---

## 🛠️ API Reference

### VK API Методы

#### utils.resolveScreenName
**URL:** `https://api.vk.com/method/utils.resolveScreenName`
**Параметры:**
- `screen_name` (string, обязательный) - короткое имя
- `v` (string) - версия API (5.131)
- `access_token` (string) - пользовательский токен

**Ответ:**
```json
{
  "response": {
    "type": "group|user|event|page|application|vk_app",
    "object_id": 123456
  }
}
```

#### video.get
**URL:** `https://api.vk.com/method/video.get`
**Параметры:**
- `videos` (string) - ID видео в формате "{owner_id}_{video_id}"
- `v` (string) - версия API
- `access_token` (string) - пользовательский токен (обязательно!)

**Ответ с прямыми ссылками:**
```json
{
  "response": {
    "items": [{
      "files": {
        "mp4_720": "https://...direct_url_720p.mp4",
        "mp4_480": "https://...direct_url_480p.mp4",
        "mp4_360": "https://...direct_url_360p.mp4",
        "hls": "https://...stream.m3u8"
      },
      "title": "Название видео",
      "duration": 180
    }]
  }
}
```

### Telegram Bot API Методы

#### sendVideo
**URL:** `https://api.telegram.org/bot<token>/sendVideo`
**Параметры:**
- `chat_id` (string) - ID чата
- `video` (string) - URL файла или InputFile
- `caption` (string, опционально) - подпись до 1024 символов
- `parse_mode` (string) - "Markdown" или "HTML"
- `supports_streaming` (boolean) - true для видео

#### sendMediaGroup  
**URL:** `https://api.telegram.org/bot<token>/sendMediaGroup`
**Ограничения:**
- Только фото ИЛИ только видео (не смешивать)
- Максимум 10 элементов
- Caption только у первого элемента

**Пример:**
```json
{
  "chat_id": "-1001234567890",
  "media": [
    {
      "type": "photo",
      "media": "https://photo1.jpg",
      "caption": "Текст поста",
      "parse_mode": "Markdown"
    },
    {
      "type": "photo", 
      "media": "https://photo2.jpg"
    }
  ]
}
```

---

## 📊 Примеры использования

### Сценарий 1: VK пост с 5 фотографиями
**Обработка:**
1. `getVkMediaUrls()` → `photos: [url1, url2, url3, url4, url5]`
2. `sendMixedMediaOptimized()` → 1 запрос `sendMediaGroup`
3. Результат: 1 сообщение в Telegram с медиагруппой

### Сценарий 2: VK пост с видео + 3 фотографии  
**Обработка:**
1. `getVkMediaUrls()` → `videos: [direct_url]`, `photos: [url1, url2, url3]`
2. `sendMixedMediaOptimized()` → `sendVideo` + `sendMediaGroup`
3. Результат: 2 сообщения в Telegram

### Сценарий 3: VK пост только с текстом
**Обработка:**
1. `formatVkPostForTelegram()` → отформатированный текст
2. `sendTelegramMessage()` → 1 запрос
3. Результат: 1 текстовое сообщение

---

## 🔧 Google Apps Script специфика

### Multipart загрузка для больших видео
```javascript
function sendVideoMultipart(token, chatId, videoUrl, caption) {
  // Скачиваем видео
  const videoBlob = UrlFetchApp.fetch(videoUrl).getBlob();
  
  if (videoBlob.getSize() > 50 * 1024 * 1024) { // >50MB
    throw new Error("Video too large for Telegram (50MB limit)");
  }
  
  // Формируем multipart payload
  const boundary = "----formdata-apps-script-" + Utilities.getUuid();
  const payloadParts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="chat_id"',
    '', 
    chatId,
    `--${boundary}`,
    'Content-Disposition: form-data; name="video"; filename="video.mp4"',
    'Content-Type: video/mp4',
    '',
    videoBlob.getBytes(),
    `--${boundary}--`
  ];
  
  return UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    payload: payloadParts.join('\r\n'),
    muteHttpExceptions: true
  });
}
```

### Rate limiting для API запросов
```javascript
let lastApiCall = 0;
const API_DELAY = 100; // мс между запросами

function rateLimitedFetch(url, options) {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < API_DELAY) {
    Utilities.sleep(API_DELAY - timeSinceLastCall);
  }
  
  lastApiCall = Date.now();
  return UrlFetchApp.fetch(url, options);
}
```

---

## 🎯 Планы оптимизации

### Этап 1: Убрать Properties кеш ✅
- [x] Удалить `getLastPostIds()` / `saveLastPostIds()` 
- [x] Заменить на `getLastPostIdFromSheet()` / `saveLastPostIdToSheet()`
- [x] Обновить `checkNewPosts()` для работы с листами

### Этап 2: URL Processing ✅  
- [x] Реализовать `extractSheetNameFromVkUrl()` для безопасных имён
- [x] Улучшить `extractVkGroupId()` с fallback на API
- [x] Добавить поддержку всех Telegram форматов

### Этап 3: Видео и медиагруппы 🔄
- [ ] Реализовать `getVkVideoDirectUrl()` через `video.get`
- [ ] Создать `sendMixedMediaOptimized()` с оптимальной стратегией
- [ ] Добавить multipart поддержку для больших файлов
- [ ] Тестирование всех сценариев медиа-контента

### Этап 4: Тестирование и документация 📋
- [ ] Unit тесты для URL extraction
- [ ] Integration тесты для медиа-отправки  
- [ ] Обновление README с примерами
- [ ] Чистка дубликатов документации

---

## 📚 Дополнительные ресурсы

- [VK API Reference](https://dev.vk.com/method) - официальная документация
- [Telegram Bot API](https://core.telegram.org/bots/api) - полное описание методов
- [Google Apps Script](https://developers.google.com/apps-script) - платформа выполнения
- [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch) - HTTP клиент для GAS

## 🔍 Отладка и мониторинг

### Логирование
Все операции логируются в лист "Logs" с уровнями:
- **ERROR** - критические ошибки
- **WARN** - предупреждения  
- **INFO** - информационные сообщения
- **DEBUG** - подробная отладка (только в DEV_MODE)

### Мониторинг производительности
- Время ответа VK API
- Время отправки в Telegram
- Количество успешных/неуспешных операций
- Статистика по типам медиа-контента

---

*Документация обновлена: 2025-11-04*
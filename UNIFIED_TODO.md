# 📋 Unified TODO — VK→Telegram Crossposter (Server + Client + Fixes + Code Samples)

Обновлено: 2025-11-03 04:43 MSK
Назначение: ЕДИНЫЙ файл задач. Все прочие todo/readme/to_fix — удалить. Рабочая истина здесь.

---

## ✅ Итоги последнего апдейта (готово к проверке)
- ✅ CLIENT: исправлена передача `vk_group_id` в `getVkPosts()` вместо URL
- ✅ CLIENT: добавлена валидация `validateVkGroupId()` и расширенные логи в `extractVkGroupId()`
- ✅ CLIENT: Published-листы — имена по `bindingName` с fallback на VK Group ID, добавлена колонка "VK Post URL"
- ✅ CLIENT: Collapse/Expand (mini-mode), прогресс-индикаторы, асинхронная подгрузка названий
- ❗ SERVER: требуется обновление обработчика `get_vk_posts` (принимать `vk_group_id`), и миграция Bindings

---

## 🚨 КРИТИЧНЫЕ БАГИ

### 🐛 VK URL Parsing Bug — "посты из левой группы"
Статус: В клиенте исправлено, требуется серверная поддержка.

Проверка:
- [ ] CLIENT: лог `vk_id_extraction` показывает `URL → ID`
- [ ] SERVER: лог `vk_api_request` показывает `owner_id = -<id>`
- [ ] Результат: посты приходят из той же группы, что в связке

---

## 🔧 SERVER (server.gs) — требования к синхронизации

1) Обработчик получения постов
- [ ] doPost(): case `get_vk_posts` — принимать `vk_group_id`, `count`
- [ ] handleGetVkPosts(payload): использовать `owner_id = vk_group_id` (число со знаком)
- [ ] Логи: `vk_api_request` с полным URL (без токена)
- [ ] Валидация: `^-?\d+$` для `vk_group_id`

2) Новые поля связок
- [ ] initializeServer(): обновить структуру листа `Bindings` — добавить `Binding Name`, `Binding Description`
- [ ] handleAddBinding(): сохранять `binding_name`, `binding_description`
- [ ] handleEditBinding(): обновлять новые поля
- [ ] getUserBindingsWithNames(): возвращать новые поля клиенту
- [ ] Миграция: автосоздание недостающих колонок при первом запуске

3) Публикация последнего поста
- [ ] doPost(): case `publish_last_post` → handlePublishLastPost()
- [ ] handlePublishLastPost(): взять последний пост по `vk_group_id` и отправить в TG
- [ ] Использовать `format_settings` связки (boldFirstLine, boldUppercase)
- [ ] Логи: детальный трейс публикации

4) Диагностика и устойчивость
- [ ] Журналировать коды ошибок VK: `5, 10, 15, 200` и тексты
- [ ] Таймауты: FAST(8s)/MEDIUM(15s)/SLOW(30s) по типу операции
- [ ] Fallback: при недоступности названий — возвращать ID/URL, не падать

---

## 🖥️ CLIENT (client.gs) — статус и контрольные тесты

1) VK URL → ID
- [x] extractVkGroupId(url): корректно обрабатывает `?from=groups`, `#hash`, `public/club/id`, числа
- [x] validateVkGroupId(id): проверка формата, длины, логирование ошибок
- [x] checkNewPosts(): вызывает `getVkPosts(vkGroupId)`

2) Published листы
- [x] getOrCreatePublishedPostsSheet(bindingName, vkGroupId)
- [x] markPostAsSent(): `VK Post URL` = `https://vk.com/wall<vkGroupId>_<postId>`
- [ ] Миграция старых листов `Published_-123456` → `Published_GroupName`

3) UI и UX
- [x] Collapse/Expand + mini-status
- [x] Асинхронные имена VK/TG, кеш в браузере
- [x] Прогресс-индикаторы, предупреждения

Тест-кейсы (ручные):
- [ ] club URL с query: `https://vk.com/club96798355?from=groups` → `-96798355`
- [ ] public URL: `https://vk.com/public123` → `-123`
- [ ] numeric `-12345` → `-12345`
- [ ] id URL: `https://vk.com/id123` → `123`

---

## 🛠️ CODE SAMPLES (актуализировано)

```javascript
// CLIENT: передача ID
const vkGroupId = extractVkGroupId(binding.vkGroupUrl);
const posts = getVkPosts(vkGroupId);

// SERVER: чтение ID
function handleGetVkPosts(payload) {
  const { vk_group_id, count = 50 } = payload;
  if (!/^-?\d+$/.test(vk_group_id)) return fail("Invalid vk_group_id");
  const url = `https://api.vk.com/method/wall.get?owner_id=${vk_group_id}&count=${count}&v=${VK_API_VERSION}&access_token=${VK_TOKEN}`;
  logApiCall('VK_API', url);
  // ... fetch, handle errors
}
```

---

## 📊 Статус

### ✅ Готово
- CLIENT: VK URL → ID, передача ID, UI/UX улучшения, листы публикаций, логирование

### 🚧 В работе
- SERVER: `get_vk_posts` по `vk_group_id`, миграция Bindings, publish_last_post

### ⏳ Планируется
- Батчевые названия VK/TG, расширенная обработка ссылок, строгие медиагруппы

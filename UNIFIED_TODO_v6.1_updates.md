# ОБНОВЛЕННЫЕ TODO ДЛЯ CLIENT.GS v6.1

## ✅ ВЫПОЛНЕНО В COMMIT 1-2:

### КРИТИЧНЫЕ ИСПРАВЛЕНИЯ:
- ✅ **LICENSE_CACHE_TTL_MS: 30 минут → 24 часа**
- ✅ **CLIENT_VERSION: 6.0 → 6.1**  
- ✅ **Новая функция getLicenseCached()** - кеширование на 3 уровнях
- ✅ **clearLicenseCache()** - очистка кеша
- ✅ **processVkLinks()** - обработка VK гиперссылок

## 📝 ОСТАЛОСЬ ВЫПОЛНИТЬ:

### COMMIT 3: Исправление template literals в основном client.gs
- ❌ Исправить \`App started, version \${CLIENT_VERSION}\`
- ❌ Исправить \`License key: \${license.key.substring(0, 20)}...\`
- ❌ Исправить все остальные template literals в логах

### COMMIT 4: Замена getLicense() на getLicenseCached()
- ❌ В getInitialData() → `const license = getLicenseCached();`
- ❌ В saveLicenseWithCheck() → оставить как есть (она проверяет)
- ❌ В addBinding() → `const license = getLicenseCached();`
- ❌ В editBinding() → `const license = getLicenseCached();`
- ❌ В deleteBinding() → `const license = getLicenseCached();`
- ❌ В toggleBindingStatus() → `const license = getLicenseCached();`
- ❌ В publishLastPost() → `const license = getLicenseCached();`
- ❌ В setGlobalSetting() → `const license = getLicenseCached();`
- ❌ В getGlobalSetting() → `const license = getLicenseCached();`

### COMMIT 5: Обновление формата листов Published
- ❌ Обновить getOrCreatePublishedPostsSheet() → использовать bindingName
- ❌ Обновить markPostAsSent() → новые колонки + bindingName
- ❌ Обновить isPostAlreadySent() → работа с bindingName

### COMMIT 6: Обработка гиперссылок VK
- ❌ Добавить processVkLinks() в sendPostToServer() перед отправкой
- ❌ Проверить обработку [vk.com/link|текст] формата

### COMMIT 7: Исправление ошибок undefined
- ❌ Добавить проверки на null/undefined во все функции
- ❌ Заменить publishLastPost() на safePickLastPost()
- ❌ Добавить проверку binding.status перед опубликованием

## 🎨 ОПЦИОНАЛЬНО (если время останется):
- 📋 Миграция Published_-123456 → Published_GroupName
- 🌐 Улучшение обработки ошибок сервера
- 📊 Дополнительная статистика

---

**Следующий шаг**: COMMIT 3 - исправление template literals
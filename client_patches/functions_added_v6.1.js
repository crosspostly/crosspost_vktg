/**
 * 📎 НОВЫЕ ФУНКЦИИ CLIENT.GS v6.1
 * Для копипасты в основной файл
 */

// ============================================
// ЛИЦЕНЗИОННЫЙ КЕШ (ЗАМЕНЯЕТ getLicense)
// ============================================

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Кешированная проверка лицензии (24 часа кеш)
 * Работает на 3 уровнях:
 * 1. Память (appState) - мгновенно
 * 2. Properties Service - быстро (24 часа)
 * 3. Сервер - медленно, обновляет кеш
 */
function getLicenseCached(forceRefresh = false) {
  try {
    // 1. Проверяем кеш в памяти (самый быстрый)
    if (!forceRefresh && appState.license && appState.initialized) {
      logEvent("DEBUG", "license_memory_cache_hit", "client", "License from memory cache");
      return appState.license;
    }
    
    const props = PropertiesService.getUserProperties();
    const licenseKey = props.getProperty(USER_PROP_LICENSE_KEY);
    
    if (!licenseKey) {
      logEvent("DEBUG", "no_license_stored", "client", "License key not found in properties");
      appState.license = null;
      appState.initialized = true;
      return null;
    }
    
    // 2. Проверяем метаданные кеша Properties (24 часа)
    const metaJson = props.getProperty(USER_PROP_LICENSE_META);
    if (metaJson && !forceRefresh) {
      try {
        const licenseMeta = JSON.parse(metaJson);
        const now = Date.now();
        const cacheAge = now - licenseMeta.cachedAt;
        
        // Кеш действителен 24 часа (НЕ 30 минут!)
        if (cacheAge < LICENSE_CACHE_TTL_MS) {
          const cacheAgeHours = Math.round(cacheAge / (1000 * 60 * 60));
          logEvent("DEBUG", "license_cache_hit", "client", "License from Properties cache, age: " + cacheAgeHours + "h");
          
          // Сохраняем в память
          appState.license = {
            key: licenseKey,
            type: licenseMeta.type,
            maxGroups: licenseMeta.maxGroups,
            expires: licenseMeta.expires
          };
          appState.initialized = true;
          
          return appState.license;
        }
        
        logEvent("DEBUG", "license_cache_expired", "client", "License cache expired, age: " + Math.round(cacheAge / (1000 * 60)) + "min");
      } catch (parseError) {
        logEvent("WARN", "license_cache_parse_error", "client", parseError.message);
      }
    }
    
    // 3. Кеш устарел - получаем с сервера и обновляем
    logEvent("INFO", "license_server_check", "client", "Fetching license details from server");
    
    const payload = {
      event: "check_license",
      license_key: licenseKey
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: REQUEST_TIMEOUT
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success && result.license) {
      const licenseData = {
        key: licenseKey,
        type: result.license.type,
        maxGroups: result.license.maxGroups,
        expires: result.license.expires
      };
      
      // Сохраняем метаданные в Properties (кеш на 24 часа)
      const newMeta = {
        type: result.license.type,
        maxGroups: result.license.maxGroups,
        expires: result.license.expires,
        cachedAt: Date.now()
      };
      
      props.setProperty(USER_PROP_LICENSE_META, JSON.stringify(newMeta));
      
      // Сохраняем в память
      appState.license = licenseData;
      appState.initialized = true;
      
      logEvent("INFO", "license_cached_refreshed", "client", "License updated: " + result.license.type + ", max: " + result.license.maxGroups);
      
      return licenseData;
    } else {
      logEvent("WARN", "license_verification_failed", "client", result.error || "Unknown server error");
      
      // В случае ошибки возвращаем минимальные данные лицензии
      const fallbackLicense = { key: licenseKey };
      appState.license = fallbackLicense;
      appState.initialized = true;
      
      return fallbackLicense;
    }
    
  } catch (error) {
    logEvent("ERROR", "get_license_cached_error", "client", error.message);
    
    // Пытаемся вернуть хотя бы ключ
    const licenseKey = PropertiesService.getUserProperties().getProperty(USER_PROP_LICENSE_KEY);
    if (licenseKey) {
      const fallbackLicense = { key: licenseKey };
      appState.license = fallbackLicense;
      return fallbackLicense;
    }
    
    return null;
  }
}

/**
 * ✅ Очистка кеша лицензии (для changeLicense)
 */
function clearLicenseCache() {
  try {
    const props = PropertiesService.getUserProperties();
    props.deleteProperty(USER_PROP_LICENSE_KEY);
    props.deleteProperty(USER_PROP_LICENSE_META);
    
    // Очищаем кеш в памяти
    appState.license = null;
    appState.initialized = false;
    
    logEvent("INFO", "license_cache_cleared", "client", "License cache cleared from Properties and memory");
    return { success: true };
    
  } catch (error) {
    logEvent("ERROR", "clear_license_cache_error", "client", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ✅ Обработка VK гиперссылок [url|текст] для Telegram
 */
function processVkLinks(text) {
  if (!text || typeof text !== 'string') return text || '';
  
  // Поиск VK гиперссылок в формате [url|текст]
  const vkLinkPattern = /\[([^\|\]]+)\|([^\]]+)\]/g;
  let replacements = 0;
  
  const processedText = text.replace(vkLinkPattern, function(match, url, linkText) {
    replacements++;
    
    if (url && linkText) {
      // Проверяем на полный URL
      let processedUrl = url.trim();
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        if (processedUrl.startsWith('vk.com/') || processedUrl.startsWith('www.vk.com/')) {
          processedUrl = 'https://' + processedUrl;
        } else if (processedUrl.startsWith('/')) {
          processedUrl = 'https://vk.com' + processedUrl;
        }
      }
      
      // Формат Telegram markdown: [text](url)
      return '[' + linkText.trim() + '](' + processedUrl + ')';
    } else {
      return linkText ? linkText.trim() : match;
    }
  });
  
  if (replacements > 0) {
    logEvent("DEBUG", "vk_links_processed", "client", "Replaced " + replacements + " VK hyperlinks");
  }
  
  return processedText;
}
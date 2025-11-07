/**
 * VK→Telegram Crossposter - LICENSE CORE MODULE
 * Основные функции управления лицензиями
 * 
 * Размер: ~300 строк
 * Зависимости: utils-core.gs, utils-stats.gs
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

// ============================================
// LICENSE MANAGEMENT
// ============================================

function handleCheckLicense(payload, clientIp) {
  try {
    const { license_key } = payload;
    
    if (!license_key) {
      logEvent("WARN", "license_check_missing_key", clientIp, "No license key provided");
      return jsonResponse({
        success: false,
        error: "License key required"
      }, 400);
    }
    
    // Проверяем rate limiting
    if (!checkRateLimit(clientIp, license_key)) {
      logEvent("WARN", "license_rate_limit", clientIp, `Rate limit exceeded for ${license_key}`);
      return jsonResponse({
        success: false,
        error: "Rate limit exceeded. Please try again later."
      }, 429);
    }
    
    // Ищем лицензию
    const license = findLicense(license_key);
    
    if (!license) {
      logEvent("WARN", "license_not_found", clientIp, `License not found: ${license_key}`);
      return jsonResponse({
        success: false,
        error: "Invalid license key"
      }, 404);
    }
    
    // Валидируем лицензию
    const validation = validateLicense(license);
    
    if (!validation.isValid) {
      logEvent("WARN", "license_invalid", clientIp, `Invalid license: ${license_key}, Reason: ${validation.reason}`);
      return jsonResponse({
        success: false,
        error: validation.reason
      }, 403);
    }
    
    logEvent("INFO", "license_valid", clientIp, `License validated: ${license_key}, Type: ${license.type}, Max Groups: ${license.maxGroups}`);
    
    return jsonResponse({
      success: true,
      license: {
        type: license.type,
        maxGroups: license.maxGroups,
        expires: license.expires,
        email: license.email
      }
    });
    
  } catch (error) {
    logEvent("ERROR", "license_check_error", clientIp, error.message);
    return jsonResponse({
      success: false,
      error: "License check failed"
    }, 500);
  }
}

function findLicense(licenseKey) {
  try {
    const licensesSheet = getSheet("Licenses");
    const data = licensesSheet.getDataRange().getValues();
    
    // Пропускаем заголовок
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === licenseKey) { // License Key column
        return {
          key: row[0],
          email: row[1],
          type: row[2],
          maxGroups: parseInt(row[3]) || 1,
          expires: new Date(row[4]),
          createdAt: new Date(row[5]),
          status: row[6],
          notes: row[7]
        };
      }
    }
    
    return null;
    
  } catch (error) {
    logEvent("ERROR", "find_license_error", "system", error.message);
    return null;
  }
}

function validateLicense(license) {
  try {
    // Проверяем статус
    if (license.status !== "active") {
      return {
        isValid: false,
        reason: `License is ${license.status}`
      };
    }
    
    // Проверяем срок действия
    const now = new Date();
    if (license.expires && license.expires < now) {
      return {
        isValid: false,
        reason: "License has expired"
      };
    }
    
    // Проверяем максимальное количество групп
    if (!license.maxGroups || license.maxGroups < 1) {
      return {
        isValid: false,
        reason: "Invalid license configuration"
      };
    }
    
    return {
      isValid: true,
      reason: "License is valid"
    };
    
  } catch (error) {
    logEvent("ERROR", "license_validation_error", "system", error.message);
    return {
      isValid: false,
      reason: "License validation error"
    };
  }
}
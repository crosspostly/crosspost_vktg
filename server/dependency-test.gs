/**
 * VK→Telegram Crossposter - DEPENDENCY TEST
 * Проверка доступности всех функций
 * 
 * Размер: ~50 строк
 * Зависимости: все модули
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

function testDependencies() {
  var results = {
    passed: [],
    failed: [],
    total: 0
  };
  
  // Тестируем базовые функции
  try {
    logEvent("INFO", "dependency_test_start", "system", "Starting dependency test");
    results.passed.push("logEvent");
  } catch (error) {
    results.failed.push(`logEvent: ${error.message}`);
  }
  
  // Тестируем утилиты
  try {
    createSheet("TestSheet", ["Test"]);
    results.passed.push("createSheet");
  } catch (error) {
    results.failed.push(`createSheet: ${error.message}`);
  }
  
  try {
    getSheet("TestSheet");
    results.passed.push("getSheet");
  } catch (error) {
    results.failed.push(`getSheet: ${error.message}`);
  }
  
  // Тестируем JSON
  try {
    jsonResponse({test: true});
    results.passed.push("jsonResponse");
  } catch (error) {
    results.failed.push(`jsonResponse: ${error.message}`);
  }
  
  // Тестируем лицензии
  try {
    findLicense("test_key");
    results.passed.push("findLicense");
  } catch (error) {
    results.failed.push(`findLicense: ${error.message}`);
  }
  
  // Тестируем URL функции
  try {
    extractVkGroupId("https://vk.com/test");
    results.passed.push("extractVkGroupId");
  } catch (error) {
    results.failed.push(`extractVkGroupId: ${error.message}`);
  }
  
  results.total = results.passed.length + results.failed.length;
  
  var summary = `Dependency Test Results:\n`;
  summary += `Total: ${results.total}\n`;
  summary += `Passed: ${results.passed.length}\n`;
  summary += `Failed: ${results.failed.length}\n`;
  
  if (results.failed.length > 0) {
    summary += `\nFailed Functions:\n`;
    summary += results.failed.join("\n");
  }
  
  logEvent("INFO", "dependency_test_complete", "system", summary);
  
  return {
    success: results.failed.length === 0,
    results: results
  };
}
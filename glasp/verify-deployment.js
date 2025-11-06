#!/usr/bin/env node

/**
 * VK→Telegram Crossposter - GLASP VERIFICATION SCRIPT
 * Проверяет что все файлы правильно загружаются в Google Apps Script
 * 
 * Использование: node glasp/verify-deployment.js
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

const fs = require('fs');
const path = require('path');

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const SERVER_DIR = path.join(__dirname, '..', 'server');
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const DIST_DIR = path.join(__dirname, '..', 'dist');

const EXPECTED_SERVER_MODULES = [
  'server.gs',
  'utils.gs', 
  'license-service.gs',
  'bindings-service.gs',
  'published-sheets-service.gs',
  'vk-service.gs',
  'telegram-service.gs',
  'posting-service.gs'
];

const EXPECTED_CLIENT_MODULES = [
  'client-core.gs',
  'client-dev.gs',
  'client-ui.html'
];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function checkFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${description}: ${filePath} - NOT FOUND`);
    return false;
  }
  console.log(`✅ ${description}: ${filePath}`);
  return true;
}

function validateFileSize(filePath, limit) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  
  if (lines > limit) {
    console.warn(`⚠️  ${path.basename(filePath)}: ${lines} lines (>${limit} limit)`);
    return false;
  }
  
  console.log(`✅ ${path.basename(filePath)}: ${lines} lines (≤${limit})`);
  return true;
}

function extractFunctionNames(content) {
  const functionRegex = /function\s+(\w+)/g;
  const functions = [];
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    functions.push(match[1]);
  }
  
  return functions;
}

function validateModule(filePath, expectedFunctions = []) {
  const content = fs.readFileSync(filePath, 'utf8');
  const functions = extractFunctionNames(content);
  
  console.log(`📦 ${path.basename(filePath)}:`);
  console.log(`   Functions: ${functions.length} (${functions.join(', ')})`);
  
  if (expectedFunctions.length > 0) {
    const missing = expectedFunctions.filter(f => !functions.includes(f));
    if (missing.length > 0) {
      console.warn(`   ⚠️  Missing expected functions: ${missing.join(', ')}`);
      return false;
    }
  }
  
  return true;
}

function validateDistFiles() {
  console.log('\n🔍 Проверка сгенерированных файлов...');
  
  const distFiles = [
    'server.gs',
    'client-core.gs', 
    'client-dev.gs',
    'client-ui.html',
    'client-combined.gs'
  ];
  
  let allValid = true;
  
  for (const file of distFiles) {
    const filePath = path.join(DIST_DIR, file);
    if (checkFileExists(filePath, `Dist file: ${file}`)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('TODO: Перенести из')) {
        console.warn(`⚠️  ${file}: Contains TODO comments - refactoring not complete`);
        allValid = false;
      } else {
        console.log(`✅ ${file}: Ready for deployment`);
      }
    } else {
      allValid = false;
    }
  }
  
  return allValid;
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ВЕРИФИКАЦИИ
// ============================================

function verifyDeployment() {
  console.log('🚀 VK→Telegram Crossposter - Glasp Verification');
  console.log('='.repeat(60));
  
  let allChecksPass = true;
  
  // Проверяем структуру папок
  console.log('\n📁 Проверка структуры папок...');
  checkFileExists(SERVER_DIR, 'Server directory');
  checkFileExists(CLIENT_DIR, 'Client directory');
  checkFileExists(DIST_DIR, 'Dist directory');
  
  // Проверяем серверные модули
  console.log('\n🖥️ Проверка серверных модулей...');
  for (const module of EXPECTED_SERVER_MODULES) {
    const modulePath = path.join(SERVER_DIR, module);
    if (checkFileExists(modulePath, `Server module: ${module}`)) {
      if (!validateFileSize(modulePath, 500)) allChecksPass = false;
      if (!validateModule(modulePath)) allChecksPass = false;
    } else {
      allChecksPass = false;
    }
  }
  
  // Проверяем клиентские модули
  console.log('\n📱 Проверка клиентских модулей...');
  for (const module of EXPECTED_CLIENT_MODULES) {
    const modulePath = path.join(CLIENT_DIR, module);
    if (checkFileExists(modulePath, `Client module: ${module}`)) {
      const limit = module.endsWith('.html') ? 2000 : 500;
      if (!validateFileSize(modulePath, limit)) allChecksPass = false;
      if (!validateModule(modulePath)) allChecksPass = false;
    } else {
      allChecksPass = false;
    }
  }
  
  // Проверяем скомпилированные файлы
  if (!validateDistFiles()) allChecksPass = false;
  
  // Проверяем glasp конфигурацию
  console.log('\n⚙️ Проверка Glasp конфигурации...');
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (checkFileExists(packageJsonPath, 'package.json')) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`✅ Package: ${packageJson.name} v${packageJson.version}`);
    console.log(`✅ Scripts: ${Object.keys(packageJson.scripts).join(', ')}`);
  }
  
  const deployServerPath = path.join(__dirname, 'deploy-server.js');
  const deployClientPath = path.join(__dirname, 'deploy-client.js');
  checkFileExists(deployServerPath, 'deploy-server.js');
  checkFileExists(deployClientPath, 'deploy-client.js');
  
  // Итоговый результат
  console.log('\n' + '='.repeat(60));
  if (allChecksPass) {
    console.log('🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!');
    console.log('✅ Glasp setup готов к использованию');
    console.log('✅ Все модули соответствуют требованиям');
    console.log('✅ Структура файлов корректна');
  } else {
    console.log('⚠️  ОБНАРУЖЕНЫ ПРОБЛЕМЫ');
    console.log('❌ Некоторые проверки не пройдены');
    console.log('🔧 См. детали выше для исправления');
  }
  
  console.log('\n📋 Следующие шаги:');
  console.log('1. npm run build:server - Собрать сервер');
  console.log('2. npm run build:client - Собрать клиент');
  console.log('3. npm run build:all - Собрать всё');
  console.log('4. npm run deploy:server -- --deploy - Деплой сервера');
  console.log('5. npm run deploy:client -- --deploy - Деплой клиента');
  
  return allChecksPass;
}

// ============================================
// ЗАПУСК
// ============================================

if (require.main === module) {
  const success = verifyDeployment();
  process.exit(success ? 0 : 1);
}

module.exports = {
  verifyDeployment
};
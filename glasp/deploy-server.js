#!/usr/bin/env node

/**
 * VK→Telegram Crossposter - Server Deployment Script
 * Автоматическая сборка и выгрузка серверных модулей в Google Apps Script
 * 
 * Использование: node glasp/deploy-server.js
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
const OUTPUT_FILE = path.join(__dirname, '..', 'dist', 'server.gs');
const SERVER_MODULES = [
  'server.gs',
  'utils.gs',
  'license-service.gs',
  'bindings-service.gs',
  'published-sheets-service.gs',
  'vk-service.gs',
  'telegram-service.gs',
  'posting-service.gs'
];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readModuleFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading file ${filePath}:`, error.message);
    process.exit(1);
  }
}

function extractFunctionNames(content) {
  // Простое извлечение имен функций для документации
  const functionRegex = /function\s+(\w+)/g;
  const functions = [];
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    functions.push(match[1]);
  }
  
  return functions;
}

function generateModuleHeader(fileName, content) {
  const functions = extractFunctionNames(content);
  const lineCount = content.split('\n').length;
  
  return `
// ============================================
// MODULE: ${fileName}
// Functions: ${functions.length}
// Lines: ${lineCount}
// Functions: ${functions.join(', ')}
// ============================================

`;
}

function validateModuleSize(content, fileName) {
  const lines = content.split('\n').length;
  if (lines > 500) {
    console.warn(`⚠️  Warning: ${fileName} has ${lines} lines (>500 limit)`);
  } else {
    console.log(`✅ ${fileName}: ${lines} lines`);
  }
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ СБОРКИ
// ============================================

function buildServer() {
  console.log('🚀 Building VK→Telegram Server modules...\n');
  
  ensureDirectoryExists(path.dirname(OUTPUT_FILE));
  
  let combinedContent = '';
  let totalLines = 0;
  let totalFunctions = 0;
  
  // Добавляем заголовок
  combinedContent += `/**
 * VK→Telegram Crossposter - SERVER (COMPILED)
 * Автоматически собрано из модулей
 * 
 * Модули: ${SERVER_MODULES.length}
 * Дата сборки: ${new Date().toISOString()}
 * 
 * НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ - ИСПОЛЬЗУЙТЕ МОДУЛИ В ПАПКЕ server/
 */

`;
  
  // Обрабатываем каждый модуль
  for (const moduleFile of SERVER_MODULES) {
    const modulePath = path.join(SERVER_DIR, moduleFile);
    
    if (!fs.existsSync(modulePath)) {
      console.error(`❌ Module not found: ${moduleFile}`);
      process.exit(1);
    }
    
    const content = readModuleFile(modulePath);
    const functions = extractFunctionNames(content);
    const lines = content.split('\n').length;
    
    // Валидация размера
    validateModuleSize(content, moduleFile);
    
    // Добавляем модуль
    combinedContent += generateModuleHeader(moduleFile, content);
    combinedContent += content;
    combinedContent += '\n\n';
    
    totalLines += lines;
    totalFunctions += functions.length;
    
    console.log(`📦 ${moduleFile}: ${lines} lines, ${functions.length} functions`);
  }
  
  // Сохраняем результат
  fs.writeFileSync(OUTPUT_FILE, combinedContent);
  
  // Статистика
  console.log('\n📊 Build Statistics:');
  console.log(`   Total modules: ${SERVER_MODULES.length}`);
  console.log(`   Total lines: ${totalLines}`);
  console.log(`   Total functions: ${totalFunctions}`);
  console.log(`   Output file: ${OUTPUT_FILE}`);
  
  return OUTPUT_FILE;
}

// ============================================
// ФУНКЦИЯ РАЗВЕРТЫВАНИЯ
// ============================================

function deployToAppsScript(filePath) {
  console.log('\n🚀 Deploying to Google Apps Script...');
  
  // TODO: Интегрировать с clasp для автоматической выгрузки
  // clasp push --watch
  
  try {
    // Проверяем наличие clasp
    const { execSync } = require('child_process');
    
    // Компилируем если нужно
    execSync('npx clasp version', { stdio: 'inherit' });
    
    // Выгружаем
    execSync('npx clasp push', { stdio: 'inherit' });
    
    console.log('✅ Successfully deployed to Google Apps Script!');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('   1. Installed clasp: npm install -g @google/clasp');
    console.log('   2. Logged in: clasp login');
    console.log('   3. Initialized project: clasp create --title "VK-Telegram Server"');
    console.log('   4. Updated .clasp.json with correct scriptId');
    
    process.exit(1);
  }
}

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================

function main() {
  try {
    // Собираем модули
    const outputFile = buildServer();
    
    // Развертываем (опционально)
    if (process.argv.includes('--deploy')) {
      deployToAppsScript(outputFile);
    } else {
      console.log('\n💡 To deploy to Google Apps Script, run:');
      console.log('   node glasp/deploy-server.js --deploy');
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Запускаем если файл вызван напрямую
if (require.main === module) {
  main();
}

module.exports = {
  buildServer,
  deployToAppsScript
};
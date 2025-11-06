#!/usr/bin/env node

/**
 * VK→Telegram Crossposter - Client Deployment Script
 * Автоматическая сборка и выгрузка клиентских модулей в Google Apps Script
 * 
 * Использование: node glasp/deploy-client.js
 * 
 * Автор: f_den
 * Дата: 2025-11-06
 */

const fs = require('fs');
const path = require('path');

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CLIENT_DIR = path.join(__dirname, '..', 'client');
const OUTPUT_DIR = path.join(__dirname, '..', 'dist');
const CORE_OUTPUT_FILE = path.join(OUTPUT_DIR, 'client-core.gs');
const DEV_OUTPUT_FILE = path.join(OUTPUT_DIR, 'client-dev.gs');
const UI_OUTPUT_FILE = path.join(OUTPUT_DIR, 'client-ui.html');

const CLIENT_MODULES = [
  { file: 'client-core.gs', output: CORE_OUTPUT_FILE },
  { file: 'client-dev.gs', output: DEV_OUTPUT_FILE },
  { file: 'client-ui.html', output: UI_OUTPUT_FILE }
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
  // Извлечение имен функций (только для .gs файлов)
  if (content.endsWith('.html')) return [];
  
  const functionRegex = /function\s+(\w+)/g;
  const functions = [];
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    functions.push(match[1]);
  }
  
  return functions;
}

function validateModuleSize(content, fileName) {
  const lines = content.split('\n').length;
  
  // Для HTML файла другой лимит
  const limit = fileName.endsWith('.html') ? 2000 : 500;
  
  if (lines > limit) {
    console.warn(`⚠️  Warning: ${fileName} has ${lines} lines (>${limit} limit)`);
  } else {
    console.log(`✅ ${fileName}: ${lines} lines`);
  }
}

function processTemplateVariables(content) {
  // Обработка template variables для HTML
  if (!content.includes('<%=')) return content;
  
  // Заменяем template variables
  return content
    .replace(/<%= SERVER_URL %>/g, '"https://script.google.com/macros/s/YOUR_SERVER_ID/exec"')
    .replace(/<%= CLIENT_VERSION %>/g, '"6.0"');
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ СБОРКИ
// ============================================

function buildClient() {
  console.log('🚀 Building VK→Telegram Client modules...\n');
  
  ensureDirectoryExists(OUTPUT_DIR);
  
  let totalLines = 0;
  let totalFunctions = 0;
  let totalFiles = 0;
  
  // Обрабатываем каждый модуль
  for (const module of CLIENT_MODULES) {
    const modulePath = path.join(CLIENT_DIR, module.file);
    
    if (!fs.existsSync(modulePath)) {
      console.error(`❌ Module not found: ${module.file}`);
      process.exit(1);
    }
    
    let content = readModuleFile(modulePath);
    const originalLines = content.split('\n').length;
    
    // Обработка template variables для HTML
    if (module.file.endsWith('.html')) {
      content = processTemplateVariables(content);
    }
    
    const functions = extractFunctionNames(content);
    const lines = content.split('\n').length;
    
    // Валидация размера
    validateModuleSize(content, module.file);
    
    // Сохраняем результат
    fs.writeFileSync(module.output, content);
    
    totalLines += lines;
    totalFunctions += functions.length;
    totalFiles++;
    
    console.log(`📦 ${module.file}: ${lines} lines, ${functions.length} functions`);
    console.log(`    → ${module.output}`);
  }
  
  // Создаем объединенный client.gs (опционально)
  const combinedClientFile = path.join(OUTPUT_DIR, 'client-combined.gs');
  createCombinedClient(combinedClientFile);
  
  // Статистика
  console.log('\n📊 Build Statistics:');
  console.log(`   Total modules: ${totalFiles}`);
  console.log(`   Total lines: ${totalLines}`);
  console.log(`   Total functions: ${totalFunctions}`);
  console.log(`   Output directory: ${OUTPUT_DIR}`);
  
  return {
    coreFile: CORE_OUTPUT_FILE,
    devFile: DEV_OUTPUT_FILE,
    uiFile: UI_OUTPUT_FILE,
    combinedFile: combinedClientFile
  };
}

function createCombinedClient(outputFile) {
  console.log('\n🔗 Creating combined client file...');
  
  let combinedContent = `/**
 * VK→Telegram Crossposter - CLIENT (COMBINED)
 * Автоматически собрано из модулей
 * 
 * Дата сборки: ${new Date().toISOString()}
 * 
 * НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ - ИСПОЛЬЗУЙТЕ МОДУЛИ В ПАПКЕ client/
 */

`;
  
  // Добавляем client-core.gs
  const coreContent = fs.readFileSync(CORE_OUTPUT_FILE, 'utf8');
  combinedContent += `// ============================================\n`;
  combinedContent += `// CLIENT CORE MODULE\n`;
  combinedContent += `// ============================================\n\n`;
  combinedContent += coreContent;
  combinedContent += '\n\n';
  
  // Добавляем client-dev.gs
  const devContent = fs.readFileSync(DEV_OUTPUT_FILE, 'utf8');
  combinedContent += `// ============================================\n`;
  combinedContent += `// CLIENT DEVELOPMENT MODULE\n`;
  combinedContent += `// ============================================\n\n`;
  combinedContent += devContent;
  
  fs.writeFileSync(outputFile, combinedContent);
  console.log(`✅ Combined client file: ${outputFile}`);
}

// ============================================
// ФУНКЦИЯ РАЗВЕРТЫВАНИЯ
// ============================================

function deployToAppsScript(files) {
  console.log('\n🚀 Deploying to Google Apps Script...');
  
  try {
    const { execSync } = require('child_process');
    
    // Проверяем наличие clasp
    execSync('npx clasp version', { stdio: 'inherit' });
    
    // Выгружаем файлы
    execSync('npx clasp push', { stdio: 'inherit' });
    
    console.log('✅ Successfully deployed to Google Apps Script!');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('   1. Installed clasp: npm install -g @google/clasp');
    console.log('   2. Logged in: clasp login');
    console.log('   3. Initialized project: clasp create --title "VK-Telegram Client"');
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
    const files = buildClient();
    
    // Развертываем (опционально)
    if (process.argv.includes('--deploy')) {
      deployToAppsScript(files);
    } else {
      console.log('\n💡 To deploy to Google Apps Script, run:');
      console.log('   node glasp/deploy-client.js --deploy');
      console.log('\n📁 Generated files:');
      Object.values(files).forEach(file => {
        if (fs.existsSync(file)) {
          console.log(`   ${file}`);
        }
      });
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
  buildClient,
  createCombinedClient
};
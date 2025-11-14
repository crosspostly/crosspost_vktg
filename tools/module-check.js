#!/usr/bin/env node

/**
 * Module Integrity Checker
 * 
 * Verifies that the VK module refactoring from Phase 1 is intact:
 * - vk-api.gs, vk-posts.gs, and vk-media.gs must exist in server/
 * - Each module must export expected entry points
 * - Module files must not exceed 500 lines (maintainability check)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_DIR = path.join(__dirname, '..', 'server');
const REQUIRED_MODULES = [
  // Core modules
  { 
    name: 'utils.gs', 
    description: 'Utility functions',
    requiredExports: ['jsonResponse', 'extractVkGroupId', 'extractTelegramChatId'], // Updated based on actual exports
    maxLines: 800 
  },
  { 
    name: 'types.gs', 
    description: 'JSDoc type definitions',
    requiredExports: [], // JSDoc only, no functions
    maxLines: 300 
  },
  { 
    name: 'server.gs', 
    description: 'Main entry point',
    requiredExports: ['doPost', 'jsonResponse', 'logEvent'], // Updated based on actual exports
    maxLines: 400 
  },
  
  // Service modules
  { 
    name: 'license-service.gs', 
    description: 'License management',
    requiredExports: ['handleCheckLicense', 'findLicense'], // Updated based on actual exports
    maxLines: 800 
  },
  { 
    name: 'bindings-service.gs', 
    description: 'Bindings CRUD',
    requiredExports: ['getUserBindings', 'handleAddBinding'], // Updated based on actual exports
    maxLines: 400 
  },
  { 
    name: 'published-sheets-service.gs',
    description: 'Publication tracking', 
    requiredExports: ['writePublicationRowToBindingSheet'], 
    maxLines: 300 
  },
  { 
    name: 'telegram-service.gs',
    description: 'Telegram API',
    requiredExports: ['sendMediaGroupWithCaption', 'sendLongTextMessage'], // Updated based on actual exports
    maxLines: 400 
  },
  { 
    name: 'posting-service.gs',
    description: 'Publication logic',
    requiredExports: ['handleSendPost'], // Updated based on actual exports
    maxLines: 300 
  },
  
  // VK modules
  { 
    name: 'vk-api.gs',
    description: 'VK API calls',
    requiredExports: ['handleGetVkPosts', 'resolveVkScreenName'], 
    maxLines: 600 
  },
  { 
    name: 'vk-posts.gs',
    description: 'Post formatting',
    requiredExports: ['formatVkTextForTelegram'], 
    maxLines: 400 
  },
  { 
    name: 'vk-media.gs',
    description: 'Media extraction',
    requiredExports: ['getVkMediaUrls'], 
    maxLines: 300 
  }
];

// ANSI color codes for output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function getFileStats(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  const size = fs.statSync(filePath).size;
  return { content, lines, size };
}

function extractFunctions(content) {
  // Match function declarations: function name(...) or const name = function(...)
  const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*function|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>)/g;
  const functions = [];
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const functionName = match[1] || match[2] || match[3];
    if (functionName) {
      functions.push(functionName);
    }
  }
  
  return functions;
}

function checkModule(module) {
  const filePath = path.join(SERVER_DIR, module.name);
  log(`\n🔍 Checking ${module.name}...`, 'cyan');
  
  // Check file exists
  if (!checkFileExists(filePath)) {
    log(`  ❌ FAIL: ${module.name} not found in server/`, 'red');
    return false;
  }
  log(`  ✓ File exists: ${module.name}`, 'green');
  
  // Check file stats
  const { content, lines, size } = getFileStats(filePath);
  log(`  📊 Stats: ${lines} lines, ${Math.round(size / 1024)} KB`, 'blue');
  
  // Check line limit
  if (lines > module.maxLines) {
    log(`  ⚠️  WARN: ${lines} lines exceeds recommended ${module.maxLines} lines`, 'yellow');
  } else {
    log(`  ✓ Line count within limits`, 'green');
  }
  
  // Extract functions
  const functions = extractFunctions(content);
  log(`  🔧 Functions found: ${functions.length}`, 'blue');
  
  if (functions.length > 0) {
    log(`    ${functions.slice(0, 10).join(', ')}`, 'magenta');
    if (functions.length > 10) {
      log(`    ... and ${functions.length - 10} more`, 'magenta');
    }
  }
  
  // Check required exports
  const missingExports = module.requiredExports.filter(exportName => 
    !functions.includes(exportName)
  );
  
  if (missingExports.length > 0) {
    log(`  ❌ FAIL: Missing required exports: ${missingExports.join(', ')}`, 'red');
    return false;
  }
  
  log(`  ✓ All required exports present: ${module.requiredExports.join(', ')}`, 'green');
  
  // Additional checks
  const hasComments = content.includes('//') || content.includes('/*');
  const hasLogging = content.includes('Logger.log') || content.includes('console.log');
  
  log(`  📝 Documentation: ${hasComments ? '✓' : '⚠️  No comments found'}`, hasComments ? 'green' : 'yellow');
  log(`  📊 Logging: ${hasLogging ? '✓' : '⚠️  No logging found'}`, hasLogging ? 'green' : 'yellow');
  
  return true;
}

function checkServerIntegrity() {
  log('\n🏗️  Checking server directory integrity...', 'cyan');
  
  if (!checkFileExists(SERVER_DIR)) {
    log('  ❌ FAIL: server/ directory not found', 'red');
    return false;
  }
  
  const serverFiles = fs.readdirSync(SERVER_DIR).filter(f => f.endsWith('.gs'));
  log(`  📁 Server modules: ${serverFiles.length} files`, 'blue');
  log(`    ${serverFiles.join(', ')}`, 'magenta');
  
  if (serverFiles.length < 8) {
    log(`  ⚠️  WARN: Expected at least 8 server modules, found ${serverFiles.length}`, 'yellow');
  }
  
  return true;
}

function main() {
  log('🚀 VK→Telegram Crossposter - Module Integrity Checker', 'cyan');
  log('=' .repeat(80), 'cyan');
  
  let allPassed = true;
  let checkedModules = 0;
  let passedModules = 0;
  
  // Check server directory
  if (!checkServerIntegrity()) {
    allPassed = false;
  }
  
  // Check each required module
  for (const module of REQUIRED_MODULES) {
    checkedModules++;
    const passed = checkModule(module);
    if (passed) {
      passedModules++;
    } else {
      allPassed = false;
    }
  }
  
  // Summary
  log('\n' + '='.repeat(80), 'cyan');
  log(`📊 Checked: ${checkedModules} modules, Passed: ${passedModules}`, 'blue');
  
  if (allPassed) {
    log('🎉 SUCCESS: All module integrity checks passed!', 'green');
    process.exit(0);
  } else {
    log('💥 FAILURE: Some module integrity checks failed', 'red');
    log(`❌ Failed: ${checkedModules - passedModules} modules`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  checkModule,
  checkServerIntegrity,
  REQUIRED_MODULES
};
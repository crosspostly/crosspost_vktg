#!/usr/bin/env node

/**
 * Syntax checker for Google Apps Script files
 * Uses Espree to parse and validate JavaScript syntax
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('espree');

const GAS_GLOBALS = [
  'PropertiesService', 'UrlFetchApp', 'Utilities', 'SpreadsheetApp', 
  'CacheService', 'ContentService', 'Logger', 'Session', 'MailApp',
  'HtmlService', 'DocumentApp', 'ScriptApp', 'DriveApp', 'BaseApp',
  'CalendarApp', 'ContactsApp', 'CardService', 'FormApp', 'GmailApp',
  'LockService', 'Maps', 'XmlService', 'ChartApp', 'SitesApp',
  'SlidesApp', 'LanguageApp', 'Jdbc', 'UrlShortener', 'Analytics'
];

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Parse with Espree using ECMAScript 2021
    const ast = parse(content, {
      ecmaVersion: 2021,
      sourceType: 'script',
      ecmaFeatures: {
        impliedStrict: false
      }
    });
    
    console.log(`✅ ${filePath}: Syntax OK`);
    return { success: true, errors: [] };
    
  } catch (error) {
    const errorMessage = error.message || error.toString();
    console.error(`❌ ${filePath}: Syntax Error`);
    console.error(`   Line ${error.lineNumber || '?'}: ${errorMessage}`);
    
    return { 
      success: false, 
      errors: [{
        file: filePath,
        line: error.lineNumber || null,
        column: error.column || null,
        message: errorMessage
      }]
    };
  }
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : ['server.gs', 'client.gs'];
  
  console.log('🔍 Checking Apps Script syntax...\n');
  
  let allPassed = true;
  const allErrors = [];
  
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`⚠️  ${file}: File not found`);
      continue;
    }
    
    const result = checkFile(file);
    if (!result.success) {
      allPassed = false;
      allErrors.push(...result.errors);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('✅ All files passed syntax check!');
    process.exit(0);
  } else {
    console.error(`❌ Syntax errors found in ${allErrors.length} location(s):`);
    allErrors.forEach(error => {
      const location = error.line ? `:${error.line}:${error.column || 0}` : '';
      console.error(`   ${error.file}${location}: ${error.message}`);
    });
    console.error('\nPlease fix these errors before committing.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFile };
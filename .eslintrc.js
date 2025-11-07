module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    // Google Apps Script global objects
    SpreadsheetApp: 'readonly',
    Session: 'readonly',
    Utilities: 'readonly',
    Logger: 'readonly',
    PropertiesService: 'readonly',
    CacheService: 'readonly',
    UrlFetchApp: 'readonly',
    HtmlService: 'readonly',
    UiApp: 'readonly',
    DocumentApp: 'readonly',
    FormApp: 'readonly',
    GmailApp: 'readonly',
    CalendarApp: 'readonly',
    DriveApp: 'readonly',
    ScriptApp: 'readonly',
    ContentService: 'readonly',
    CardService: 'readonly',
    // Custom global functions
    doGet: 'readonly',
    doPost: 'readonly',
    onOpen: 'readonly',
    onEdit: 'readonly',
    onInstall: 'readonly',
    // VK API globals
    VK_API_VERSION: 'readonly',
    // Telegram API globals
    TELEGRAM_API_TOKEN: 'readonly',
    // Custom constants
    TIMEOUTS: 'readonly',
    CACHE_KEYS: 'readonly',
    // Test globals
    test: 'readonly',
    assertEquals: 'readonly',
    assertTrue: 'readonly',
    assertFalse: 'readonly'
  },
  rules: {
    // Relaxed rules for existing codebase
    'no-unused-vars': 'warn',
    'no-console': 'off', // Allow console.log for debugging
    'no-undef': 'warn',
    'semi': 'warn',
    'quotes': 'warn',
    'indent': 'off', // Disable for now due to inconsistencies
    'no-trailing-spaces': 'warn',
    'eol-last': 'warn',
    'comma-dangle': 'warn',
    'object-curly-spacing': 'warn',
    'array-bracket-spacing': 'warn',
    'space-before-function-paren': 'warn',
    'keyword-spacing': 'warn',
    'space-infix-ops': 'warn',
    'no-multiple-empty-lines': 'warn',
    'brace-style': 'warn',
    'curly': 'warn',
    'no-prototype-builtins': 'warn'
  },
  overrides: [
    {
      files: ['**/*.gs'],
      env: {
        browser: true,
        es2021: true
      }
    }
  ]
};
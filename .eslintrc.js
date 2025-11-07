module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:jsdoc/recommended'
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
    assertFalse: 'readonly',
    // Jest globals (for test files)
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    jest: 'readonly'
  },
  rules: {
    // Relaxed rules for existing codebase
    'no-unused-vars': 'warn',
    'no-console': 'off', // Allow console.log for debugging
    'no-undef': 'warn',
    'semi': 'warn',
    'quotes': ['warn', 'single'],
    'indent': 'off', // Disable for now due to inconsistencies
    'no-trailing-spaces': 'warn',
    'eol-last': 'warn',
    'comma-dangle': ['warn', 'never'],
    'object-curly-spacing': ['warn', 'always'],
    'array-bracket-spacing': ['warn', 'never'],
    'space-before-function-paren': ['warn', 'never'],
    'keyword-spacing': 'warn',
    'space-infix-ops': 'warn',
    'no-multiple-empty-lines': ['warn', { max: 2 }],
    'brace-style': ['warn', '1tbs'],
    'curly': 'warn',
    'no-prototype-builtins': 'warn',
    'no-var': 'warn',
    'prefer-const': 'warn',
    'no-use-before-define': 'warn',
    // JSDoc specific rules
    'jsdoc/require-jsdoc': 'warn', // Require JSDoc comments for functions
    'jsdoc/require-description': 'warn', // Require description in JSDoc
    'jsdoc/require-param': 'warn', // Require @param tags
    'jsdoc/require-returns': 'warn', // Require @returns tags
    'jsdoc/require-throws': 'off', // Don't require @throws for now
    'jsdoc/valid-types': 'warn', // Validate JSDoc types
    'jsdoc/check-tag-names': 'warn', // Check tag names are valid
    'jsdoc/check-param-names': 'warn', // Check param names match function
    'jsdoc/check-alignment': 'warn', // Check JSDoc alignment
    'jsdoc/check-indentation': 'off' // Don't enforce specific indentation
  },
  overrides: [
    {
      files: ['**/*.gs'],
      env: {
        browser: true,
        es2021: true,
        node: false
      },
      rules: {
        // More relaxed rules for .gs files (Google Apps Script)
        'no-unused-vars': 'warn',
        'no-console': 'off',
        'prefer-const': 'warn',
        'no-var': 'off' // Allow var in .gs files for GAS compatibility
      }
    },
    {
      files: ['**/*.test.js', '**/*.test.gs', '**/*.spec.js', '**/*.spec.gs'],
      env: {
        jest: true,
        node: true
      },
      rules: {
        'no-unused-vars': 'off', // Allow unused variables in tests
        'no-console': 'off' // Allow console in tests
      }
    },
    {
      files: ['tools/**/*.js', 'jest.config.js', 'babel.config.js'],
      env: {
        node: true,
        browser: false
      },
      parserOptions: {
        sourceType: 'commonjs'
      }
    }
  ]
};
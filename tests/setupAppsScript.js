/**
 * Enhanced Jest setup file for Google Apps Script testing
 * 
 * This file provides comprehensive mocks for all Google Apps Script services
 * used in the VK→Telegram Crossposter application.
 * 
 * Usage:
 *   - Automatically loaded via jest.config.js setupFilesAfterEnv
 *   - Mocks are automatically reset between tests (clearMocks: true)
 *   - Access mocks via global.SpreadsheetApp, global.Logger, etc.
 *   - Use createMockSheet(), createMockRange(), etc. in tests for custom scenarios
 */

// ============================================================================
// SPREADSHEET APP MOCKS
// ============================================================================

/**
 * Creates a mock Range object with common methods
 * @param {Array<Array<any>>} values - 2D array of cell values
 * @returns {Object} Mock Range object
 */
function createMockRange(values = [[]]) {
  return {
    getValues: jest.fn().mockReturnValue(values),
    setValues: jest.fn(),
    setValue: jest.fn(),
    getNumRows: jest.fn().mockReturnValue(values.length),
    getNumColumns: jest.fn().mockReturnValue(values[0]?.length || 0),
    getRow: jest.fn().mockReturnValue(1),
    getColumn: jest.fn().mockReturnValue(1),
    getA1Notation: jest.fn().mockReturnValue('A1'),
    setBackground: jest.fn(),
    setFontWeight: jest.fn(),
    setFontColor: jest.fn(),
    setHorizontalAlignment: jest.fn(),
    clear: jest.fn(),
    clearContent: jest.fn(),
    clearFormat: jest.fn(),
    offset: jest.fn(function() { return this; }),
  };
}

/**
 * Creates a mock Sheet object with common methods
 * @param {string} name - Sheet name
 * @param {Array<Array<any>>} data - Initial sheet data
 * @returns {Object} Mock Sheet object
 */
function createMockSheet(name = 'Sheet1', data = [[]]) {
  const sheet = {
    getName: jest.fn().mockReturnValue(name),
    getDataRange: jest.fn().mockReturnValue(createMockRange(data)),
    getRange: jest.fn().mockReturnValue(createMockRange(data)),
    getLastRow: jest.fn().mockReturnValue(data.length),
    getLastColumn: jest.fn().mockReturnValue(data[0]?.length || 0),
    getMaxRows: jest.fn().mockReturnValue(1000),
    getMaxColumns: jest.fn().mockReturnValue(26),
    appendRow: jest.fn(),
    insertRowAfter: jest.fn(),
    insertRowBefore: jest.fn(),
    deleteRow: jest.fn(),
    deleteRows: jest.fn(),
    clear: jest.fn(),
    clearContents: jest.fn(),
    setName: jest.fn(),
    hideSheet: jest.fn(),
    showSheet: jest.fn(),
    isSheetHidden: jest.fn().mockReturnValue(false),
    setFrozenRows: jest.fn(),
    setFrozenColumns: jest.fn(),
    autoResizeColumn: jest.fn(),
    setColumnWidth: jest.fn(),
    getSheetId: jest.fn().mockReturnValue(Math.floor(Math.random() * 1000000)),
  };
  return sheet;
}

/**
 * Creates a mock Spreadsheet object with common methods
 * @param {Array<Object>} sheets - Array of mock sheets
 * @returns {Object} Mock Spreadsheet object
 */
function createMockSpreadsheet(sheets = []) {
  if (sheets.length === 0) {
    sheets = [createMockSheet()];
  }
  
  return {
    getSheets: jest.fn().mockReturnValue(sheets),
    getSheetByName: jest.fn((name) => sheets.find(s => s.getName() === name) || null),
    insertSheet: jest.fn((name) => {
      const newSheet = createMockSheet(name);
      sheets.push(newSheet);
      return newSheet;
    }),
    deleteSheet: jest.fn((sheet) => {
      const index = sheets.indexOf(sheet);
      if (index > -1) sheets.splice(index, 1);
    }),
    getActiveSheet: jest.fn().mockReturnValue(sheets[0]),
    setActiveSheet: jest.fn(),
    getSheetId: jest.fn().mockReturnValue('mock-spreadsheet-id'),
    getName: jest.fn().mockReturnValue('Mock Spreadsheet'),
    getId: jest.fn().mockReturnValue('1234567890abcdef'),
    getUrl: jest.fn().mockReturnValue('https://docs.google.com/spreadsheets/d/mock-id'),
    toast: jest.fn(),
    getRangeByName: jest.fn(),
    getSpreadsheetTimeZone: jest.fn().mockReturnValue('GMT'),
  };
}

global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => createMockSpreadsheet()),
  openById: jest.fn((id) => createMockSpreadsheet()),
  openByUrl: jest.fn((url) => createMockSpreadsheet()),
  getUi: jest.fn(() => ({
    createMenu: jest.fn(() => ({
      addItem: jest.fn(function() { return this; }),
      addSeparator: jest.fn(function() { return this; }),
      addToUi: jest.fn(),
    })),
    alert: jest.fn(),
    prompt: jest.fn(),
    showModalDialog: jest.fn(),
    showModelessDialog: jest.fn(),
    showSidebar: jest.fn(),
    Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO', CLOSE: 'CLOSE' },
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO', YES_NO_CANCEL: 'YES_NO_CANCEL' },
  })),
  create: jest.fn(() => createMockSpreadsheet()),
  flush: jest.fn(),
};

// ============================================================================
// PROPERTIES SERVICE MOCKS
// ============================================================================

/**
 * Creates a mock Properties object
 * @param {Object} initialProps - Initial properties
 * @returns {Object} Mock Properties object
 */
function createMockProperties(initialProps = {}) {
  const props = { ...initialProps };
  
  return {
    getProperty: jest.fn((key) => props[key] || null),
    setProperty: jest.fn((key, value) => { props[key] = value; }),
    deleteProperty: jest.fn((key) => { delete props[key]; }),
    getProperties: jest.fn(() => ({ ...props })),
    setProperties: jest.fn((newProps) => { Object.assign(props, newProps); }),
    deleteAllProperties: jest.fn(() => { Object.keys(props).forEach(k => delete props[k]); }),
    getKeys: jest.fn(() => Object.keys(props)),
  };
}

global.PropertiesService = {
  getScriptProperties: jest.fn(() => createMockProperties()),
  getUserProperties: jest.fn(() => createMockProperties()),
  getDocumentProperties: jest.fn(() => createMockProperties()),
};

// ============================================================================
// URL FETCH APP MOCKS
// ============================================================================

/**
 * Creates a mock HTTP response
 * @param {Object} options - Response options
 * @returns {Object} Mock HTTPResponse object
 */
function createMockHttpResponse(options = {}) {
  const {
    code = 200,
    content = '{}',
    headers = {},
    contentText = content,
  } = options;
  
  return {
    getResponseCode: jest.fn().mockReturnValue(code),
    getContentText: jest.fn().mockReturnValue(contentText),
    getContent: jest.fn().mockReturnValue(content),
    getHeaders: jest.fn().mockReturnValue(headers),
    getAllHeaders: jest.fn().mockReturnValue(headers),
    getAs: jest.fn(),
  };
}

global.UrlFetchApp = {
  fetch: jest.fn((url, params) => createMockHttpResponse()),
  getRequest: jest.fn(),
};

// ============================================================================
// CACHE SERVICE MOCKS
// ============================================================================

/**
 * Creates a mock Cache object
 * @returns {Object} Mock Cache object
 */
function createMockCache() {
  const cache = {};
  
  return {
    get: jest.fn((key) => cache[key] || null),
    put: jest.fn((key, value, expirationInSeconds) => { cache[key] = value; }),
    putAll: jest.fn((values, expirationInSeconds) => { Object.assign(cache, values); }),
    remove: jest.fn((key) => { delete cache[key]; }),
    removeAll: jest.fn((keys) => { keys.forEach(k => delete cache[k]); }),
    getAll: jest.fn((keys) => {
      const result = {};
      keys.forEach(k => { if (cache[k]) result[k] = cache[k]; });
      return result;
    }),
  };
}

global.CacheService = {
  getScriptCache: jest.fn(() => createMockCache()),
  getUserCache: jest.fn(() => createMockCache()),
  getDocumentCache: jest.fn(() => createMockCache()),
};

// ============================================================================
// LOGGER MOCKS
// ============================================================================

global.Logger = {
  log: jest.fn((message) => console.log('[Logger]', message)),
  clear: jest.fn(),
  getLog: jest.fn().mockReturnValue(''),
};

global.console = global.console || {};
global.console.log = global.console.log || jest.fn();
global.console.error = global.console.error || jest.fn();
global.console.warn = global.console.warn || jest.fn();

// ============================================================================
// UTILITIES MOCKS
// ============================================================================

global.Utilities = {
  formatDate: jest.fn((date, timeZone, format) => {
    return date.toISOString().split('T')[0];
  }),
  formatString: jest.fn((template, ...args) => {
    return template.replace(/%s/g, () => args.shift());
  }),
  base64Encode: jest.fn((data) => Buffer.from(data).toString('base64')),
  base64Decode: jest.fn((encoded) => Buffer.from(encoded, 'base64').toString()),
  sleep: jest.fn(),
  parseCsv: jest.fn((csv) => csv.split('\n').map(row => row.split(','))),
  newBlob: jest.fn((data, contentType, name) => ({
    getDataAsString: jest.fn().mockReturnValue(data),
    getBytes: jest.fn().mockReturnValue(data),
    getContentType: jest.fn().mockReturnValue(contentType),
    getName: jest.fn().mockReturnValue(name),
  })),
  computeDigest: jest.fn(),
  getUuid: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(2)),
  jsonParse: jest.fn((jsonString) => JSON.parse(jsonString)),
  jsonStringify: jest.fn((obj) => JSON.stringify(obj)),
};

// ============================================================================
// LOCK SERVICE MOCKS
// ============================================================================

global.LockService = {
  getScriptLock: jest.fn(() => ({
    tryLock: jest.fn().mockReturnValue(true),
    waitLock: jest.fn(),
    hasLock: jest.fn().mockReturnValue(false),
    releaseLock: jest.fn(),
  })),
  getUserLock: jest.fn(() => ({
    tryLock: jest.fn().mockReturnValue(true),
    waitLock: jest.fn(),
    hasLock: jest.fn().mockReturnValue(false),
    releaseLock: jest.fn(),
  })),
  getDocumentLock: jest.fn(() => ({
    tryLock: jest.fn().mockReturnValue(true),
    waitLock: jest.fn(),
    hasLock: jest.fn().mockReturnValue(false),
    releaseLock: jest.fn(),
  })),
};

// ============================================================================
// SCRIPT APP MOCKS
// ============================================================================

global.ScriptApp = {
  getProjectTriggers: jest.fn().mockReturnValue([]),
  newTrigger: jest.fn(() => ({
    timeBased: jest.fn(function() { return this; }),
    everyMinutes: jest.fn(function() { return this; }),
    everyHours: jest.fn(function() { return this; }),
    everyDays: jest.fn(function() { return this; }),
    everyWeeks: jest.fn(function() { return this; }),
    atHour: jest.fn(function() { return this; }),
    nearMinute: jest.fn(function() { return this; }),
    create: jest.fn(),
  })),
  deleteTrigger: jest.fn(),
  getService: jest.fn(() => ({
    getUrl: jest.fn().mockReturnValue('https://script.google.com/macros/s/mock-id/exec'),
  })),
  getScriptId: jest.fn().mockReturnValue('mock-script-id'),
  getOAuthToken: jest.fn().mockReturnValue('mock-oauth-token'),
};

// ============================================================================
// SESSION MOCKS
// ============================================================================

global.Session = {
  getActiveUser: jest.fn(() => ({
    getEmail: jest.fn().mockReturnValue('test@example.com'),
  })),
  getEffectiveUser: jest.fn(() => ({
    getEmail: jest.fn().mockReturnValue('test@example.com'),
  })),
  getScriptTimeZone: jest.fn().mockReturnValue('GMT'),
  getTemporaryActiveUserKey: jest.fn().mockReturnValue('temp-user-key'),
};

// ============================================================================
// CONTENT SERVICE MOCKS (for HTML dialogs)
// ============================================================================

global.HtmlService = {
  createHtmlOutput: jest.fn((html) => ({
    setTitle: jest.fn(function() { return this; }),
    setWidth: jest.fn(function() { return this; }),
    setHeight: jest.fn(function() { return this; }),
    append: jest.fn(function() { return this; }),
    getContent: jest.fn().mockReturnValue(html || ''),
  })),
  createHtmlOutputFromFile: jest.fn((filename) => ({
    setTitle: jest.fn(function() { return this; }),
    setWidth: jest.fn(function() { return this; }),
    setHeight: jest.fn(function() { return this; }),
    append: jest.fn(function() { return this; }),
    getContent: jest.fn().mockReturnValue(''),
  })),
  createTemplateFromFile: jest.fn((filename) => ({
    evaluate: jest.fn(function() { 
      return {
        setTitle: jest.fn(function() { return this; }),
        setWidth: jest.fn(function() { return this; }),
        setHeight: jest.fn(function() { return this; }),
        getContent: jest.fn().mockReturnValue(''),
      };
    }),
  })),
};

// ============================================================================
// GLOBAL FUNCTION MOCKS
// ============================================================================

global.doGet = jest.fn();
global.doPost = jest.fn();
global.onOpen = jest.fn();
global.onEdit = jest.fn();
global.onInstall = jest.fn();

// ============================================================================
// EXPORT MOCK HELPERS (for use in tests)
// ============================================================================

global.mockHelpers = {
  createMockSheet,
  createMockSpreadsheet,
  createMockRange,
  createMockProperties,
  createMockHttpResponse,
  createMockCache,
};

// ============================================================================
// CONSOLE NOTICE
// ============================================================================

console.log('✓ Google Apps Script mocks loaded');
console.log('✓ Mock helpers available via global.mockHelpers');

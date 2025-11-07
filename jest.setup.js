// Simplified Jest setup file for Google Apps Script testing

// Mock basic Google Apps Script services
global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(),
  getUi: jest.fn()
};

global.PropertiesService = {
  getScriptProperties: jest.fn()
};

global.UrlFetchApp = {
  fetch: jest.fn()
};

global.Logger = {
  log: jest.fn()
};

global.doGet = jest.fn();
global.doPost = jest.fn();
global.onOpen = jest.fn();
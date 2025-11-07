// Basic test to verify Jest setup and Google Apps Script mocks
describe('Google Apps Script Mocks', () => {
  test('SpreadsheetApp mock is available', () => {
    expect(global.SpreadsheetApp).toBeDefined();
    expect(typeof global.SpreadsheetApp.getActiveSpreadsheet).toBe('function');
  });

  test('PropertiesService mock is available', () => {
    expect(global.PropertiesService).toBeDefined();
    expect(typeof global.PropertiesService.getScriptProperties).toBe('function');
  });

  test('UrlFetchApp mock is available', () => {
    expect(global.UrlFetchApp).toBeDefined();
    expect(typeof global.UrlFetchApp.fetch).toBe('function');
  });

  test('Logger mock is available', () => {
    expect(global.Logger).toBeDefined();
    expect(typeof global.Logger.log).toBe('function');
  });

  test('Global functions are mocked', () => {
    expect(global.doGet).toBeDefined();
    expect(global.doPost).toBeDefined();
    expect(global.onOpen).toBeDefined();
  });
});

describe('Module Structure', () => {
  const fs = require('fs');
  const path = require('path');

  test('Server directory exists', () => {
    const serverDir = path.join(process.cwd(), 'server');
    expect(fs.existsSync(serverDir)).toBe(true);
  });

  test('Client directory exists', () => {
    const clientDir = path.join(process.cwd(), 'client');
    expect(fs.existsSync(clientDir)).toBe(true);
  });

  test('Required VK modules exist', () => {
    const serverDir = path.join(process.cwd(), 'server');
    const requiredModules = ['vk-api.gs', 'vk-posts.gs', 'vk-media.gs'];
    requiredModules.forEach(module => {
      const modulePath = path.join(serverDir, module);
      expect(fs.existsSync(modulePath)).toBe(true);
    });
  });
});
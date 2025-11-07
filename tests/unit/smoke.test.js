/**
 * Smoke tests to verify the test harness is working correctly
 */

describe('Test Harness Smoke Tests', () => {
  describe('Apps Script Mocks', () => {
    test('SpreadsheetApp is available', () => {
      expect(global.SpreadsheetApp).toBeDefined();
      expect(typeof global.SpreadsheetApp.getActiveSpreadsheet).toBe('function');
    });

    test('PropertiesService is available', () => {
      expect(global.PropertiesService).toBeDefined();
      expect(typeof global.PropertiesService.getScriptProperties).toBe('function');
    });

    test('UrlFetchApp is available', () => {
      expect(global.UrlFetchApp).toBeDefined();
      expect(typeof global.UrlFetchApp.fetch).toBe('function');
    });

    test('Logger is available', () => {
      expect(global.Logger).toBeDefined();
      expect(typeof global.Logger.log).toBe('function');
    });

    test('CacheService is available', () => {
      expect(global.CacheService).toBeDefined();
      expect(typeof global.CacheService.getScriptCache).toBe('function');
    });

    test('Utilities is available', () => {
      expect(global.Utilities).toBeDefined();
      expect(typeof global.Utilities.formatDate).toBe('function');
    });

    test('ScriptApp is available', () => {
      expect(global.ScriptApp).toBeDefined();
      expect(typeof global.ScriptApp.getProjectTriggers).toBe('function');
    });
  });

  describe('Mock Helpers', () => {
    test('mockHelpers is available', () => {
      expect(global.mockHelpers).toBeDefined();
    });

    test('createMockSheet helper works', () => {
      const sheet = global.mockHelpers.createMockSheet('TestSheet');
      expect(sheet.getName()).toBe('TestSheet');
      expect(typeof sheet.getRange).toBe('function');
    });

    test('createMockSpreadsheet helper works', () => {
      const spreadsheet = global.mockHelpers.createMockSpreadsheet();
      expect(typeof spreadsheet.getSheets).toBe('function');
      expect(spreadsheet.getSheets().length).toBeGreaterThan(0);
    });

    test('createMockRange helper works', () => {
      const range = global.mockHelpers.createMockRange([['A1', 'B1'], ['A2', 'B2']]);
      expect(range.getNumRows()).toBe(2);
      expect(range.getNumColumns()).toBe(2);
      expect(range.getValues()).toEqual([['A1', 'B1'], ['A2', 'B2']]);
    });

    test('createMockProperties helper works', () => {
      const props = global.mockHelpers.createMockProperties({ key1: 'value1' });
      expect(props.getProperty('key1')).toBe('value1');
      props.setProperty('key2', 'value2');
      expect(props.getProperty('key2')).toBe('value2');
    });

    test('createMockHttpResponse helper works', () => {
      const response = global.mockHelpers.createMockHttpResponse({
        code: 200,
        contentText: '{"status":"ok"}',
      });
      expect(response.getResponseCode()).toBe(200);
      expect(response.getContentText()).toBe('{"status":"ok"}');
    });
  });

  describe('Fixtures', () => {
    const fixtures = require('../fixtures');

    test('VK posts fixtures are available', () => {
      expect(fixtures.vkPosts).toBeDefined();
      expect(fixtures.vkPosts.sampleTextPost).toBeDefined();
      expect(fixtures.vkPosts.postWithPhoto).toBeDefined();
    });

    test('Bindings fixtures are available', () => {
      expect(fixtures.bindings).toBeDefined();
      expect(fixtures.bindings.validBinding).toBeDefined();
    });

    test('createVkApiResponse helper works', () => {
      const response = fixtures.createVkApiResponse([fixtures.vkPosts.sampleTextPost]);
      expect(response.response).toBeDefined();
      expect(response.response.items).toHaveLength(1);
    });

    test('createTelegramApiResponse helper works', () => {
      const response = fixtures.createTelegramApiResponse(true, { message_id: 123 });
      expect(response.ok).toBe(true);
      expect(response.result.message_id).toBe(123);
    });

    test('getAllVkPosts helper works', () => {
      const posts = fixtures.getAllVkPosts();
      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
    });

    test('getAllBindings helper works', () => {
      const allBindings = fixtures.getAllBindings();
      expect(Array.isArray(allBindings)).toBe(true);
      expect(allBindings.length).toBeGreaterThan(0);
    });
  });

  describe('Jest Configuration', () => {
    test('Jest is configured correctly', () => {
      expect(jest).toBeDefined();
      expect(typeof jest.fn).toBe('function');
      expect(typeof jest.mock).toBe('function');
    });

    test('Mocks are cleared between tests', () => {
      const mockFn = jest.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledTimes(1);
      // In next test, this should be reset to 0
    });

    test('Previous test mock was cleared', () => {
      // This verifies clearMocks: true in jest.config.js
      expect(global.Logger.log).not.toHaveBeenCalled();
    });
  });
});

/**
 * Integration smoke tests to verify component interactions
 */

describe('Integration Smoke Tests', () => {
  const fixtures = require('../fixtures');

  describe('Mock Spreadsheet Integration', () => {
    test('Can create spreadsheet with multiple sheets', () => {
      const sheet1 = global.mockHelpers.createMockSheet('Bindings', fixtures.bindings.bindingSheetData);
      const sheet2 = global.mockHelpers.createMockSheet('Licenses', fixtures.bindings.licenseSheetData);
      
      const spreadsheet = global.mockHelpers.createMockSpreadsheet([sheet1, sheet2]);
      
      expect(spreadsheet.getSheets()).toHaveLength(2);
      expect(spreadsheet.getSheetByName('Bindings')).toBe(sheet1);
      expect(spreadsheet.getSheetByName('Licenses')).toBe(sheet2);
    });

    test('Can read and write to sheet ranges', () => {
      const sheet = global.mockHelpers.createMockSheet('TestSheet', [
        ['Header 1', 'Header 2'],
        ['Value 1', 'Value 2'],
      ]);
      
      const range = sheet.getRange();
      const values = range.getValues();
      
      expect(values).toEqual([
        ['Header 1', 'Header 2'],
        ['Value 1', 'Value 2'],
      ]);
      
      range.setValues([['New 1', 'New 2']]);
      expect(range.setValues).toHaveBeenCalledWith([['New 1', 'New 2']]);
    });

    test('Can append rows to sheet', () => {
      const sheet = global.mockHelpers.createMockSheet('TestSheet');
      
      sheet.appendRow(['Row 1', 'Data 1']);
      sheet.appendRow(['Row 2', 'Data 2']);
      
      expect(sheet.appendRow).toHaveBeenCalledTimes(2);
      expect(sheet.appendRow).toHaveBeenNthCalledWith(1, ['Row 1', 'Data 1']);
      expect(sheet.appendRow).toHaveBeenNthCalledWith(2, ['Row 2', 'Data 2']);
    });
  });

  describe('Mock Properties Integration', () => {
    test('Can store and retrieve properties', () => {
      const props = global.mockHelpers.createMockProperties();
      
      props.setProperty('vkToken', 'test-vk-token');
      props.setProperty('telegramToken', 'test-telegram-token');
      
      expect(props.getProperty('vkToken')).toBe('test-vk-token');
      expect(props.getProperty('telegramToken')).toBe('test-telegram-token');
    });

    test('Can get all properties', () => {
      const props = global.mockHelpers.createMockProperties({
        key1: 'value1',
        key2: 'value2',
      });
      
      const allProps = props.getProperties();
      expect(allProps).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    test('Can delete properties', () => {
      const props = global.mockHelpers.createMockProperties({
        key1: 'value1',
        key2: 'value2',
      });
      
      props.deleteProperty('key1');
      expect(props.getProperty('key1')).toBeNull();
      expect(props.getProperty('key2')).toBe('value2');
    });
  });

  describe('Mock HTTP Requests Integration', () => {
    test('Can mock VK API response', () => {
      const vkResponse = fixtures.createVkApiResponse([
        fixtures.vkPosts.sampleTextPost,
        fixtures.vkPosts.postWithPhoto,
      ]);
      
      global.UrlFetchApp.fetch.mockReturnValue(
        global.mockHelpers.createMockHttpResponse({
          code: 200,
          contentText: JSON.stringify(vkResponse),
        })
      );
      
      const response = global.UrlFetchApp.fetch('https://api.vk.com/method/wall.get');
      expect(response.getResponseCode()).toBe(200);
      
      const data = JSON.parse(response.getContentText());
      expect(data.response.items).toHaveLength(2);
    });

    test('Can mock Telegram API response', () => {
      const tgMessage = fixtures.createTelegramMessage(123, '-1001234567890', 'Test');
      const tgResponse = fixtures.createTelegramApiResponse(true, tgMessage);
      
      global.UrlFetchApp.fetch.mockReturnValue(
        global.mockHelpers.createMockHttpResponse({
          code: 200,
          contentText: JSON.stringify(tgResponse),
        })
      );
      
      const response = global.UrlFetchApp.fetch('https://api.telegram.org/bot123/sendMessage');
      const data = JSON.parse(response.getContentText());
      
      expect(data.ok).toBe(true);
      expect(data.result.message_id).toBe(123);
    });

    test('Can mock API error responses', () => {
      global.UrlFetchApp.fetch.mockReturnValue(
        global.mockHelpers.createMockHttpResponse({
          code: 429,
          contentText: JSON.stringify(fixtures.telegramApiErrors.tooManyRequests),
        })
      );
      
      const response = global.UrlFetchApp.fetch('https://api.telegram.org/bot123/sendMessage');
      expect(response.getResponseCode()).toBe(429);
      
      const data = JSON.parse(response.getContentText());
      expect(data.ok).toBe(false);
      expect(data.error_code).toBe(429);
    });
  });

  describe('Mock Cache Integration', () => {
    test('Can store and retrieve from cache', () => {
      const cache = global.CacheService.getScriptCache();
      
      cache.put('test-key', 'test-value', 600);
      expect(cache.get('test-key')).toBe('test-value');
    });

    test('Can store multiple values in cache', () => {
      const cache = global.CacheService.getScriptCache();
      
      cache.putAll({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      }, 600);
      
      const values = cache.getAll(['key1', 'key2', 'key3']);
      expect(values).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
    });
  });

  describe('Fixture Helper Integration', () => {
    test('Can create bindings sheet from fixtures', () => {
      const bindings = [
        fixtures.bindings.validBinding,
        fixtures.bindings.bindingWithUsername,
      ];
      
      const spreadsheet = fixtures.createBindingsSheet(bindings);
      const bindingsSheet = spreadsheet.getSheetByName('Bindings');
      
      expect(bindingsSheet).toBeDefined();
      expect(bindingsSheet.getName()).toBe('Bindings');
      
      const data = bindingsSheet.getDataRange().getValues();
      expect(data.length).toBe(3); // Header + 2 bindings
      expect(data[0][0]).toBe('Binding Name');
    });

    test('Can create licenses sheet from fixtures', () => {
      const spreadsheet = fixtures.createLicensesSheet();
      const licensesSheet = spreadsheet.getSheetByName('Licenses');
      
      expect(licensesSheet).toBeDefined();
      expect(licensesSheet.getName()).toBe('Licenses');
      
      const data = licensesSheet.getDataRange().getValues();
      expect(data.length).toBeGreaterThan(1); // Header + licenses
      expect(data[0][0]).toBe('License Key');
    });

    test('Can create published posts sheet from fixtures', () => {
      const spreadsheet = fixtures.createPublishedPostsSheet('TestBinding01');
      const postsSheet = spreadsheet.getSheetByName('TestBinding01');
      
      expect(postsSheet).toBeDefined();
      expect(postsSheet.getName()).toBe('TestBinding01');
      
      const data = postsSheet.getDataRange().getValues();
      expect(data.length).toBeGreaterThan(1); // Header + posts
      expect(data[0][0]).toBe('Timestamp');
    });
  });
});

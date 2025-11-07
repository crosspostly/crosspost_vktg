const fixtures = require('../fixtures');

const {
  createMockSheet,
  createMockSpreadsheet,
  createMockProperties,
  createMockHttpResponse,
} = global.mockHelpers;

function createJsonResponse(body, status = 200) {
  return {
    getContent: () => JSON.stringify(body),
    getResponseCode: () => status,
    body,
    status,
  };
}

describe('license-service.gs', () => {
  beforeAll(() => {
    jest.resetModules();

    // Set up mocks BEFORE loading files
    global.logEvent = jest.fn();
    global.logApiError = jest.fn();
    global.jsonResponse = jest.fn((body, status) => createJsonResponse(body, status));

    // Load server.gs first to define constants like SERVER_VERSION
    global.loadGasFile(require.resolve('../../server/server.gs'));
    global.loadGasFile(require.resolve('../../server/utils.gs'));
    global.loadGasFile(require.resolve('../../server/license-service.gs'));
    
    // Re-mock functions that the service uses
    global.logEvent = jest.fn();
    global.logApiError = jest.fn();
    global.jsonResponse = jest.fn((body, status) => createJsonResponse(body, status));
  });

  beforeEach(() => {
    global.logEvent.mockReset();
    global.logApiError.mockReset();
    global.jsonResponse.mockImplementation((body, status) => createJsonResponse(body, status));

    PropertiesService.getScriptProperties.mockReturnValue(createMockProperties());
    UrlFetchApp.fetch.mockReset();
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(createMockSpreadsheet());

    const service = ScriptApp.getService();
    service.getUrl.mockReturnValue('https://script.google.com/macros/s/mock-id/exec');
  });

  function seedLicensesSheet(rows) {
    const sheet = createMockSheet('Licenses', rows);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(createMockSpreadsheet([sheet]));
    return sheet;
  }

  test('findLicense returns license object when key exists', () => {
    const rows = [
      ['License Key', 'Email', 'Type', 'Max Groups', 'Expires', 'Created At', 'Status', 'Notes'],
      ['LICENSE-1', 'user@example.com', 'pro', 5, '2099-01-01', '2024-01-01', 'active', ''],
    ];

    seedLicensesSheet(rows);

    const license = findLicense('LICENSE-1');

    expect(license).toMatchObject({
      key: 'LICENSE-1',
      email: 'user@example.com',
      type: 'pro',
      maxGroups: 5,
      status: 'active',
    });
  });

  test('findLicense returns null when key is absent', () => {
    const rows = [
      ['License Key', 'Email', 'Type', 'Max Groups', 'Expires', 'Created At', 'Status', 'Notes'],
      ['LICENSE-OTHER', 'other@example.com', 'basic', 1, '2099-01-01', '2024-01-01', 'active', ''],
    ];

    seedLicensesSheet(rows);

    expect(findLicense('MISSING-KEY')).toBeNull();
  });

  test('findLicense logs error and returns null when sheet lookup fails', () => {
    const original = SpreadsheetApp.getActiveSpreadsheet;
    SpreadsheetApp.getActiveSpreadsheet = jest.fn(() => {
      throw new Error('Spreadsheet unavailable');
    });

    expect(findLicense('ANY')).toBeNull();
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'find_license_error',
      'system',
      expect.stringContaining('Spreadsheet unavailable')
    );

    SpreadsheetApp.getActiveSpreadsheet = original;
  });

  test('handleCheckLicense returns success payload for active licenses', () => {
    const rows = [
      ['License Key', 'Email', 'Type', 'Max Groups', 'Expires', 'Created At', 'Status', 'Notes'],
      ['LICENSE-ACTIVE', 'user@example.com', 'pro', 3, '2099-01-01', '2024-01-01', 'active', ''],
    ];

    seedLicensesSheet(rows);

    const response = handleCheckLicense({ license_key: 'LICENSE-ACTIVE' }, '127.0.0.1');
    const payload = JSON.parse(response.getContent());

    expect(payload.success).toBe(true);
    expect(payload.license).toMatchObject({ type: 'pro', maxGroups: 3 });
    expect(global.logEvent).toHaveBeenCalledWith(
      'INFO',
      'license_check_success',
      'LICENSE-ACTIVE',
      expect.stringContaining('127.0.0.1')
    );
  });

  test('handleCheckLicense validates required license key', () => {
    const response = handleCheckLicense({}, '127.0.0.1');
    const payload = JSON.parse(response.getContent());

    expect(payload).toMatchObject({ success: false, error: 'License key required' });
    expect(global.jsonResponse).toHaveBeenCalledWith(expect.any(Object), 400);
  });

  test('handleCheckLicense returns not found when license missing', () => {
    seedLicensesSheet([
      ['License Key', 'Email', 'Type', 'Max Groups', 'Expires', 'Created At', 'Status', 'Notes'],
      ['OTHER-LICENSE', 'user@example.com', 'pro', 3, '2099-01-01', '2024-01-01', 'active', ''],
    ]);

    const response = handleCheckLicense({ license_key: 'MISSING' }, '127.0.0.1');
    const payload = JSON.parse(response.getContent());

    expect(payload).toMatchObject({ success: false, error: 'License not found' });
    expect(global.jsonResponse).toHaveBeenCalledWith(expect.any(Object), 404);
  });

  test('handleCheckLicense rejects inactive and expired licenses', () => {
    const rows = [
      ['License Key', 'Email', 'Type', 'Max Groups', 'Expires', 'Created At', 'Status', 'Notes'],
      ['LICENSE-INACTIVE', 'user@example.com', 'pro', 3, '2099-01-01', '2024-01-01', 'paused', ''],
      ['LICENSE-EXPIRED', 'user@example.com', 'pro', 3, '2000-01-01', '2024-01-01', 'active', ''],
    ];

    seedLicensesSheet(rows);

    let response = handleCheckLicense({ license_key: 'LICENSE-INACTIVE' }, '127.0.0.1');
    expect(JSON.parse(response.getContent())).toMatchObject({ success: false, error: 'License inactive' });

    response = handleCheckLicense({ license_key: 'LICENSE-EXPIRED' }, '127.0.0.1');
    expect(JSON.parse(response.getContent())).toMatchObject({ success: false, error: 'License expired' });
  });

  test('handleCheckLicense logs and reports unexpected errors', () => {
    const originalFindLicense = global.findLicense;
    global.findLicense = jest.fn(() => {
      throw new Error('Unexpected failure');
    });

    const response = handleCheckLicense({ license_key: 'ANY' }, '127.0.0.1');
    const payload = JSON.parse(response.getContent());

    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Unexpected failure');
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'license_check_error',
      'ANY',
      'Unexpected failure'
    );

    global.findLicense = originalFindLicense;
  });

  test('saveServerConfig validates required fields and logs warnings', () => {
    let result = saveServerConfig('', 'vk-token', 'admin');
    expect(result).toEqual({ success: false, error: 'Заполните Telegram Bot Token' });

    result = saveServerConfig('bot-token', '', 'admin');
    expect(result).toEqual({ success: false, error: 'Заполните VK User Access Token' });

    result = saveServerConfig('bot-token', 'vk-token', '');
    expect(result).toEqual({ success: false, error: 'Заполните Admin Chat ID' });
  });

  test('saveServerConfig returns validation errors from validateTokens', () => {
    const originalValidateTokens = global.validateTokens;
    global.validateTokens = jest.fn(() => ({ success: false, error: 'Invalid tokens' }));

    const result = saveServerConfig('bot', 'vk', 'admin');
    expect(result).toEqual({ success: false, error: 'Invalid tokens' });
    expect(global.logEvent).toHaveBeenCalledWith('WARN', 'config_validation_failed', 'admin', 'Invalid tokens');

    global.validateTokens = originalValidateTokens;
  });

  test('saveServerConfig persists settings when validation succeeds', () => {
    const props = createMockProperties();
    PropertiesService.getScriptProperties.mockReturnValue(props);

    const originalValidateTokens = global.validateTokens;
    global.validateTokens = jest.fn(() => ({
      success: true,
      details: {
        telegram: { status: '✅', message: 'ok' },
        vkUser: { status: '✅', message: 'ok' },
        adminChat: { status: '✅', message: 'ok' },
      },
    }));

    const result = saveServerConfig('bot', 'vk', 'admin');

    expect(result.success).toBe(true);
    expect(props.setProperties).toHaveBeenCalledWith({
      BOT_TOKEN: 'bot',
      VK_USER_ACCESS_TOKEN: 'vk',
      ADMIN_CHAT_ID: 'admin',
    });
    expect(global.logEvent).toHaveBeenCalledWith('INFO', 'config_updated', 'admin', expect.any(String));

    global.validateTokens = originalValidateTokens;
  });

  test('validateTokens returns success details on valid credentials', () => {
    UrlFetchApp.fetch
      .mockImplementationOnce(() => createMockHttpResponse({
        contentText: JSON.stringify({ ok: true, result: { username: 'bot_user' } }),
      }))
      .mockImplementationOnce(() => createMockHttpResponse({
        contentText: JSON.stringify({ response: [{ first_name: 'Ivan', last_name: 'Petrov' }] }),
      }))
      .mockImplementationOnce(() => createMockHttpResponse({
        contentText: JSON.stringify({ ok: true, result: {} }),
      }));

    const result = validateTokens('bot-token', 'vk-token', 'admin');

    expect(result.success).toBe(true);
    expect(result.details.telegram.status).toBe('✅');
    expect(result.details.vkUser.status).toBe('✅');
    expect(result.details.adminChat.status).toBe('✅');
  });

  test('validateTokens records failures and partial successes', () => {
    UrlFetchApp.fetch
      .mockImplementationOnce(() => createMockHttpResponse({
        contentText: JSON.stringify({ ok: false, description: 'Bad token' }),
      }))
      .mockImplementationOnce(() => createMockHttpResponse({
        contentText: JSON.stringify({ error: { error_code: 5, error_msg: 'Invalid token' } }),
      }));

    const result = validateTokens('bot-token', 'vk-token', 'admin');

    expect(result.success).toBe(false);
    expect(result.details.telegram.status).toBe('❌');
    expect(result.details.vkUser.status).toBe('❌');
    expect(result.details.adminChat.status).toBe('⚠️');
  });

  test('testServerEndpointQuick reports missing and invalid URLs', () => {
    const service = ScriptApp.getService();

    service.getUrl.mockReturnValue('');
    expect(testServerEndpointQuick()).toMatchObject({ working: false, error: expect.stringContaining('Отсутствует URL') });

    service.getUrl.mockReturnValue('https://example.com/path');
    expect(testServerEndpointQuick()).toMatchObject({ working: false, error: expect.stringContaining('не содержит') });

    service.getUrl.mockReturnValue('https://script.google.com/macros/s/mock-id/exec');
    expect(testServerEndpointQuick()).toMatchObject({ working: true });
  });

  test('checkSheetExists returns boolean status', () => {
    const sheet = createMockSheet('Licenses');
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(createMockSpreadsheet([sheet]));
    expect(checkSheetExists('Licenses')).toBe(true);

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(createMockSpreadsheet([]));
    expect(checkSheetExists('Missing')).toBe(false);
  });

  test('getServerHealthData aggregates configuration state', () => {
    PropertiesService.getScriptProperties.mockReturnValue(
      createMockProperties({
        BOT_TOKEN: 'bot',
        VK_USER_ACCESS_TOKEN: 'vk',
        ADMIN_CHAT_ID: 'admin',
      })
    );

    const checkSheetExistsSpy = jest.spyOn(global, 'checkSheetExists').mockImplementation(name => name !== 'Logs');
    const testEndpointSpy = jest.spyOn(global, 'testServerEndpointQuick').mockReturnValue({ working: false, error: 'No exec', message: 'Fix' });

    const data = getServerHealthData();

    expect(data.isHealthy).toBe(false);
    expect(data.config.hasAllTokens).toBe(true);
    expect(data.sheets.logs).toBe(false);
    expect(data.endpoint.working).toBe(false);

    checkSheetExistsSpy.mockRestore();
    testEndpointSpy.mockRestore();
  });

  test('getServerHealthHtml embeds key sections', () => {
    const html = getServerHealthHtml({
      status: '✅ OK',
      version: '6.1',
      deploymentDate: '2025-01-01',
      serverUrl: 'https://example.com',
      config: { hasAllTokens: true, missingTokens: [] },
      sheets: { licenses: true, bindings: true, logs: true },
      endpoint: { working: true, responseTime: 'inline' },
      isHealthy: true,
    });

    expect(html).toContain('VK→Telegram Crossposter Server v6.1');
    expect(html).toContain('Server URL');
    expect(html).toContain('API Endpoint');
  });

  test('findTopUser counts bindings per email', () => {
    const bindingsData = [
      ['id1', 'license', 'user@example.com'],
      ['id2', 'license', 'user@example.com'],
      ['id3', 'license', 'other@example.com'],
    ];

    expect(findTopUser(bindingsData)).toBe('user@example.com (2)');
  });
});

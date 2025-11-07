const {
  createMockSheet,
  createMockSpreadsheet,
} = global.mockHelpers;

describe('utils.gs', () => {
  beforeAll(() => {
    jest.resetModules();
    global.logEvent = jest.fn();
    global.resolveVkScreenName = jest.fn();

    require('../../server/utils.gs');
  });

  beforeEach(() => {
    global.logEvent.mockReset();
    global.resolveVkScreenName.mockReset();

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(createMockSpreadsheet());
  });

  test('escapeHtml escapes special characters', () => {
    const text = '<b>"Hello" & Goodbye</b>';
    expect(escapeHtml(text)).toBe('&lt;b&gt;&quot;Hello&quot; &amp; Goodbye&lt;/b&gt;');
  });

  test('generateBindingId returns unique binding identifiers', () => {
    const id1 = generateBindingId();
    const id2 = generateBindingId();

    expect(id1).toMatch(/^binding_\d+_[a-z0-9]{9}$/);
    expect(id2).toMatch(/^binding_\d+_[a-z0-9]{9}$/);
    expect(id1).not.toBe(id2);
  });

  test('extractVkGroupId normalizes numeric identifiers', () => {
    const result = extractVkGroupId('123456');
    expect(result).toBe('-123456');
    expect(global.logEvent).toHaveBeenCalledWith(
      'DEBUG',
      'vk_group_id_numeric',
      'server',
      expect.stringContaining('123456')
    );
  });

  test('extractVkGroupId supports explicit negative group ids', () => {
    const result = extractVkGroupId('-654321');
    expect(result).toBe('-654321');
  });

  test('extractVkGroupId maps public and club URLs', () => {
    expect(extractVkGroupId('https://vk.com/public987')).toBe('-987');
    expect(extractVkGroupId('https://vk.com/club555')).toBe('-555');
  });

  test('extractVkGroupId resolves custom screen names through VK API', () => {
    global.resolveVkScreenName.mockReturnValue('-777');

    const result = extractVkGroupId('https://vk.com/custom_group');

    expect(result).toBe('-777');
    expect(global.resolveVkScreenName).toHaveBeenCalledWith('custom_group');
    expect(global.logEvent).toHaveBeenCalledWith(
      'DEBUG',
      'vk_group_id_resolved',
      'server',
      expect.stringContaining('custom_group')
    );
  });

  test('extractVkGroupId falls back for numeric screen names', () => {
    const result = extractVkGroupId('https://vk.com/123999');
    expect(result).toBe('-123999');
  });

  test('extractVkGroupId throws informative error when resolution fails', () => {
    global.resolveVkScreenName.mockImplementation(() => {
      throw new Error('VK API down');
    });

    expect(() => extractVkGroupId('https://vk.com/failure_group')).toThrow(
      'Не удалось определить ID группы из failure_group'
    );

    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_group_id_resolution_failed',
      'server',
      expect.stringContaining('failure_group')
    );
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_url_extraction_failed',
      'server',
      expect.stringContaining('VK API down')
    );
  });

  test('extractVkGroupId validates input type', () => {
    expect(() => extractVkGroupId(null)).toThrow('Invalid URL type');
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_url_extraction_failed',
      'server',
      expect.stringContaining('Invalid URL type')
    );
  });

  test('extractTelegramChatId accepts numeric ids and usernames', () => {
    expect(extractTelegramChatId('-100123')).toBe('-100123');
    expect(extractTelegramChatId('@test_channel')).toBe('@test_channel');
    expect(extractTelegramChatId('t.me/mychannel')).toBe('@mychannel');
  });

  test('extractTelegramChatId throws on unsupported formats', () => {
    expect(() => extractTelegramChatId('invalid-format')).toThrow('Invalid Telegram format');
  });

  test('splitTextIntoChunks respects word boundaries when possible', () => {
    const text = 'word '.repeat(2000); // 10000 characters approx
    const chunks = splitTextIntoChunks(text, 1000);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(1000);
    });
  });

  test('createSheet inserts sheet and seeds header formatting', () => {
    const insertedSheet = createMockSheet('NewSheet');
    insertedSheet.appendRow = jest.fn();
    insertedSheet.setFrozenRows = jest.fn();
    insertedSheet.getRange = jest.fn(() => ({
      setBackground: jest.fn(),
      setFontColor: jest.fn(),
      setFontWeight: jest.fn(),
    }));

    const spreadsheet = {
      getSheetByName: jest.fn(() => null),
      insertSheet: jest.fn(() => insertedSheet),
    };

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(spreadsheet);

    const sheet = createSheet('NewSheet', ['Col1', 'Col2']);

    expect(spreadsheet.insertSheet).toHaveBeenCalledWith('NewSheet');
    expect(insertedSheet.appendRow).toHaveBeenCalledWith(['Col1', 'Col2']);
    expect(insertedSheet.setFrozenRows).toHaveBeenCalledWith(1);
    expect(sheet).toBe(insertedSheet);
  });

  test('getSheet returns existing sheet or throws descriptive error', () => {
    const logsSheet = createMockSheet('Logs');
    const spreadsheet = createMockSpreadsheet([logsSheet]);

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(spreadsheet);

    expect(getSheet('Logs')).toBe(logsSheet);
    expect(() => getSheet('MissingSheet')).toThrow(/Sheet 'MissingSheet' not found/);
  });
});

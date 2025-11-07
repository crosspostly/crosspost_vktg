const fixtures = require('../fixtures');

const {
  createMockRange,
  createMockSheet,
  createMockSpreadsheet,
} = global.mockHelpers;

describe('vk-posts.gs', () => {
  beforeAll(() => {
    jest.resetModules();

    global.logEvent = jest.fn();
    global.getPublishedSheetNameFromBindingName = jest.fn();

    require('../../server/vk-posts.gs');
  });

  beforeEach(() => {
    global.logEvent.mockReset();
    global.getPublishedSheetNameFromBindingName.mockReset();

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(createMockSpreadsheet());
  });

  test('formatVkPostForTelegram applies binding format settings', () => {
    const binding = {
      licenseKey: 'TEST',
      formatSettings: JSON.stringify({ boldFirstLine: true, boldUppercase: true }),
    };

    const formatted = formatVkPostForTelegram(fixtures.vkPosts.sampleTextPost, binding);

    expect(formatted.startsWith('**')).toBe(true);
    expect(formatted).toContain('**VK**');
    expect(global.logEvent).toHaveBeenCalledWith(
      'DEBUG',
      'format_settings_applied',
      'TEST',
      expect.stringContaining('Bold first: true')
    );
  });

  test('formatVkPostForTelegram handles invalid JSON in format settings gracefully', () => {
    const binding = {
      licenseKey: 'TEST',
      formatSettings: '{invalid-json}',
    };

    const formatted = formatVkPostForTelegram(fixtures.vkPosts.sampleTextPost, binding);
    const defaultFormatted = formatVkTextForTelegram(fixtures.vkPosts.sampleTextPost.text, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    expect(formatted).toBe(defaultFormatted);
    expect(global.logEvent).toHaveBeenCalledWith(
      'WARN',
      'format_settings_parse_error',
      'TEST',
      expect.any(String)
    );
  });

  test('createMediaSummary counts attachment types', () => {
    const attachments = [
      { type: 'photo' },
      { type: 'photo' },
      { type: 'video' },
      { type: 'doc' },
      { type: 'link' },
      { type: 'unknown' },
    ];

    expect(createMediaSummary(attachments)).toBe('2 photos, 1 video, 1 doc, 1 link, 1 other');
  });

  test('createMediaSummary returns no media when attachments missing', () => {
    expect(createMediaSummary([])).toBe('no media');
    expect(createMediaSummary(null)).toBe('no media');
  });

  test('createMediaSummary logs and returns fallback when counting fails', () => {
    const attachments = [
      Object.defineProperty({}, 'type', {
        get() {
          throw new Error('Cannot read type');
        },
      }),
    ];

    expect(createMediaSummary(attachments)).toBe('error counting media');
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'media_summary_failed',
      'server',
      expect.stringContaining('Cannot read type')
    );
  });

  test('checkPostAlreadySent returns true when success or partial entry matches', () => {
    const sheetValues = [
      ['timestamp', 'status', 'vkGroupId', 'vkPostId'],
      ['2024-01-01', 'success', '-123', '100'],
      ['2024-01-02', 'partial', '-123', '101'],
      ['2024-01-03', 'error', '-123', '102'],
    ];

    const sheet = {
      getLastRow: jest.fn().mockReturnValue(sheetValues.length),
      getRange: jest.fn((row, column, numRows, numCols) => {
        const subset = sheetValues
          .slice(row - 1, row - 1 + numRows)
          .map(arr => arr.slice(column - 1, column - 1 + numCols));
        return createMockRange(subset);
      }),
      getName: jest.fn().mockReturnValue('BindingSheet'),
    };

    const spreadsheet = {
      getSheetByName: jest.fn(name => (name === 'BindingSheet' ? sheet : null)),
    };

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(spreadsheet);
    global.getPublishedSheetNameFromBindingName.mockReturnValue('BindingSheet');

    expect(checkPostAlreadySent('BindingA', '100')).toBe(true);
    expect(checkPostAlreadySent('BindingA', '101')).toBe(true);
    expect(checkPostAlreadySent('BindingA', '102')).toBe(false);

    expect(sheet.getRange).toHaveBeenCalledWith(2, 2, 3, 3);
  });

  test('checkPostAlreadySent returns false when published sheet missing', () => {
    const spreadsheet = {
      getSheetByName: jest.fn(() => null),
    };

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(spreadsheet);
    global.getPublishedSheetNameFromBindingName.mockReturnValue('MissingSheet');

    expect(checkPostAlreadySent('BindingB', '999')).toBe(false);
  });

  test('checkPostAlreadySent logs warning and returns false when range fetch fails', () => {
    const sheet = {
      getLastRow: jest.fn().mockReturnValue(5),
      getRange: jest.fn(() => {
        throw new Error('Range error');
      }),
      getName: jest.fn().mockReturnValue('BrokenSheet'),
    };

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue({
      getSheetByName: jest.fn(() => sheet),
    });
    global.getPublishedSheetNameFromBindingName.mockReturnValue('BrokenSheet');

    expect(checkPostAlreadySent('BindingC', '123')).toBe(false);
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'check_post_already_sent_failed',
      'server',
      expect.stringContaining('Range error')
    );
  });
});

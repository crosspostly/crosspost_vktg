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

    global.loadGasFile(require.resolve('../../server/vk-posts.gs'));
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

    expect(formatted.startsWith('<b>')).toBe(true);
    expect(formatted).toContain('<b>VK</b>');
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

  test('formatVkTextForTelegram converts VK hyperlinks to HTML format', () => {
    const textWithLinks = 'Check out this link: [https://example.com|Example Site] and this user: [id12345|John Doe]';
    const formatted = formatVkTextForTelegram(textWithLinks, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    expect(formatted).toContain('<a href="https://example.com">Example Site</a>');
    expect(formatted).toContain('<a href="https://vk.com/id12345">John Doe</a>');
  });

  test('formatVkTextForTelegram preserves line breaks', () => {
    const textWithBreaks = 'First line\n\nSecond line\n\n\nThird line';
    const formatted = formatVkTextForTelegram(textWithBreaks, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    // Should preserve original line breaks
    expect(formatted).toBe('First line\n\nSecond line\n\n\nThird line');
  });

  test('formatVkTextForTelegram handles VK club/group links', () => {
    const textWithGroups = 'Check out this club: [club12345|My Club] and public page: [public67890|Public Page]';
    const formatted = formatVkTextForTelegram(textWithGroups, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    expect(formatted).toContain('<a href="https://vk.com/club12345">My Club</a>');
    expect(formatted).toContain('<a href="https://vk.com/public67890">Public Page</a>');
  });

  test('formatVkTextForTelegram handles VK URLs without protocol (CRITICAL)', () => {
    const textWithVkLinks = 'Check this vk.com link: [vk.com/daoqub|DAOQUB] and wall post: [vk.com/wall-123_456|Wall Post]';
    const formatted = formatVkTextForTelegram(textWithVkLinks, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    expect(formatted).toContain('<a href="https://vk.com/daoqub">DAOQUB</a>');
    expect(formatted).toContain('<a href="https://vk.com/wall-123_456">Wall Post</a>');
  });

  test('formatVkTextForTelegram handles VK URLs with protocol', () => {
    const textWithVkLinks = 'Check this https vk.com link: [https://vk.com/daoqub|DAOQUB] and http: [http://vk.com/wall-123_456|Wall Post]';
    const formatted = formatVkTextForTelegram(textWithVkLinks, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    expect(formatted).toContain('<a href="https://vk.com/daoqub">DAOQUB</a>');
    expect(formatted).toContain('<a href="http://vk.com/wall-123_456">Wall Post</a>');
  });

  test('formatVkTextForTelegram handles mixed hyperlink formats with correct priority', () => {
    const mixedText = 'User: [id12345|John] | Group: [club67890|Group] | VK no protocol: [vk.com/test|Test] | VK with protocol: [https://vk.com/test2|Test2] | General: [https://example.com|Example]';
    const formatted = formatVkTextForTelegram(mixedText, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    // Check all formats are converted correctly
    expect(formatted).toContain('<a href="https://vk.com/id12345">John</a>');
    expect(formatted).toContain('<a href="https://vk.com/club67890">Group</a>');
    expect(formatted).toContain('<a href="https://vk.com/test">Test</a>');
    expect(formatted).toContain('<a href="https://vk.com/test2">Test2</a>');
    expect(formatted).toContain('<a href="https://example.com">Example</a>');
  });

  test('formatVkTextForTelegram critical example from requirements', () => {
    const criticalText = 'Очень новый пост [vk.com/daoqub|с гиперссылкой]';
    const formatted = formatVkTextForTelegram(criticalText, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    expect(formatted).toBe('Очень новый пост <a href="https://vk.com/daoqub">с гиперссылкой</a>');
  });

  test('formatVkTextForTelegram complex VK URL formats', () => {
    const complexText = 'Various VK formats: [vk.com/wall-123_456|Post], [vk.com/club123|Club], [vk.com/public456|Public], [vk.com/id789|User]';
    const formatted = formatVkTextForTelegram(complexText, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    expect(formatted).toContain('<a href="https://vk.com/wall-123_456">Post</a>');
    expect(formatted).toContain('<a href="https://vk.com/club123">Club</a>');
    expect(formatted).toContain('<a href="https://vk.com/public456">Public</a>');
    expect(formatted).toContain('<a href="https://vk.com/id789">User</a>');
  });

  test('formatVkTextForTelegram preserves line breaks with hyperlinks', () => {
    const textWithBreaksAndLinks = 'First line with [vk.com/test1|link1]\n\nSecond line with [https://example.com|link2]\n\nThird line';
    const formatted = formatVkTextForTelegram(textWithBreaksAndLinks, {
      boldFirstLine: false,
      boldUppercase: false,
    });

    expect(formatted).toBe('First line with <a href="https://vk.com/test1">link1</a>\n\nSecond line with <a href="https://example.com">link2</a>\n\nThird line');
  });
});

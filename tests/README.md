# Testing Documentation

This directory contains the test suite for the VK→Telegram Crossposter application. The test infrastructure provides comprehensive mocks for Google Apps Script services and fixtures for common test scenarios.

## Table of Contents

- [Directory Structure](#directory-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Using Mocks](#using-mocks)
- [Using Fixtures](#using-fixtures)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Directory Structure

```
tests/
├── README.md                    # This file
├── setupAppsScript.js           # Google Apps Script mocks and helpers
├── unit/                        # Unit tests (individual functions)
│   └── smoke.test.js           # Smoke tests verifying harness works
├── integration/                 # Integration tests (component interactions)
│   └── smoke.test.js           # Integration smoke tests
└── fixtures/                    # Test data and fixtures
    ├── index.js                # Fixture helpers and utilities
    ├── vk-posts.json           # Sample VK post data
    └── bindings.json           # Sample binding/license data
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage Report

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npm test -- tests/unit/smoke.test.js
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="VK API"
```

## Writing Tests

### Unit Tests

Unit tests focus on testing individual functions in isolation. Place unit tests in `tests/unit/`.

**Example: Testing a utility function**

```javascript
// tests/unit/utils.test.js
const fixtures = require('../fixtures');

describe('extractVkGroupId', () => {
  // Import or require the function being tested
  // For .gs files, you may need to load them via babel-jest
  
  test('extracts group ID from vk.com/club URL', () => {
    const url = 'https://vk.com/club123456789';
    const result = extractVkGroupId(url);
    expect(result).toBe('-123456789');
  });
  
  test('extracts group ID from vk.com/public URL', () => {
    const url = 'https://vk.com/public987654321';
    const result = extractVkGroupId(url);
    expect(result).toBe('-987654321');
  });
  
  test('returns null for screen names', () => {
    const url = 'https://vk.com/mygroup';
    const result = extractVkGroupId(url);
    expect(result).toBeNull();
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly. Place integration tests in `tests/integration/`.

**Example: Testing API interaction with sheets**

```javascript
// tests/integration/vk-to-telegram.test.js
const fixtures = require('../fixtures');

describe('VK to Telegram Integration', () => {
  let mockSpreadsheet;
  
  beforeEach(() => {
    // Set up mock spreadsheet with bindings
    const bindings = [fixtures.bindings.validBinding];
    mockSpreadsheet = fixtures.createBindingsSheet(bindings);
    
    // Mock SpreadsheetApp to return our mock
    global.SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
  });
  
  test('sends VK post to Telegram via binding', () => {
    // Mock VK API response
    const vkResponse = fixtures.createVkApiResponse([
      fixtures.vkPosts.sampleTextPost
    ]);
    
    global.UrlFetchApp.fetch.mockImplementation((url) => {
      if (url.includes('vk.com')) {
        return global.mockHelpers.createMockHttpResponse({
          code: 200,
          contentText: JSON.stringify(vkResponse)
        });
      }
      if (url.includes('telegram.org')) {
        const tgMessage = fixtures.createTelegramMessage(123);
        const tgResponse = fixtures.createTelegramApiResponse(true, tgMessage);
        return global.mockHelpers.createMockHttpResponse({
          code: 200,
          contentText: JSON.stringify(tgResponse)
        });
      }
    });
    
    // Test the integration
    // const result = sendVkPostToTelegram(binding, post);
    // expect(result.success).toBe(true);
  });
});
```

## Using Mocks

All Google Apps Script services are automatically mocked via `setupAppsScript.js`. Mocks are automatically reset between tests (`clearMocks: true`).

### Available Mock Services

- **SpreadsheetApp**: Spreadsheets, sheets, ranges
- **PropertiesService**: Script/user/document properties
- **UrlFetchApp**: HTTP requests and responses
- **CacheService**: Script/user/document cache
- **Logger**: Logging functions
- **Utilities**: Date formatting, encoding, UUID generation
- **LockService**: Script locks
- **ScriptApp**: Triggers and script metadata
- **Session**: User information and timezone
- **HtmlService**: HTML dialogs

### Mock Helper Functions

Access helper functions via `global.mockHelpers`:

#### createMockSheet(name, data)

Creates a mock Google Sheets sheet.

```javascript
const sheet = global.mockHelpers.createMockSheet('TestSheet', [
  ['Header 1', 'Header 2'],
  ['Value 1', 'Value 2']
]);

expect(sheet.getName()).toBe('TestSheet');
expect(sheet.getLastRow()).toBe(2);
```

#### createMockSpreadsheet(sheets)

Creates a mock spreadsheet with multiple sheets.

```javascript
const sheet1 = global.mockHelpers.createMockSheet('Sheet1');
const sheet2 = global.mockHelpers.createMockSheet('Sheet2');
const spreadsheet = global.mockHelpers.createMockSpreadsheet([sheet1, sheet2]);

expect(spreadsheet.getSheets()).toHaveLength(2);
expect(spreadsheet.getSheetByName('Sheet1')).toBe(sheet1);
```

#### createMockRange(values)

Creates a mock range with cell values.

```javascript
const range = global.mockHelpers.createMockRange([
  ['A1', 'B1'],
  ['A2', 'B2']
]);

expect(range.getNumRows()).toBe(2);
expect(range.getValues()).toEqual([['A1', 'B1'], ['A2', 'B2']]);
```

#### createMockProperties(initialProps)

Creates a mock properties object.

```javascript
const props = global.mockHelpers.createMockProperties({
  vkToken: 'test-token'
});

expect(props.getProperty('vkToken')).toBe('test-token');
props.setProperty('newKey', 'newValue');
expect(props.getProperty('newKey')).toBe('newValue');
```

#### createMockHttpResponse(options)

Creates a mock HTTP response.

```javascript
const response = global.mockHelpers.createMockHttpResponse({
  code: 200,
  contentText: '{"status":"ok"}'
});

expect(response.getResponseCode()).toBe(200);
expect(response.getContentText()).toBe('{"status":"ok"}');
```

#### createMockCache()

Creates a mock cache object.

```javascript
const cache = global.CacheService.getScriptCache();
cache.put('key', 'value', 600);
expect(cache.get('key')).toBe('value');
```

### Customizing Mock Behavior

You can customize mock behavior for specific tests:

```javascript
test('handles VK API rate limit', () => {
  global.UrlFetchApp.fetch.mockReturnValue(
    global.mockHelpers.createMockHttpResponse({
      code: 429,
      contentText: JSON.stringify(fixtures.vkApiErrors.rateLimit)
    })
  );
  
  // Test rate limit handling
  // const result = callVkApi();
  // expect(result.error).toContain('rate limit');
});
```

## Using Fixtures

Fixtures provide realistic test data for VK posts, bindings, and licenses.

### Importing Fixtures

```javascript
const fixtures = require('../fixtures');
```

### Available Fixtures

#### VK Posts

```javascript
// Individual posts
fixtures.vkPosts.sampleTextPost       // Text-only post
fixtures.vkPosts.postWithPhoto        // Post with single photo
fixtures.vkPosts.postWithMultiplePhotos  // Post with photo album
fixtures.vkPosts.postWithVideo        // Post with video
fixtures.vkPosts.postWithLink         // Post with link
fixtures.vkPosts.postWithDoc          // Post with document
fixtures.vkPosts.postWithAudio        // Post with audio
fixtures.vkPosts.postWithMixedMedia   // Post with multiple media types
fixtures.vkPosts.longPost             // Post exceeding Telegram limits
fixtures.vkPosts.emptyPost            // Post with no text

// Get all posts as array
const allPosts = fixtures.getAllVkPosts();
```

#### Bindings

```javascript
// Individual bindings
fixtures.bindings.validBinding         // Standard valid binding
fixtures.bindings.bindingWithUsername  // Binding with @username
fixtures.bindings.bindingWithCustomSettings  // Binding with custom config
fixtures.bindings.inactiveBinding      // Inactive binding

// Sheet data
fixtures.bindings.bindingSheetData     // Array for Bindings sheet
fixtures.bindings.licenseSheetData     // Array for Licenses sheet
fixtures.bindings.publishedPostsData   // Array for published posts

// Get all bindings as array
const allBindings = fixtures.getAllBindings();
```

### Fixture Helper Functions

#### createVkApiResponse(items, count)

Creates a VK API response structure.

```javascript
const response = fixtures.createVkApiResponse([
  fixtures.vkPosts.sampleTextPost,
  fixtures.vkPosts.postWithPhoto
]);

// response.response.items === array of posts
// response.response.count === 2
```

#### createTelegramApiResponse(ok, result, description)

Creates a Telegram API response.

```javascript
// Success response
const success = fixtures.createTelegramApiResponse(true, {
  message_id: 123,
  chat: { id: '-1001234567890' }
});

// Error response
const error = fixtures.createTelegramApiResponse(false, 
  { error_code: 400 }, 
  'Bad Request: chat not found'
);
```

#### createTelegramMessage(messageId, chatId, text)

Creates a Telegram message object.

```javascript
const message = fixtures.createTelegramMessage(123, '-1001234567890', 'Test');
expect(message.message_id).toBe(123);
expect(message.chat.id).toBe('-1001234567890');
```

#### createBindingsSheet(bindingObjects)

Creates a mock spreadsheet with bindings data.

```javascript
const bindings = [
  fixtures.bindings.validBinding,
  fixtures.bindings.bindingWithUsername
];

const spreadsheet = fixtures.createBindingsSheet(bindings);
const bindingsSheet = spreadsheet.getSheetByName('Bindings');
const data = bindingsSheet.getDataRange().getValues();
// data[0] = header row
// data[1] = first binding
// data[2] = second binding
```

#### createLicensesSheet(licenseRows)

Creates a mock spreadsheet with license data.

```javascript
const spreadsheet = fixtures.createLicensesSheet();
const licensesSheet = spreadsheet.getSheetByName('Licenses');
```

#### createPublishedPostsSheet(bindingName, postsData)

Creates a mock spreadsheet with published posts data.

```javascript
const spreadsheet = fixtures.createPublishedPostsSheet('TestBinding01');
const postsSheet = spreadsheet.getSheetByName('TestBinding01');
```

#### createServerDoPostEvent(action, params)

Creates a mock doPost event for server endpoints.

```javascript
const event = fixtures.createServerDoPostEvent('getVkPosts', {
  vkGroupId: '-123456789',
  count: 10
});

// const response = doPost(event);
```

### Error Response Fixtures

Pre-configured error responses for common scenarios:

```javascript
// VK API errors
fixtures.vkApiErrors.rateLimit
fixtures.vkApiErrors.accessDenied
fixtures.vkApiErrors.invalidGroup
fixtures.vkApiErrors.groupNotFound
fixtures.vkApiErrors.screenNameNotFound

// Telegram API errors
fixtures.telegramApiErrors.chatNotFound
fixtures.telegramApiErrors.messageNotModified
fixtures.telegramApiErrors.fileTooLarge
fixtures.telegramApiErrors.invalidChatId
fixtures.telegramApiErrors.botBlocked
fixtures.telegramApiErrors.tooManyRequests
```

**Example usage:**

```javascript
test('handles Telegram rate limit', () => {
  global.UrlFetchApp.fetch.mockReturnValue(
    global.mockHelpers.createMockHttpResponse({
      code: 429,
      contentText: JSON.stringify(fixtures.telegramApiErrors.tooManyRequests)
    })
  );
  
  // Test rate limit handling
});
```

## Best Practices

### 1. Keep Tests Isolated

Each test should be independent and not rely on the state from other tests.

```javascript
describe('My Feature', () => {
  beforeEach(() => {
    // Reset mocks and state before each test
    jest.clearAllMocks();
  });
  
  test('test 1', () => {
    // This test is isolated
  });
  
  test('test 2', () => {
    // This test is also isolated
  });
});
```

### 2. Use Descriptive Test Names

Test names should clearly describe what is being tested.

```javascript
// Good
test('extracts group ID from vk.com/club URL with HTTPS', () => { });

// Bad
test('test1', () => { });
```

### 3. Test Edge Cases

Always test boundary conditions and edge cases.

```javascript
test('handles empty string input', () => { });
test('handles null input', () => { });
test('handles very long input', () => { });
test('handles special characters', () => { });
```

### 4. Use Fixtures for Realistic Data

Don't hardcode test data; use fixtures for consistent, realistic test scenarios.

```javascript
// Good
const post = fixtures.vkPosts.postWithPhoto;
expect(formatPost(post)).toBeDefined();

// Bad
const post = { id: 1, text: 'test' };  // Incomplete, unrealistic
```

### 5. Mock External Dependencies

Always mock external API calls and services.

```javascript
test('calls VK API with correct parameters', () => {
  global.UrlFetchApp.fetch.mockReturnValue(
    global.mockHelpers.createMockHttpResponse({ code: 200, contentText: '{}' })
  );
  
  // Test function that calls VK API
  // Verify mock was called with expected parameters
  expect(global.UrlFetchApp.fetch).toHaveBeenCalledWith(
    expect.stringContaining('api.vk.com'),
    expect.any(Object)
  );
});
```

### 6. Test Both Success and Failure Paths

Test both successful operations and error handling.

```javascript
test('successfully sends post to Telegram', () => {
  // Mock successful response
});

test('handles Telegram API error gracefully', () => {
  // Mock error response
});
```

### 7. Keep Tests Fast

Avoid unnecessary delays or complex operations in tests.

```javascript
// Good
test('formats date correctly', () => {
  const result = formatDate(new Date('2024-01-15'));
  expect(result).toBe('2024-01-15');
});

// Bad (don't use real delays in tests)
test('waits for result', async () => {
  await new Promise(resolve => setTimeout(resolve, 5000));  // ❌
});
```

## Troubleshooting

### Tests Are Failing

1. **Check mock setup**: Ensure `setupAppsScript.js` is loaded correctly
2. **Clear Jest cache**: `npm test -- --clearCache`
3. **Check for import errors**: Verify fixture imports are correct
4. **Review test output**: Jest provides detailed error messages

### Mocks Not Working

1. **Verify setup file**: Check `jest.config.js` includes `setupAppsScript.js`
2. **Check mock helpers**: Ensure `global.mockHelpers` is available
3. **Clear mocks between tests**: Use `jest.clearAllMocks()` in `beforeEach`

### Coverage Too Low

1. **Add more unit tests**: Focus on uncovered functions
2. **Test edge cases**: Add tests for boundary conditions
3. **Check coverage report**: `npm run test:coverage` shows uncovered lines
4. **Review coverage in browser**: Open `coverage/lcov-report/index.html`

### Fixture Data Not Loading

1. **Check file paths**: Verify `require('../fixtures')` path is correct
2. **Validate JSON**: Ensure fixture JSON files are valid
3. **Check Node modules**: Ensure Jest can resolve the fixture module

### Performance Issues

1. **Run specific tests**: Use `--testNamePattern` to run subset
2. **Disable coverage**: Run without `--coverage` for faster execution
3. **Check for infinite loops**: Review test code for blocking operations

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Google Apps Script Reference](https://developers.google.com/apps-script/reference)
- [Project CI/CD Guide](../GITHUB_ACTIONS_SETUP.md)
- [Main README](../README.md)

---

**Need help?** Check the [main troubleshooting guide](../TROUBLESHOOTING.md) or review existing tests for examples.

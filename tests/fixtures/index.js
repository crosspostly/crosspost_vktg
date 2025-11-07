/**
 * Fixture Data Helpers
 * 
 * This module provides easy access to test fixture data for VK posts, bindings,
 * and license sheets. All fixtures are loaded from JSON files in this directory.
 * 
 * Usage:
 *   const { vkPosts, bindings } = require('./tests/fixtures');
 *   const post = vkPosts.sampleTextPost;
 *   const binding = bindings.validBinding;
 */

const vkPosts = require('./vk-posts.json');
const bindings = require('./bindings.json');

/**
 * Helper to create a mock VK API response
 * @param {Array} items - Array of VK post objects
 * @param {number} count - Total count of posts
 * @returns {Object} VK API response structure
 */
function createVkApiResponse(items = [], count = null) {
  return {
    response: {
      count: count !== null ? count : items.length,
      items: items,
    },
  };
}

/**
 * Helper to create a mock Telegram API response
 * @param {boolean} ok - Success status
 * @param {Object} result - Result object
 * @param {string} description - Error description (if ok=false)
 * @returns {Object} Telegram API response structure
 */
function createTelegramApiResponse(ok = true, result = {}, description = '') {
  if (ok) {
    return {
      ok: true,
      result: result,
    };
  } else {
    return {
      ok: false,
      description: description,
      error_code: result.error_code || 400,
    };
  }
}

/**
 * Helper to create a mock Telegram message response
 * @param {number} messageId - Message ID
 * @param {string} chatId - Chat ID
 * @param {string} text - Message text
 * @returns {Object} Telegram message object
 */
function createTelegramMessage(messageId = 123, chatId = '-1001234567890', text = 'Test message') {
  return {
    message_id: messageId,
    chat: {
      id: chatId,
      type: 'supergroup',
      title: 'Test Channel',
      username: 'test_channel',
    },
    date: Math.floor(Date.now() / 1000),
    text: text,
  };
}

/**
 * Helper to create a mock spreadsheet with binding data
 * @param {Array<Object>} bindingObjects - Array of binding objects
 * @returns {Object} Mock spreadsheet with Bindings sheet
 */
function createBindingsSheet(bindingObjects = []) {
  const { createMockSheet, createMockSpreadsheet } = global.mockHelpers || {};
  
  if (!createMockSheet || !createMockSpreadsheet) {
    throw new Error('mockHelpers not available. Ensure setupAppsScript.js is loaded.');
  }
  
  const header = ['Binding Name', 'VK Group ID', 'Telegram Chat ID', 'Description', 'Status', 'Last Check', 'Posts Sent'];
  const rows = bindingObjects.map(b => [
    b.bindingName,
    b.vkGroupId,
    b.telegramChatId,
    b.description,
    b.status,
    b.lastCheck || '',
    b.postsSent || '0',
  ]);
  
  const data = [header, ...rows];
  const sheet = createMockSheet('Bindings', data);
  
  return createMockSpreadsheet([sheet]);
}

/**
 * Helper to create a mock spreadsheet with license data
 * @param {Array<Array>} licenseRows - License sheet rows
 * @returns {Object} Mock spreadsheet with Licenses sheet
 */
function createLicensesSheet(licenseRows = null) {
  const { createMockSheet, createMockSpreadsheet } = global.mockHelpers || {};
  
  if (!createMockSheet || !createMockSpreadsheet) {
    throw new Error('mockHelpers not available. Ensure setupAppsScript.js is loaded.');
  }
  
  const data = licenseRows || bindings.licenseSheetData;
  const sheet = createMockSheet('Licenses', data);
  
  return createMockSpreadsheet([sheet]);
}

/**
 * Helper to create a mock spreadsheet with published posts data
 * @param {string} bindingName - Name of the binding
 * @param {Array<Array>} postsData - Published posts rows
 * @returns {Object} Mock spreadsheet with binding sheet
 */
function createPublishedPostsSheet(bindingName = 'TestBinding01', postsData = null) {
  const { createMockSheet, createMockSpreadsheet } = global.mockHelpers || {};
  
  if (!createMockSheet || !createMockSpreadsheet) {
    throw new Error('mockHelpers not available. Ensure setupAppsScript.js is loaded.');
  }
  
  const data = postsData || bindings.publishedPostsData;
  const sheet = createMockSheet(bindingName, data);
  
  return createMockSpreadsheet([sheet]);
}

/**
 * Helper to get all VK posts as an array
 * @returns {Array<Object>} Array of all VK post fixtures
 */
function getAllVkPosts() {
  return Object.keys(vkPosts)
    .filter(key => !key.includes('Post') || vkPosts[key].id !== undefined)
    .map(key => vkPosts[key]);
}

/**
 * Helper to get all bindings as an array
 * @returns {Array<Object>} Array of all binding fixtures
 */
function getAllBindings() {
  return Object.keys(bindings)
    .filter(key => bindings[key].bindingName !== undefined)
    .map(key => bindings[key]);
}

/**
 * Helper to create a mock server doPost event
 * @param {string} action - Action name (e.g., 'getVkPosts', 'sendPost')
 * @param {Object} params - Action parameters
 * @returns {Object} doPost event object
 */
function createServerDoPostEvent(action, params = {}) {
  return {
    parameter: {},
    parameters: {},
    postData: {
      length: 100,
      type: 'application/json',
      contents: JSON.stringify({
        action: action,
        ...params,
      }),
    },
    contextPath: '',
    contentLength: 100,
  };
}

/**
 * Helper to create mock VK API error responses
 */
const vkApiErrors = {
  rateLimit: {
    error: {
      error_code: 6,
      error_msg: 'Too many requests per second',
    },
  },
  
  accessDenied: {
    error: {
      error_code: 15,
      error_msg: 'Access denied: group is private',
    },
  },
  
  invalidGroup: {
    error: {
      error_code: 100,
      error_msg: 'One of the parameters specified was missing or invalid: group_id',
    },
  },
  
  groupNotFound: {
    error: {
      error_code: 113,
      error_msg: 'Invalid user id',
    },
  },
  
  screenNameNotFound: {
    error: {
      error_code: 5,
      error_msg: 'User authorization failed: invalid access_token',
    },
  },
};

/**
 * Helper to create mock Telegram API error responses
 */
const telegramApiErrors = {
  chatNotFound: createTelegramApiResponse(false, { error_code: 400 }, 'Bad Request: chat not found'),
  
  messageNotModified: createTelegramApiResponse(false, { error_code: 400 }, 'Bad Request: message is not modified'),
  
  fileTooLarge: createTelegramApiResponse(false, { error_code: 400 }, 'Bad Request: file is too large'),
  
  invalidChatId: createTelegramApiResponse(false, { error_code: 400 }, 'Bad Request: chat_id is invalid'),
  
  botBlocked: createTelegramApiResponse(false, { error_code: 403 }, 'Forbidden: bot was blocked by the user'),
  
  tooManyRequests: createTelegramApiResponse(false, { error_code: 429 }, 'Too Many Requests: retry after 30'),
};

module.exports = {
  // Fixture data
  vkPosts,
  bindings,
  
  // Response helpers
  createVkApiResponse,
  createTelegramApiResponse,
  createTelegramMessage,
  
  // Sheet helpers
  createBindingsSheet,
  createLicensesSheet,
  createPublishedPostsSheet,
  
  // Data helpers
  getAllVkPosts,
  getAllBindings,
  
  // Event helpers
  createServerDoPostEvent,
  
  // Error responses
  vkApiErrors,
  telegramApiErrors,
};

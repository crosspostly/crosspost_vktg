const fixtures = require('../fixtures');

const {
  createMockHttpResponse,
  createMockProperties,
} = global.mockHelpers;

function createJsonResponse(body, status = 200) {
  return {
    getContent: () => JSON.stringify(body),
    getResponseCode: () => status,
    body,
    status,
  };
}

describe('vk-api.gs', () => {
  beforeAll(() => {
    jest.resetModules();

    global.VK_API_VERSION = '5.131';
    global.TIMEOUTS = { FAST: 8000, MEDIUM: 15000, SLOW: 30000 };

    global.logApiError = jest.fn();
    global.logEvent = jest.fn();
    global.jsonResponse = jest.fn((body, status) => createJsonResponse(body, status));
    global.handleCheckLicense = jest.fn();
    global.extractVkGroupId = jest.fn();
    global.getUserBindings = jest.fn();
    global.checkPostAlreadySent = jest.fn();

    require('../../server/vk-api.gs');
  });

  beforeEach(() => {
    global.logEvent.mockReset();
    global.logApiError.mockReset();
    global.jsonResponse.mockImplementation((body, status) => createJsonResponse(body, status));
    global.handleCheckLicense.mockReset();
    global.extractVkGroupId.mockReset();
    global.getUserBindings.mockReset();
    global.checkPostAlreadySent.mockReset();

    UrlFetchApp.fetch.mockReset();
    PropertiesService.getScriptProperties.mockReset();

    global.handleCheckLicense.mockImplementation(() => createJsonResponse({ success: true }, 200));
    global.extractVkGroupId.mockImplementation(() => '-123456');
    global.getUserBindings.mockReturnValue([]);
    global.checkPostAlreadySent.mockReturnValue(false);
  });

  function setVkToken(token = 'vk-user-token') {
    const props = createMockProperties({ VK_USER_ACCESS_TOKEN: token });
    PropertiesService.getScriptProperties.mockReturnValue(props);
    return props;
  }

  test('resolveVkScreenName returns normalized group id when VK API succeeds', () => {
    setVkToken();
    UrlFetchApp.fetch.mockReturnValue(
      createMockHttpResponse({
        code: 200,
        contentText: JSON.stringify({
          response: {
            object_id: 987654,
            type: 'group',
          },
        }),
      })
    );

    const result = resolveVkScreenName('TestGroup');

    expect(result).toBe('-987654');
    expect(UrlFetchApp.fetch).toHaveBeenCalledWith(
      expect.stringContaining('utils.resolveScreenName'),
      expect.objectContaining({ muteHttpExceptions: true, timeout: TIMEOUTS.FAST })
    );
    expect(global.logEvent).toHaveBeenCalledWith(
      'INFO',
      'vk_resolve_screen_name_success',
      'system',
      expect.stringContaining('TestGroup')
    );
  });

  test('resolveVkScreenName throws when VK user token is missing', () => {
    PropertiesService.getScriptProperties.mockReturnValue(createMockProperties({}));

    expect(() => resolveVkScreenName('missingTokenGroup')).toThrow(
      'VK User Access Token не настроен'
    );
  });

  test('resolveVkScreenName surfaces VK API errors and logs details', () => {
    setVkToken();
    UrlFetchApp.fetch.mockReturnValue(
      createMockHttpResponse({
        code: 200,
        contentText: JSON.stringify({
          error: {
            error_code: 113,
            error_msg: 'Invalid user id',
          },
        }),
      })
    );

    expect(() => resolveVkScreenName('badScreen')).toThrow(
      'Не удалось резольвить badScreen: Невалидное имя screenname: badScreen - Invalid user id'
    );

    expect(global.logEvent).toHaveBeenCalledWith(
      'WARN',
      'vk_resolve_screen_name_api_error',
      'system',
      expect.stringContaining('badScreen')
    );
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_resolve_screen_name_failed',
      'system',
      expect.stringContaining('badScreen')
    );
  });

  test('getVkPosts returns mapped posts from VK API response', () => {
    setVkToken();
    const vkPostFixtures = [
      fixtures.vkPosts.sampleTextPost,
      fixtures.vkPosts.postWithPhoto,
    ];

    UrlFetchApp.fetch.mockReturnValue(
      createMockHttpResponse({
        code: 200,
        contentText: JSON.stringify(fixtures.createVkApiResponse(vkPostFixtures, 5)),
      })
    );

    const posts = getVkPosts('123456789', 2);

    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({ id: vkPostFixtures[0].id, text: expect.any(String) });
    expect(UrlFetchApp.fetch).toHaveBeenCalledWith(
      expect.stringContaining('owner_id=-123456789'),
      expect.objectContaining({ timeout: TIMEOUTS.MEDIUM })
    );
    expect(global.logEvent).toHaveBeenCalledWith(
      'INFO',
      'vk_posts_retrieved',
      'server',
      expect.stringContaining('Posts found: 2')
    );
  });

  test('getVkPosts logs when VK API returns no items', () => {
    setVkToken();
    UrlFetchApp.fetch.mockReturnValue(
      createMockHttpResponse({
        code: 200,
        contentText: JSON.stringify({ response: { items: [], count: 0 } }),
      })
    );

    const posts = getVkPosts('555', 1);

    expect(posts).toEqual([]);
    expect(global.logEvent).toHaveBeenCalledWith(
      'INFO',
      'vk_posts_empty',
      'server',
      expect.stringContaining('Group ID: 555')
    );
  });

  test('getVkPosts throws when VK user token missing', () => {
    PropertiesService.getScriptProperties.mockReturnValue(createMockProperties({}));

    expect(() => getVkPosts('123')).toThrow('VK User Access Token not configured');
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_api_error',
      'server',
      expect.stringContaining('Group ID: 123')
    );
  });

  test('getVkPosts throws enriched message and logs on VK API error', () => {
    setVkToken();
    UrlFetchApp.fetch.mockReturnValue(
      createMockHttpResponse({
        code: 200,
        contentText: JSON.stringify({
          error: {
            error_code: 15,
            error_msg: 'Access denied',
          },
        }),
      })
    );

    expect(() => getVkPosts('-999'))
      .toThrow('Нет доступа к группе: Access denied');

    expect(global.logApiError).toHaveBeenCalledWith(
      'VK_API',
      'wall.get',
      expect.any(Object),
      expect.objectContaining({ error_code: 15 })
    );
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_api_error',
      'server',
      expect.stringContaining('Access denied')
    );
  });

  test('handleGetVkPosts returns original license response when license check fails', () => {
    const licenseResponse = createJsonResponse({ success: false, error: 'License not found' }, 404);
    global.handleCheckLicense.mockImplementationOnce(() => licenseResponse);

    const response = handleGetVkPosts({ license_key: 'TEST', vk_group_id: 'club123' }, '1.1.1.1');

    expect(response).toBe(licenseResponse);
    expect(global.handleCheckLicense).toHaveBeenCalledWith({ license_key: 'TEST' }, '1.1.1.1');
  });

  test('handleGetVkPosts returns validation error when vk_group_id cannot be resolved', () => {
    global.extractVkGroupId.mockImplementation(() => {
      throw new Error('format invalid');
    });

    const response = handleGetVkPosts({ license_key: 'TEST', vk_group_id: 'bad' }, '2.2.2.2');
    const payload = JSON.parse(response.getContent());

    expect(global.jsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('Invalid vk_group_id format') }),
      400
    );
    expect(payload.success).toBe(false);
    expect(global.logEvent).toHaveBeenCalledWith(
      'WARN',
      'invalid_vk_group_id_format',
      'TEST',
      expect.stringContaining('bad')
    );
  });

  test('handleGetVkPosts returns server error when VK token missing', () => {
    setVkToken(null);
    global.extractVkGroupId.mockReturnValue('-321');

    const response = handleGetVkPosts({ license_key: 'TEST', vk_group_id: 'club321' }, '3.3.3.3');
    const payload = JSON.parse(response.getContent());

    expect(payload).toMatchObject({ success: false, error: 'Не настроен VK User Access Token' });
    expect(global.jsonResponse).toHaveBeenCalledWith(expect.any(Object), 500);
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_user_token_missing',
      'TEST',
      expect.stringContaining('-321')
    );
  });

  test('handleGetVkPosts converts VK API error responses into JSON error payload', () => {
    setVkToken();
    global.extractVkGroupId.mockReturnValue('-654');

    UrlFetchApp.fetch.mockReturnValue(
      createMockHttpResponse({
        code: 200,
        contentText: JSON.stringify({
          error: { error_code: 200, error_msg: 'Access denied' },
        }),
      })
    );

    const response = handleGetVkPosts({ license_key: 'TEST', vk_group_id: 'club654' }, '4.4.4.4');
    const payload = JSON.parse(response.getContent());

    expect(payload).toMatchObject({ success: false, vk_error_code: 200 });
    expect(global.jsonResponse).toHaveBeenCalledWith(expect.any(Object), 400);
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_api_error',
      'TEST',
      expect.stringContaining('Access denied')
    );
  });

  test('handleGetVkPosts filters out already sent posts using bindings metadata', () => {
    setVkToken();
    const payload = { license_key: 'TEST', vk_group_id: 'club500', count: 2 };

    UrlFetchApp.fetch.mockReturnValue(
      createMockHttpResponse({
        code: 200,
        contentText: JSON.stringify({
          response: {
            items: [{ id: 1 }, { id: 2 }],
            count: 2,
          },
        }),
      })
    );

    global.extractVkGroupId.mockImplementation((value) => {
      if (value === payload.vk_group_id) return '-500';
      if (value === 'https://vk.com/club500') return '-500';
      return '-1';
    });

    global.getUserBindings.mockReturnValue([
      { vkGroupUrl: 'https://vk.com/club500', bindingName: 'BindingA' },
    ]);

    global.checkPostAlreadySent.mockImplementation((bindingName, postId) => {
      expect(bindingName).toBe('BindingA');
      return postId === 1;
    });

    const response = handleGetVkPosts(payload, '5.5.5.5');
    const body = JSON.parse(response.getContent());

    expect(body.success).toBe(true);
    expect(body.posts).toEqual([{ id: 2 }]);
    expect(global.logEvent).toHaveBeenCalledWith(
      'INFO',
      'vk_posts_filtered',
      'TEST',
      expect.stringContaining('Original: 2, Filtered: 1')
    );
  });

  test('handleGetVkPosts falls back to unfiltered posts when filtering throws', () => {
    setVkToken();
    global.extractVkGroupId.mockReturnValue('-600');
    global.getUserBindings.mockImplementation(() => {
      throw new Error('Bindings sheet unavailable');
    });

    UrlFetchApp.fetch.mockReturnValue(
      createMockHttpResponse({
        code: 200,
        contentText: JSON.stringify({
          response: {
            items: [{ id: 10 }, { id: 11 }],
            count: 2,
          },
        }),
      })
    );

    const response = handleGetVkPosts({ license_key: 'TEST', vk_group_id: 'club600' }, '6.6.6.6');
    const data = JSON.parse(response.getContent());

    expect(data.posts).toHaveLength(2);
    expect(global.logEvent).toHaveBeenCalledWith(
      'WARN',
      'post_filtering_failed',
      'TEST',
      expect.stringContaining('Bindings sheet unavailable')
    );
  });

  test('handleGetVkPosts returns server error when VK fetch throws', () => {
    setVkToken();
    global.extractVkGroupId.mockReturnValue('-700');

    UrlFetchApp.fetch.mockImplementation(() => {
      throw new Error('Network failure');
    });

    const response = handleGetVkPosts({ license_key: 'TEST', vk_group_id: 'club700' }, '7.7.7.7');
    const payload = JSON.parse(response.getContent());

    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Network failure');
    expect(global.logEvent).toHaveBeenCalledWith(
      'ERROR',
      'vk_posts_fetch_error',
      'TEST',
      expect.stringContaining('Network failure')
    );
  });
});

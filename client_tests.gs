// @ts-nocheck
/**
 * TEST: Дублирование контента из vk.com/varsmana в TG -1001857442326
 * Использует существующие серверные endpoints get_vk_posts и send_post
 * с fallback на имеющийся license_key из PropertiesService.
 *
 * Важно:
 * - Функция работает из любого контекста (триггер/UI/ручной вызов)
 * - Не использует SpreadsheetApp.getUi() - только Logger.log + logEvent
 * - Берёт последний пост из varsmana и дублирует со всеми медиа
 * - Полная поддержка медиагрупп, видео, форматирования через сервер
 */
function testDuplicateVarsmanaToTG() {
  try {
    const SERVER = SERVER_URL;
    if (!SERVER || SERVER.includes('YOURSERVERURL')) {
      throw new Error('SERVER_URL не настроен в client.gs');
    }

    // Константы теста
    const vkInput = 'vk.com/varsmana';
    const tgChatId = '-1001857442326';
    const vkGroupId = 'varsmana'; // screen_name для резолва на сервере

    logEvent('INFO', 'test_varsmana_start', 'client', `VK: ${vkInput} → TG: ${tgChatId}`);
    Logger.log(`[TEST] Начат тест дублирования varsmana → TG ${tgChatId}`);

    // 1) Получаем license_key из PropertiesService (если есть)
    const license = getLicense();
    if (!license || !license.key) {
      const errorMsg = 'Для теста нужен сохранённый license_key в Properties. Добавьте лицензию через UI или установите временный ключ.';
      logEvent('ERROR', 'test_varsmana_no_license', 'client', errorMsg);
      Logger.log(`[TEST ERROR] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    Logger.log(`[TEST] Используем license_key: ${license.key.substring(0, 20)}...`);

    // 2) Получаем посты из varsmana через сервер (1 последний пост)
    const postsPayload = {
      event: 'get_vk_posts',
      license_key: license.key,
      vk_group_id: vkGroupId, // Сервер должен резолвить screen_name → owner_id
      count: 1
    };

    logEvent('DEBUG', 'test_varsmana_get_posts', 'client', `Requesting posts with payload: ${JSON.stringify(postsPayload)}`);
    Logger.log('[TEST] Запрашиваем посты с сервера...');

    const postsResp = callServer(postsPayload, { timeout: 30000 });

    if (!postsResp.success) {
      throw new Error(`Не удалось получить посты varsmana: ${postsResp.error || 'unknown error'}`);
    }

    if (!postsResp.posts || postsResp.posts.length === 0) {
      throw new Error('Посты varsmana не найдены (пустой список)');
    }

    const post = postsResp.posts[0];
    logEvent('INFO', 'test_varsmana_got_post', 'client',
             `Post ID: ${post.id}, Text length: ${post.text ? post.text.length : 0}, Attachments: ${post.attachments?.length || 0}`);
    Logger.log(`[TEST] Получен пост ID: ${post.id}, текст: ${post.text ? post.text.substring(0, 100) + '...' : 'без текста'}, медиа: ${post.attachments?.length || 0}`);

    // 3) Отправляем пост в TG через сервер
    const sendPayload = {
      event: 'send_post',
      license_key: license.key,
      tg_chat_id: tgChatId,
      vk_post: {
        id: post.id,
        date: post.date,
        text: post.text ? String(post.text).substring(0, 4096) : '',
        attachments: post.attachments || []
      },
      // Дополнительные опции для полной обработки медиа
      format_options: {
        boldFirstLine: true,
        boldUppercase: true,
        parse_mode: 'Markdown'
      }
    };

    logEvent('DEBUG', 'test_varsmana_send_post', 'client',
             `Sending post to TG with payload keys: [${Object.keys(sendPayload).join(', ')}]`);
    Logger.log('[TEST] Отправляем пост в Telegram...');

    const sendResp = callServer(sendPayload, { timeout: 60000 });

    if (!sendResp.success) {
      throw new Error(`Ошибка отправки в TG: ${sendResp.error || 'unknown error'}`);
    }

    // 4) Успех
    const successMsg = `✅ varsmana → TG отправлено успешно! Message ID: ${sendResp.message_id || 'N/A'}`;
    logEvent('INFO', 'test_varsmana_success', 'client', successMsg);
    Logger.log(`[TEST SUCCESS] ${successMsg}`);

    return {
      success: true,
      message_id: sendResp.message_id,
      post_id: post.id,
      text_preview: post.text ? post.text.substring(0, 150) : null
    };

  } catch (error) {
    const errorMsg = `Ошибка теста varsmana: ${error.message}`;
    logEvent('ERROR', 'test_varsmana_error', 'client', errorMsg);
    Logger.log(`[TEST ERROR] ${errorMsg}`);

    return { success: false, error: error.message };
  }
}

/**
 * АЛЬТЕРНАТИВНАЯ ВЕРСИЯ: Использует прямой вызов без binding_id
 * Если основная версия выше не работает из-за обязательного binding_id в send_post,
 * эта функция попытается создать временный фиктивный биндинг только для теста.
 */
function testDuplicateVarsmanaToTGDirect() {
  try {
    logEvent('INFO', 'test_varsmana_direct_start', 'client', 'Starting direct test without bindings');
    Logger.log('[TEST DIRECT] Прямой тест дублирования varsmana → TG');

    // Проверяем license_key
    const license = getLicense();
    if (!license || !license.key) {
      const errorMsg = 'Нужен license_key в Properties для прямого теста';
      logEvent('ERROR', 'test_direct_no_license', 'client', errorMsg);
      Logger.log(`[TEST DIRECT ERROR] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Создаём временный тестовый биндинг (без сохранения на сервер)
    const testBinding = {
      id: 'test_varsmana_' + Date.now(),
      bindingName: 'TEST_Varsmana',
      vkGroupUrl: 'vk.com/varsmana',
      tgChatId: '-1001857442326',
      status: 'active',
      formatSettings: {
        boldFirstLine: true,
        boldUppercase: true,
        syncPostsCount: 1
      }
    };

    Logger.log(`[TEST DIRECT] Создан временный биндинг: ${testBinding.id}`);

    // Получаем VK Group ID
    const vkGroupId = extractVkGroupId(testBinding.vkGroupUrl);
    if (!vkGroupId) {
      // varsmana это screen_name, а не числовой ID - передаём как есть
      Logger.log('[TEST DIRECT] varsmana - это screen_name, сервер резолвит');
    }

    // Получаем посты
    const postsResp = callServer({
      event: 'get_vk_posts',
      license_key: license.key,
      vk_group_id: vkGroupId || 'varsmana', // Если не резолвился - передаём screen_name
      count: 1
    }, { timeout: 30000 });

    if (!postsResp.success) {
      throw new Error(`VK посты не получены: ${postsResp.error}`);
    }

    if (!postsResp.posts || postsResp.posts.length === 0) {
      throw new Error('VK посты varsmana пусты');
    }

    const post = postsResp.posts[0];
    Logger.log(`[TEST DIRECT] Получен пост ${post.id}: "${post.text ? post.text.substring(0, 100) : 'без текста'}"`);

    // Отправляем через временный биндинг
    const publishResult = publishPost(testBinding, post, license.key);

    if (!publishResult.success) {
      throw new Error(`Отправка не удалась: ${publishResult.error}`);
    }

    const successMsg = `✅ ПРЯМОЙ тест успешен! varsmana пост ${post.id} → TG message ${publishResult.message_id || 'N/A'}`;
    logEvent('INFO', 'test_varsmana_direct_success', 'client', successMsg);
    Logger.log(`[TEST DIRECT SUCCESS] ${successMsg}`);

    return {
      success: true,
      message_id: publishResult.message_id,
      post_id: post.id,
      binding_id: testBinding.id
    };

  } catch (error) {
    const errorMsg = `Прямой тест неудачен: ${error.message}`;
    logEvent('ERROR', 'test_varsmana_direct_error', 'client', errorMsg);
    Logger.log(`[TEST DIRECT ERROR] ${errorMsg}`);

    return { success: false, error: error.message };
  }
}

/**
 * Утилитарная функция для запуска любого из тестов с выводом результата
 * Можно вызывать из UI или триггеров без проблем с контекстом
 */
function runVarsmanaTest() {
  Logger.log('='.repeat(50));
  Logger.log('[TEST RUNNER] Запуск теста дублирования varsmana → TG');
  Logger.log('='.repeat(50));

  // Пробуем основную версию
  const result1 = testDuplicateVarsmanaToTG();

  if (result1.success) {
    Logger.log(`[TEST RUNNER] ✅ Основной тест успешен: ${JSON.stringify(result1)}`);
    return result1;
  }

  Logger.log('[TEST RUNNER] ⚠️ Основной тест провален, пробуем прямую версию...');

  // Если не получилось - пробуем прямую версию
  const result2 = testDuplicateVarsmanaToTGDirect();

  if (result2.success) {
    Logger.log(`[TEST RUNNER] ✅ Прямой тест успешен: ${JSON.stringify(result2)}`);
    return result2;
  }

  Logger.log('[TEST RUNNER] ❌ Оба теста провалились:');
  Logger.log(`  Основной: ${result1.error}`);
  Logger.log(`  Прямой: ${result2.error}`);

  return {
    success: false,
    error: 'Оба теста провалились',
    details: { main: result1.error, direct: result2.error }
  };
}

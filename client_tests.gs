// @ts-nocheck
/**
 * TEST: Дублирование контента из vk.com/varsmana в TG -1001857442326
 * Обходит лицензию/биндинги. Берёт последний пост и отправляет через сервер,
 * используя серверные VK USER TOKEN и TG BOT TOKEN. Полная поддержка медиа (фото, видео, медиагруппы).
 *
 * Важно:
 * - РЕЗОЛВ vk.com/varsmana → owner_id выполняет сервер (utils.resolveScreenName)
 * - На вход серверу отправляем event: "send_post" с полем vk_post ИЛИ без него (сервер возьмёт последний)
 * - Здесь берём 1 самый свежий пост через get_vk_posts, затем отправляем его через send_post
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

    logEvent('INFO', 'test_varsmana_start', 'client', `VK: ${vkInput} → TG: ${tgChatId}`);

    // 1) Попросим сервер вытащить посты по screen_name (без лицензии)
    // Передаём vk_group_id=null и screen_name в payload — сервер обязан уметь резолвить
    const postsResp = callServer({
      event: 'get_vk_posts_public',   // Публичный эндпоинт БЕЗ лицензии (добавлен для тестов)
      screen_name: 'varsmana',
      count: 1
    });

    if (!postsResp.success || !postsResp.posts || postsResp.posts.length === 0) {
      throw new Error(`Не удалось получить посты varsmana: ${postsResp.error || 'empty list'}`);
    }

    const post = postsResp.posts[0];
    logEvent('INFO', 'test_varsmana_got_post', 'client', `Post ID: ${post.id}, Text len: ${post.text ? post.text.length : 0}, Atchs: ${post.attachments?.length || 0}`);

    // 2) Отправим его в TG напрямую через серверный обработчик без лицензии/биндингов
    const sendResp = callServer({
      event: 'send_post_public',      // Публичный эндпоинт БЕЗ лицензии
      tg_chat_id: tgChatId,
      vk_post: {
        id: post.id,
        date: post.date,
        text: post.text ? String(post.text).substring(0, 4096) : '',
        attachments: post.attachments || []
      },
      options: {
        parse_mode: 'Markdown',
        support_media_groups: true,
        prefer_direct_video: true
      }
    }, { timeout: 60000 });

    if (!sendResp.success) {
      throw new Error(`Ошибка отправки в TG: ${sendResp.error || 'unknown'}`);
    }

    logEvent('INFO', 'test_varsmana_sent', 'client', `Message ID: ${sendResp.message_id || 'N/A'}`);
    SpreadsheetApp.getUi().alert('✅ varsmana → TG отправлено успешно');
    return { success: true, message_id: sendResp.message_id };

  } catch (e) {
    logEvent('ERROR', 'test_varsmana_error', 'client', e.message);
    SpreadsheetApp.getUi().alert('❌ Ошибка теста: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * VK→Telegram Crossposter - POSTING SERVICE MODULE
 * Обработчики публикации: send_post, send_post_direct, test_publication
 */

/**
 * Обработка запроса на отправку поста
 * @param {Object} payload - Данные запроса
 * @param {string} payload.license_key - Ключ лицензии
 * @param {VkPost} payload.post - VK пост
 * @param {string} payload.binding_id - ID связки
 * @param {string} payload.format_settings - Настройки форматирования
 * @param {string} payload.tg_chat_id - ID Telegram чата
 * @param {string} payload.vk_group_id - ID VK группы
 * @param {string} clientIp - IP адрес клиента
 * @returns {ContentService.TextOutput} - JSON ответ
 * @returns {boolean} returns.success - Успешность отправки
 * @returns {number} [returns.message_id] - ID сообщения
 * @returns {Object} [returns.result] - Результат отправки
 * @returns {string} [returns.error] - Ошибка если была
 */
function handleSendPost(payload, clientIp) {
  try {
    var { license_key, binding_id, vk_post } = payload;
    
    // Проверяем лицензию
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    
    if (!licenseData.success) {
      return licenseCheck;
    }
    
    // Проверяем глобальную настройку "disable_all_stores"
    var props = PropertiesService.getScriptProperties();
    var disableAllStores = props.getProperty("global_disable_all_stores");
    
    if (disableAllStores === "true") {
      logEvent("INFO", "post_blocked_by_global_setting", license_key, 
               `Post sending blocked by global disable_all_stores setting`);
      return jsonResponse({
        success: false,
        error: "All stores are globally disabled",
        blocked_by_global_setting: true
      }, 403);
    }

    // Находим связку
    var binding = findBindingById(binding_id, license_key);
    if (!binding) {
      return jsonResponse({
        success: false,
        error: "Binding not found"
      }, 404);
    }
    
    if (binding.status !== "active") {
      return jsonResponse({
        success: false,
        error: "Binding is not active"
      }, 403);
    }
    
    // Если vk_post не передан, получаем последний пост
    if (!vk_post) {
      logEvent("INFO", "fetching_last_post", license_key, 
               `Binding ID: ${binding_id}, No post provided, fetching last post`);
      
      var getPostsResult = handleGetVkPosts({ 
        license_key: license_key, 
        vk_group_id: binding.vkGroupId, 
        count: 1 
      }, clientIp);
      
      var postsData = JSON.parse(getPostsResult.getContent());
      if (!postsData.success || !postsData.posts || postsData.posts.length === 0) {
        logEvent("ERROR", "no_posts_found", license_key, 
                 `Binding ID: ${binding_id}, No posts found to publish`);
        return jsonResponse({ 
          success: false, 
          error: "No posts found to publish" 
        }, 404);
      }
      
      vk_post = postsData.posts[0];
      logEvent("INFO", "last_post_fetched", license_key, 
               `Binding ID: ${binding_id}, Post ID: ${vk_post.id}`);
    }
    
    // Проверка на дубликат перед отправкой
    if (vk_post && vk_post.id && checkPostAlreadySent(binding.bindingName, vk_post.id)) {
      logEvent("INFO", "post_already_sent_skipped", license_key, 
               `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, IP: ${clientIp}`);
      return jsonResponse({ success: true, skipped: true, message: "Post already sent" });
    }
    
    // Отправляем пост в Telegram с учетом настроек связки
    var sendResult = sendVkPostToTelegram(binding.tgChatId, vk_post, binding);
    
    if (sendResult.success) {
      logEvent("INFO", "post_sent_successfully", license_key, 
               `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, Message ID: ${sendResult.message_id}, IP: ${clientIp}`);
    } else {
      logEvent("ERROR", "post_send_failed", license_key, 
               `Binding ID: ${binding_id}, Post ID: ${vk_post.id}, Error: ${sendResult.error}, IP: ${clientIp}`);
    }
    
    return jsonResponse(sendResult);
    
  } catch (error) {
    logEvent("ERROR", "send_post_error", payload.license_key, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Обработка запроса на прямую отправку поста
 * @param {Object} payload - Данные запроса
 * @param {string} payload.license_key - Ключ лицензии
 * @param {VkPost} payload.post - VK пост
 * @param {string} payload.tg_chat_id - ID Telegram чата
 * @param {string} payload.format_settings - Настройки форматирования
 * @param {string} payload.vk_group_id - ID VK группы
 * @param {string} clientIp - IP адрес клиента
 * @returns {ContentService.TextOutput} - JSON ответ
 * @returns {boolean} returns.success - Успешность отправки
 * @returns {number} [returns.message_id] - ID сообщения
 * @returns {Object} [returns.result] - Результат отправки
 * @returns {string} [returns.error] - Ошибка если была
 */
function handleSendPostDirect(payload, clientIp) {
  try {
    var { license_key, post, tg_chat_id, format_settings, vk_group_id } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    if (!tg_chat_id) return jsonResponse({ success: false, error: 'tg_chat_id required' }, 400);

    var binding = { bindingName: 'DIRECT', tgChatId: tg_chat_id, vkGroupId: vk_group_id || null, formatSettings: format_settings || '{}' };
    var result = sendVkPostToTelegram(tg_chat_id, post, binding);
    if (result.success) {
      logEvent('INFO', 'post_direct_sent', license_key, `TG ${tg_chat_id}, VK ${vk_group_id}/${post?.id}`);
      return jsonResponse({ success: true, message_id: result.message_id, result });
    } else {
      logEvent('ERROR', 'post_direct_send_failed', license_key, result.error || 'Unknown');
      return jsonResponse({ success: false, error: result.error || 'Failed to send direct post' }, 500);
    }
  } catch (e) {
    logEvent('ERROR', 'handle_send_post_direct_error', payload.license_key, e.message);
    return jsonResponse({ success: false, error: e.message }, 500);
  }
}

/**
 * Обработка запроса на тестовую публикацию
 * @param {Object} payload - Данные запроса
 * @param {string} payload.license_key - Ключ лицензии
 * @param {string} payload.vk_group_id - ID VK группы
 * @param {string} payload.tg_chat_id - ID Telegram чата
 * @param {string} clientIp - IP адрес клиента
 * @returns {ContentService.TextOutput} - JSON ответ
 * @returns {boolean} returns.success - Успешность отправки
 * @returns {number} [returns.message_id] - ID сообщения
 * @returns {Object} [returns.result] - Результат отправки
 * @returns {string} [returns.error] - Ошибка если была
 */
function handleTestPublication(payload, clientIp) {
  try {
    var { license_key, vk_group_id, tg_chat_id } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    if (!vk_group_id || !tg_chat_id) return jsonResponse({ success: false, error: 'vk_group_id and tg_chat_id required' }, 400);

    // Берём последний пост
    var postsResult = handleGetVkPosts({ license_key, vk_group_id, count: 1 }, clientIp);
    var postsData = JSON.parse(postsResult.getContent());
    if (!postsData.success || postsData.posts.length === 0) return jsonResponse({ success: false, error: 'No posts to publish' }, 404);

    var post = postsData.posts[0];
    var binding = { bindingName: 'TEST', tgChatId: tg_chat_id, vkGroupId: vk_group_id, formatSettings: '{}' };
    var result = sendVkPostToTelegram(tg_chat_id, post, binding);

    if (result.success) {
      logEvent('INFO', 'test_publication_success', license_key, `VK ${vk_group_id}/${post.id} → TG ${tg_chat_id}`);
      return jsonResponse({ success: true, message_id: result.message_id, result });
    } else {
      logEvent('ERROR', 'test_publication_failed', license_key, result.error || 'Unknown');
      return jsonResponse({ success: false, error: result.error || 'Failed to publish test post' }, 500);
    }
  } catch (e) {
    logEvent('ERROR', 'handle_test_publication_error', payload.license_key, e.message);
    return jsonResponse({ success: false, error: e.message }, 500);
  }
}

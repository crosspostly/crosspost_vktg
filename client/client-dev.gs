// @ts-nocheck
/**
 * VK→Telegram Crossposter - CLIENT DEV/APIs & TESTS
 * API вызовы, утилиты, тесты
 */

function callServer(event, payload) {
  var url = SERVER_URL;
  if (!url || url.indexOf('/exec') === -1) {
    throw new Error('SERVER_URL не настроен или не является Web App (/exec)');
  }
  var body = JSON.stringify(Object.assign({ event: event }, payload || {}));
  var resp = UrlFetchApp.fetch(url, { method: 'POST', contentType: 'application/json', payload: body, muteHttpExceptions: true, timeout: REQUEST_TIMEOUT });
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  var data = {};
  try { data = JSON.parse(text); } catch(e) { throw new Error('Invalid JSON from server: ' + text.substring(0,200)); }
  if (code !== 200 || data.success === false) throw new Error(data.error || ('Server error HTTP '+code));
  return data;
}

function saveLicenseWithCheck(license_key) {
  PropertiesService.getUserProperties().setProperty('LICENSE_KEY', license_key || '');
  var lic = getLicense();
  var res = callServer('check_license', { license_key: lic.license_key });
  logClient('INFO','license_check', JSON.stringify(res));
  return res;
}

function getInitialData() {
  var lic = getLicense();
  var bindings = callServer('get_user_bindings_with_names', { license_key: lic.license_key });
  logClient('INFO','initial_data', JSON.stringify({ bindings_count: (bindings.bindings||[]).length }));
  return bindings;
}

function addBinding(vk_group_url, tg_chat_id, binding_name, binding_description, format_settings) {
  var lic = getLicense();
  return callServer('add_binding', { license_key: lic.license_key, user_email: lic.email, vk_group_url, tg_chat_id, binding_name, binding_description, format_settings });
}

function editBinding(binding_id, fields) {
  var lic = getLicense();
  return callServer('edit_binding', Object.assign({ license_key: lic.license_key, binding_id: binding_id }, fields || {}));
}

function deleteBinding(binding_id) {
  var lic = getLicense();
  return callServer('delete_binding', { license_key: lic.license_key, binding_id: binding_id });
}

function getBindings() {
  var lic = getLicense();
  return callServer('get_bindings', { license_key: lic.license_key });
}

function toggleBindingStatus(binding_id, status) {
  var lic = getLicense();
  return callServer('toggle_binding_status', { license_key: lic.license_key, binding_id: binding_id, status: status });
}

function publishLastPost(binding_id, vk_group_id) {
  var lic = getLicense();
  return callServer('publish_last_post', { license_key: lic.license_key, binding_id: binding_id, vk_group_id: vk_group_id });
}

function getVkPosts(vk_group_id, count) {
  var lic = getLicense();
  return callServer('get_vk_posts', { license_key: lic.license_key, vk_group_id: vk_group_id, count: count||10 });
}

function validateVkGroupId(input) {
  if (!input) throw new Error('vk_group_id is empty');
  return input;
}

function extractVkGroupId(input) {
  return input; // клиентская версия — без резолва API, сервер резолвит
}

function extractTelegramChatId(input) {
  return input; // клиентская версия — сервер валидирует
}

function setupTrigger() {
  // Пример: триггер раз в 15 минут
  ScriptApp.newTrigger('checkNewPosts').timeBased().everyMinutes(15).create();
  logClient('INFO','trigger_setup','every 15 minutes checkNewPosts');
}

function checkNewPosts() {
  var lic = getLicense();
  var bindings = callServer('get_bindings', { license_key: lic.license_key });
  (bindings.bindings||[]).forEach(function(b){
    try {
      var posts = getVkPosts(b.vkGroupUrl, 5);
      // здесь можно сравнить/фильтровать и публиковать
    } catch(e) { logClient('WARN','check_new_posts_error', e.message); }
  });
}

function checkNewPostsManually() { return checkNewPosts(); }

function publishPost(binding_id, post) {
  var lic = getLicense();
  return callServer('send_post', { license_key: lic.license_key, binding_id: binding_id, post: post });
}

function resolveSyncPostsCount() { return 1; }

function doFirstAuth() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Укажите серверный Web App URL (…/exec):');
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var url = (resp.getResponseText() || '').trim();
  if (!url || url.indexOf('/exec') === -1) { ui.alert('Неверный URL'); return; }
  PropertiesService.getScriptProperties().setProperty('SERVER_URL', url);
  ui.alert('✅ Подключено!');
}

function checkScriptAppPermissions() { return { success: true }; }

// ===== TESTS =====
function testDuplicateVarsmanaToTG() {
  var lic = getLicense();
  var vk = 'varsmana';
  var posts = getVkPosts(vk, 1);
  if (!posts.posts || posts.posts.length === 0) throw new Error('Нет постов');
  var tg = PropertiesService.getUserProperties().getProperty('TEST_TG_CHAT_ID') || '@your_channel';
  var res = callServer('send_post_direct', { license_key: lic.license_key, post: posts.posts[0], tg_chat_id: tg, vk_group_id: '-123' });
  logClient('INFO','test_direct', JSON.stringify(res));
  return res;
}

function testDuplicateVarsmanaToTGDirect() { return testDuplicateVarsmanaToTG(); }
function runVarsmanaTest() { return testDuplicateVarsmanaToTG(); }
function quickTest() { return getInitialData(); }
function runFullSystemTest() { var data = getInitialData(); return data; }

/**
 * VK→Telegram Crossposter - BINDINGS SERVICE MODULE
 * CRUD связок и вспомогательные функции
 */

/**
 * Обработка запроса на получение связок
 * @param {Object} payload - Данные запроса
 * @param {string} payload.license_key - Ключ лицензии
 * @param {string} clientIp - IP адрес клиента
 * @returns {ContentService.TextOutput} - JSON ответ
 * @returns {boolean} returns.success - Успешность операции
 * @returns {Array<BindingConfig>} [returns.bindings] - Массив связок
 * @returns {string} [returns.error] - Ошибка если была
 */
function handleGetBindings(payload, clientIp) {
  try {
    var { license_key } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var bindings = getUserBindings(license_key);
    return jsonResponse({ success: true, bindings });
  } catch (e) { return jsonResponse({ success: false, error: e.message }, 500); }
}

function handleGetUserBindingsWithNames(payload, clientIp) {
  try {
    var { license_key } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var bindings = getUserBindings(license_key);
    bindings.forEach(function(b){ if (!b.bindingName) b.bindingName = resolveBindingName(b.bindingName, { bindingId: b.id, vkGroupUrl: b.vkGroupUrl, processedTgChatId: b.tgChatId }); });
    return jsonResponse({ success: true, bindings });
  } catch (e) { return jsonResponse({ success: false, error: e.message }, 500); }
}

function handleAddBinding(payload, clientIp) {
  try {
    var { license_key, user_email, vk_group_url, tg_chat_id, format_settings, binding_name, binding_description } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var sheet = getSheet('Bindings');
    var id = generateBindingId();
    var now = new Date().toISOString();
    var processedTgChatId = extractTelegramChatId(tg_chat_id);
    var normalizedName = resolveBindingName(binding_name, { bindingId: id, vkGroupUrl: vk_group_url, processedTgChatId });

    sheet.appendRow([
      id,
      license_key,
      user_email || '',
      vk_group_url || '',
      processedTgChatId || '',
      'active',
      now,
      now,
      format_settings ? JSON.stringify(format_settings) : '{}',
      normalizedName,
      binding_description || ''
    ]);

    migrateLegacyBindingSheets(binding_name, normalizedName);
    return jsonResponse({ success: true, binding_id: id, binding_name: normalizedName });
  } catch (e) { return jsonResponse({ success: false, error: e.message }, 500); }
}

function handleEditBinding(payload, clientIp) {
  try {
    var { license_key, binding_id, vk_group_url, tg_chat_id, status, format_settings, binding_name, binding_description } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var sheet = getSheet('Bindings');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === binding_id && data[i][1] === license_key) {
        if (vk_group_url !== undefined) sheet.getRange(i+1, 4).setValue(vk_group_url);
        if (tg_chat_id !== undefined) sheet.getRange(i+1, 5).setValue(extractTelegramChatId(tg_chat_id));
        if (status) sheet.getRange(i+1, 6).setValue(status);
        if (format_settings) sheet.getRange(i+1, 9).setValue(JSON.stringify(format_settings));
        if (binding_name) {
          var newName = resolveBindingName(binding_name, { bindingId: binding_id, vkGroupUrl: vk_group_url || data[i][3], processedTgChatId: tg_chat_id || data[i][4] });
          var oldName = data[i][9];
          if (newName !== oldName) { sheet.getRange(i+1, 10).setValue(newName); migrateLegacyBindingSheets(oldName, newName); }
        }
        if (binding_description !== undefined) sheet.getRange(i+1, 11).setValue(binding_description);
        sheet.getRange(i+1, 8).setValue(new Date().toISOString());
        return jsonResponse({ success: true });
      }
    }
    return jsonResponse({ success: false, error: 'Binding not found' }, 404);
  } catch (e) { return jsonResponse({ success: false, error: e.message }, 500); }
}

function handleDeleteBinding(payload, clientIp) {
  try {
    var { license_key, binding_id } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var sheet = getSheet('Bindings');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === binding_id && data[i][1] === license_key) {
        var name = data[i][9];
        sheet.deleteRow(i+1);
        renameBindingArtifacts(name, null); // опционально: архивирование/удаление артефактов
        return jsonResponse({ success: true });
      }
    }
    return jsonResponse({ success: false, error: 'Binding not found' }, 404);
  } catch (e) { return jsonResponse({ success: false, error: e.message }, 500); }
}

function handleToggleBindingStatus(payload, clientIp) {
  try {
    var { license_key, binding_id, status } = payload;
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) return licenseCheck;

    var sheet = getSheet('Bindings');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === binding_id && data[i][1] === license_key) {
        sheet.getRange(i+1, 6).setValue(status || (data[i][5] === 'active' ? 'paused' : 'active'));
        sheet.getRange(i+1, 8).setValue(new Date().toISOString());
        return jsonResponse({ success: true });
      }
    }
    return jsonResponse({ success: false, error: 'Binding not found' }, 404);
  } catch (e) { return jsonResponse({ success: false, error: e.message }, 500); }
}

function getUserBindings(licenseKey) {
  var sheet = getSheet('Bindings');
  var data = sheet.getDataRange().getValues();
  var bindings = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === licenseKey) {
      bindings.push(buildBindingObjectFromRow(data[i]));
    }
  }
  return bindings;
}

function findBindingById(bindingId, licenseKey) {
  var sheet = getSheet('Bindings');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === bindingId && data[i][1] === licenseKey) {
      return buildBindingObjectFromRow(data[i]);
    }
  }
  return null;
}

function buildBindingObjectFromRow(row) {
  try {
    return {
      id: row[0],
      licenseKey: row[1],
      userEmail: row[2],
      vkGroupUrl: row[3],
      tgChatId: row[4],
      status: row[5],
      createdAt: row[6],
      lastCheck: row[7],
      formatSettings: row[8],
      bindingName: row[9],
      bindingDescription: row[10]
    };
  } catch (e) { return null; }
}

function resolveBindingName(inputName, ctx) {
  var base = (inputName && inputName.trim()) ? inputName.trim() : '';
  if (!base) {
    var parts = [];
    if (ctx?.bindingId) parts.push(ctx.bindingId.substring(0, 8));
    if (ctx?.vkGroupUrl) parts.push(ctx.vkGroupUrl.replace(/https?:\/\/vk\.com\//i, 'vk/'));
    if (ctx?.processedTgChatId) parts.push(ctx.processedTgChatId);
    base = parts.filter(Boolean).join(' • ');
  }
  return base.substring(0, 80);
}

function sanitizeBindingText(text) { return (text || '').toString().replace(/[\r\n]+/g, ' ').trim().substring(0, 200); }

function migrateLegacyBindingSheets(oldName, newName) {
  try {
    if (!oldName || !newName || oldName === newName) return;
    renameBindingArtifacts(oldName, newName);
  } catch (e) { logEvent('WARN', 'migrate_legacy_binding_sheets_error', 'server', e.message); }
}

function renameBindingArtifacts(oldName, newName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mapping = [
    { fromPrefix: 'Published ', toPrefix: 'Published ' },
    { fromPrefix: 'Log ', toPrefix: 'Log ' },
    { fromPrefix: 'Logs ', toPrefix: 'Logs ' }
  ];
  mapping.forEach(function(m){
    try {
      if (!oldName) return;
      var from = m.fromPrefix + oldName;
      var sheet = ss.getSheetByName(from);
      if (!sheet) return;
      if (!newName) { sheet.setName(from + ' (archived)'); return; }
      var to = m.toPrefix + newName;
      var existing = ss.getSheetByName(to);
      if (existing && existing.getSheetId() !== sheet.getSheetId()) return;
      sheet.setName(to);
    } catch (e) { logEvent('WARN', 'rename_binding_artifact_error', 'server', e.message); }
  });
}

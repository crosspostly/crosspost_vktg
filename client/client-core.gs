// @ts-nocheck
/**
 * VK→Telegram Crossposter - CLIENT CORE
 * Константы, меню, логирование, лицензия
 */

var CLIENT_DEV_MODE = false;
var CLIENT_VERSION = '6.1';
var REQUEST_TIMEOUT = 15000;
var SERVER_URL = (function(){ try { return PropertiesService.getScriptProperties().getProperty('SERVER_URL') || ''; } catch(e) { return ''; } })();

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📱 VK→TG Client')
    .addItem('🔌 Подключить сервер', 'doFirstAuth')
    .addItem('🔁 Обновить данные', 'getInitialData')
    .addSeparator()
    .addItem('🧪 Тест VarSmana → TG', 'testDuplicateVarsmanaToTG')
    .addItem('⚙️ Настроить триггер', 'setupTrigger')
    .addSeparator()
    .addItem('📄 Логи клиента', 'showClientLogsSheet')
    .addToUi();
}

function logClient(level, event, details) {
  try {
    var sheet = getOrCreateClientLogsSheet();
    sheet.appendRow([new Date().toISOString(), level, event, Session.getActiveUser().getEmail() || 'anonymous', details || '']);
  } catch(e) { console.log('Client log error: ' + e.message); }
}

function getOrCreateClientLogsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Client Logs');
  if (!sheet) {
    sheet = ss.insertSheet('Client Logs');
    sheet.appendRow(['Timestamp','Level','Event','User','Details']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function showClientLogsSheet() { SpreadsheetApp.setActiveSheet(getOrCreateClientLogsSheet()); }

function cleanOldLogsClient(daysToKeep) {
  try {
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (daysToKeep || 30));
    var sheet = getOrCreateClientLogsSheet();
    var data = sheet.getDataRange().getValues();
    var rows = [];
    for (var i=1;i<data.length;i++){ var ts = new Date(data[i][0]); if (ts < cutoff) rows.push(i+1); }
    for (var j=rows.length-1;j>=0;j--) sheet.deleteRow(rows[j]);
    logClient('INFO','client_logs_cleaned','rows='+rows.length);
  } catch(e) { logClient('ERROR','client_logs_cleanup_error', e.message); }
}

function getLicense() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('license_info');
    if (cached) return JSON.parse(cached);
    var email = Session.getActiveUser().getEmail() || 'anonymous@local';
    var key = PropertiesService.getUserProperties().getProperty('LICENSE_KEY') || '';
    var info = { email: email, license_key: key };
    cache.put('license_info', JSON.stringify(info), 3600);
    return info;
  } catch(e) { return { email: 'anonymous', license_key: '' }; }
}

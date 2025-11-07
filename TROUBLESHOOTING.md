# TROUBLESHOOTING.md

**VK→Telegram Crossposter v7.0** - Troubleshooting Guide  
Updated: 2025-11-07  

---

## 🚨 Table of Contents

- [CI/CD Issues](#cicd-issues)
- [Deployment Errors](#deployment-errors) 
- [Runtime Exceptions](#runtime-exceptions)
- [Monitoring & Alerts](#monitoring--alerts)
- [Common User Issues](#common-user-issues)
- [Debugging Tools](#debugging-tools)

---

## 🔧 CI/CD Issues

### GitHub Actions Failures

#### **Build Failures**
**Symptoms**: `npm run build:server` or `npm run build:client` fails

**Common Causes**:
- Missing `server/` or `client/` directories
- Corrupted `node_modules` in `glasp/`
- Invalid module references in `deploy-server.js` or `deploy-client.js`

**Remediation Steps**:
1. Check file structure:
   ```bash
   ls -la server/ client/ glasp/
   ```
2. Verify expected modules exist:
   ```bash
   node glasp/verify-deployment.js
   ```
3. Clean and rebuild:
   ```bash
   cd glasp && rm -rf node_modules && npm install && npm run build
   ```

#### **Clasp Deployment Failures**
**Symptoms**: `clasp push --force` fails with authentication or script ID errors

**Common Causes**:
- Invalid `CLASPRC_JSON` secret in GitHub
- Incorrect script IDs in workflow files
- Expired Google Apps Script authorization

**Remediation Steps**:
1. Verify clasp credentials:
   ```bash
   echo '${{ secrets.CLASPRC_JSON }}' > ~/.clasprc.json
   clasp status
   ```
2. Check script IDs in workflow files:
   - Server: `1swkg5t74hsAma2H6KevvHNATgYVQ0L1WZx6jZH-FUC45EXxhXXXsjvC9`
   - Client: `1QkeuN2Fa47W06HGJRPUVzHmWJV_vZ2xk3lwJKetDnH049YFxV9aGrO9h`
3. Re-authorize clasp if needed:
   ```bash
   clasp login
   ```

#### **Linting Failures**
**Symptoms**: ESLint reports errors in `.gs` files

**Common Causes**:
- New syntax not compatible with ESLint configuration
- Missing semicolons or incorrect formatting
- Unused variables or functions

**Remediation Steps**:
1. Run lint locally:
   ```bash
   cd glasp && npm run lint
   ```
2. Fix reported issues manually or with:
   ```bash
   eslint --fix ../server/*.gs ../client/*.gs
   ```

---

## 🚀 Deployment Errors

### Server Deployment Issues

#### **Missing VK Modules**
**Symptoms**: `verify-deployment.js` reports missing VK modules

**Cause**: Recent refactoring split `vk-service.gs` into 3 modules

**Remediation**:
1. Verify all 3 VK modules exist:
   ```bash
   ls -la server/vk-api.gs server/vk-posts.gs server/vk-media.gs
   ```
2. Update `deploy-server.js` module list:
   ```javascript
   const MODULES = [
     'server.gs',
     'vk-api.gs',
     'vk-posts.gs', 
     'vk-media.gs'
   ];
   ```

#### **Web App Configuration Errors**
**Symptoms**: Server deployed but not accessible via HTTP

**Remediation Steps**:
1. Check Web App deployment in Google Apps Script console
2. Verify "Execute as" and "Who has access" settings:
   - Execute as: "Me" (administrator)
   - Who has access: "Anyone"
3. Redeploy if necessary:
   ```bash
   clasp deploy --description "VK→TG Server v7.0"
   ```

### Client Deployment Issues

#### **Server URL Configuration**
**Symptoms**: Client cannot connect to server

**Remediation**:
1. Verify `SERVER_URL` constant in `client.gs`:
   ```javascript
   const SERVER_URL = "YOUR_SERVER_URL_HERE"; // Must be updated
   ```
2. Test server endpoint:
   ```bash
   curl -X POST https://script.google.com/macros/s/SCRIPT_ID/exec \
        -H "Content-Type: application/json" \
        -d '{"action":"healthCheck"}'
   ```

---

## ⚡ Runtime Exceptions

### VK API Errors

#### **Rate Limiting (Error 6)**
**Symptoms**: `VK API Error: Too many requests per second`

**Monitoring**: Check Logs sheet for "VK_RATE_LIMIT" entries

**Remediation**:
1. Verify rate limiting implementation:
   ```javascript
   // Should be present in VK API calls
   if (lastVkApiCall && (Date.now() - lastVkApiCall) < 1000) {
     Utilities.sleep(1000);
   }
   ```
2. Check VK token quotas:
   - User token: 5000 requests/day
   - Service token: 1000 requests/day

#### **Authorization Errors (Error 5, 10, 15)**
**Symptoms**: `VK API Error: User authorization failed`

**Remediation Steps**:
1. Verify VK token validity:
   ```javascript
   // Test token manually
   const response = UrlFetchApp.fetch(`https://api.vk.com/method/users.get?access_token=${TOKEN}&v=5.131`);
   ```
2. Check token permissions: `wall`, `video`, `offline`
3. Renew token if expired

#### **Group Access Errors (Error 113)**
**Symptoms**: `VK API Error: Invalid group id`

**Remediation**:
1. Use `resolveVkScreenName()` for screen names:
   ```javascript
   const groupId = resolveVkScreenName('durov'); // Returns -1
   ```
2. Verify group is public and accessible

### Telegram API Errors

#### **Bot Token Issues**
**Symptoms**: `403 Forbidden: bot token is invalid`

**Remediation**:
1. Test bot token:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getMe
   ```
2. Verify bot is admin in target channels
3. Check token hasn't been revoked

#### **Chat ID Errors**
**Symptoms**: `400 Bad Request: chat not found`

**Remediation**:
1. Verify chat ID format:
   ```javascript
   // Should handle all formats
   extractTelegramChatId('@channel');    // Returns @channel
   extractTelegramChatId('https://t.me/channel'); // Returns @channel
   extractTelegramChatId('-1001234567890'); // Returns -1001234567890
   ```
2. Test bot membership in chat:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getChatMember?chat_id=@channel&user_id=@botname
   ```

#### **Message Size Limits**
**Symptoms**: `400 Bad Request: message is too long`

**Monitoring**: Look for "CAPTION_TOO_LONG" in Logs

**Remediation**: Verify caption splitting logic:
```javascript
// Should split captions > 1024 chars
if (caption.length > MAX_CAPTION_LENGTH) {
  sendMediaGroupWithoutCaption();
  sendLongTextMessage();
}
```

### Google Apps Script Errors

#### **Timeout Errors**
**Symptoms**: `Exceeded maximum execution time`

**Remediation**:
1. Check execution time in Logs
2. Optimize heavy operations:
   - Batch API calls
   - Reduce loop iterations
   - Use caching for repeated requests

#### **Quota Exceeded**
**Symptoms**: `Quota exceeded: UrlFetch calls`

**Remediation**:
1. Monitor daily quota usage
2. Implement caching where possible
3. Reduce API call frequency

---

## 📊 Monitoring & Alerts

### Log Monitoring

#### **Critical Log Patterns**
Monitor these patterns in the Logs sheet:

1. **VK API Failures**:
   ```
   LEVEL: ERROR, MESSAGE: VK API Error: *
   ```

2. **Telegram Failures**:
   ```
   LEVEL: ERROR, MESSAGE: Telegram API Error: *
   ```

3. **Rate Limiting**:
   ```
   LEVEL: WARN, MESSAGE: *RATE_LIMIT*
   ```

4. **Authentication Issues**:
   ```
   LEVEL: ERROR, MESSAGE: *TOKEN* or *AUTH*
   ```

#### **Health Check Endpoint**
Use built-in health check:
```bash
curl -X POST https://script.google.com/macros/s/SERVER_ID/exec \
     -H "Content-Type: application/json" \
     -d '{"action":"healthCheck"}'
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-07T12:00:00Z",
  "version": "7.0"
}
```

### Automated Monitoring

#### **Google Apps Script Triggers**
Monitor trigger failures:
1. Open Script Editor → Triggers
2. Check for "Failed" status
3. Review error messages

#### **Daily Health Summary**
Implement automated health checks:
```javascript
// Add to server.gs
function dailyHealthCheck() {
  const health = {
    vkApi: testVkApiConnection(),
    telegramApi: testTelegramApiConnection(),
    sheets: testSheetsAccess(),
    quotas: checkQuotaUsage()
  };
  
  // Log results and send admin notification if issues found
  logHealthCheck(health);
}
```

---

## 👥 Common User Issues

### License Problems

#### **"License not found"**
**Causes**:
- Invalid license key
- Expired license
- License not in Licenses sheet

**Remediation**:
1. Verify license in Licenses sheet
2. Check expiration date
3. Ensure status is "active"

#### **"License limit exceeded"**
**Causes**:
- Too many active bindings
- License type doesn't allow more groups

**Remediation**:
1. Count current bindings: `COUNTIF(Bindings!A:A, "<>") - 1`
2. Upgrade license or remove unused bindings

### Binding Issues

#### **"Invalid VK group URL"**
**Remediation**:
1. Test URL format:
   ```javascript
   const result = extractVkGroupId('https://vk.com/durov');
   // Should return -1 or call resolveVkScreenName()
   ```
2. Verify group is public
3. Check VK token permissions

#### **"Invalid Telegram chat ID"**
**Remediation**:
1. Test chat ID format:
   ```javascript
   const result = extractTelegramChatId('@channel');
   // Should return @channel
   ```
2. Verify bot is admin in chat
3. Test bot permissions

### Publication Issues

#### **"Post already sent"**
**Cause**: Duplicate detection working correctly

**Remediation**: None needed - system preventing duplicates

#### **"Media upload failed"**
**Causes**:
- File too large (>20MB)
- Unsupported file type
- Network timeout

**Remediation**:
1. Check file size in VK post
2. Verify media type is supported
3. Check network connectivity

---

## 🛠️ Debugging Tools

### Development Mode

Enable detailed logging:
```javascript
// Add to top of server.gs or client.gs
const DEV_MODE = true; // Set to false in production
```

**Effects**:
- Verbose API request/response logging
- Detailed error stack traces
- Performance timing information

### Manual Testing Functions

#### **Test VK Connection**:
```javascript
function testVkConnection() {
  const posts = getVkPosts(-1, 5); // Test with 5 posts from durov
  console.log(`Fetched ${posts.length} posts`);
}
```

#### **Test Telegram Connection**:
```javascript
function testTelegramConnection() {
  const result = sendTelegramMessage(BOT_TOKEN, CHAT_ID, "Test message");
  console.log("Telegram test result:", result);
}
```

#### **Test Binding**:
```javascript
function testBinding(bindingId) {
  const binding = getBindingById(bindingId);
  const result = sendVkPostToTelegram(binding, 'test');
  console.log("Binding test result:", result);
}
```

### Log Analysis

#### **Filter Logs by Level**:
```javascript
function getErrors(lastHours = 24) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
  const data = sheet.getDataRange().getValues();
  const cutoff = new Date(Date.now() - lastHours * 60 * 60 * 1000);
  
  return data.filter(row => {
    const timestamp = new Date(row[0]);
    const level = row[1];
    return timestamp > cutoff && level === 'ERROR';
  });
}
```

#### **Performance Analysis**:
```javascript
function getSlowOperations(thresholdMs = 5000) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
  const data = sheet.getDataRange().getValues();
  
  return data.filter(row => {
    const message = row[2];
    return message.includes('ms') && 
           parseInt(message.match(/(\d+)ms/)[1]) > thresholdMs;
  });
}
```

---

## 📞 Getting Help

### Before Contacting Support

1. **Check Logs**: Review recent error messages
2. **Try Development Mode**: Enable `DEV_MODE = true` and retry
3. **Test Manually**: Use manual testing functions
4. **Verify Configuration**: Check tokens, URLs, and permissions

### Information to Provide

When reporting issues, include:

1. **Error Message**: Full error text from Logs
2. **Timestamp**: When the error occurred
3. **Binding Details**: VK group URL and Telegram chat ID
4. **Steps to Reproduce**: What actions led to the error
5. **Environment**: Server or client, browser/app used

### Emergency Procedures

#### **Service Outage Response**:
1. Check all API tokens are valid
2. Verify Web App is deployed and accessible
3. Test with minimal configuration
4. Roll back to last known working configuration if needed

#### **Data Recovery**:
- All data stored in Google Sheets has automatic version history
- Use File → Version history → See version history to restore
- Critical data: Licenses, Bindings, and individual binding sheets

---

**Last Updated**: 2025-11-07  
**Version**: 7.0  
**For emergencies**: Check logs first, then use development mode for detailed diagnostics.
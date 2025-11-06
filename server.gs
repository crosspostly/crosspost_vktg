/* PATCH APPLIED: Enhanced handleGetVkPosts now accepts vk_group_id (numeric/-numeric) OR screen_name and auto-resolves non-numeric inputs. */
function handleGetVkPosts(payload, clientIp) {
  try {
    var { license_key, vk_group_id, screen_name, count = 50 } = payload;
    
    // 1) License check
    var licenseCheck = handleCheckLicense({ license_key }, clientIp);
    var licenseData = JSON.parse(licenseCheck.getContent());
    if (!licenseData.success) {
      return licenseCheck;
    }

    // 2) Resolve group id
    var resolvedGroupId = null;

    // Prefer vk_group_id if provided
    if (vk_group_id && typeof vk_group_id === 'string') {
      var trimmed = vk_group_id.trim();
      if (/^-?\d+$/.test(trimmed)) {
        // Numeric format already
        resolvedGroupId = trimmed;
      } else {
        // Non-numeric: treat as screen_name or URL fragment
        try {
          // Accept raw screen_name like "varsmana" or forms like "vk.com/varsmana"
          var sn = trimmed.replace(/^https?:\/\/vk\.com\//i, '').split('/')[0].split('?')[0].split('#')[0];
          resolvedGroupId = resolveVkScreenName(sn);
        } catch (e) {
          logEvent("WARN", "vk_group_id_screen_name_resolution_failed", license_key, `Input: ${trimmed}, Error: ${e.message}`);
          return jsonResponse({ success: false, error: `Cannot resolve vk_group_id "${trimmed}": ${e.message}` }, 400);
        }
      }
    } else if (typeof vk_group_id === 'number') {
      resolvedGroupId = vk_group_id.toString();
    } else if (screen_name && typeof screen_name === 'string' && screen_name.trim()) {
      try {
        var sn2 = screen_name.trim().replace(/^https?:\/\/vk\.com\//i, '').split('/')[0].split('?')[0].split('#')[0];
        resolvedGroupId = resolveVkScreenName(sn2);
      } catch (e) {
        logEvent("WARN", "screen_name_resolution_failed", license_key, `Screen: ${screen_name}, Error: ${e.message}`);
        return jsonResponse({ success: false, error: `Cannot resolve screen_name "${screen_name}": ${e.message}` }, 400);
      }
    } else {
      return jsonResponse({ success: false, error: "vk_group_id or screen_name required" }, 400);
    }

    // Ensure groups have leading minus
    if (!/^-.+/.test(resolvedGroupId)) {
      resolvedGroupId = '-' + resolvedGroupId.replace(/^-/, '');
    }

    // 3) VK token
    var userToken = PropertiesService.getScriptProperties().getProperty("VK_USER_ACCESS_TOKEN");
    if (!userToken) {
      logEvent("ERROR", "vk_user_token_missing", license_key, `Cannot fetch posts without VK User Access Token, Group ID: ${resolvedGroupId}, IP: ${clientIp}`);
      return jsonResponse({ success: false, error: "VK User Access Token не настроен на сервере" }, 500);
    }

    // 4) wall.get
    var safeCount = Math.max(1, Math.min(parseInt(count, 10) || 50, 100));
    var apiUrl = `https://api.vk.com/method/wall.get?owner_id=${encodeURIComponent(resolvedGroupId)}&count=${encodeURIComponent(safeCount)}&v=${VK_API_VERSION}&access_token=${userToken}`;
    var logUrl = `https://api.vk.com/method/wall.get?owner_id=${resolvedGroupId}&count=${safeCount}&v=${VK_API_VERSION}&access_token=***`;
    logEvent("DEBUG", "vk_api_request", license_key, `Request URL: ${logUrl}, IP: ${clientIp}`);

    var response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true, timeout: 15000 });
    var responseData = JSON.parse(response.getContentText());

    if (responseData.error) {
      var err = responseData.error;
      logEvent("ERROR", "vk_api_error", license_key, `Group ID: ${resolvedGroupId}, VK Error code: ${err.error_code}, Message: ${err.error_msg}, IP: ${clientIp}`);
      var errorMessage = `VK API Error: ${err.error_msg}`;
      if (err.error_code === 5) errorMessage = "User authorization failed: VK Access Token is invalid or expired";
      else if (err.error_code === 15) errorMessage = "Access denied: Unable to access VK group posts";
      else if (err.error_code === 100) errorMessage = "Invalid VK group ID";
      else if (err.error_code === 200) errorMessage = "Access to this VK group denied";
      return jsonResponse({ success: false, error: errorMessage, vk_error_code: err.error_code }, 400);
    }

    var posts = responseData.response ? (responseData.response.items || []) : [];

    // Optional: filter out already sent posts using Published sheets (as before)
    try {
      var bindings = getUserBindings(license_key);
      var filteredPosts = [];
      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var alreadySent = false;
        for (var j = 0; j < bindings.length; j++) {
          var binding = bindings[j];
          if (binding.vkGroupUrl) {
            try {
              var bindingGroupId = extractVkGroupId(binding.vkGroupUrl);
              if (bindingGroupId === resolvedGroupId && binding.bindingName) {
                if (checkPostAlreadySent(binding.bindingName, post.id)) {
                  alreadySent = true; break;
                }
              }
            } catch (vkx) {}
          }
        }
        if (!alreadySent) filteredPosts.push(post);
      }
      logEvent("INFO", "vk_posts_filtered", license_key, `Group ID: ${resolvedGroupId}, Original: ${posts.length}, Filtered: ${filteredPosts.length}, IP: ${clientIp}`);
      return jsonResponse({ success: true, posts: filteredPosts, group_id: resolvedGroupId, total_count: responseData.response ? responseData.response.count : 0, filtered_count: filteredPosts.length });
    } catch (filterError) {
      logEvent("WARN", "post_filtering_failed", license_key, `Failed to filter posts: ${filterError.message}, returning all posts`);
      return jsonResponse({ success: true, posts: posts, group_id: resolvedGroupId, total_count: responseData.response ? responseData.response.count : 0 });
    }

  } catch (error) {
    logEvent("ERROR", "get_vk_posts_error", payload.license_key || "unknown", error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

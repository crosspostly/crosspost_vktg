// ============================================
// TEST UTILITY FUNCTIONS
// ============================================

// Test function for VK Group ID extraction
function testExtractVkGroupId() {
  console.log("=== Testing extractVkGroupId ===");
  
  const testCases = [
    // Server-side test cases
    { input: "https://vk.com/public123456", expected: "-123456" },
    { input: "https://vk.com/club789012", expected: "-789012" },
    { input: "https://vk.com/durov", expected: "resolve_needed" },
    { input: "https://vk.com/varsmana", expected: "resolve_needed" },
    { input: "vk.com/apiclub", expected: "resolve_needed" },
    { input: "VK.COM/PUBLIC999888", expected: "-999888" },
    { input: "-123456", expected: "-123456" },
    { input: "123456", expected: "-123456" },
    { input: "https://vk.com/club123?from=groups", expected: "-123" },
    { input: "https://vk.com/public456#section", expected: "-456" },
  ];
  
  testCases.forEach((testCase, index) => {
    try {
      const result = extractVkGroupId(testCase.input);
      const status = (result === testCase.expected || (testCase.expected === "resolve_needed" && result.includes("-"))) ? "✅" : "❌";
      console.log(`${status} Test ${index + 1}: "${testCase.input}" → "${result}" (expected: ${testCase.expected})`);
    } catch (error) {
      console.log(`❌ Test ${index + 1}: "${testCase.input}" → ERROR: ${error.message}`);
    }
  });
}

// Test function for Telegram Chat ID extraction
function testExtractTelegramChatId() {
  console.log("=== Testing extractTelegramChatId ===");
  
  const testCases = [
    { input: "@channelname", expected: "@channelname" },
    { input: "https://t.me/channelname", expected: "@channelname" },
    { input: "t.me/username", expected: "@username" },
    { input: "channelname", expected: "@channelname" },
    { input: "-1001234567890", expected: "-1001234567890" },
    { input: "123456789", expected: "123456789" },
    { input: "https://t.me/test_channel?start=123", expected: "@test_channel" },
    { input: "@user_name123", expected: "@user_name123" },
  ];
  
  testCases.forEach((testCase, index) => {
    try {
      const result = extractTelegramChatId(testCase.input);
      const status = result === testCase.expected ? "✅" : "❌";
      console.log(`${status} Test ${index + 1}: "${testCase.input}" → "${result}" (expected: ${testCase.expected})`);
    } catch (error) {
      console.log(`❌ Test ${index + 1}: "${testCase.input}" → ERROR: ${error.message}`);
    }
  });
}

// Test function for cleanOldLogs (will create sample data)
function testCleanOldLogs() {
  console.log("=== Testing cleanOldLogs ===");
  
  try {
    const result = cleanOldLogs();
    console.log("✅ cleanOldLogs completed successfully:");
    console.log(`   Total deleted: ${result.totalDeleted}`);
    console.log(`   Sheets processed: ${result.sheetsProcessed}`);
    console.log(`   Results: ${JSON.stringify(result.sheetResults, null, 2)}`);
  } catch (error) {
    console.log(`❌ cleanOldLogs failed: ${error.message}`);
  }
}

// Run all tests
function runAllUtilityTests() {
  console.log("Starting utility function tests...");
  
  try {
    testExtractVkGroupId();
    console.log("");
    testExtractTelegramChatId();
    console.log("");
    testCleanOldLogs();
    
    console.log("=== All tests completed ===");
  } catch (error) {
    console.log(`Test suite error: ${error.message}`);
  }
}
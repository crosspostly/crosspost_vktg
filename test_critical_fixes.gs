// Test the critical fixes for VK hyperlinks and line breaks
function testCriticalFixes() {
  console.log("=== TESTING CRITICAL FIXES ===");
  
  // Test case 1: VK hyperlink without protocol (the main issue)
  var test1 = "Тестовый пост!\n\nс гиперссылкой [vk.com/daoqub|sdfjlsd]\n\nОценили 0 человек";
  console.log("TEST 1 INPUT:", JSON.stringify(test1));
  
  // Apply the critical regex patterns manually
  var result1 = test1;
  
  // 1. VK links without protocol: [vk.com/...|text] → https://vk.com/...
  result1 = result1.replace(/\[vk\.com\/([^\]|]+)\|([^\]]+)\]/g, '<a href="https://vk.com/$1">$2</a>');
  console.log("TEST 1 AFTER VK LINKS:", JSON.stringify(result1));
  
  // 2. Check if line breaks preserved
  console.log("TEST 1 HAS LINE BREAKS:", result1.includes('\n'));
  console.log("TEST 1 HAS HTML LINK:", result1.includes('<a href="https://vk.com/daoqub">'));
  
  // Test case 2: Multiple hyperlink formats
  var test2 = "Пользователь [id123|Иван] и группа [club456|Группа] и ссылка [vk.com/test|клик]";
  console.log("TEST 2 INPUT:", JSON.stringify(test2));
  
  var result2 = test2;
  result2 = result2.replace(/\[id(\d+)\|([^\]]+)\]/g, '<a href="https://vk.com/id$1">$2</a>');
  result2 = result2.replace(/\[(club|public)(\d+)\|([^\]]+)\]/g, function(match, type, id, title) {
    return `<a href="https://vk.com/${type}${id}">${title}</a>`;
  });
  result2 = result2.replace(/\[vk\.com\/([^\]|]+)\|([^\]]+)\]/g, '<a href="https://vk.com/$1">$2</a>');
  
  console.log("TEST 2 RESULT:", JSON.stringify(result2));
  console.log("TEST 2 HAS USER LINK:", result2.includes('<a href="https://vk.com/id123">'));
  console.log("TEST 2 HAS GROUP LINK:", result2.includes('<a href="https://vk.com/club456">'));
  console.log("TEST 2 HAS VK LINK:", result2.includes('<a href="https://vk.com/test">'));
  
  return {
    test1: {input: test1, result: result1, hasLink: result1.includes('<a href="https://vk.com/daoqub">'), hasLineBreaks: result1.includes('\n')},
    test2: {input: test2, result: result2, hasUserLink: result2.includes('<a href="https://vk.com/id123">'), hasGroupLink: result2.includes('<a href="https://vk.com/club456">'), hasVkLink: result2.includes('<a href="https://vk.com/test">')}
  };
}
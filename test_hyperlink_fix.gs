// Test function to validate formatVkTextForTelegram fixes
function testHyperlinkAndLineBreakFixes() {
  console.log("=== TESTING HYPERLINK AND LINE BREAK FIXES ===");
  
  // Test case 1: VK hyperlink without protocol
  var test1 = "Тестовый пост!\n\nс гиперссылкой [vk.com/daoqub|sdfjlsd]\n\nОценили 0 человек";
  console.log("INPUT 1:", JSON.stringify(test1));
  
  var result1 = formatVkTextForTelegram(test1, {boldFirstLine: false, boldUppercase: false});
  console.log("OUTPUT 1:", JSON.stringify(result1));
  console.log("HAS HTML LINK:", result1.includes('<a href="https://vk.com/daoqub">'));
  console.log("HAS LINE BREAKS:", result1.includes('\n'));
  console.log("---");
  
  // Test case 2: Multiple hyperlink formats
  var test2 = "Пользователь [id123|Иван] и группа [club456|Группа] и ссылка [vk.com/test|клик]";
  console.log("INPUT 2:", JSON.stringify(test2));
  
  var result2 = formatVkTextForTelegram(test2, {boldFirstLine: false, boldUppercase: false});
  console.log("OUTPUT 2:", JSON.stringify(result2));
  console.log("HAS USER LINK:", result2.includes('<a href="https://vk.com/id123">'));
  console.log("HAS GROUP LINK:", result2.includes('<a href="https://vk.com/club456">'));
  console.log("HAS VK LINK:", result2.includes('<a href="https://vk.com/test">'));
  console.log("---");
  
  // Test case 3: Bold first line with hyperlink
  var test3 = "Первое сообщение с [vk.com/link|ссылкой]\n\nВторое сообщение";
  console.log("INPUT 3:", JSON.stringify(test3));
  
  var result3 = formatVkTextForTelegram(test3, {boldFirstLine: true, boldUppercase: false});
  console.log("OUTPUT 3:", JSON.stringify(result3));
  console.log("HAS BOLD:", result3.includes('<b>'));
  console.log("HAS HTML LINK:", result3.includes('<a href="https://vk.com/link">'));
  console.log("HAS LINE BREAKS:", result3.includes('\n'));
  console.log("---");
}
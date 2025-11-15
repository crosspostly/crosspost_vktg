// Simple test to check if formatVkTextForTelegram works
function testBasicFunction() {
  // Test case from the task
  var input = "Тестовый пост!\n\nс гиперссылкой [vk.com/daoqub|sdfjlsd]\n\nОценили 0 человек";
  var result = formatVkTextForTelegram(input, {boldFirstLine: false, boldUppercase: false});
  
  console.log("INPUT:", JSON.stringify(input));
  console.log("OUTPUT:", JSON.stringify(result));
  console.log("HAS HTML LINK:", result.includes('<a href="https://vk.com/daoqub">'));
  console.log("HAS LINE BREAKS:", result.includes('\n'));
  
  return result;
}
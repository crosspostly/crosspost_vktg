// Quick test to see if the current function works despite corruption
function quickTest() {
  try {
    var input = "Тестовый пост!\n\nс гиперссылкой [vk.com/daoqub|sdfjlsd]\n\nОценили 0 человек";
    var result = formatVkTextForTelegram(input, {boldFirstLine: false, boldUppercase: false});
    
    console.log("CURRENT FUNCTION TEST:");
    console.log("INPUT:", JSON.stringify(input));
    console.log("OUTPUT:", JSON.stringify(result));
    console.log("SUCCESS: Links working?", result.includes('<a href="https://vk.com/daoqub">'));
    console.log("SUCCESS: Line breaks working?", result.includes('\n'));
    
    return result;
  } catch (error) {
    console.log("ERROR: " + error.message);
    return null;
  }
}
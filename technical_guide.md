// Тестирование функций извлечения ID из ссылок
console.log("=== Тестирование функций извлечения ===");

// Функция для тестирования VK ссылок (упрощенная версия)
function testVkUrl(url) {
  try {
    let processedUrl = url.trim().toLowerCase();
    
    if (!processedUrl.startsWith('http')) {
      processedUrl = 'https://' + processedUrl;
    }
    
    const urlParts = processedUrl.match(/vk\.com\/(.+)/);
    if (!urlParts) {
      throw new Error('Неверный формат ссылки ВК');
    }
    
    const path = urlParts[1];
    
    // public123456 -> -123456
    const publicMatch = path.match(/^public(\d+)$/);
    if (publicMatch) {
      return '-' + publicMatch[1];
    }
    
    // club123456 -> -123456
    const clubMatch = path.match(/^club(\d+)$/);
    if (clubMatch) {
      return '-' + clubMatch[1];
    }
    
    // короткое имя
    const shortName = path.replace(/[^a-z0-9_]/g, '');
    if (shortName) {
      return `SHORTNAME:${shortName}`;
    }
    
    throw new Error('Неподдерживаемый формат');
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}

// Функция для тестирования Telegram ссылок
function testTelegramUrl(input) {
  try {
    const trimmed = input.trim();
    
    // Уже chat_id
    if (trimmed.match(/^-100\d+$/)) {
      return trimmed;
    }
    
    // Начинается с @
    if (trimmed.startsWith('@')) {
      return trimmed;
    }
    
    // t.me ссылка
    const tMeMatch = trimmed.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (tMeMatch) {
      return '@' + tMeMatch[1];
    }
    
    // Простое имя
    if (trimmed.match(/^[a-zA-Z0-9_]+$/)) {
      return '@' + trimmed;
    }
    
    throw new Error('Неподдерживаемый формат');
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}

// Тесты ВК
console.log("\n=== ВК ссылки ===");
const vkTests = [
  'https://vk.com/public123456',
  'vk.com/club789012', 
  'https://vk.com/durov',
  'VK.COM/PUBLIC999888',
  'https://vk.com/club456789'
];

vkTests.forEach(url => {
  const result = testVkUrl(url);
  console.log(`${url} -> ${result}`);
});

// Тесты Telegram
console.log("\n=== Telegram ссылки ===");
const tgTests = [
  'https://t.me/durov',
  't.me/telegram',
  '@channelname',
  'mychannel',
  '-1001234567890'
];

tgTests.forEach(input => {
  const result = testTelegramUrl(input);
  console.log(`${input} -> ${result}`);
});

console.log("\n=== Тестирование завершено ===");

import { TelegramService } from '../src/services/telegram.js';
import * as HttpClientModule from '../src/services/http-client.js';

// Stub HttpClient.fetch to capture payload instead of making real HTTP calls
HttpClientModule.HttpClient.fetch = async (url, options, label) => {
  console.log('HTTP CALL TO:', url);
  console.log('LABEL:', label);
  try {
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    console.log('BODY KEYS:', Object.keys(body));
    console.log('BODY.reply_markup is object:', typeof body.reply_markup === 'object');
    console.log('reply_markup content:', JSON.stringify(body.reply_markup, null, 2));
  } catch (e) {
    console.log('Failed to parse body:', e.message);
    console.log('RAW BODY:', options.body);
  }
  return { ok: true };
};

(async () => {
  const telegram = new TelegramService('TEST_TOKEN');

  const replyMarkup = {
    inline_keyboard: [
      [ { text: 'A', callback_data: 'a' }, { text: 'B', callback_data: 'b' } ],
      [ { text: 'Back', callback_data: 'menu_main' } ]
    ]
  };

  await telegram.sendMessage(123456789, 'Test message with buttons', { reply_markup: replyMarkup, parse_mode: 'Markdown' });

  console.log('Test send completed');
})();

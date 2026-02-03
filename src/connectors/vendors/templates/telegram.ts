/**
 * Telegram Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const telegramTemplate: VendorTemplate = {
  id: 'telegram',
  name: 'Telegram',
  serviceType: 'telegram',
  baseURL: 'https://api.telegram.org',
  docsURL: 'https://core.telegram.org/bots/api',
  credentialsSetupURL: 'https://t.me/BotFather',
  category: 'communication',
  notes: 'Telegram Bot API requires token to be part of URL path: /bot<token>/method',

  authTemplates: [
    {
      id: 'bot-token',
      name: 'Bot Token',
      type: 'api_key',
      description: 'Bot token from @BotFather - used in URL path, not header',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: '',
      },
    },
  ],
};

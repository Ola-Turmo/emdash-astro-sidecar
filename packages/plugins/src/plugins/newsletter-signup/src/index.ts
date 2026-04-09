import type { Plugin } from '../../../sdk/types.js';
import { registerContentBlock } from '../../../sdk/renderer.js';

export const newsletterPlugin: Plugin = {
  name: '@emdash/newsletter-signup',
  version: '0.1.0',
  enabled: true,
  hooks: {
    onInit: async (ctx) => {
      ctx.logger.info('Newsletter signup plugin initialized');
    },
    onPublish: async (ctx) => {
      ctx.logger.info(`Newsletter: new post published - ${ctx.slug}`);
    },
  },
  contentBlocks: {
    NewsletterBlock: {
      name: 'NewsletterBlock',
      component: './NewsletterBlock.astro',
      props: {
        title: 'Subscribe to our newsletter',
        description: 'Get the latest posts delivered straight to your inbox.',
        buttonText: 'Subscribe',
        placeholder: 'Enter your email',
      },
    },
  },
  pageTypes: {},
};

export function initNewsletterPlugin() {
  registerContentBlock('NewsletterBlock', newsletterPlugin.contentBlocks!.NewsletterBlock);
}
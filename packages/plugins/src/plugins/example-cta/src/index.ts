import type { Plugin } from '../../../sdk/types.js';
import { registerContentBlock } from '../../../sdk/renderer.js';

const exampleCtaPlugin: Plugin = {
  name: '@emdash/example-cta',
  version: '0.1.0',
  enabled: true,
  hooks: {
    onInit: async (ctx) => {
      ctx.logger.info('Example CTA plugin initialized');
    },
  },
  contentBlocks: {
    CTABlock: {
      name: 'CTABlock',
      component: './CTABlock.astro',
      props: {
        title: 'Call to Action',
        description: 'Sign up today',
        buttonText: 'Get Started',
        buttonUrl: '/signup',
        variant: 'default',
      },
    },
  },
  pageTypes: {},
};

// Auto-register when imported
export function initCtaPlugin() {
  registerContentBlock('CTABlock', exampleCtaPlugin.contentBlocks!.CTABlock);
  console.log('Example CTA plugin content block registered: CTABlock');
}

export { exampleCtaPlugin };

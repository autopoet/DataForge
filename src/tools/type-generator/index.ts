import { IconCode } from '@tabler/icons-vue';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.type-generator.title'),
  path: '/type-generator',
  description: translate('tools.type-generator.description'),
  keywords: ['typescript', 'type', 'generate', 'json', 'ts'],
  component: () => import('./type-generator.vue'),
  icon: IconCode,
  createdAt: new Date('2026-08-16'),
});

import { IconDashboard } from '@tabler/icons-vue';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.workbench.title'),
  path: '/workbench',
  description: translate('tools.workbench.description'),
  keywords: ['workbench', 'data', 'json', 'yaml', 'toml', 'xml', 'csv', 'format', 'minify', 'convert', 'typescript'],
  component: () => import('./workbench.vue'),
  icon: IconDashboard,
  createdAt: new Date('2026-08-16'),
});

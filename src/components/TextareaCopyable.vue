<script setup lang="ts">
import { IconCopy } from '@tabler/icons-vue';
import { useElementSize } from '@vueuse/core';
import hljs from 'highlight.js/lib/core';
import jsonHljs from 'highlight.js/lib/languages/json';
import sqlHljs from 'highlight.js/lib/languages/sql';
import xmlHljs from 'highlight.js/lib/languages/xml';
import yamlHljs from 'highlight.js/lib/languages/yaml';
import iniHljs from 'highlight.js/lib/languages/ini';
import markdownHljs from 'highlight.js/lib/languages/markdown';
import typescriptHljs from 'highlight.js/lib/languages/typescript';
import { useCopy } from '@/composable/copy';

const props = withDefaults(
  defineProps<{
    value: string
    followHeightOf?: HTMLElement | null
    language?: string
    copyPlacement?: 'top-right' | 'bottom-right' | 'outside' | 'none'
    copyMessage?: string
  }>(),
  {
    followHeightOf: null,
    language: 'txt',
    copyPlacement: 'top-right',
    copyMessage: 'Copy to clipboard',
  },
);
hljs.registerLanguage('sql', sqlHljs);
hljs.registerLanguage('json', jsonHljs);
hljs.registerLanguage('html', xmlHljs);
hljs.registerLanguage('xml', xmlHljs);
hljs.registerLanguage('yaml', yamlHljs);
hljs.registerLanguage('toml', iniHljs);
hljs.registerLanguage('markdown', markdownHljs);
hljs.registerLanguage('typescript', typescriptHljs);

const { value, language, followHeightOf, copyPlacement, copyMessage } = toRefs(props);
const { height } = followHeightOf.value ? useElementSize(followHeightOf) : { height: ref(null) };

const { t } = useI18n();

// M12 U7: success feedback is a toast, aligned with the workbench ViewToolbar;
// the tooltip only states the action.
const { copy, isJustCopied } = useCopy({ source: value, createToast: true, text: t('copy.success') });
const tooltipText = computed(() => (isJustCopied.value ? t('copy.copied') : (copyMessage.value || t('copy.tooltip'))));
</script>

<template>
  <div style="overflow-x: hidden; width: 100%">
    <c-card relative>
      <n-scrollbar
        x-scrollable
        trigger="none"
        :style="height ? `min-height: ${height - 40 /* card padding */ + 10 /* negative margin compensation */}px` : ''"
      >
        <n-config-provider :hljs="hljs">
          <n-code :code="value" :language="language" :trim="false" data-test-id="area-content" />
        </n-config-provider>
      </n-scrollbar>
      <div absolute right-10px top-10px>
        <c-tooltip v-if="value" :tooltip="tooltipText" position="left">
          <c-button circle important:h-10 important:w-10 data-test-id="copy-output" @click="copy()">
            <n-icon size="22" :component="IconCopy" />
          </c-button>
        </c-tooltip>
      </div>
    </c-card>
    <div v-if="copyPlacement === 'outside'" mt-4 flex justify-center>
      <c-button @click="copy()">
        {{ tooltipText }}
      </c-button>
    </div>
  </div>
</template>

<style lang="less" scoped>
::v-deep(.n-scrollbar) {
  padding-bottom: 10px;
  margin-bottom: -10px;
}
</style>

<script setup lang="ts">
import { IconDownload } from '@tabler/icons-vue';
import _ from 'lodash';
import type { UseValidationRule } from '@/composable/validation';
import { useDownloadTextFile } from '@/composable/downloadTextFile';
import CInputText from '@/ui/c-input-text/c-input-text.vue';

const props = withDefaults(
  defineProps<{
    transformer?: (v: string) => string
    inputValidationRules?: UseValidationRule<string>[]
    inputLabel?: string
    inputPlaceholder?: string
    inputDefault?: string
    outputLabel?: string
    outputLanguage?: string
  }>(),
  {
    transformer: _.identity,
    inputValidationRules: () => [],
    inputLabel: 'Input',
    inputDefault: '',
    inputPlaceholder: 'Input...',
    outputLabel: 'Output',
    outputLanguage: '',
  },
);

const { transformer, inputValidationRules, inputLabel, outputLabel, outputLanguage, inputPlaceholder, inputDefault }
  = toRefs(props);

const inputElement = ref<typeof CInputText>();

const input = ref(inputDefault.value);
const output = computed(() => transformer.value(input.value));

// M12 U7: every FormatTransformer page gets the same download action as the
// workbench ViewToolbar (icon + label, small, right-aligned above the output).
const { t } = useI18n();

const outputExtension = computed(() => {
  const map: Record<string, string> = {
    json: 'json',
    yaml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    typescript: 'ts',
    csv: 'csv',
  };
  return map[outputLanguage.value] ?? 'txt';
});

const { download } = useDownloadTextFile({
  source: output,
  filename: () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `dataforge-${outputExtension.value}-${stamp}`;
  },
  extension: () => outputExtension.value,
});
</script>

<template>
  <div v-if="$slots.actions" mb-1 flex justify-end>
    <slot name="actions" :input="input" />
  </div>

  <CInputText
    ref="inputElement"
    v-model:value="input"
    :placeholder="inputPlaceholder"
    :label="inputLabel"
    rows="20"
    autosize
    raw-text
    multiline
    test-id="input"
    :validation-rules="inputValidationRules"
    monospace
  />

  <div overflow-auto>
    <div mb-5px flex items-center justify-between>
      <span>{{ outputLabel }}</span>
      <c-button size="small" data-test-id="download-output" @click="download()">
        <span flex items-center gap-1>
          <n-icon size="16" :component="IconDownload" />
          {{ t('copy.download') }}
        </span>
      </c-button>
    </div>
    <textarea-copyable :value="output" :language="outputLanguage" :follow-height-of="inputElement?.inputWrapperRef" />
  </div>
</template>

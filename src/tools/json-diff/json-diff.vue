<script setup lang="ts">
import JSON5 from 'json5';

import DiffsViewer from './diff-viewer/diff-viewer.vue';
import OpenInWorkbenchButton from '@/components/OpenInWorkbenchButton.vue';
import { withDefaultOnError } from '@/utils/defaults';
import { isNotThrowing } from '@/utils/boolean';

const { t } = useI18n();

const rawLeftJson = ref('');
const rawRightJson = ref('');

const leftJson = computed(() => withDefaultOnError(() => JSON5.parse(rawLeftJson.value), undefined));
const rightJson = computed(() => withDefaultOnError(() => JSON5.parse(rawRightJson.value), undefined));

// M9: hand the first non-empty side over to the workbench (left side first).
const handoffRaw = computed(() => rawLeftJson.value.trim() !== '' ? rawLeftJson.value : rawRightJson.value);

const jsonValidationRules = [
  {
    validator: (value: string) => value === '' || isNotThrowing(() => JSON5.parse(value)),
    message: t('tools.json-diff.invalidJson'),
  },
];
</script>

<template>
  <div style="flex: 0 0 100%" flex justify-end>
    <OpenInWorkbenchButton :raw="handoffRaw" format="json" />
  </div>

  <c-input-text
    v-model:value="rawLeftJson"
    :validation-rules="jsonValidationRules"
    :label="t('tools.json-diff.leftLabel')"
    :placeholder="t('tools.json-diff.leftPlaceholder')"
    rows="20"
    multiline
    test-id="leftJson"
    raw-text
    monospace
  />

  <c-input-text
    v-model:value="rawRightJson"
    :validation-rules="jsonValidationRules"
    :label="t('tools.json-diff.rightLabel')"
    :placeholder="t('tools.json-diff.rightPlaceholder')"
    rows="20"
    multiline
    test-id="rightJson"
    raw-text
    monospace
  />

  <DiffsViewer :left-json="leftJson" :right-json="rightJson" />
</template>

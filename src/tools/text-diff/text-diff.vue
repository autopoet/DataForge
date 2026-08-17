<script setup lang="ts">
import { useStorage } from '@vueuse/core';

import OpenInWorkbenchButton from '@/components/OpenInWorkbenchButton.vue';

const { t } = useI18n();

// Phase 3 P1: two real inputs wired to the diff editor, persisted so a refresh
// keeps them (same pattern as the type-generator page). The workbench only
// consumes the raw payload (A6), so the format tag is informational.
const original = useStorage('dataforge:text-diff:original', '');
const modified = useStorage('dataforge:text-diff:modified', '');

// Hand the first non-empty side over to the workbench (left side first).
const handoffRaw = computed(() => original.value.trim() !== '' ? original.value : modified.value);
</script>

<template>
  <div style="flex: 0 0 100%" flex justify-end>
    <OpenInWorkbenchButton :raw="handoffRaw" format="json" />
  </div>

  <c-input-text
    v-model:value="original"
    :label="t('tools.text-diff.leftLabel')"
    :placeholder="t('tools.text-diff.leftPlaceholder')"
    rows="20"
    multiline
    test-id="original"
    raw-text
    monospace
  />

  <c-input-text
    v-model:value="modified"
    :label="t('tools.text-diff.rightLabel')"
    :placeholder="t('tools.text-diff.rightPlaceholder')"
    rows="20"
    multiline
    test-id="modified"
    raw-text
    monospace
  />

  <c-card w-full important:flex-1 important:pa-0>
    <c-diff-editor :original="original" :modified="modified" />
  </c-card>
</template>

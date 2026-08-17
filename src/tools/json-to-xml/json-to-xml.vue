<script setup lang="ts">
import convert from 'xml-js';
import JSON5 from 'json5';
import OpenInWorkbenchButton from '@/components/OpenInWorkbenchButton.vue';
import { withDefaultOnError } from '@/utils/defaults';
import type { UseValidationRule } from '@/composable/validation';

const { t } = useI18n();

function transformer(value: string) {
  return withDefaultOnError(() => {
    return convert.js2xml(JSON5.parse(value), { compact: true });
  }, '');
}

const rules: UseValidationRule<string>[] = [
  {
    validator: (v: string) => v === '' || JSON5.parse(v),
    message: t('tools.json-to-xml.invalidJson'),
  },
];
</script>

<template>
  <format-transformer
    :input-label="t('tools.json-to-xml.inputLabel')"
    :input-placeholder="t('tools.json-to-xml.inputPlaceholder')"
    :output-label="t('tools.json-to-xml.outputLabel')"
    output-language="xml"
    :transformer="transformer"
    :input-validation-rules="rules"
  >
    <template #actions="{ input }">
      <OpenInWorkbenchButton :raw="input" format="json" />
    </template>
  </format-transformer>
</template>

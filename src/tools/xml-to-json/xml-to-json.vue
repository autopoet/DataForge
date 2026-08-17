<script setup lang="ts">
import convert from 'xml-js';
import { isValidXML } from '../xml-formatter/xml-formatter.service';
import OpenInWorkbenchButton from '@/components/OpenInWorkbenchButton.vue';
import { withDefaultOnError } from '@/utils/defaults';
import type { UseValidationRule } from '@/composable/validation';

const { t } = useI18n();

function transformer(value: string) {
  return withDefaultOnError(() => {
    return JSON.stringify(convert.xml2js(value, { compact: true }), null, 2);
  }, '');
}

const rules: UseValidationRule<string>[] = [
  {
    validator: isValidXML,
    message: t('tools.xml-to-json.invalidXml'),
  },
];
</script>

<template>
  <format-transformer
    :input-label="t('tools.xml-to-json.inputLabel')"
    :input-placeholder="t('tools.xml-to-json.inputPlaceholder')"
    :output-label="t('tools.xml-to-json.outputLabel')"
    output-language="json"
    :transformer="transformer"
    :input-validation-rules="rules"
  >
    <template #actions="{ input }">
      <OpenInWorkbenchButton :raw="input" format="xml" />
    </template>
  </format-transformer>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core';
import JSON5 from 'json5';
import OpenInWorkbenchButton from '@/components/OpenInWorkbenchButton.vue';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useValidation } from '@/composable/validation';
import { toCsv } from '@/tools/workbench/services/csv.service';
import { withDefaultOnError } from '@/utils/defaults';

const { t } = useI18n();

const inputElement = ref<HTMLElement>();

const rawJson = ref('');
const flatten = useStorage('json-to-csv:flatten', true);

const output = computed(() => withDefaultOnError(() => toCsv(JSON5.parse(rawJson.value), { flatten: flatten.value }), ''));

const rawJsonValidation = useValidation({
  source: rawJson,
  rules: [
    {
      validator: (v: string) => v === '' || JSON5.parse(v),
      message: t('tools.json-to-csv.invalidJson'),
    },
  ],
});
</script>

<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 600px" flex justify-center gap-3>
      <n-form-item :label="t('tools.json-to-csv.flatten')" label-placement="left" label-width="220">
        <n-switch v-model:value="flatten" />
      </n-form-item>
    </div>

    <div flex justify-end>
      <OpenInWorkbenchButton :raw="rawJson" format="json" />
    </div>
  </div>

  <n-form-item
    :label="t('tools.json-to-csv.inputLabel')"
    :feedback="rawJsonValidation.message"
    :validation-status="rawJsonValidation.status"
  >
    <c-input-text
      ref="inputElement"
      v-model:value="rawJson"
      :placeholder="t('tools.json-to-csv.inputPlaceholder')"
      rows="20"
      multiline
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      monospace
      test-id="input"
    />
  </n-form-item>
  <n-form-item :label="t('tools.json-to-csv.outputLabel')">
    <TextareaCopyable :value="output" :follow-height-of="inputElement" />
  </n-form-item>
</template>

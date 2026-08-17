<script setup lang="ts">
import JSON5 from 'json5';
import { useRouter } from 'vue-router';
import { useStorage } from '@vueuse/core';
import { TYPE_GENERATION_WARN_SIZE, type TypeGeneratorStyle, generateTypeScriptTypes } from './type-generator.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { withDefaultOnError } from '@/utils/defaults';
import { isNotThrowing } from '@/utils/boolean';

const { t } = useI18n();
const router = useRouter();

// Cross-page handoff (design decision A6): the workbench writes { raw, format } here
// before navigating with ?from=workbench; this page writes it back on the reverse trip.
const HANDOFF_KEY = 'dataforge:handoff';

// M12 U6 (decision A12): no prefilled example value anymore — the example now
// lives in the placeholder, consistent with every other input across the app.
const input = useStorage('dataforge:type-generator:input', '');
const rootName = useStorage('dataforge:type-generator:root-name', 'Root');
const style = useStorage<TypeGeneratorStyle>('dataforge:type-generator:style', 'interface');
const exportKeyword = useStorage('dataforge:type-generator:export-keyword', true);
const literalUnionMax = useStorage('dataforge:type-generator:literal-union-max', 8);

const inputValidationRules = [
  {
    validator: (value: string) => value === '' || isNotThrowing(() => JSON5.parse(value)),
    message: t('tools.type-generator.invalidJson'),
  },
];

const parsed = computed(() => withDefaultOnError(() => JSON5.parse(input.value), undefined));
const hasInput = computed(() => input.value.trim() !== '');
const output = computed(() => {
  if (!hasInput.value || parsed.value === undefined) {
    return '';
  }
  return generateTypeScriptTypes(parsed.value, {
    rootName: rootName.value,
    style: style.value,
    exportKeyword: exportKeyword.value,
    literalUnion: { enabled: true, maxLiterals: literalUnionMax.value },
  });
});
const largeInputWarning = computed(() => input.value.length > TYPE_GENERATION_WARN_SIZE);

onMounted(() => {
  if (new URLSearchParams(window.location.search).get('from') === 'workbench') {
    const handoff = sessionStorage.getItem(HANDOFF_KEY);
    if (handoff) {
      try {
        const { raw } = JSON.parse(handoff);
        if (typeof raw === 'string') {
          input.value = raw;
        }
      }
      catch {
        // ignore a malformed handoff payload and keep the stored input
      }
    }
    sessionStorage.removeItem(HANDOFF_KEY);
  }
});

function openInWorkbench() {
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ raw: input.value, format: 'json' }));
  router.push('/workbench');
}
</script>

<template>
  <div style="flex: 0 0 100%">
    <div mb-4 flex flex-wrap items-end gap-4>
      <n-form-item
        label-placement="left"
        :label="t('tools.type-generator.options.rootName')"
        label-width="110"
      >
        <n-input v-model:value="rootName" size="small" style="width: 160px" placeholder="Root" />
      </n-form-item>

      <c-buttons-select
        v-model:value="style"
        :options="[{ label: 'interface', value: 'interface' }, { label: 'type', value: 'type' }]"
        :label="t('tools.type-generator.options.style')"
        label-width="110"
      />

      <n-form-item
        label-placement="left"
        :label="t('tools.type-generator.options.exportKeyword')"
        label-width="110"
      >
        <n-switch v-model:value="exportKeyword" />
      </n-form-item>

      <n-form-item
        label-placement="left"
        :label="t('tools.type-generator.options.literalUnionMax')"
        label-width="110"
      >
        <n-input-number v-model:value="literalUnionMax" size="small" min="0" max="100" style="width: 100px" />
      </n-form-item>

      <c-button :disabled="!hasInput" ml-auto @click="openInWorkbench">
        {{ t('tools.type-generator.openInWorkbench') }}
      </c-button>
    </div>

    <n-alert v-if="largeInputWarning" type="warning" mb-4>
      {{ t('tools.type-generator.largeInputWarning') }}
    </n-alert>

    <div grid gap-4 lg:grid-cols-2>
      <c-input-text
        v-model:value="input"
        :validation-rules="inputValidationRules"
        :label="t('tools.type-generator.inputLabel')"
        :placeholder="t('tools.type-generator.inputPlaceholder')"
        rows="16"

        raw-text multiline monospace
        test-id="input"
      />

      <div>
        <div mb-5px>
          {{ t('tools.type-generator.outputLabel') }}
        </div>
        <TextareaCopyable :value="output" language="typescript" />
      </div>
    </div>
  </div>
</template>

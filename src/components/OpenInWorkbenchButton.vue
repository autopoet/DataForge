<script setup lang="ts">
import { useRouter } from 'vue-router';

// M9: shared cross-entry button (design doc M9 §2). It hands the current input
// to the workbench through the sessionStorage handoff (decision A6); the
// workbench consumes the payload on mount and clears it right away.
const props = defineProps<{
  raw: string
  format: 'json' | 'yaml' | 'toml' | 'xml' | 'csv'
}>();

const { t } = useI18n();
const router = useRouter();

const HANDOFF_KEY = 'dataforge:handoff';

const hasRaw = computed(() => props.raw.trim() !== '');

function openInWorkbench() {
  if (!hasRaw.value) {
    return;
  }
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ raw: props.raw, format: props.format }));
  router.push('/workbench');
}
</script>

<template>
  <c-button size="small" data-test-id="open-in-workbench" :disabled="!hasRaw" @click="openInWorkbench">
    {{ t('openInWorkbench.label') }}
  </c-button>
</template>

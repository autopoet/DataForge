<script setup lang="ts">
import { IconRepeat } from '@tabler/icons-vue';
import DiffsViewer from '../../json-diff/diff-viewer/diff-viewer.vue';
import { parseToData } from '../services/convert.service';
import { useWorkbenchStore } from '../workbench.store';
import type { WorkbenchSnapshot } from '../workbench.store';

// M8 (design doc M8 §2): compare a history snapshot against the current input
// with the shared json-diff engine. The snapshot is parsed with the format that
// was in effect when it was captured, reproducing the IR the user saw then;
// both sides are pure JSON-compatible values (A2), so a JSON snapshot can be
// diffed against a YAML input. diff-viewer.vue is imported straight from the
// json-diff tool (design doc: 跨工具目录 import, 务实优先) — if Phase 2 reuses
// it elsewhere, lift it to src/components/ then.

const props = defineProps<{
  open: boolean
  snapshot: WorkbenchSnapshot | null
}>();

const emit = defineEmits(['update:open']);

const { t } = useI18n();

const store = useWorkbenchStore();

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

// The snapshot always starts on the left; reset the swap whenever the modal
// closes (each compare opens a fresh layout, even for the same snapshot).
const swap = ref(false);
watch(isOpen, (open) => {
  if (!open) {
    swap.value = false;
  }
});

const snapshotData = computed<unknown>(() => {
  if (!props.snapshot || props.snapshot.truncated) {
    return undefined;
  }
  return parseToData(props.snapshot.raw, props.snapshot.format).data;
});

const currentData = computed<unknown>(() => store.parsedData.data);

const leftJson = computed(() => (swap.value ? currentData.value : snapshotData.value));
const rightJson = computed(() => (swap.value ? snapshotData.value : currentData.value));

const canCompare = computed(() => leftJson.value !== undefined && rightJson.value !== undefined);
</script>

<template>
  <n-modal
    v-model:show="isOpen"
    preset="card"
    :title="t('tools.workbench.history.diffTitle')"
    style="width: min(880px, calc(100vw - 32px))"
    data-test-id="diff-modal"
  >
    <div class="snapshot-diff">
      <div class="diff-toolbar mb-3" flex justify-end>
        <c-button size="small" :disabled="!canCompare" data-test-id="diff-swap" @click="swap = !swap">
          <span flex items-center gap-1>
            <n-icon size="14" :component="IconRepeat" />
            {{ t('tools.workbench.history.swap') }}
          </span>
        </c-button>
      </div>

      <n-alert
        v-if="!canCompare"
        type="info"
        :bordered="false"
        data-test-id="diff-unavailable"
      >
        {{ t('tools.workbench.history.diffUnavailable') }}
      </n-alert>

      <div v-else class="diff-content max-h-[60vh] overflow-auto" data-test-id="diff-content">
        <DiffsViewer :left-json="leftJson" :right-json="rightJson" />
      </div>
    </div>
  </n-modal>
</template>

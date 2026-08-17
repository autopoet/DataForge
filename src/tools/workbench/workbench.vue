<script setup lang="ts">
import { IconHistory } from '@tabler/icons-vue';
import DecodeBanner from './components/DecodeBanner.vue';
import FileDropZone from './components/FileDropZone.vue';
import HistoryTimeline from './components/HistoryTimeline.vue';
import InputPanel from './components/InputPanel.vue';
import OutputViews from './components/OutputViews.vue';
import { parseToData } from './services/convert.service';
import type { ParseResult } from './services/convert.service';
import { detectFormat } from './services/format-detect.service';
import type { FormatDetection } from './services/format-detect.service';
import { useWorkbenchStore } from './workbench.store';
import type { WorkbenchFormat } from './workbench.store';
import useDebouncedRef from '@/composable/debouncedref';

// M4: page assembly only — layout grid, the debounce pipeline and sub-component
// wiring (design doc M4 §2). The textarea edits store.rawInput live (instant
// cursor), while detection and view rendering run off a 300ms-debounced copy so
// large pastes don't re-parse on every keystroke. pushSnapshot is itself
// debounced (M3), so a plain watch is all it needs.

const store = useWorkbenchStore();

const { t } = useI18n();

// Cross-page handoff (design decision A6): the type-generator page writes this
// key before pushing /workbench. Consume it on mount and clear it right away so
// a refresh does not re-apply a stale payload.
const HANDOFF_KEY = 'dataforge:handoff';

onMounted(() => {
  const handoff = sessionStorage.getItem(HANDOFF_KEY);
  if (handoff === null) {
    return;
  }
  sessionStorage.removeItem(HANDOFF_KEY);
  try {
    const { raw } = JSON.parse(handoff) as { raw?: unknown };
    if (typeof raw === 'string') {
      store.setInput(raw);
    }
  }
  catch {
    // ignore a malformed handoff payload and keep the persisted workspace
  }
});

const debouncedRaw = useDebouncedRef(store.rawInput, 300);
watch(() => store.rawInput, (raw) => {
  debouncedRaw.value = raw;
}, { immediate: true });

const detection = computed<FormatDetection>(() => {
  if (store.formatOverride !== 'auto') {
    return {
      format: store.formatOverride,
      confidence: 'high',
      reason: 'format manually selected by the user',
    };
  }
  return detectFormat(debouncedRaw.value);
});

const parsedData = computed<ParseResult>(() => parseToData(debouncedRaw.value, detection.value.format));

watch(debouncedRaw, () => store.pushSnapshot());

const inputPanel = ref<InstanceType<typeof InputPanel>>();
const followHeightOf = computed(() => inputPanel.value?.inputElement?.inputWrapperRef ?? null);

const formatOptions = computed<{ label: string; value: WorkbenchFormat }[]>(() => [
  { label: t('tools.workbench.format.auto'), value: 'auto' },
  ...(['json', 'yaml', 'toml', 'xml', 'csv'] as const).map(format => ({
    label: t(`tools.workbench.format.${format}`),
    value: format,
  })),
]);

// M8: the history drawer opens from the toolbar button; the drawer itself owns
// the compare modal and the clear-history confirmation (HistoryTimeline.vue).
const historyOpen = ref(false);
</script>

<template>
  <div class="workbench" flex flex-col gap-4>
    <!-- Toolbar: format override + history (M8) + clear. -->
    <div class="workbench-toolbar" flex flex-wrap items-center gap-3>
      <c-buttons-select v-model:value="store.formatOverride" :options="formatOptions" size="small" />
      <div flex-1 />
      <c-button size="small" data-test-id="history-open" @click="historyOpen = true">
        <span flex items-center gap-1>
          <n-icon size="16" :component="IconHistory" />
          {{ t('tools.workbench.history.open', { count: store.snapshots.length }) }}
        </span>
      </c-button>
      <c-button size="small" data-test-id="clear-all" @click="store.clearAll()">
        {{ t('tools.workbench.toolbar.clear') }}
      </c-button>
    </div>

    <DecodeBanner />

    <div class="workbench-layout" grid gap-4 lg:grid-cols-12 lg:gap-6>
      <div class="min-w-0 lg:col-span-5">
        <FileDropZone>
          <InputPanel ref="inputPanel" :detection="detection" :parsed="parsedData" :raw="debouncedRaw" />
        </FileDropZone>
      </div>
      <div class="min-w-0 lg:col-span-7">
        <OutputViews :detection="detection" :parsed="parsedData" :follow-height-of="followHeightOf" />
      </div>
    </div>

    <HistoryTimeline v-model:open="historyOpen" />
  </div>
</template>

<script setup lang="ts">
import type { ParseResult } from '../services/convert.service';
import type { FormatDetection } from '../services/format-detect.service';
import { viewRegistry } from '../views/registry';
import type { ViewAvailability, ViewDescriptor } from '../views/registry';
import { useWorkbenchStore } from '../workbench.store';
import ViewToolbar from './ViewToolbar.vue';
import { computedCatch } from '@/composable/computed/catchedComputed';

// M4: the output side of the workbench. The tab bar is rendered straight from
// the view registry (design doc M4 §1): disabled views stay visible but greyed
// with a tooltip explaining why. The active view renders on demand — switching
// tabs is the only thing that triggers its render — and a throwing render
// becomes an in-view error bar (error model level 2), never a crash.

const props = defineProps<{
  detection: FormatDetection
  parsed: ParseResult
  followHeightOf: HTMLElement | null
}>();

const { t } = useI18n();

const store = useWorkbenchStore();

// CSV view option (design doc M5): the flatten toggle feeds toCsv through the
// render options. Component-local on purpose — it is a per-session preference,
// not part of the persisted workspace state.
const csvFlatten = ref(true);

const availabilityById = computed<Map<string, ViewAvailability>>(() => {
  const map = new Map<string, ViewAvailability>();
  viewRegistry.forEach((view) => {
    map.set(view.id, view.availability(props.parsed.data, props.detection.format));
  });
  return map;
});

// Prefer the persisted active view, but never let it point at a disabled view
// (e.g. the input was cleared or switched to a format the view cannot serve) —
// fall back to the first enabled one.
const activeViewId = computed<string | null>({
  get: () => {
    const requested = store.activeViewId;
    if (requested && availabilityById.value.get(requested)?.enabled) {
      return requested;
    }
    return viewRegistry.find(view => availabilityById.value.get(view.id)?.enabled)?.id ?? null;
  },
  set: (id: string | null) => {
    store.activeViewId = id;
  },
});

const activeView = computed<ViewDescriptor | null>(
  () => viewRegistry.find(view => view.id === activeViewId.value) ?? null,
);

const [output, renderError] = computedCatch(() => {
  if (!activeView.value || props.parsed.data === undefined) {
    return '';
  }
  return activeView.value.render(props.parsed.data, props.detection.format, { csvFlatten: csvFlatten.value });
}, { defaultValue: '', defaultErrorMessage: t('tools.workbench.output.renderFailed') });

function isEnabled(view: ViewDescriptor): boolean {
  return availabilityById.value.get(view.id)?.enabled ?? false;
}

function disabledTooltip(view: ViewDescriptor): string {
  const reasonKey = availabilityById.value.get(view.id)?.disabledReasonKey;
  if (!reasonKey) {
    return '';
  }
  // extra params are harmless for keys without placeholders
  return t(reasonKey, { view: t(view.labelKey) });
}
</script>

<template>
  <div class="output-views">
    <n-tabs v-model:value="activeViewId" type="line" size="small" data-test-id="view-tabs">
      <n-tab-pane
        v-for="view in viewRegistry"
        :key="view.id"
        :name="view.id"
        :disabled="!isEnabled(view)"
      >
        <template #tab>
          <c-tooltip v-if="!isEnabled(view)" :tooltip="disabledTooltip(view)">
            <span>{{ t(view.labelKey) }}</span>
          </c-tooltip>
          <span v-else>{{ t(view.labelKey) }}</span>
        </template>
      </n-tab-pane>
    </n-tabs>

    <div v-if="activeView?.id === 'csv'" class="csv-options mt-2" flex items-center gap-2>
      <n-switch v-model:value="csvFlatten" size="small" />
      <span class="text-sm opacity-70">{{ t('tools.workbench.views.csvOptions.flatten') }}</span>
    </div>

    <div class="output-content mt-2">
      <n-alert
        v-if="renderError"
        type="error"
        :title="t('tools.workbench.output.renderFailed')"
        data-test-id="view-error"
      >
        {{ renderError }}
      </n-alert>
      <template v-else-if="activeView">
        <textarea-copyable
          :value="output"
          :language="activeView.language(detection.format)"
          :follow-height-of="followHeightOf"
          copy-placement="none"
        />
        <ViewToolbar
          :value="output"
          :view-id="activeView.id"
          :extension="activeView.extension(detection.format)"
        />
      </template>
      <div v-else class="output-empty py-8 text-center opacity-60" data-test-id="output-empty">
        {{ t('tools.workbench.output.empty') }}
      </div>
    </div>
  </div>
</template>

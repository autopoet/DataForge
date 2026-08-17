<script setup lang="ts">
import type { ParseResult } from '../services/convert.service';
import type { DataFormat, FormatDetection } from '../services/format-detect.service';
import { useWorkbenchStore } from '../workbench.store';
import CInputText from '@/ui/c-input-text/c-input-text.vue';
import { useAppTheme } from '@/ui/theme/themes';

// M4: the input side of the workbench. The textarea edits the store's rawInput
// live (instant cursor), while the status line below reflects the debounced
// detection/parse results passed down by workbench.vue (design doc M4 §2).

const props = defineProps<{
  detection: FormatDetection
  parsed: ParseResult
  raw: string
}>();

const { t } = useI18n();

const store = useWorkbenchStore();
const appTheme = useAppTheme();

const inputElement = ref<InstanceType<typeof CInputText>>();

const bytes = computed(() => new TextEncoder().encode(props.raw).length);
const lines = computed(() => props.raw.split('\n').length);

const sizeText = computed(() => props.raw.trim() === ''
  ? ''
  : t('tools.workbench.status.size', { size: bytes.value.toLocaleString(), lines: lines.value }));

const badgeText = computed(() => {
  const { format, confidence } = props.detection;
  if (format === null) {
    return '';
  }
  if (store.formatOverride !== 'auto') {
    return t('tools.workbench.status.badgeOverride', { format: formatName(format) });
  }
  if (confidence === 'low') {
    return t('tools.workbench.status.badgeLow', { format: formatName(format) });
  }
  return t('tools.workbench.status.badgeHigh', { format: formatName(format) });
});

const badgeType = computed(() => {
  if (props.parsed.error) {
    return 'error';
  }
  if (store.formatOverride !== 'auto') {
    return 'info';
  }
  return props.detection.confidence === 'high' ? 'success' : 'warning';
});

const errorText = computed(() => {
  if (!props.parsed.error || props.detection.format === null) {
    return '';
  }
  return t('tools.workbench.status.parseError', {
    format: formatName(props.detection.format),
    error: props.parsed.error,
  });
});

const showLowConfidenceHint = computed(() =>
  props.detection.format !== null && props.detection.confidence === 'low' && !props.parsed.error,
);

function formatName(format: DataFormat): string {
  // JSON/YAML/... are universal latin names; only the 'text' fallback needs
  // this literal form.
  return format === 'text' ? 'TEXT' : t(`tools.workbench.format.${format}`);
}

defineExpose({ inputElement });
</script>

<template>
  <div class="input-panel">
    <CInputText
      ref="inputElement"
      v-model:value="store.rawInput"
      :placeholder="t('tools.workbench.inputPlaceholder')"
      rows="18"

      autosize raw-text multiline monospace
      test-id="workbench-input"
    />

    <div class="status-line mt-2" flex flex-wrap items-center gap-x-3 gap-y-1>
      <n-tag v-if="detection.format" :type="badgeType" size="small" :bordered="false" data-test-id="format-badge">
        {{ badgeText }}
      </n-tag>
      <span v-if="sizeText" class="status-size text-sm opacity-70">{{ sizeText }}</span>
      <span v-if="errorText" class="parse-error text-sm" data-test-id="parse-error">{{ errorText }}</span>
      <span v-if="showLowConfidenceHint" class="low-confidence-hint text-sm opacity-70">
        {{ t('tools.workbench.status.lowConfidenceHint') }}
      </span>
    </div>
  </div>
</template>

<style lang="less" scoped>
.parse-error {
  color: v-bind('appTheme.error.color');
}
</style>

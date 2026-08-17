<script setup lang="ts">
import { decodeDeep } from '../services/deep-decode.service';
import { useWorkbenchStore } from '../workbench.store';

// M7 (design doc M7 §1): surface the multi-layer decode hint (F04) as an alert
// under the toolbar. "Decode one layer" writes the first decode layer back so
// the user can watch the peel, "Decode all" jumps straight to the last one.
// The write-back re-enters the normal input pipeline, so the M3 snapshot
// debounce covers it — no separate undo is needed.

const { t } = useI18n();

const store = useWorkbenchStore();

// The store's decodeHint is live (not debounced), so the banner follows the
// textarea while typing; decodeDeep's 1MB guard keeps this cheap on big inputs.
const decode = computed(() => (store.decodeHint ? decodeDeep(store.rawInput) : null));

const layerCount = computed(() => decode.value?.layers.length ?? 0);

function decodeOneLayer() {
  const first = decode.value?.layers[0];
  if (first) {
    store.applyDecodedValue(first.value);
  }
}

function decodeAll() {
  const layers = decode.value?.layers;
  const last = layers?.[layers.length - 1];
  if (last) {
    store.applyDecodedValue(last.value);
  }
}
</script>

<template>
  <n-alert
    v-if="decode && layerCount > 0"
    type="info"
    :bordered="false"
    data-test-id="decode-banner"
  >
    <div flex flex-wrap items-center gap-3>
      <span flex-1>{{ t('tools.workbench.decode.banner', { count: layerCount }) }}</span>
      <div flex gap-2>
        <c-button size="small" data-test-id="decode-one" @click="decodeOneLayer">
          {{ t('tools.workbench.decode.decodeOne') }}
        </c-button>
        <c-button size="small" type="primary" data-test-id="decode-all" @click="decodeAll">
          {{ t('tools.workbench.decode.decodeAll') }}
        </c-button>
      </div>
    </div>
  </n-alert>
</template>

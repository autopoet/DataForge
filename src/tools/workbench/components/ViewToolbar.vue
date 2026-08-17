<script setup lang="ts">
import { IconCopy, IconDownload } from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import { useWorkbenchStore } from '../workbench.store';
import { useCopy } from '@/composable/copy';
import { useDownloadTextFile } from '@/composable/downloadTextFile';

// M4: per-view action bar. Copy works right away; the download button (M7 §3)
// saves the rendered output under dataforge-{viewId}-{yyyyMMdd-HHmmss}.{ext},
// and the TypeScript view gains an extra "open in dedicated page" button that
// hands the current IR to /type-generator through the sessionStorage handoff
// (design decision A6).

const props = defineProps<{
  value: string
  viewId: string
  extension: string
}>();

const { t } = useI18n();
const router = useRouter();
const store = useWorkbenchStore();

const { copy } = useCopy({
  source: () => props.value,
  text: t('tools.workbench.copySuccess'),
});

const source = computed(() => props.value);

// Filename and extension resolve at click time: ViewToolbar stays mounted
// across view switches, so capturing them at setup would stamp a stale viewId
// onto the file once the user moves to another tab.
const { download } = useDownloadTextFile({
  source,
  filename: () => downloadBaseName(props.viewId),
  extension: () => props.extension,
});

// Cross-page handoff (design decision A6): the type-generator page reads this
// key when it arrives with ?from=workbench and consumes it right away.
const HANDOFF_KEY = 'dataforge:handoff';

function openInTypeGenerator() {
  const data = store.parsedData.data;
  if (data === undefined) {
    return;
  }
  // The IR is JSON-compatible by construction (A2), so serializing it always
  // gives the type generator a parseable input, whatever the source format was.
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ raw: JSON.stringify(data), format: 'json' }));
  router.push('/type-generator?from=workbench');
}

function downloadBaseName(viewId: string): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `dataforge-${viewId}-${stamp}`;
}
</script>

<template>
  <div class="view-toolbar mt-2" flex flex-wrap items-center justify-end gap-2>
    <c-button
      v-if="viewId === 'typescript'"
      size="small"
      data-test-id="open-in-type-generator"
      @click="openInTypeGenerator"
    >
      {{ t('tools.workbench.output.openInTypeGenerator') }}
    </c-button>
    <c-button size="small" data-test-id="download-output" @click="download()">
      <span flex items-center gap-1>
        <n-icon size="16" :component="IconDownload" />
        {{ t('tools.workbench.output.download') }}
      </span>
    </c-button>
    <c-button size="small" data-test-id="copy-output" @click="copy()">
      <span flex items-center gap-1>
        <n-icon size="16" :component="IconCopy" />
        {{ t('tools.workbench.output.copy') }}
      </span>
    </c-button>
  </div>
</template>

<script setup lang="ts">
import type { DataFormat } from '../services/format-detect.service';
import { useWorkbenchStore } from '../workbench.store';

// M7 (design doc M7 §2): drag-and-drop file import around the input panel.
// Drops anywhere on the wrapper (or the click-to-browse entry below) read the
// file as text, map its extension to a format and write input + override. The
// 1MB perf guard asks for confirmation, the 10MB product boundary rejects.

const { t } = useI18n();
const message = useMessage();

const store = useWorkbenchStore();

const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // hard product boundary (REQUIREMENTS §6.3)
const CONFIRM_SIZE = 1 * 1024 * 1024; // perf guard: large files may lag the page

const FORMAT_BY_EXTENSION: Record<string, DataFormat | 'auto'> = {
  json: 'json',
  json5: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  csv: 'csv',
  txt: 'auto',
};

const acceptList = '.json,.json5,.yaml,.yml,.toml,.xml,.csv,.txt';

// A counter instead of a boolean: dragenter/dragleave fire on every child
// boundary crossing, and the overlay must not flicker while moving inside.
let dragDepth = 0;
const isDragging = ref(false);

// The 1MB guard is a modal now (c-modal-confirm, M8) instead of window.confirm
// — same two-step flow, but consistent with the rest of the UI. The oversized
// drop is parked until the user answers, so no data is lost on "cancel".
const showConfirm = ref(false);
let pendingFile: File | null = null;

function importFile(file: File) {
  const format = formatForFile(file);
  if (format === null) {
    message.error(t('tools.workbench.import.unsupportedType'));
    return;
  }
  if (file.size > MAX_IMPORT_SIZE) {
    message.error(t('tools.workbench.import.tooLarge'));
    return;
  }
  if (file.size > CONFIRM_SIZE) {
    pendingFile = file;
    showConfirm.value = true;
    return;
  }
  readAndApply(file, format);
}

function confirmImport() {
  const file = pendingFile;
  pendingFile = null;
  if (!file) {
    return;
  }
  const format = formatForFile(file);
  if (format !== null) {
    readAndApply(file, format);
  }
}

function readAndApply(file: File, format: DataFormat | 'auto') {
  file.text().then((text) => {
    store.setInput(text);
    store.setFormatOverride(format);
  });
}

function formatForFile(file: File): DataFormat | 'auto' | null {
  const dot = file.name.lastIndexOf('.');
  if (dot < 0) {
    return null;
  }
  return FORMAT_BY_EXTENSION[file.name.slice(dot + 1).toLowerCase()] ?? null;
}

function onDragEnter(event: DragEvent) {
  event.preventDefault();
  dragDepth += 1;
  isDragging.value = true;
}

function onDragLeave(event: DragEvent) {
  event.preventDefault();
  dragDepth -= 1;
  if (dragDepth <= 0) {
    dragDepth = 0;
    isDragging.value = false;
  }
}

function onDrop(event: DragEvent) {
  dragDepth = 0;
  isDragging.value = false;
  if (event.defaultPrevented) {
    return; // already handled by the inner c-file-upload
  }
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    importFile(file);
  }
}
</script>

<template>
  <div
    class="file-drop-zone relative"
    @dragenter="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <slot />

    <div
      v-if="isDragging"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-primary rounded-lg border-dashed bg-primary/10"
      data-test-id="drop-overlay"
    >
      <span class="rounded bg-primary px-4 py-2 text-sm text-white shadow-lg">
        {{ t('tools.workbench.import.dropHint') }}
      </span>
    </div>

    <c-file-upload :accept="acceptList" class="mt-3" @file-upload="importFile">
      <c-button size="small" data-test-id="import-file">
        {{ t('tools.workbench.import.label') }}
      </c-button>
    </c-file-upload>

    <c-modal-confirm
      v-model:open="showConfirm"
      :title="t('tools.workbench.import.confirmTitle')"
      :content="t('tools.workbench.import.largeFileConfirm')"
      :confirm-text="t('tools.workbench.import.confirm')"
      :cancel-text="t('tools.workbench.import.cancel')"
      type="warning"
      data-test-id="import-confirm"
      @confirm="confirmImport"
    />
  </div>
</template>

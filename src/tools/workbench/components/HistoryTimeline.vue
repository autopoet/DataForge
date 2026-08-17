<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import zhCN from 'date-fns/locale/zh-CN';
import { IconGitCompare, IconRefresh, IconTrash } from '@tabler/icons-vue';
import { useWorkbenchStore } from '../workbench.store';
import type { WorkbenchSnapshot } from '../workbench.store';
import SnapshotDiffModal from './SnapshotDiffModal.vue';
import CModalConfirm from '@/ui/c-modal-confirm/c-modal-confirm.vue';

// M8 (design doc M8 §1): the history drawer (n-drawer, right side). Snapshots
// are newest-first already (M3 pushes to index 0). Restore writes the raw input
// back, Compare opens the diff modal, Delete drops the entry. Truncated
// snapshots (no raw content stored, quota guard A8) disable restore/compare.

const props = defineProps<{ open: boolean }>();
const emit = defineEmits(['update:open']);

const { t, locale } = useI18n();

const store = useWorkbenchStore();

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const MAX_SNAPSHOTS = 50;

const comparing = ref<WorkbenchSnapshot | null>(null);
const diffOpen = ref(false);
const showClearConfirm = ref(false);

const usedCount = computed(() => store.snapshots.length);

const totalBytes = computed(() => store.snapshots.reduce((sum, snapshot) => sum + snapshot.size, 0));

// Only zh has a dedicated date-fns locale here; the other eight languages fall
// back to en, matching the app's i18n fallback behaviour.
const dateLocale = computed(() => (locale.value === 'zh' ? zhCN : enUS));

function relativeTime(createdAt: number): string {
  return formatDistanceToNow(createdAt, { addSuffix: true, locale: dateLocale.value });
}

function formatLabel(format: WorkbenchSnapshot['format']): string {
  // 'text' has no format key (like InputPanel) — the latin name reads fine.
  return format === null || format === 'text' ? (format?.toUpperCase() ?? '') : t(`tools.workbench.format.${format}`);
}

function kbText(bytes: number): string {
  if (bytes === 0) {
    return '0';
  }
  if (bytes < 1024) {
    return '<1';
  }
  const kb = bytes / 1024;
  return kb >= 100 ? String(Math.round(kb)) : kb.toFixed(1);
}

function restore(snapshot: WorkbenchSnapshot) {
  store.restoreSnapshot(snapshot.id);
  isOpen.value = false; // the input changed — close the drawer so it is visible
}

function compare(snapshot: WorkbenchSnapshot) {
  comparing.value = snapshot;
  diffOpen.value = true;
}

function remove(snapshot: WorkbenchSnapshot) {
  store.removeSnapshot(snapshot.id);
}

function clearAll() {
  store.clearSnapshots();
  showClearConfirm.value = false;
}
</script>

<template>
  <n-drawer v-model:show="isOpen" placement="right" :width="420" data-test-id="history-drawer">
    <n-drawer-content :title="t('tools.workbench.history.title')">
      <div class="history-timeline" flex flex-col gap-3>
        <div class="history-quota" flex items-center justify-between gap-2 text-sm>
          <span class="opacity-70">
            {{ t('tools.workbench.history.quota', { used: usedCount, max: MAX_SNAPSHOTS, size: kbText(totalBytes) }) }}
          </span>
          <c-button
            v-if="usedCount > 0"
            size="small"
            variant="text"
            data-test-id="history-clear"
            @click="showClearConfirm = true"
          >
            {{ t('tools.workbench.history.clear') }}
          </c-button>
        </div>

        <div v-if="usedCount === 0" class="history-empty py-8 text-center opacity-60" data-test-id="history-empty">
          {{ t('tools.workbench.history.empty') }}
        </div>

        <ul v-else class="history-list" flex flex-col gap-2>
          <li
            v-for="snapshot in store.snapshots"
            :key="snapshot.id"
            class="history-item border rounded-md p-3"
            data-test-id="history-item"
          >
            <div class="history-item__meta" flex flex-wrap items-center gap-2 text-sm>
              <span class="opacity-70">{{ relativeTime(snapshot.createdAt) }}</span>
              <n-tag v-if="snapshot.format" size="small" :bordered="false">
                {{ formatLabel(snapshot.format) }}
              </n-tag>
              <span class="opacity-70">{{ kbText(snapshot.size) }} KB</span>
            </div>

            <p class="history-item__preview mt-1 truncate text-xs opacity-70" :title="snapshot.preview">
              {{ snapshot.preview }}
            </p>

            <div class="history-item__actions mt-2" flex flex-wrap items-center gap-2>
              <c-tooltip v-if="snapshot.truncated" :tooltip="t('tools.workbench.history.truncated')">
                <span inline-flex gap-2>
                  <c-button size="small" disabled data-test-id="history-restore">
                    {{ t('tools.workbench.history.restore') }}
                  </c-button>
                  <c-button size="small" disabled data-test-id="history-compare">
                    {{ t('tools.workbench.history.compare') }}
                  </c-button>
                </span>
              </c-tooltip>
              <template v-else>
                <c-button size="small" data-test-id="history-restore" @click="restore(snapshot)">
                  <span flex items-center gap-1>
                    <n-icon size="14" :component="IconRefresh" />
                    {{ t('tools.workbench.history.restore') }}
                  </span>
                </c-button>
                <c-button size="small" data-test-id="history-compare" @click="compare(snapshot)">
                  <span flex items-center gap-1>
                    <n-icon size="14" :component="IconGitCompare" />
                    {{ t('tools.workbench.history.compare') }}
                  </span>
                </c-button>
              </template>

              <div flex-1 />

              <c-button
                size="small"
                variant="text"
                data-test-id="history-delete"
                @click="remove(snapshot)"
              >
                <n-icon size="14" :component="IconTrash" />
              </c-button>
            </div>
          </li>
        </ul>
      </div>
    </n-drawer-content>
  </n-drawer>

  <SnapshotDiffModal v-model:open="diffOpen" :snapshot="comparing" />

  <CModalConfirm
    v-model:open="showClearConfirm"
    :title="t('tools.workbench.history.clearConfirmTitle')"
    :content="t('tools.workbench.history.clearConfirmContent', { count: usedCount })"
    :confirm-text="t('tools.workbench.history.confirm')"
    :cancel-text="t('tools.workbench.history.cancel')"
    type="error"
    data-test-id="history-clear-confirm"
    @confirm="clearAll"
  />
</template>

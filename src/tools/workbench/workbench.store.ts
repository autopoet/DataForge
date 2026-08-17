import { useStorage } from '@vueuse/core';
import _ from 'lodash';
import { defineStore } from 'pinia';
import { parseToData } from './services/convert.service';
import type { ParseResult } from './services/convert.service';
import { needsDecoding } from './services/deep-decode.service';
import { detectFormat } from './services/format-detect.service';
import type { DataFormat, FormatDetection } from './services/format-detect.service';

// M3: single source of truth for the workbench. State survives reloads through
// two dedicated storage keys — the workspace (rawInput / formatOverride /
// activeViewId) and the history snapshots, which get their own quota guard
// (design doc A8) so huge inputs cannot evict every other localStorage key.

export type WorkbenchFormat = DataFormat | 'auto';

export interface WorkbenchSnapshot {
  id: string
  createdAt: number
  format: DataFormat | null
  size: number
  preview: string
  raw: string
  truncated: boolean
}

interface WorkbenchPersistedState {
  rawInput: string
  formatOverride: WorkbenchFormat
  activeViewId: string | null
}

export const WORKBENCH_STORAGE_KEY = 'dataforge:workbench';
export const SNAPSHOTS_STORAGE_KEY = 'dataforge:workbench:snapshots';

const MAX_SNAPSHOTS = 50;
const MAX_SNAPSHOT_RAW_LENGTH = 512 * 1024; // snapshots beyond this keep metadata only
const SNAPSHOT_DEBOUNCE_MS = 2000;
const SNAPSHOT_PREVIEW_LENGTH = 120;
const DEFAULT_STATE: WorkbenchPersistedState = {
  rawInput: '',
  formatOverride: 'auto',
  activeViewId: null,
};

export const useWorkbenchStore = defineStore('workbench', () => {
  const persisted = useStorage<WorkbenchPersistedState>(WORKBENCH_STORAGE_KEY, DEFAULT_STATE);

  // A corrupted or hand-edited entry must never boot the store into a broken
  // shape — reset to defaults (useStorage picks the write back up).
  if (!isPersistedState(persisted.value)) {
    persisted.value = { ...DEFAULT_STATE };
  }

  const rawInput = computed({
    get: () => persisted.value.rawInput,
    set: (value: string) => {
      persisted.value = { ...persisted.value, rawInput: value };
    },
  });

  const formatOverride = computed({
    get: () => persisted.value.formatOverride,
    set: (value: WorkbenchFormat) => {
      persisted.value = { ...persisted.value, formatOverride: value };
    },
  });

  const activeViewId = computed({
    get: () => persisted.value.activeViewId,
    set: (value: string | null) => {
      persisted.value = { ...persisted.value, activeViewId: value };
    },
  });

  const snapshots = ref<WorkbenchSnapshot[]>(loadSnapshots());

  const detection = computed<FormatDetection>(() => {
    if (formatOverride.value !== 'auto') {
      return {
        format: formatOverride.value,
        confidence: 'high',
        reason: 'format manually selected by the user',
      };
    }
    return detectFormat(rawInput.value);
  });

  const parsedData = computed<ParseResult>(() => parseToData(rawInput.value, detection.value.format));

  const decodeHint = computed<boolean>(() => needsDecoding(rawInput.value));

  function setInput(raw: string): void {
    rawInput.value = raw;
  }

  function clearAll(): void {
    persisted.value = { ...DEFAULT_STATE };
  }

  function applyDecodedValue(value: unknown): void {
    if (value === undefined) {
      return;
    }
    rawInput.value = JSON.stringify(value, null, 2);
  }

  function setFormatOverride(format: WorkbenchFormat): void {
    formatOverride.value = format;
  }

  const pushSnapshot = _.debounce(() => {
    const raw = rawInput.value;
    if (raw.trim() === '') {
      return; // an empty workspace is not a meaningful history entry
    }

    const newest = snapshots.value[0];
    if (newest && !newest.truncated && newest.raw === raw) {
      return; // identical consecutive input — no duplicate history entries
    }

    snapshots.value = [createSnapshot(raw, detection.value.format), ...snapshots.value]
      .slice(0, MAX_SNAPSHOTS);
    syncSnapshotsToStorage();
  }, SNAPSHOT_DEBOUNCE_MS);

  function restoreSnapshot(id: string): void {
    const snapshot = snapshots.value.find(item => item.id === id);
    if (!snapshot || snapshot.truncated) {
      return; // truncated entries never stored their raw content
    }
    rawInput.value = snapshot.raw;
  }

  function removeSnapshot(id: string): void {
    snapshots.value = snapshots.value.filter(item => item.id !== id);
    syncSnapshotsToStorage();
  }

  function clearSnapshots(): void {
    snapshots.value = [];
    syncSnapshotsToStorage();
  }

  function createSnapshot(raw: string, format: DataFormat | null): WorkbenchSnapshot {
    const truncated = raw.length > MAX_SNAPSHOT_RAW_LENGTH;
    return {
      id: createId(),
      createdAt: Date.now(),
      format,
      size: bytesOf(raw),
      preview: previewOf(raw),
      raw: truncated ? '' : raw,
      truncated,
    };
  }

  function previewOf(raw: string): string {
    const singleLine = raw.replace(/\s+/g, ' ').trim();
    return singleLine.length > SNAPSHOT_PREVIEW_LENGTH
      ? `${singleLine.slice(0, SNAPSHOT_PREVIEW_LENGTH)}…`
      : singleLine;
  }

  function syncSnapshotsToStorage(): void {
    const attempt = tryWriteSnapshots(snapshots.value);
    if (attempt.ok) {
      return;
    }

    if (!attempt.quota) {
      return; // non-quota failures (private mode, blocked storage) keep memory only
    }

    // Quota exceeded: drop the oldest half and retry once (decision A8). The
    // in-memory list follows the pruned one so a reload shows the same history;
    // if the retry still fails, the newest entries stay in memory only.
    const pruned = snapshots.value.slice(0, Math.ceil(snapshots.value.length / 2));
    snapshots.value = pruned;
    tryWriteSnapshots(pruned);
  }

  return {
    rawInput,
    formatOverride,
    activeViewId,
    snapshots,
    detection,
    parsedData,
    decodeHint,
    setInput,
    clearAll,
    applyDecodedValue,
    setFormatOverride,
    pushSnapshot,
    restoreSnapshot,
    removeSnapshot,
    clearSnapshots,
  };
});

function loadSnapshots(): WorkbenchSnapshot[] {
  try {
    const stored = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (stored === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isSnapshotRecord).slice(0, MAX_SNAPSHOTS);
  }
  catch {
    return [];
  }
}

function isSnapshotRecord(value: unknown): value is WorkbenchSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.createdAt === 'number'
    && typeof record.size === 'number'
    && typeof record.preview === 'string'
    && typeof record.raw === 'string'
    && typeof record.truncated === 'boolean'
    && (record.format === null || isDataFormat(record.format));
}

function isPersistedState(value: unknown): value is WorkbenchPersistedState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.rawInput === 'string'
    && (record.formatOverride === 'auto' || isDataFormat(record.formatOverride))
    && (record.activeViewId === null || typeof record.activeViewId === 'string');
}

function isDataFormat(value: unknown): value is DataFormat {
  return value === 'json'
    || value === 'yaml'
    || value === 'toml'
    || value === 'xml'
    || value === 'csv'
    || value === 'text';
}

function tryWriteSnapshots(list: WorkbenchSnapshot[]): { ok: boolean; quota: boolean } {
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(list));
    return { ok: true, quota: false };
  }
  catch (error) {
    return { ok: false, quota: isQuotaExceeded(error) };
  }
}

function isQuotaExceeded(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const record = error as { name?: unknown; code?: unknown };
  return record.name === 'QuotaExceededError'
    || record.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || record.code === 22
    || record.code === 1014;
}

function bytesOf(text: string): number {
  return new TextEncoder().encode(text).length;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // jsdom and older runtimes lack randomUUID — fall back to a unique-enough id
  return `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

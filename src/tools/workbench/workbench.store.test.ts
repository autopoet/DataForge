import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { SNAPSHOTS_STORAGE_KEY, WORKBENCH_STORAGE_KEY, useWorkbenchStore } from './workbench.store';

const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');

describe('workbench store', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('detection', () => {
    it('auto-detects the format of the raw input', () => {
      const store = useWorkbenchStore();
      store.setInput('{"name":"DataForge"}');
      expect(store.detection).toMatchObject({ format: 'json', confidence: 'high' });
    });

    it('falls back to null for empty input', () => {
      const store = useWorkbenchStore();
      expect(store.detection.format).toBeNull();
    });

    it('respects a manual format override over the detection', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.setFormatOverride('csv');
      expect(store.detection).toMatchObject({ format: 'csv', confidence: 'high' });
    });
  });

  describe('parsedData', () => {
    it('parses the input with the effective format', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1,"b":[true,null]}');
      expect(store.parsedData).toMatchObject({ ok: true, data: { a: 1, b: [true, null] } });
    });

    it('reports a readable, positioned error for broken input', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a": 1,,}');
      expect(store.parsedData.ok).toBe(false);
      expect(store.parsedData.error).toContain('line 1, column');
    });
  });

  describe('decodeHint', () => {
    it('flags input that embeds JSON-encoded strings', () => {
      const store = useWorkbenchStore();
      store.setInput(JSON.stringify(JSON.stringify({ a: 1 }))); // "{\"a\":1}"
      expect(store.decodeHint).toBe(true);
    });

    it('is false for plain JSON', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      expect(store.decodeHint).toBe(false);
    });
  });

  describe('state actions', () => {
    it('writes input, format override and active view', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.setFormatOverride('json');
      store.activeViewId = 'minified';
      expect(store.rawInput).toBe('{"a":1}');
      expect(store.formatOverride).toBe('json');
      expect(store.activeViewId).toBe('minified');
    });

    it('clearAll resets the workspace', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.setFormatOverride('toml');
      store.activeViewId = 'yaml';
      store.clearAll();
      expect(store.rawInput).toBe('');
      expect(store.formatOverride).toBe('auto');
      expect(store.activeViewId).toBeNull();
    });

    it('applyDecodedValue writes the decoded value back as pretty JSON', () => {
      const store = useWorkbenchStore();
      store.applyDecodedValue({ a: 1 });
      expect(store.rawInput).toBe('{\n  "a": 1\n}');
    });

    it('applyDecodedValue ignores undefined values', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.applyDecodedValue(undefined);
      expect(store.rawInput).toBe('{"a":1}');
    });
  });

  describe('snapshots', () => {
    it('creates a snapshot 2s after pushSnapshot (debounced)', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.pushSnapshot();
      expect(store.snapshots).toHaveLength(0);
      vi.advanceTimersByTime(1999);
      expect(store.snapshots).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(store.snapshots).toHaveLength(1);
    });

    it('captures format, byte size, single-line preview and a unique id', () => {
      const store = useWorkbenchStore();
      store.setInput('{\n  "name": "DataForge"\n}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);

      const [snapshot] = store.snapshots;
      expect(snapshot.format).toBe('json');
      expect(snapshot.size).toBe(25);
      expect(snapshot.raw).toBe('{\n  "name": "DataForge"\n}');
      expect(snapshot.preview).toBe('{ "name": "DataForge" }');
      expect(snapshot.truncated).toBe(false);
      expect(snapshot.createdAt).toBeGreaterThan(0);
      expect(snapshot.id).toBeTruthy();
    });

    it('skips duplicate consecutive inputs', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);
      expect(store.snapshots).toHaveLength(1);
    });

    it('snapshots again once the input changes, newest first', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);
      store.setInput('{"a":2}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);

      expect(store.snapshots).toHaveLength(2);
      expect(store.snapshots[0].raw).toBe('{"a":2}');
      expect(store.snapshots[0].id).not.toBe(store.snapshots[1].id);
    });

    it('ignores empty input', () => {
      const store = useWorkbenchStore();
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);
      expect(store.snapshots).toHaveLength(0);
    });

    it('evicts the oldest snapshots beyond the 50-item ring', () => {
      const store = useWorkbenchStore();
      for (let i = 0; i < 52; i += 1) {
        store.setInput(`{"n":${i}}`);
        store.pushSnapshot();
        vi.advanceTimersByTime(2000);
      }

      expect(store.snapshots).toHaveLength(50);
      expect(store.snapshots[0].raw).toBe('{"n":51}'); // newest kept
      expect(store.snapshots[49].raw).toBe('{"n":2}'); // oldest kept
      expect(store.snapshots.some(snapshot => snapshot.raw === '{"n":0}' || snapshot.raw === '{"n":1}')).toBe(false);
    });

    it('truncates snapshots larger than 512KB to metadata only', () => {
      const store = useWorkbenchStore();
      const huge = `${'x'.repeat(512 * 1024)}y`;
      store.setInput(huge);
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);

      const [snapshot] = store.snapshots;
      expect(snapshot.truncated).toBe(true);
      expect(snapshot.raw).toBe('');
      expect(snapshot.size).toBe(512 * 1024 + 1);
      expect(snapshot.preview.length).toBeLessThanOrEqual(121); // 120 chars + ellipsis
    });

    it('restores an older snapshot into the input', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);
      store.setInput('{"a":2}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);

      store.restoreSnapshot(store.snapshots[1].id);
      expect(store.rawInput).toBe('{"a":1}');
    });

    it('cannot restore a truncated snapshot (no raw content was kept)', () => {
      const store = useWorkbenchStore();
      store.setInput('x'.repeat(512 * 1024 + 1));
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);
      store.setInput('{"a":2}');

      store.restoreSnapshot(store.snapshots[0].id);
      expect(store.rawInput).toBe('{"a":2}');
    });

    it('removes a single snapshot and clears the whole history', () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);
      store.setInput('{"b":2}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);

      store.removeSnapshot(store.snapshots[1].id);
      expect(store.snapshots).toHaveLength(1);
      expect(store.snapshots[0].raw).toBe('{"b":2}');

      store.clearSnapshots();
      expect(store.snapshots).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('keeps input, override, active view and history after a page refresh', async () => {
      const store = useWorkbenchStore();
      store.setInput('{"a":1}');
      store.setFormatOverride('toml');
      store.activeViewId = 'toml';
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);
      await nextTick(); // flush useStorage writes

      setActivePinia(createPinia()); // simulated page reload
      const fresh = useWorkbenchStore();
      expect(fresh.rawInput).toBe('{"a":1}');
      expect(fresh.formatOverride).toBe('toml');
      expect(fresh.activeViewId).toBe('toml');
      expect(fresh.snapshots).toHaveLength(1);
      expect(fresh.snapshots[0].raw).toBe('{"a":1}');
    });

    it('drops corrupted persisted snapshots instead of crashing', () => {
      localStorage.setItem(SNAPSHOTS_STORAGE_KEY, 'not-json{');
      const store = useWorkbenchStore();
      expect(store.snapshots).toHaveLength(0);
    });

    it('resets the workspace when the persisted state is malformed', () => {
      localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify({ rawInput: 42, formatOverride: 'nope' }));
      const store = useWorkbenchStore();
      expect(store.rawInput).toBe('');
      expect(store.formatOverride).toBe('auto');
    });

    it('prunes the oldest half and retries once when the quota is exceeded', () => {
      const store = useWorkbenchStore();
      for (let i = 0; i < 6; i += 1) {
        store.setInput(`{"n":${i}}`);
        store.pushSnapshot();
        vi.advanceTimersByTime(2000);
      }
      expect(store.snapshots).toHaveLength(6);

      const originalSetItem = Storage.prototype.setItem;
      let snapshotsWrites = 0;
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        if (key === SNAPSHOTS_STORAGE_KEY) {
          snapshotsWrites += 1;
          if (snapshotsWrites === 1) {
            throw quotaError; // full list does not fit anymore
          }
        }
        return originalSetItem.call(window.localStorage, key, value);
      });

      store.setInput('{"n":6}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);

      // Oldest half dropped, retry succeeded: memory matches what was written.
      expect(store.snapshots).toHaveLength(4);
      expect(store.snapshots[0].raw).toBe('{"n":6}');
      expect(store.snapshots[3].raw).toBe('{"n":3}');
      const persisted = JSON.parse(localStorage.getItem(SNAPSHOTS_STORAGE_KEY) ?? '[]') as { raw: string }[];
      expect(persisted.map(item => item.raw)).toEqual(['{"n":6}', '{"n":5}', '{"n":4}', '{"n":3}']);

      setItemSpy.mockRestore();
    });

    it('keeps the newest entries in memory when even the retry exceeds the quota', () => {
      const store = useWorkbenchStore();
      for (let i = 0; i < 6; i += 1) {
        store.setInput(`{"n":${i}}`);
        store.pushSnapshot();
        vi.advanceTimersByTime(2000);
      }
      expect(store.snapshots).toHaveLength(6);

      const originalSetItem = Storage.prototype.setItem;
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        if (key === SNAPSHOTS_STORAGE_KEY) {
          throw quotaError; // nothing fits in storage anymore
        }
        return originalSetItem.call(window.localStorage, key, value);
      });

      store.setInput('{"n":6}');
      store.pushSnapshot();
      vi.advanceTimersByTime(2000);

      expect(store.snapshots).toHaveLength(4); // pruned half survives in memory
      expect(store.snapshots[0].raw).toBe('{"n":6}');
      expect(store.snapshots[3].raw).toBe('{"n":3}');

      setItemSpy.mockRestore();
    });
  });
});

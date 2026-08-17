import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useDownloadTextFile } from './downloadTextFile';

// jsdom has no Blob URL factory, so the test stubs it and captures the anchor
// the composable creates to assert the filename contract (design doc M7 §3).

describe('downloadTextFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads the current source value under the given filename + extension', () => {
    const url = 'blob:mock-url';
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => url),
      revokeObjectURL: vi.fn(),
    });
    const originalCreateElement = document.createElement.bind(document);
    const createdAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        createdAnchors.push(element as HTMLAnchorElement);
      }
      return element;
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const source = ref('{"a":1}');
    const { download } = useDownloadTextFile({ source, filename: 'dataforge-json-20260816-120000', extension: 'json' });
    download();

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(createdAnchors[0].href).toBe(url);
    expect(createdAnchors[0].download).toBe('dataforge-json-20260816-120000.json');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it('appends no extension when none is provided', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    const originalCreateElement = document.createElement.bind(document);
    const createdAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        createdAnchors.push(element as HTMLAnchorElement);
      }
      return element;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const source = ref('hello');
    const { download } = useDownloadTextFile({ source, filename: 'dataforge-notes' });
    download();

    expect(createdAnchors[0].download).toBe('dataforge-notes');
  });

  it('does nothing for an empty source', () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const source = ref('   ');
    const { download } = useDownloadTextFile({ source, filename: 'dataforge-empty', extension: 'json' });
    download();

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('resolves lazy filename/extension getters at download time', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    const originalCreateElement = document.createElement.bind(document);
    const createdAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        createdAnchors.push(element as HTMLAnchorElement);
      }
      return element;
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const source = ref('a: 1');
    let viewId = 'formatted';
    const { download } = useDownloadTextFile({
      source,
      filename: () => `dataforge-${viewId}-20260816-120000`,
      extension: () => (viewId === 'formatted' ? 'yaml' : 'ts'),
    });
    download();
    expect(createdAnchors[0].download).toBe('dataforge-formatted-20260816-120000.yaml');

    // simulate a view switch on the same toolbar instance
    viewId = 'typescript';
    download();
    expect(createdAnchors[1].download).toBe('dataforge-typescript-20260816-120000.ts');
  });
});

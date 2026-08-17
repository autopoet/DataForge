import type { Ref } from 'vue';

// Plain-text download via Blob + object URL (design doc M7 §3). The existing
// downloadBase64 composable builds base64 data URIs, which is not a fit for the
// workbench's text outputs (json/yaml/toml/xml/csv/ts) — this one writes the
// raw string into a Blob and lets the browser save it with the view's filename.

const MIME_BY_EXTENSION: Record<string, string> = {
  json: 'application/json',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  toml: 'text/toml',
  xml: 'application/xml',
  csv: 'text/csv',
  ts: 'text/typescript',
};

export function useDownloadTextFile(
  { source, filename, extension }:
  {
    source: Ref<string>
    filename: string | (() => string)
    extension?: string | (() => string)
  },
) {
  return {
    download() {
      const content = source.value;
      if (content.trim() === '') {
        return; // nothing to download
      }
      const name = typeof filename === 'function' ? filename() : filename;
      const ext = typeof extension === 'function' ? extension() : extension;
      const mime = ext ? MIME_BY_EXTENSION[ext] : undefined;
      const blob = new Blob([content], { type: mime ?? 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = ext ? `${name}.${ext}` : name;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  };
}

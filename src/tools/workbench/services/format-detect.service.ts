import { parse as parseToml } from 'iarna-toml-esm';
import JSON5 from 'json5';
import convert from 'xml-js';
import { parse as parseYaml } from 'yaml';

export type DataFormat = 'json' | 'yaml' | 'toml' | 'xml' | 'csv' | 'text';

export interface FormatDetection {
  format: DataFormat | null
  confidence: 'high' | 'low'
  reason: string
  parseError?: string
}

const TOML_KEY_VALUE_RE = /^\s*[A-Za-z0-9_.-]+\s*=/m;
const TOML_TABLE_RE = /^\s*\[.+\]\s*$/m;

export { detectFormat, formatJson5Error, formatXmlError };

function detectFormat(input: string): FormatDetection {
  const trimmed = input.trim();

  if (trimmed === '') {
    return { format: null, confidence: 'low', reason: 'input is empty' };
  }

  if (trimmed.startsWith('<')) {
    return detectXml(trimmed);
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return detectFromBracketStart(trimmed);
  }

  if (TOML_KEY_VALUE_RE.test(trimmed) || TOML_TABLE_RE.test(trimmed)) {
    const toml = tryParse(() => parseToml(trimmed));
    if (toml.ok) {
      return { format: 'toml', confidence: 'high', reason: 'TOML key-value or table syntax matched and TOML.parse succeeded' };
    }
  }

  // YAML covers the widest range of structured inputs, but a bare scalar
  // (plain prose, a base64 blob...) is not data: only accept objects and arrays.
  const yamlFallback = tryParse(() => parseYaml(trimmed));
  if (yamlFallback.ok && isStructured(yamlFallback.value)) {
    return { format: 'yaml', confidence: 'low', reason: 'parsed as YAML (fallback probe)' };
  }

  return { format: 'text', confidence: 'low', reason: 'not recognized as a structured data format' };
}

function detectXml(trimmed: string): FormatDetection {
  const xml = tryParse(() => convert.xml2js(trimmed));

  if (xml.ok && hasRootElement(xml.value)) {
    return { format: 'xml', confidence: 'high', reason: 'starts with < and parsed as XML' };
  }

  return {
    format: 'xml',
    confidence: 'high',
    reason: 'starts with <',
    parseError: xml.ok ? 'no root element found' : formatXmlError(xml.error),
  };
}

function detectFromBracketStart(trimmed: string): FormatDetection {
  const json = tryParse(() => JSON5.parse(trimmed));
  if (json.ok) {
    return { format: 'json', confidence: 'high', reason: 'starts with { or [ and JSON5.parse succeeded (comments and trailing commas allowed)' };
  }

  const yamlFlow = tryParse(() => parseYaml(trimmed));
  if (yamlFlow.ok && isStructured(yamlFlow.value)) {
    return { format: 'yaml', confidence: 'low', reason: 'starts with { or [ and parsed as YAML flow style after JSON5 failed' };
  }

  // A document starting with a [table] header is TOML before it is broken JSON.
  if (TOML_TABLE_RE.test(trimmed)) {
    const toml = tryParse(() => parseToml(trimmed));
    if (toml.ok) {
      return { format: 'toml', confidence: 'high', reason: 'starts with a [table] header and TOML.parse succeeded' };
    }
  }

  return {
    format: 'json',
    confidence: 'high',
    reason: 'starts with { or [ but JSON5.parse failed',
    parseError: formatJson5Error(json.error),
  };
}

function tryParse<T>(parse: () => T): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: parse() };
  }
  catch (error) {
    return { ok: false, error };
  }
}

function isStructured(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function hasRootElement(value: unknown): boolean {
  const elements = (value as { elements?: { type?: string }[] } | null)?.elements;
  return Array.isArray(elements) && elements.some(element => element.type === 'element');
}

function formatJson5Error(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // JSON5 messages end with "at 3:5" — surface it as an explicit line/column hint
  return message
    .replace(/^JSON5:\s*/, '')
    .replace(/\bat (\d+):(\d+)/, 'at line $1, column $2');
}

function formatXmlError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const summary = message.split('\n').map(line => line.trim()).find(line => line !== '') ?? 'invalid XML';
  const line = Number(/Line:\s*(\d+)/.exec(message)?.[1] ?? -1);
  const column = Number(/Column:\s*(\d+)/.exec(message)?.[1] ?? -1);

  if (line < 0 || column < 0) {
    return summary;
  }

  // xml-js reports 0-based lines
  return `${summary} (line ${line + 1}, column ${column})`;
}

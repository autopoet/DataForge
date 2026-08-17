import JSON5 from 'json5';

export interface DecodedLayer {
  depth: number
  value: unknown
  rawLength: number
  preview: string
}

export interface DeepDecodeResult {
  layers: DecodedLayer[]
  fullyDecoded: boolean
  reason?: string
}

export interface DeepDecodeOptions {
  maxDepth?: number
}

const MAX_INPUT_LENGTH = 1024 * 1024; // 1 MB performance guard
const PREVIEW_LENGTH = 120;
const MAX_STRING_CHAIN = 64; // defensive bound for pathological string chains

export { decodeDeep, needsDecoding };

// A layer is one resolution pass:
// - on a string: unwrap JSON string-encoding chains until real data is reached
//   (a whole chain of string layers collapses into the single layer that reveals the data)
// - on an object/array: decode every embedded JSON string value by one encoding level
// '"{"a":1}"' is therefore 1 layer, and '"{"data":"{\"b\":2}"}"' is 2 layers
// (top-level encoding, then the encoded field).
function needsDecoding(input: string): boolean {
  if (input.length > MAX_INPUT_LENGTH) {
    return false;
  }

  return decodeDeep(input, { maxDepth: 1 }).layers.length > 0;
}

function decodeDeep(input: string, { maxDepth = 5 }: DeepDecodeOptions = {}): DeepDecodeResult {
  if (input.length > MAX_INPUT_LENGTH) {
    return { layers: [], fullyDecoded: false, reason: 'input exceeds the 1MB decoding limit' };
  }

  const trimmed = input.trim();
  if (trimmed === '') {
    return { layers: [], fullyDecoded: false, reason: 'input is empty' };
  }

  const layers: DecodedLayer[] = [];
  let current: unknown;

  if (isQuotedLiteral(trimmed)) {
    const data = peelStringToData(input);
    if (data === null) {
      return { layers: [], fullyDecoded: false, reason: 'string content is not JSON-encoded data' };
    }
    layers.push(toLayer(1, data, input.length));
    current = data;
  }
  else {
    // Plain JSON whose fields may embed JSON-encoded strings (requirement F04 scenario A)
    const parsed = tryParseJson(input);
    if (!parsed.ok || !isStructured(parsed.value)) {
      return { layers: [], fullyDecoded: false, reason: 'input is not a JSON-encoded string' };
    }
    current = parsed.value;
  }

  let depth = layers.length;
  while (depth < maxDepth) {
    const pass = decodeEmbeddedStringsOnce(current);
    if (!pass.changed) {
      break;
    }
    depth += 1;
    layers.push(toLayer(depth, pass.value, textLengthOf(current)));
    current = pass.value;
  }

  if (layers.length === 0) {
    return { layers: [], fullyDecoded: false, reason: 'no JSON-encoded string layers found' };
  }

  if (!decodeEmbeddedStringsOnce(current).changed) {
    return { layers, fullyDecoded: true };
  }

  return { layers, fullyDecoded: false, reason: `reached max depth ${maxDepth}, more encoded layers remain` };
}

function isQuotedLiteral(trimmed: string): boolean {
  return trimmed.length >= 2 && (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  );
}

// Parses string-encoding chains ("{\"a\":1}" -> {"a":1} string -> {a: 1} data)
// and returns the first non-string value, or null when the chain never reaches data.
function peelStringToData(text: string): unknown {
  let current: unknown = text;

  for (let i = 0; i < MAX_STRING_CHAIN && typeof current === 'string'; i += 1) {
    const parsed = tryParseJson(current);
    if (!parsed.ok) {
      return null;
    }
    current = parsed.value;
  }

  return typeof current === 'string' ? null : current;
}

function decodeEmbeddedStringsOnce(value: unknown): { changed: boolean; value: unknown } {
  if (typeof value === 'string') {
    const data = peelStringToData(value);
    return data === null
      ? { changed: false, value }
      : { changed: true, value: data };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const result = decodeEmbeddedStringsOnce(item);
      changed = changed || result.changed;
      return result.value;
    });
    return { changed, value: items };
  }

  if (typeof value === 'object' && value !== null) {
    let changed = false;
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const result = decodeEmbeddedStringsOnce(item);
      changed = changed || result.changed;
      return [key, result.value] as const;
    });
    return { changed, value: Object.fromEntries(entries) };
  }

  return { changed: false, value };
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON5.parse(text) };
  }
  catch {
    return { ok: false };
  }
}

function isStructured(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function toLayer(depth: number, value: unknown, rawLength: number): DecodedLayer {
  return { depth, value, rawLength, preview: previewOf(value) };
}

function previewOf(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}

function textLengthOf(value: unknown): number {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text?.length ?? 0;
}

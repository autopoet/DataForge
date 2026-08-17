import JSON5 from 'json5';
import { parse as parseToml, stringify as stringifyToml } from 'iarna-toml-esm';
import convert from 'xml-js';
import type { Element, ElementCompact } from 'xml-js';
import xmlFormat from 'xml-formatter';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { formatJson5Error, formatXmlError } from './format-detect.service';
import type { DataFormat } from './format-detect.service';
import { parseCsv, toCsv } from './csv.service';
import { sortObjectKeys } from '@/tools/json-viewer/json.models';

// Unified conversion kernel (design doc M2): every view consumes the same
// intermediate representation — a pure JSON-compatible JS value — produced by
// parseToData and serialized by serialize. Heterogeneous shapes (TOML dates,
// XML attributes) are normalized once, at the parse layer.

export type SerializeTarget = 'json' | 'yaml' | 'toml' | 'xml' | 'csv';

export interface ParseResult {
  ok: boolean
  data?: unknown
  error?: string
}

export interface SerializeOptions {
  indentSize?: number
  sortKeys?: boolean
  csvFlatten?: boolean
  csvSeparator?: string
}

const DEFAULT_INDENT = 2;
const MAX_NORMALIZE_DEPTH = 64; // defensive bound; real formats cannot nest this deep

export { parseToData, serialize };

// --- parsing -----------------------------------------------------------------

function parseToData(raw: string, format: DataFormat | null): ParseResult {
  if (raw.trim() === '') {
    return { ok: false, error: 'input is empty' };
  }

  switch (format) {
    case 'json':
      return parseJson(raw);
    case 'yaml':
      return parseYamlDocument(raw);
    case 'toml':
      return parseTomlDocument(raw);
    case 'xml':
      return parseXmlDocument(raw);
    case 'csv':
      return { ok: true, data: parseCsv(raw) };
    case 'text':
      return { ok: false, error: 'plain text has no structured data to convert' };
    default:
      return { ok: false, error: 'no format detected' };
  }
}

function parseJson(raw: string): ParseResult {
  try {
    return { ok: true, data: normalizeIr(JSON5.parse(raw)) };
  }
  catch (error) {
    return { ok: false, error: formatJson5Error(error) };
  }
}

function parseYamlDocument(raw: string): ParseResult {
  try {
    const data = parseYaml(raw);
    if (isJsonIncompatible(data)) {
      return { ok: false, error: 'the YAML document has no structured value to convert (bare scalars are rejected)' };
    }
    return { ok: true, data: normalizeIr(data) };
  }
  catch (error) {
    return { ok: false, error: formatYamlError(error) };
  }
}

function parseTomlDocument(raw: string): ParseResult {
  try {
    return { ok: true, data: normalizeIr(parseToml(raw)) };
  }
  catch (error) {
    return { ok: false, error: formatTomlError(error) };
  }
}

function parseXmlDocument(raw: string): ParseResult {
  try {
    return { ok: true, data: normalizeXmlIr(convert.xml2js(raw, { compact: true })) };
  }
  catch (error) {
    return { ok: false, error: formatXmlError(error) };
  }
}

// --- serialization ------------------------------------------------------------

function serialize(data: unknown, target: SerializeTarget, options: SerializeOptions = {}): string {
  const indentSize = options.indentSize ?? DEFAULT_INDENT;

  switch (target) {
    case 'json':
      return JSON.stringify(options.sortKeys ? sortObjectKeys(data) : data, null, indentSize);
    case 'yaml':
      return stringifyYaml(data, { indent: indentSize });
    case 'toml':
      return serializeToml(data);
    case 'xml':
      return serializeXml(data, indentSize);
    case 'csv':
      return toCsv(data, { flatten: options.csvFlatten ?? true, separator: options.csvSeparator ?? '.' });
  }
}

function serializeToml(data: unknown): string {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(`TOML output requires a root object, but the data is ${describeValue(data)}.`);
  }

  rejectNullValues(data);

  return stringifyToml(data);
}

// iarna-toml silently drops null/undefined keys, which would lose data — fail
// loudly instead and point the user at the lossless target (decision A2).
function rejectNullValues(data: unknown): void {
  if (data === null || data === undefined) {
    throw new Error('TOML cannot represent null/undefined values; convert to YAML instead to keep them.');
  }

  if (Array.isArray(data)) {
    data.forEach(item => rejectNullValues(item));
  }
  else if (typeof data === 'object') {
    Object.values(data as Record<string, unknown>).forEach(value => rejectNullValues(value));
  }
}

function serializeXml(data: unknown, indentSize: number): string {
  // pickXmlRoot always returns a plain object (the data itself or a wrapper),
  // which is exactly the compact shape js2xml expects.
  const compact = rebuildXmlCompact(pickXmlRoot(data)) as Element | ElementCompact;

  // collapseContent keeps text-only elements on one line; lineSeparator is
  // pinned so output is identical on Windows and CI (design doc M0/D10).
  return xmlFormat(convert.js2xml(compact, { compact: true }), {
    indentation: ' '.repeat(indentSize),
    collapseContent: true,
    lineSeparator: '\n',
  });
}

// js2xml emits one sibling element per object key, and XML needs a single
// root: single-key objects (including XML-parsed IR) serialize directly,
// anything else is wrapped (design doc: "根为标量时包 { root: value }").
// A single-key object whose value is an array is a special case: js2xml
// repeats that element once per item, which would yield multiple top-level
// nodes ("Found multiple root nodes") — wrap it like the multi-key case.
function pickXmlRoot(data: unknown): unknown {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const keys = Object.keys(data as Record<string, unknown>);
    if (keys.length === 1 && !Array.isArray((data as Record<string, unknown>)[keys[0]])) {
      return data;
    }
    return { root: data };
  }

  if (Array.isArray(data)) {
    // an `item` list keeps array output inside one root element
    return { root: { item: data } };
  }

  return { root: data };
}

// --- IR normalization ---------------------------------------------------------

// Guarantees the IR is a pure JSON-compatible value: dates become ISO strings,
// NaN/Infinity become null, BigInt becomes a string, and undefined/Symbol/
// function keys are dropped (array slots become null, matching JSON.stringify).
function normalizeIr(value: unknown, depth = 0): unknown {
  if (depth > MAX_NORMALIZE_DEPTH) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return String(value);
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }

  if (value === undefined || typeof value === 'symbol' || typeof value === 'function') {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeIr(item, depth + 1));
  }

  if (typeof value === 'object' && value !== null) {
    const normalized: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item === undefined || typeof item === 'symbol' || typeof item === 'function') {
        return;
      }
      normalized[key] = normalizeIr(item, depth + 1);
    });
    return normalized;
  }

  return value;
}

// --- XML mapping (decision A3) ------------------------------------------------

// xml-js compact mode yields { note: { _attributes: { x: '1' }, to: { _text: 'You' } } }.
// normalizeXmlIr maps that to { note: { '@x': '1', to: 'You' } }: attributes
// become @-prefixed keys and a sole _text child is lifted to a scalar.
function normalizeXmlIr(value: unknown, depth = 0): unknown {
  if (depth > MAX_NORMALIZE_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeXmlIr(item, depth + 1));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const node = value as Record<string, unknown>;

  if (isPlainTextNode(node)) {
    return node._text;
  }

  const normalized: Record<string, unknown> = {};

  Object.entries(node).forEach(([key, item]) => {
    if (key === '_declaration' || key === '_instruction' || key === '_comment') {
      return; // document prolog and comments are not data
    }
    if (key === '_attributes' && typeof item === 'object' && item !== null) {
      Object.entries(item as Record<string, unknown>).forEach(([attributeName, attributeValue]) => {
        normalized[`@${attributeName}`] = attributeValue;
      });
    }
    else if (key === '_text') {
      normalized[key] = item; // mixed content keeps its _text key
    }
    else {
      normalized[key] = normalizeXmlIr(item, depth + 1);
    }
  });

  return normalized;
}

function isPlainTextNode(node: Record<string, unknown>): boolean {
  const keys = Object.keys(node);
  return keys.length === 1 && keys[0] === '_text';
}

// Inverse of normalizeXmlIr: @-prefixed keys are attributes again, and a
// scalar root is wrapped so js2xml always has a named element to emit.
function rebuildXmlCompact(value: unknown, depth = 0): unknown {
  if (depth > MAX_NORMALIZE_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(item => rebuildXmlCompact(item, depth + 1));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const node = value as Record<string, unknown>;
  const rebuilt: Record<string, unknown> = {};
  let attributes: Record<string, unknown> | undefined;

  Object.entries(node).forEach(([key, item]) => {
    if (key.startsWith('@') && (typeof item !== 'object' || item === null)) {
      attributes = attributes ?? {};
      attributes[key.slice(1)] = item;
    }
    else {
      rebuilt[key] = rebuildXmlCompact(item, depth + 1);
    }
  });

  if (attributes) {
    rebuilt._attributes = attributes;
  }

  return rebuilt;
}

// --- error formatting ----------------------------------------------------------

function formatYamlError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const position = (error as { linePos?: { line: number; col: number }[] }).linePos?.[0];

  if (position) {
    return `${message.split('\n')[0]} (line ${position.line}, column ${position.col})`;
  }

  return message.split('\n')[0];
}

function formatTomlError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const line = Number((error as { line?: unknown }).line ?? -1);
  const col = Number((error as { col?: unknown }).col ?? -1);

  if (line >= 0 && col >= 0) {
    return `${message} (line ${line + 1}, column ${col})`;
  }

  return message;
}

function describeValue(data: unknown): string {
  if (data === null) {
    return 'null';
  }
  if (Array.isArray(data)) {
    return 'an array';
  }
  if (typeof data === 'object') {
    return 'an object';
  }
  return `a ${typeof data} value`;
}

// Bare scalars and multi-document sources cannot be converted meaningfully —
// guard before normalization so the caller gets a clear error.
function isJsonIncompatible(data: unknown): boolean {
  return typeof data !== 'object' || data === null;
}

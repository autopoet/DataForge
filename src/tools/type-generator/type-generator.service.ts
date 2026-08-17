// Self-contained JSON → TypeScript type inference engine (design doc M6).
//
// Conventions (each one is covered by a unit test):
// - IR values are plain JSON-compatible JS values; keys holding `undefined` are dropped.
// - Objects become `interface` (or `type` alias) declarations. Child types are named
//   `<parentName><PascalCase(key)>`, e.g. Root + "user name" → RootUserName. A leading
//   non-letter gets a `_` prefix; name clashes get `$1`, `$2`, … suffixes.
// - Arrays: same element type → `T[]`; strings deduplicated within `maxLiterals` →
//   `('a' | 'b')[]`; objects → one merged interface over the key union, keys missing in
//   some elements become optional; mixed elements → `(A | B)[]`; empty → `unknown[]`.
// - Top-level arrays always emit a `type Root = RootItem[];` alias (TS forbids
//   `interface extends T[]`), so a nested array field `users` yields `RootUsers[]`.
// - Empty objects are `Record<string, unknown>`; reserved words and non-identifier keys
//   are emitted as quoted string-literal keys.
// - Declaration order is depth-first pre-order: the root type first, nested types in
//   first-visit order, one blank line between declarations.

export type TypeGeneratorStyle = 'interface' | 'type';

export interface LiteralUnionOptions {
  enabled?: boolean
  maxLiterals?: number
}

export interface TypeGeneratorOptions {
  rootName?: string
  style?: TypeGeneratorStyle
  exportKeyword?: boolean
  optionalUnmatchedKeys?: boolean
  literalUnion?: LiteralUnionOptions
}

export const MAX_NESTING_DEPTH = 32;

// Guardrail for the UI: inputs larger than this get a performance warning before
// type generation runs (design doc §5.3).
export const TYPE_GENERATION_WARN_SIZE = 1024 * 1024;

interface ResolvedOptions {
  rootName: string
  style: TypeGeneratorStyle
  exportKeyword: boolean
  optionalUnmatchedKeys: boolean
  literalUnion: { enabled: boolean; maxLiterals: number }
}

interface GeneratorContext {
  options: ResolvedOptions
  usedNames: Set<string>
  depth: number
  active: Set<object>
  exportPrefix: string
}

interface MergedObject {
  value: Record<string, unknown>
  optionalKeys: Set<string>
  multiValueKeys: Set<string>
}

export { generateTypeScriptTypes };

function generateTypeScriptTypes(value: unknown, options?: TypeGeneratorOptions): string {
  const context = createContext(options);
  const out: string[] = [];

  if (Array.isArray(value)) {
    const elementDeclarations: string[] = [];
    const elementType = inferElementType(value, `${context.options.rootName}Item`, context, elementDeclarations);
    out.push(`${context.exportPrefix}type ${context.options.rootName} = ${arrayTypeOf(elementType)};`);
    out.push(...elementDeclarations);
  }
  else if (isPlainObject(value)) {
    if (Object.keys(value).length === 0) {
      out.push(`${context.exportPrefix}type ${context.options.rootName} = Record<string, unknown>;`);
    }
    else {
      emitObject(value, context.options.rootName, context, out);
    }
  }
  else {
    const refs = typeParts(value, context.options.rootName, context, out);
    out.push(`${context.exportPrefix}type ${context.options.rootName} = ${refs.join(' | ') || 'unknown'};`);
  }

  return out.join('\n\n');
}

function createContext(options?: TypeGeneratorOptions): GeneratorContext {
  const rootName = options?.rootName?.trim() || 'Root';
  return {
    options: {
      rootName,
      style: options?.style ?? 'interface',
      exportKeyword: options?.exportKeyword ?? true,
      optionalUnmatchedKeys: options?.optionalUnmatchedKeys ?? true,
      literalUnion: {
        enabled: options?.literalUnion?.enabled ?? true,
        maxLiterals: options?.literalUnion?.maxLiterals ?? 8,
      },
    },
    usedNames: new Set(),
    depth: 0,
    active: new Set(),
    exportPrefix: options?.exportKeyword ?? true ? 'export ' : '',
  };
}

// Returns the union parts describing `value`; object/array values push their nested
// type declarations into `out` as a side effect.
function typeParts(value: unknown, hint: string, context: GeneratorContext, out: string[]): string[] {
  if (value === null) {
    return ['null'];
  }
  if (value === undefined) {
    return [];
  }
  if (typeof value === 'string') {
    return ['string'];
  }
  if (typeof value === 'number') {
    return ['number'];
  }
  if (typeof value === 'boolean') {
    return ['boolean'];
  }
  if (typeof value !== 'object') {
    // functions, symbols, bigint… never reach a JSON-based IR, defensive only
    return ['unknown'];
  }

  if (Array.isArray(value)) {
    if (context.depth >= MAX_NESTING_DEPTH || context.active.has(value)) {
      return ['unknown'];
    }
    context.active.add(value);
    context.depth += 1;
    const elementType = inferElementType(value, hint, context, out);
    context.depth -= 1;
    context.active.delete(value);
    return [arrayTypeOf(elementType)];
  }

  if (Object.keys(value).length === 0) {
    return ['Record<string, unknown>'];
  }

  // narrowed to a non-array object here; cast for the Record<string, unknown>
  // signature below
  return [emitObject(value as Record<string, unknown>, hint, context, out)];
}

// Emits one named type declaration. Children declarations are collected in a private
// buffer so the parent lands first (root-first pre-order), then appended.
function emitObject(
  value: Record<string, unknown>,
  hint: string,
  context: GeneratorContext,
  out: string[],
  optionalKeys: Set<string> = new Set(),
  multiValueKeys: Set<string> = new Set(),
): string {
  if (context.depth >= MAX_NESTING_DEPTH || context.active.has(value)) {
    return 'unknown';
  }
  context.active.add(value);
  context.depth += 1;

  const name = claimName(context, hint);
  const childDeclarations: string[] = [];
  const lines: string[] = [];

  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue === undefined) {
      continue;
    }
    const childHint = `${name}${pascalCase(key)}`;
    const refs = multiValueKeys.has(key)
      ? [unionRefs(fieldValue as unknown[], childHint, context, childDeclarations)]
      : typeParts(fieldValue, childHint, context, childDeclarations);
    const optional = context.options.optionalUnmatchedKeys && optionalKeys.has(key) ? '?' : '';
    lines.push(`  ${formatKey(key)}${optional}: ${refs.join(' | ') || 'unknown'};`);
  }

  context.depth -= 1;
  context.active.delete(value);

  const declaration = context.options.style === 'type'
    ? `${context.exportPrefix}type ${name} = {\n${lines.join('\n')}\n};`
    : `${context.exportPrefix}interface ${name} {\n${lines.join('\n')}\n}`;
  out.push(declaration);
  out.push(...childDeclarations);

  return name;
}

// Element type of an array, without the trailing `[]`.
function inferElementType(items: unknown[], hint: string, context: GeneratorContext, out: string[]): string {
  if (items.length === 0) {
    return 'unknown';
  }

  if (context.options.literalUnion.enabled && items.every(item => typeof item === 'string')) {
    const uniqueLiterals = [...new Set(items as string[])];
    if (uniqueLiterals.length <= context.options.literalUnion.maxLiterals) {
      return `(${uniqueLiterals.map(quoteStringLiteral).join(' | ')})`;
    }
  }

  if (items.every(isPlainObject)) {
    return emitMergedObjects(items as Record<string, unknown>[], hint, context, out);
  }

  const objectValues: Record<string, unknown>[] = [];
  const nonObjectRefs: string[] = [];
  for (const item of items) {
    if (isPlainObject(item)) {
      objectValues.push(item);
    }
    else {
      for (const ref of typeParts(item, hint, context, out)) {
        if (!nonObjectRefs.includes(ref)) {
          nonObjectRefs.push(ref);
        }
      }
    }
  }

  const objectRef = objectValues.length > 0 ? emitMergedObjects(objectValues, hint, context, out) : null;
  const refs = objectRef === null ? nonObjectRefs : [...nonObjectRefs, objectRef];
  return refs.length === 0 ? 'unknown' : refs.join(' | ');
}

function emitMergedObjects(items: Record<string, unknown>[], hint: string, context: GeneratorContext, out: string[]): string {
  const merged = mergeObjectArray(items);
  if (Object.keys(merged.value).length === 0) {
    return 'Record<string, unknown>';
  }
  return emitObject(merged.value, hint, context, out, merged.optionalKeys, merged.multiValueKeys);
}

// Unions the types of several values that share one key across array elements
// (e.g. `[{a: 1}, {a: 'x'}]` → `number | string`).
function unionRefs(values: unknown[], hint: string, context: GeneratorContext, out: string[]): string {
  const objectValues: Record<string, unknown>[] = [];
  const scalarRefs: string[] = [];

  for (const value of values) {
    if (isPlainObject(value)) {
      objectValues.push(value);
    }
    else {
      for (const ref of typeParts(value, hint, context, out)) {
        if (!scalarRefs.includes(ref)) {
          scalarRefs.push(ref);
        }
      }
    }
  }

  const objectRef = objectValues.length > 0 ? emitMergedObjects(objectValues, hint, context, out) : null;
  const refs = objectRef === null ? scalarRefs : [...scalarRefs, objectRef];
  return refs.length === 0 ? 'unknown' : refs.join(' | ');
}

// Collects the key union of an array of objects. Keys present in every element stay
// required; the rest are flagged optional. A key holding different values across
// elements becomes a multi-value entry that is resolved as a type union.
function mergeObjectArray(items: Record<string, unknown>[]): MergedObject {
  const keyOrder: string[] = [];
  const valuesByKey = new Map<string, unknown[]>();

  for (const item of items) {
    for (const [key, fieldValue] of Object.entries(item)) {
      if (fieldValue === undefined) {
        continue;
      }
      const values = valuesByKey.get(key);
      if (values) {
        values.push(fieldValue);
      }
      else {
        valuesByKey.set(key, [fieldValue]);
        keyOrder.push(key);
      }
    }
  }

  const value: Record<string, unknown> = {};
  const optionalKeys = new Set<string>();
  const multiValueKeys = new Set<string>();
  for (const key of keyOrder) {
    const values = valuesByKey.get(key)!;
    if (values.length < items.length) {
      optionalKeys.add(key);
    }
    if (values.length > 1) {
      multiValueKeys.add(key);
      value[key] = values;
    }
    else {
      value[key] = values[0];
    }
  }

  return { value, optionalKeys, multiValueKeys };
}

// `(A | B)[]` needs parens around a union, `RootItem[]` and `('a' | 'b')[]` do not.
function arrayTypeOf(elementType: string): string {
  if (elementType.startsWith('(') && elementType.endsWith(')')) {
    return `${elementType}[]`;
  }
  return elementType.includes(' | ') ? `(${elementType})[]` : `${elementType}[]`;
}

function claimName(context: GeneratorContext, hint: string): string {
  if (!context.usedNames.has(hint)) {
    context.usedNames.add(hint);
    return hint;
  }
  let index = 1;
  while (context.usedNames.has(`${hint}$${index}`)) {
    index += 1;
  }
  const name = `${hint}$${index}`;
  context.usedNames.add(name);
  return name;
}

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Words that need quoting as object type members in strict TS contexts.
const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum',
  'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null',
  'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'implements', 'interface', 'let', 'package', 'private', 'protected', 'public', 'static', 'yield', 'await',
  'declare', 'abstract', 'readonly', 'keyof', 'infer', 'namespace', 'type', 'from', 'as', 'any', 'unknown',
  'never', 'object', 'string', 'number', 'boolean', 'symbol', 'bigint', 'undefined', 'constructor',
]);

function formatKey(key: string): string {
  return IDENTIFIER_RE.test(key) && !RESERVED_WORDS.has(key) ? key : JSON.stringify(key);
}

// `user name` → `UserName`, `my-key` → `MyKey`, `123` → `_123`, `!!!` → `_`
function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let name = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  if (name === '') {
    name = '_';
  }
  if (!/^[A-Za-z]/.test(name)) {
    name = `_${name}`;
  }
  return name;
}

function quoteStringLiteral(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}'`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

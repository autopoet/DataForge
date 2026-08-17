import { describe, expect, it } from 'vitest';
import { MAX_NESTING_DEPTH, generateTypeScriptTypes } from './type-generator.service';

describe('type-generator service', () => {
  describe('primitive fields and basic objects', () => {
    it('maps the four basic types of an object to their TS counterparts', () => {
      const output = generateTypeScriptTypes({ name: 'DataForge', version: 1.2, active: true, legacy: null });

      expect(output).toBe([
        'export interface Root {',
        '  name: string;',
        '  version: number;',
        '  active: boolean;',
        '  legacy: null;',
        '}',
      ].join('\n'));
    });

    it('emits a quoted key for identifiers that are not valid TS identifiers', () => {
      const output = generateTypeScriptTypes({ 'my-key': 'x', '123': true, 'a.b': 1 });

      expect(output).toContain('  "my-key": string;');
      expect(output).toContain('  "123": boolean;');
      expect(output).toContain('  "a.b": number;');
    });

    it('quotes reserved words used as keys', () => {
      const output = generateTypeScriptTypes({ interface: 1, delete: 'x' });

      expect(output).toContain('  "interface": number;');
      expect(output).toContain('  "delete": string;');
    });

    it('drops undefined-valued keys (IR normalization)', () => {
      const output = generateTypeScriptTypes({ kept: 1, dropped: undefined });

      expect(output).toBe('export interface Root {\n  kept: number;\n}');
    });

    it('emits an empty object as Record<string, unknown>', () => {
      expect(generateTypeScriptTypes({})).toBe('export type Root = Record<string, unknown>;');
    });
  });

  describe('nested object naming', () => {
    it('builds the nested naming chain from parent type and key', () => {
      const output = generateTypeScriptTypes({ user: { address: { city: 'Paris' } } });

      expect(output).toBe([
        'export interface Root {',
        '  user: RootUser;',
        '}',
        '',
        'export interface RootUser {',
        '  address: RootUserAddress;',
        '}',
        '',
        'export interface RootUserAddress {',
        '  city: string;',
        '}',
      ].join('\n'));
    });

    it('PascalCases keys with separators and underscores numeric leading chars', () => {
      const output = generateTypeScriptTypes({ 'user name': { ok: true }, '123data': { ok: true } });

      expect(output).toContain('  "user name": RootUserName;');
      expect(output).toContain('  "123data": Root_123data;');
      expect(output).toContain('export interface RootUserName {');
      expect(output).toContain('export interface Root_123data {');
    });

    it('disambiguates name clashes with $1, $2 suffixes', () => {
      const output = generateTypeScriptTypes({ 'user-name': { a: 1 }, 'userName': { b: 2 } });

      expect(output).toBe([
        'export interface Root {',
        '  "user-name": RootUserName;',
        '  userName: RootUserName$1;',
        '}',
        '',
        'export interface RootUserName {',
        '  a: number;',
        '}',
        '',
        'export interface RootUserName$1 {',
        '  b: number;',
        '}',
      ].join('\n'));
    });
  });

  describe('arrays', () => {
    it('emits T[] when every element shares one type', () => {
      expect(generateTypeScriptTypes({ ids: [1, 2, 3] })).toBe('export interface Root {\n  ids: number[];\n}');
      expect(generateTypeScriptTypes({ flags: [true, false] })).toBe('export interface Root {\n  flags: boolean[];\n}');
    });

    it('emits unknown[] for an empty array', () => {
      expect(generateTypeScriptTypes({ items: [] })).toBe('export interface Root {\n  items: unknown[];\n}');
      expect(generateTypeScriptTypes([])).toBe('export type Root = unknown[];');
    });

    it('emits a string literal union for deduplicated enum-like strings', () => {
      const output = generateTypeScriptTypes({ role: ['admin', 'viewer', 'admin'] });

      expect(output).toBe('export interface Root {\n  role: (\'admin\' | \'viewer\')[];\n}');
    });

    it('falls back to string[] when unique literals exceed maxLiterals', () => {
      const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
      expect(generateTypeScriptTypes({ tags: many })).toBe('export interface Root {\n  tags: string[];\n}');
    });

    it('respects literalUnion.enabled = false', () => {
      const output = generateTypeScriptTypes({ role: ['admin', 'viewer'] }, { literalUnion: { enabled: false, maxLiterals: 8 } });

      expect(output).toBe('export interface Root {\n  role: string[];\n}');
    });

    it('escapes quotes and newlines inside literal union members', () => {
      const output = generateTypeScriptTypes({ note: ['it\'s', 'line\nbreak'] });

      expect(output).toContain('note: (\'it\\\'s\' | \'line\\nbreak\')[];');
    });

    it('merges object elements into one interface with optional unmatched keys', () => {
      const output = generateTypeScriptTypes([{ a: 1 }, { a: 2, b: 'x' }]);

      expect(output).toBe([
        'export type Root = RootItem[];',
        '',
        'export interface RootItem {',
        '  a: number;',
        '  b?: string;',
        '}',
      ].join('\n'));
    });

    it('merges different types of one shared key into a union', () => {
      const output = generateTypeScriptTypes([{ a: 1 }, { a: 'x' }]);

      expect(output).toContain('  a: number | string;');
    });

    it('marks every key optional when no key is shared by all elements', () => {
      const output = generateTypeScriptTypes([{ a: 1 }, { b: 2 }]);

      expect(output).toBe([
        'export type Root = RootItem[];',
        '',
        'export interface RootItem {',
        '  a?: number;',
        '  b?: number;',
        '}',
      ].join('\n'));
    });

    it('drops the ? marker when optionalUnmatchedKeys is false', () => {
      const output = generateTypeScriptTypes([{ a: 1 }, { b: 2 }], { optionalUnmatchedKeys: false });

      expect(output).toContain('  a: number;');
      expect(output).toContain('  b: number;');
      expect(output).not.toContain('?');
    });

    it('merges nested objects that appear under the same key', () => {
      const output = generateTypeScriptTypes([{ meta: { x: 1 } }, { meta: { y: 2 } }]);

      expect(output).toContain('  meta: RootItemMeta;');
      expect(output).toContain('export interface RootItemMeta {');
      expect(output).toContain('  x?: number;');
      expect(output).toContain('  y?: number;');
    });

    it('emits a union type for mixed element types', () => {
      expect(generateTypeScriptTypes([1, 'x'])).toBe('export type Root = (number | string)[];');
    });

    it('emits nested arrays as T[][]', () => {
      expect(generateTypeScriptTypes([[1, 2], [3]])).toBe('export type Root = number[][];');
    });

    it('emits an array of objects as a named element interface', () => {
      const output = generateTypeScriptTypes({ users: [{ name: 'Ada' }] });

      expect(output).toBe([
        'export interface Root {',
        '  users: RootUsers[];',
        '}',
        '',
        'export interface RootUsers {',
        '  name: string;',
        '}',
      ].join('\n'));
    });
  });

  describe('top-level scalars', () => {
    it('emits the primitive type for each scalar root', () => {
      expect(generateTypeScriptTypes(42)).toBe('export type Root = number;');
      expect(generateTypeScriptTypes('hello')).toBe('export type Root = string;');
      expect(generateTypeScriptTypes(true)).toBe('export type Root = boolean;');
      expect(generateTypeScriptTypes(null)).toBe('export type Root = null;');
    });
  });

  describe('options', () => {
    it('uses a custom rootName', () => {
      const output = generateTypeScriptTypes({ a: 1 }, { rootName: 'Config' });

      expect(output).toBe('export interface Config {\n  a: number;\n}');
    });

    it('falls back to Root for a blank rootName', () => {
      expect(generateTypeScriptTypes({ a: 1 }, { rootName: '   ' })).toBe('export interface Root {\n  a: number;\n}');
    });

    it('emits type aliases when style = type', () => {
      const output = generateTypeScriptTypes({ a: 1 }, { style: 'type' });

      expect(output).toBe('export type Root = {\n  a: number;\n};');
    });

    it('applies style = type to nested types too', () => {
      const output = generateTypeScriptTypes({ user: { name: 'Ada' } }, { style: 'type' });

      expect(output).toBe([
        'export type Root = {',
        '  user: RootUser;',
        '};',
        '',
        'export type RootUser = {',
        '  name: string;',
        '};',
      ].join('\n'));
    });

    it('omits the export keyword when exportKeyword is false', () => {
      const output = generateTypeScriptTypes({ a: 1, user: { name: 'Ada' } }, { exportKeyword: false });

      expect(output).not.toContain('export ');
      expect(output).toContain('interface Root {');
      expect(output).toContain('interface RootUser {');
    });

    it('respects a custom literal union maxLiterals', () => {
      const output = generateTypeScriptTypes({ role: ['a', 'b', 'c'] }, { literalUnion: { maxLiterals: 2 } });

      expect(output).toBe('export interface Root {\n  role: string[];\n}');
    });
  });

  describe('guardrails', () => {
    it('caps recursion depth and falls back to unknown', () => {
      let nested: unknown = 1;
      for (let i = 0; i < 40; i += 1) {
        nested = { a: nested };
      }
      const output = generateTypeScriptTypes(nested);

      const interfaceCount = (output.match(/interface /g) ?? []).length;
      expect(interfaceCount).toBeLessThanOrEqual(MAX_NESTING_DEPTH);
      expect(output).toContain('  a: unknown;');
    });

    it('does not loop forever on a self-referential object', () => {
      const cyclic: Record<string, unknown> = { name: 'self' };
      cyclic.self = cyclic;

      const output = generateTypeScriptTypes({ data: cyclic });
      expect(output).toContain('  data: RootData;');
      expect(output).toContain('  self: unknown;');
    });
  });
});

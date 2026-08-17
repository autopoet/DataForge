import { describe, expect, it } from 'vitest';
import { flattenObject, parseCsv, toCsv } from './csv.service';

describe('csv service', () => {
  describe('parseCsv', () => {
    it('returns an empty list for empty or header-only input', () => {
      expect(parseCsv('')).toEqual([]);
      expect(parseCsv('a,b,c')).toEqual([]);
      expect(parseCsv('a,b,c\n')).toEqual([]);
    });

    it('parses simple rows into records', () => {
      expect(parseCsv('name,role\nAlice,admin\nBob,viewer')).toEqual([
        { name: 'Alice', role: 'admin' },
        { name: 'Bob', role: 'viewer' },
      ]);
    });

    it('parses quoted fields containing commas', () => {
      expect(parseCsv('name,note\nAlice,"hello, world"')).toEqual([
        { name: 'Alice', note: 'hello, world' },
      ]);
    });

    it('unpairs escaped double quotes inside quoted fields', () => {
      expect(parseCsv('text\n"he said ""hi"""')).toEqual([{ text: 'he said "hi"' }]);
    });

    it('keeps embedded newlines inside quoted fields', () => {
      expect(parseCsv('text\n"line1\nline2"')).toEqual([{ text: 'line1\nline2' }]);
    });

    it('accepts CRLF line endings', () => {
      expect(parseCsv('a,b\r\n1,2\r\n3,4')).toEqual([
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ]);
    });

    it('pads short rows and ignores extra cells', () => {
      expect(parseCsv('a,b\n1\n2,3,4')).toEqual([
        { a: '1', b: '' },
        { a: '2', b: '3' },
      ]);
    });

    it('parses quoted header names', () => {
      expect(parseCsv('"first name",last name\nA,B')).toEqual([{ 'first name': 'A', 'last name': 'B' }]);
    });
  });

  describe('flattenObject', () => {
    it('flattens nested objects into dotted keys', () => {
      expect(flattenObject({ a: { b: { c: 1 }, d: 2 }, e: 3 }, '.')).toEqual({ 'a.b.c': 1, 'a.d': 2, 'e': 3 });
    });

    it('keeps arrays as JSON strings instead of flattening them', () => {
      expect(flattenObject({ a: { b: [1, 2] } }, '.')).toEqual({ 'a.b': '[1,2]' });
    });

    it('lets a literal key win over a derived one', () => {
      expect(flattenObject({ 'a': { b: 1 }, 'a.b': 2 }, '.')).toEqual({ 'a.b': 2 });
      expect(flattenObject({ 'a.b': 2, 'a': { b: 1 } }, '.')).toEqual({ 'a.b': 2 });
    });

    it('flattens nothing for an empty object', () => {
      expect(flattenObject({}, '.')).toEqual({});
      expect(flattenObject({ a: {} }, '.')).toEqual({});
    });
  });

  describe('toCsv', () => {
    it('converts an array of objects to a CSV string', () => {
      expect(toCsv([{ a: 1, b: 2 }, { a: 3, b: 4 }])).toBe('a,b\n1,2\n3,4');
    });

    it('wraps a single object into one row', () => {
      expect(toCsv({ a: 1, b: 2 })).toBe('a,b\n1,2');
    });

    it('collects headers in first-seen order and pads missing cells', () => {
      expect(toCsv([{ a: 1, b: 2 }, { a: 3, c: 4 }])).toBe('a,b,c\n1,2,\n3,,4');
    });

    it('flattens nested objects by default', () => {
      expect(toCsv([{ user: { name: 'Ada', age: 36 } }])).toBe('user.name,user.age\nAda,36');
    });

    it('keeps nested objects as JSON strings when flatten is disabled', () => {
      // the cell is JSON text, so RFC4180 quoting applies (quotes are doubled)
      expect(toCsv([{ user: { name: 'Ada' } }], { flatten: false })).toBe('user\n"{""name"":""Ada""}"');
    });

    it('serializes arrays as JSON strings', () => {
      expect(toCsv([{ tags: ['a', 'b'] }])).toBe('tags\n"[""a"",""b""]"');
      expect(toCsv([{ nums: [1, 2] }])).toBe('nums\n"[1,2]"');
    });

    it('renders null and undefined compatibly with the legacy page', () => {
      expect(toCsv([{ a: null, b: undefined, c: 1 }])).toBe('a,b,c\nnull,,1');
    });

    it('quotes fields that contain commas, quotes, line breaks or edge whitespace', () => {
      expect(toCsv([{ a: 'x,y' }])).toBe('a\n"x,y"');
      expect(toCsv([{ a: 'say "hi"' }])).toBe('a\n"say ""hi"""');
      expect(toCsv([{ a: 'line1\nline2' }])).toBe('a\n"line1\nline2"');
      expect(toCsv([{ a: 'with\rreturn' }])).toBe('a\n"with\rreturn"');
      expect(toCsv([{ a: ' lead' }])).toBe('a\n" lead"');
      expect(toCsv([{ a: 'trail ' }])).toBe('a\n"trail "');
    });

    it('throws a readable error when the root is not an object array', () => {
      expect(() => toCsv('scalar')).toThrow(/requires an array of objects/);
      expect(() => toCsv([1, 2])).toThrow(/non-objects/);
      expect(() => toCsv(null)).toThrow(/requires an array of objects/);
    });

    it('returns an empty string for an empty array', () => {
      expect(toCsv([])).toBe('');
    });
  });
});

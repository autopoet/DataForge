import { describe, expect, it } from 'vitest';
import { decodeDeep, needsDecoding } from './deep-decode.service';

// Produces the raw text of a JSON value wrapped in one string-encoding layer:
// encode({ a: 1 }) === '"{\"a\":1}"'
const encode = (value: unknown) => JSON.stringify(JSON.stringify(value));

// Wraps a value into n levels of { nested: <stringified previous> } encoding
function nest(value: unknown, levels: number) {
  let nested = value;
  for (let i = 0; i < levels; i += 1) {
    nested = { nested: JSON.stringify(nested) };
  }
  return nested;
}

describe('deep-decode service', () => {
  describe('needsDecoding', () => {
    it('returns true for a string-encoded JSON object', () => {
      expect(needsDecoding(encode({ a: 1 }))).toBe(true);
    });

    it('returns true for plain JSON containing an encoded field (scenario A)', () => {
      expect(needsDecoding(JSON.stringify({ body: JSON.stringify({ code: 200 }) }))).toBe(true);
    });

    it('returns false for plain JSON input', () => {
      expect(needsDecoding('{"a": 1}')).toBe(false);
      expect(needsDecoding('[1, 2]')).toBe(false);
      expect(needsDecoding(JSON.stringify({ body: 'plain text' }))).toBe(false);
    });

    it('returns false for a non-JSON string literal', () => {
      expect(needsDecoding('"hello"')).toBe(false);
    });

    it('returns false for plain text and other formats', () => {
      expect(needsDecoding('hello world')).toBe(false);
      expect(needsDecoding('a: 1')).toBe(false);
      expect(needsDecoding('')).toBe(false);
    });

    it('short-circuits inputs above 1MB', () => {
      expect(needsDecoding(`"${'x'.repeat(1024 * 1024)}"`)).toBe(false);
    });
  });

  describe('decodeDeep', () => {
    it('decodes a single string-encoded layer', () => {
      const input = encode({ a: 1 });
      const result = decodeDeep(input);

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0]).toMatchObject({ depth: 1, value: { a: 1 }, rawLength: input.length });
      expect(result.fullyDecoded).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('accepts single-quoted encoded strings', () => {
      const result = decodeDeep('\'{"a":1}\'');
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].value).toEqual({ a: 1 });
    });

    it('decodes two layers: top-level encoding, then the encoded field', () => {
      const input = encode({ data: JSON.stringify({ b: 2 }) });
      const result = decodeDeep(input);

      expect(result.layers).toHaveLength(2);
      expect(result.layers[0]).toMatchObject({ depth: 1, value: { data: '{"b":2}' } });
      expect(result.layers[1]).toMatchObject({ depth: 2, value: { data: { b: 2 } } });
      expect(result.fullyDecoded).toBe(true);
    });

    it('decodes plain JSON with an encoded field without an unwrap layer', () => {
      const input = JSON.stringify({ body: JSON.stringify({ code: 200 }) });
      const result = decodeDeep(input);

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].value).toEqual({ body: { code: 200 } });
      expect(result.fullyDecoded).toBe(true);
    });

    it('decodes sibling encoded fields within a single layer', () => {
      const input = JSON.stringify({ a: JSON.stringify({ x: 1 }), b: JSON.stringify({ y: 2 }) });
      const result = decodeDeep(input);

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].value).toEqual({ a: { x: 1 }, b: { y: 2 } });
    });

    it('decodes encoded strings nested in arrays', () => {
      const input = JSON.stringify([{ item: JSON.stringify({ id: 7 }) }]);
      const result = decodeDeep(input);

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].value).toEqual([{ item: { id: 7 } }]);
    });

    it('crops previews to 120 characters', () => {
      const result = decodeDeep(encode({ text: 'x'.repeat(300) }));

      expect(result.layers[0].preview.length).toBeLessThanOrEqual(121);
      expect(result.layers[0].preview.endsWith('…')).toBe(true);
    });

    it('returns no layers for inputs without encoded JSON', () => {
      expect(decodeDeep('{"a": 1}').layers).toHaveLength(0);
      expect(decodeDeep('"hello"').layers).toHaveLength(0);
      expect(decodeDeep('hello world').layers).toHaveLength(0);
      expect(decodeDeep('a: 1').layers).toHaveLength(0);
      expect(decodeDeep('').layers).toHaveLength(0);
    });

    it('stops at maxDepth layers and reports the reason', () => {
      const result = decodeDeep(encode(nest({ deep: true }, 8)));

      expect(result.layers).toHaveLength(5);
      expect(result.layers.map(layer => layer.depth)).toEqual([1, 2, 3, 4, 5]);
      expect(result.fullyDecoded).toBe(false);
      expect(result.reason).toContain('max depth 5');
    });

    it('fully decodes deep chains when the depth budget allows it', () => {
      const result = decodeDeep(encode(nest({ deep: true }, 3)), { maxDepth: 10 });

      expect(result.layers).toHaveLength(4);
      expect(result.layers.at(-1)?.value).toEqual({ nested: { nested: { nested: { deep: true } } } });
      expect(result.fullyDecoded).toBe(true);
    });

    it('respects a custom maxDepth option', () => {
      const result = decodeDeep(encode({ data: JSON.stringify({ b: 2 }) }), { maxDepth: 1 });

      expect(result.layers).toHaveLength(1);
      expect(result.fullyDecoded).toBe(false);
      expect(result.reason).toContain('max depth 1');
    });

    it('short-circuits inputs above 1MB', () => {
      const result = decodeDeep(`"${'x'.repeat(1024 * 1024)}"`);

      expect(result.layers).toHaveLength(0);
      expect(result.fullyDecoded).toBe(false);
      expect(result.reason).toContain('1MB');
    });
  });
});

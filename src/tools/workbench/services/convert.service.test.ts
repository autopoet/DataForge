import { describe, expect, it } from 'vitest';
import { detectionFixtures } from '../fixtures';
import { type SerializeTarget, parseToData, serialize } from './convert.service';

describe('convert service', () => {
  describe('parseToData', () => {
    it('rejects empty input and missing formats', () => {
      expect(parseToData('', 'json')).toMatchObject({ ok: false, error: 'input is empty' });
      expect(parseToData('  \n', 'yaml')).toMatchObject({ ok: false, error: 'input is empty' });
      expect(parseToData('{"a":1}', null)).toMatchObject({ ok: false, error: 'no format detected' });
      expect(parseToData('hello', 'text')).toMatchObject({ ok: false, error: 'plain text has no structured data to convert' });
    });

    it('parses JSON (including dirty JSON5)', () => {
      const result = parseToData('{\n  // note\n  name: \'DataForge\',\n  tags: [\'json\',],\n}', 'json');
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ name: 'DataForge', tags: ['json'] });
    });

    it('reports a positioned error for broken JSON', () => {
      const result = parseToData('{"a": 1,,}', 'json');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('line 1, column');
    });

    it('parses block-style YAML', () => {
      const result = parseToData('server:\n  port: 8080\n  host: localhost', 'yaml');
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ server: { port: 8080, host: 'localhost' } });
    });

    it('rejects multi-document YAML with a readable error', () => {
      const result = parseToData('---\na: 1\n---\nb: 2', 'yaml');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('multiple documents');
    });

    it('rejects bare scalar YAML documents', () => {
      const result = parseToData('just a string', 'yaml');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('structured value');
    });

    it('parses TOML and normalizes dates to ISO strings', () => {
      const result = parseToData('title = "config"\nd = 2020-01-01T00:00:00Z\n[server]\nport = 8080', 'toml');
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ title: 'config', d: '2020-01-01T00:00:00.000Z', server: { port: 8080 } });
    });

    it('maps XML attributes to @ keys and lifts sole text nodes to scalars', () => {
      const result = parseToData('<note x="1"><to>You</to><to>Me</to></note>', 'xml');
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ note: { '@x': '1', 'to': ['You', 'Me'] } });
    });

    it('drops the XML declaration and keeps mixed content _text', () => {
      const withDeclaration = parseToData('<?xml version="1.0" encoding="UTF-8"?><note/>', 'xml');
      expect(withDeclaration.data).toEqual({ note: {} });

      const mixed = parseToData('<note>hi<to>You</to></note>', 'xml');
      expect(mixed.data).toEqual({ note: { _text: 'hi', to: 'You' } });
    });

    it('parses CSV into record arrays', () => {
      const result = parseToData('name,role\nAlice,admin\nBob,viewer', 'csv');
      expect(result.ok).toBe(true);
      expect(result.data).toEqual([
        { name: 'Alice', role: 'admin' },
        { name: 'Bob', role: 'viewer' },
      ]);
    });
  });

  describe('serialize', () => {
    it('pretty-prints JSON with an indent and optional key sorting', () => {
      expect(serialize({ b: 1, a: 2 }, 'json')).toBe('{\n  "b": 1,\n  "a": 2\n}');
      expect(serialize({ b: 1, a: 2 }, 'json', { sortKeys: true, indentSize: 4 })).toBe('{\n    "a": 2,\n    "b": 1\n}');
    });

    it('serializes YAML (undefined keys are dropped by normalization)', () => {
      expect(serialize({ server: { port: 8080 } }, 'yaml')).toBe('server:\n  port: 8080\n');
    });

    it('serializes TOML documents from object IR', () => {
      // iarna-toml-esm writes digit separators in integers (8_080), like the legacy json-to-toml tool
      expect(serialize({ title: 'config', server: { port: 8080 } }, 'toml')).toBe('title = "config"\n\n[server]\nport = 8_080\n');
    });

    it('throws a readable error when TOML cannot represent null values', () => {
      expect(() => serialize({ a: { b: null } }, 'toml')).toThrow(/TOML cannot represent null\/undefined/);
      expect(() => serialize({ a: undefined }, 'toml')).toThrow(/TOML cannot represent null\/undefined/);
    });

    it('throws a readable error when the TOML root is not an object', () => {
      expect(() => serialize([1, 2], 'toml')).toThrow(/requires a root object/);
      expect(() => serialize('x', 'toml')).toThrow(/requires a root object/);
    });

    it('round-trips XML attributes and text nodes', () => {
      const xml = serialize(parseToData('<note x="1"><to>You</to></note>', 'xml').data, 'xml');
      expect(xml).toContain('<note x="1">');
      expect(xml).toContain('<to>You</to>');
    });

    it('wraps scalar and array roots so XML output has a single root', () => {
      expect(serialize('hi', 'xml')).toContain('<root>hi</root>');
      const arrayXml = serialize([1, 2], 'xml');
      expect(arrayXml).toContain('<item>1</item>');
      expect(arrayXml).toContain('<item>2</item>');
    });

    it('wraps multi-key objects in a root element to stay valid XML', () => {
      const xml = serialize({ a: 1, b: 2 }, 'xml');
      expect(xml).toContain('<a>1</a>');
      expect(xml).toContain('<b>2</b>');
      expect(xml.trim().startsWith('<root>')).toBe(true);
      expect(xml.trim().endsWith('</root>')).toBe(true);
    });

    it('wraps single-key objects with array values so XML keeps a single root', () => {
      // js2xml repeats the element once per item, which would emit multiple
      // top-level nodes without the wrap (regression: "Found multiple root nodes")
      const objectArrayXml = serialize({ users: [{ name: 'Ada' }, { name: 'Bob' }] }, 'xml');
      expect(objectArrayXml.trim().startsWith('<root>')).toBe(true);
      expect(objectArrayXml.trim().endsWith('</root>')).toBe(true);
      expect(objectArrayXml).toContain('<users>');
      expect(objectArrayXml).toContain('<name>Ada</name>');
      expect(objectArrayXml).toContain('<name>Bob</name>');

      const scalarArrayXml = serialize({ nums: [1, 2] }, 'xml');
      expect(scalarArrayXml.trim().startsWith('<root>')).toBe(true);
      expect(scalarArrayXml).toContain('<nums>1</nums>');
      expect(scalarArrayXml).toContain('<nums>2</nums>');
    });

    it('keeps nested arrays as repeated child elements under one root', () => {
      const xml = serialize({ note: { to: ['You', 'Me'] } }, 'xml');
      expect(xml.trim().startsWith('<note>')).toBe(true);
      expect(xml).toContain('<to>You</to>');
      expect(xml).toContain('<to>Me</to>');
    });

    it('serializes CSV from object arrays and rejects other roots', () => {
      expect(serialize([{ a: 1, b: 2 }], 'csv')).toBe('a,b\n1,2');
      expect(() => serialize('scalar', 'csv')).toThrow(/CSV output requires an array of objects/);
    });
  });

  describe('conversion matrix: every parseable fixture against every target', () => {
    const parseableFixtures = detectionFixtures
      .filter(fixture => fixture.expectedFormat !== 'text' && !fixture.expectParseError);

    it.each(parseableFixtures)('$name ($tool): serialize(parseToData($expectedFormat)) produces output or a readable error', (fixture) => {
      const parsed = parseToData(fixture.content, fixture.expectedFormat);
      expect(parsed.ok).toBe(true);

      const targets: SerializeTarget[] = ['json', 'yaml', 'toml', 'xml', 'csv'];
      targets.forEach((target) => {
        try {
          const output = serialize(parsed.data, target);
          expect(typeof output).toBe('string');
        }
        catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message.length).toBeGreaterThan(0);
        }
      });
    });

    it('keeps the parsed data consistent with the detected format', () => {
      const fixture = detectionFixtures.find(f => f.name === 'yaml-mapping')!;
      const parsed = parseToData(fixture.content, fixture.expectedFormat);
      expect(parsed.data).toEqual({ server: { port: 8080, host: 'localhost' } });
    });
  });
});

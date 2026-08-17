import { describe, expect, it } from 'vitest';
import { detectionFixtures } from '../fixtures';
import { detectFormat } from './format-detect.service';

describe('format-detect service', () => {
  describe('detectFormat', () => {
    it('returns null format for an empty input', () => {
      expect(detectFormat('')).toMatchObject({ format: null });
      expect(detectFormat('   \n\t ')).toMatchObject({ format: null });
    });

    it('detects json objects and arrays with high confidence', () => {
      expect(detectFormat('{"a": 1}')).toMatchObject({ format: 'json', confidence: 'high' });
      expect(detectFormat('[1, 2, 3]')).toMatchObject({ format: 'json', confidence: 'high' });
    });

    it('accepts dirty JSON5 (comments, trailing commas, single quotes)', () => {
      const dirty = `{
  // team config
  name: 'DataForge',
  tags: ['json',],
}`;
      expect(detectFormat(dirty)).toMatchObject({ format: 'json', confidence: 'high' });
    });

    it('reports line and column for broken JSON', () => {
      const detection = detectFormat('{"a": 1,,}');
      expect(detection.format).toBe('json');
      expect(detection.parseError).toContain('line 1, column');
    });

    it('keeps a multi-line broken JSON error informative', () => {
      const detection = detectFormat('{\n  "a": 1\n  "b": 2\n}');
      expect(detection.format).toBe('json');
      expect(detection.parseError).toMatch(/line \d+, column \d+/);
    });

    it('detects block-style YAML through the fallback probe', () => {
      expect(detectFormat('a: 1\nb: two')).toMatchObject({ format: 'yaml', confidence: 'low' });
      expect(detectFormat('server:\n  port: 8080')).toMatchObject({ format: 'yaml', confidence: 'low' });
      expect(detectFormat('- json\n- yaml\n- toml')).toMatchObject({ format: 'yaml', confidence: 'low' });
    });

    it('detects YAML flow style when JSON5 fails on a { start', () => {
      const detection = detectFormat('{a: yes}');
      expect(detection).toMatchObject({ format: 'yaml', confidence: 'low' });
      expect(detection.reason).toContain('flow');
    });

    it('distinguishes a = 1 (TOML) from a: 1 (YAML)', () => {
      expect(detectFormat('a = 1')).toMatchObject({ format: 'toml', confidence: 'high' });
      expect(detectFormat('a: 1')).toMatchObject({ format: 'yaml', confidence: 'low' });
    });

    it('detects TOML documents, including section-first ones', () => {
      expect(detectFormat('title = "config"')).toMatchObject({ format: 'toml', confidence: 'high' });
      expect(detectFormat('[server]\nport = 8080')).toMatchObject({ format: 'toml', confidence: 'high' });
    });

    it('detects valid XML and fragments starting with <', () => {
      expect(detectFormat('<note><to>You</to></note>')).toMatchObject({ format: 'xml', confidence: 'high' });
      expect(detectFormat('<?xml version="1.0"?><note/>')).toMatchObject({ format: 'xml', confidence: 'high' });
      expect(detectFormat('<note>')).toMatchObject({ format: 'xml', confidence: 'high' });
    });

    it('reports a positioned parse error for broken XML', () => {
      const detection = detectFormat('<note><to>x</note>');
      expect(detection.format).toBe('xml');
      expect(detection.parseError).toMatch(/line 1, column \d+/);
    });

    it('falls back to text for unstructured input', () => {
      expect(detectFormat('hello world')).toMatchObject({ format: 'text', confidence: 'low' });
      expect(detectFormat('name=Data%20Forge&tool=workbench')).toMatchObject({ format: 'text' });
      expect(detectFormat('SGVsbG8gRGF0YUZvcmdlIQ==')).toMatchObject({ format: 'text' });
    });

    it('never auto-detects CSV (decision A5)', () => {
      expect(detectFormat('name,role\nAlice,admin\nBob,viewer')).toMatchObject({ format: 'text' });
    });

    it('treats multi-document YAML as text', () => {
      expect(detectFormat('---\na: 1\n---\nb: 2')).toMatchObject({ format: 'text' });
    });
  });

  describe('fixtures: typical inputs of the retained tools', () => {
    it.each(detectionFixtures)('$name ($tool) is detected as $expectedFormat', (fixture) => {
      const detection = detectFormat(fixture.content);

      expect(detection.format).toBe(fixture.expectedFormat);
      expect(detection.confidence).toBe(fixture.expectedConfidence);
      expect(Boolean(detection.parseError)).toBe(Boolean(fixture.expectParseError));
    });
  });
});

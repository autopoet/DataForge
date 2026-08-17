import { describe, expect, it } from 'vitest';
import { csvView } from './csv.view';
import { formattedView } from './formatted.view';
import { minifiedView } from './minified.view';
import { tomlView } from './toml.view';
import { typescriptView } from './typescript.view';
import { viewRegistry } from './registry';
import { xmlView } from './xml.view';
import { yamlView } from './yaml.view';

// M4 acceptance (design doc): pasting dirty JSON must produce a formatted view,
// broken JSON disables every data tab, and structured inputs all get a minified
// JSON view. M5 extends the registry with the conversion views and locks the
// availability matrix: same-format tabs are greyed, CSV needs an array of
// objects, and a throwing render surfaces as the view-level error contract.
// M6 adds the TypeScript view (render = type-generator service, availability
// aligned with the minified view).

describe('view registry', () => {
  it('registers the M4, M5 and M6 views in tab order', () => {
    expect(viewRegistry.map(view => view.id)).toEqual(['formatted', 'minified', 'typescript', 'yaml', 'toml', 'xml', 'csv']);
  });
});

describe('formatted view', () => {
  it('re-emits JSON input as pretty JSON', () => {
    const data = { a: 1, b: [1, 2] };
    expect(formattedView.render(data, 'json', {})).toBe(JSON.stringify(data, null, 2));
  });

  it('re-emits YAML input as YAML', () => {
    expect(formattedView.render({ a: 1 }, 'yaml', {})).toBe('a: 1\n');
  });

  it('is available for every structured input format', () => {
    for (const format of ['json', 'yaml', 'toml', 'xml'] as const) {
      expect(formattedView.availability({}, format).enabled).toBe(true);
    }
  });

  it('is unavailable for CSV input with a reason', () => {
    const availability = formattedView.availability({}, 'csv');
    expect(availability.enabled).toBe(false);
    expect(availability.disabledReasonKey).toBe('tools.workbench.views.disabled.csv');
  });

  it('is unavailable without parseable data', () => {
    const availability = formattedView.availability(undefined, 'json');
    expect(availability.enabled).toBe(false);
    expect(availability.disabledReasonKey).toBe('tools.workbench.views.disabled.noData');
  });

  it('lets serialization failures bubble up (view-level error contract)', () => {
    expect(() => formattedView.render({ a: null }, 'toml', {})).toThrow();
  });
});

describe('minified view', () => {
  it('minifies any structured IR to single-line JSON', () => {
    expect(minifiedView.render({ a: [1, 'two'], b: null }, 'json', {})).toBe('{"a":[1,"two"],"b":null}');
  });

  it('is available for every structured input format', () => {
    for (const format of ['json', 'yaml', 'toml', 'xml'] as const) {
      expect(minifiedView.availability({}, format).enabled).toBe(true);
    }
  });

  it('is unavailable for CSV and text inputs with a reason', () => {
    expect(minifiedView.availability({}, 'csv').enabled).toBe(false);
    expect(minifiedView.availability({}, 'text').disabledReasonKey).toBe('tools.workbench.views.disabled.text');
  });

  it('is unavailable without parseable data', () => {
    expect(minifiedView.availability(undefined, 'json').enabled).toBe(false);
  });
});

describe('typescript view', () => {
  it('generates TypeScript type declarations from the IR', () => {
    const types = typescriptView.render({ user: { name: 'Ada' } }, 'json', {});
    expect(types).toContain('export interface Root');
    expect(types).toContain('user: RootUser;');
    expect(types).toContain('interface RootUser');
  });

  it('is available for every structured input format like the minified view', () => {
    for (const format of ['json', 'yaml', 'toml', 'xml'] as const) {
      expect(typescriptView.availability({}, format).enabled).toBe(true);
    }
  });

  it('is unavailable for CSV and text inputs with a reason', () => {
    expect(typescriptView.availability({}, 'csv').enabled).toBe(false);
    expect(typescriptView.availability({}, 'text').disabledReasonKey).toBe('tools.workbench.views.disabled.text');
  });

  it('is unavailable without parseable data', () => {
    expect(typescriptView.availability(undefined, 'json').enabled).toBe(false);
  });
});

describe('yaml view', () => {
  it('converts JSON IR to YAML', () => {
    expect(yamlView.render({ a: 1 }, 'json', {})).toBe('a: 1\n');
  });

  it('converts CSV-parsed IR (array of objects) to YAML', () => {
    expect(yamlView.render([{ a: 1 }], 'csv', {})).toContain('a: 1');
  });

  it('is available for every structured input format except YAML', () => {
    for (const format of ['json', 'toml', 'xml', 'csv'] as const) {
      expect(yamlView.availability({}, format).enabled).toBe(true);
    }
    const availability = yamlView.availability({}, 'yaml');
    expect(availability.enabled).toBe(false);
    expect(availability.disabledReasonKey).toBe('tools.workbench.views.disabled.sameFormat');
  });

  it('is unavailable for text and empty inputs', () => {
    expect(yamlView.availability({}, 'text').enabled).toBe(false);
    expect(yamlView.availability({}, null).enabled).toBe(false);
    expect(yamlView.availability(undefined, 'json').enabled).toBe(false);
  });
});

describe('toml view', () => {
  it('converts JSON IR to TOML', () => {
    expect(tomlView.render({ title: 'config', server: { port: 8080 } }, 'json', {})).toBe('title = "config"\n\n[server]\nport = 8_080\n');
  });

  it('is available for every structured input format except TOML', () => {
    for (const format of ['json', 'yaml', 'xml', 'csv'] as const) {
      expect(tomlView.availability({}, format).enabled).toBe(true);
    }
    const availability = tomlView.availability({}, 'toml');
    expect(availability.enabled).toBe(false);
    expect(availability.disabledReasonKey).toBe('tools.workbench.views.disabled.sameFormat');
  });

  it('is unavailable for text and empty inputs', () => {
    expect(tomlView.availability({}, 'text').enabled).toBe(false);
    expect(tomlView.availability(undefined, 'json').enabled).toBe(false);
  });

  it('lets TOML serialization failures bubble up with a readable message (view-level error contract)', () => {
    expect(() => tomlView.render({ a: null }, 'json', {})).toThrow(/TOML cannot represent null\/undefined/);
    expect(() => tomlView.render({ a: null }, 'json', {})).toThrow(/YAML/);
    expect(() => tomlView.render('hi', 'json', {})).toThrow(/requires a root object/);
  });
});

describe('xml view', () => {
  it('converts JSON IR to XML', () => {
    const xml = xmlView.render({ note: { to: 'You' } }, 'json', {});
    expect(xml).toContain('<note>');
    expect(xml).toContain('<to>You</to>');
  });

  it('is available for every structured input format except XML', () => {
    for (const format of ['json', 'yaml', 'toml', 'csv'] as const) {
      expect(xmlView.availability({}, format).enabled).toBe(true);
    }
    const availability = xmlView.availability({}, 'xml');
    expect(availability.enabled).toBe(false);
    expect(availability.disabledReasonKey).toBe('tools.workbench.views.disabled.sameFormat');
  });

  it('is unavailable for text and empty inputs', () => {
    expect(xmlView.availability({}, 'text').enabled).toBe(false);
    expect(xmlView.availability(undefined, 'json').enabled).toBe(false);
  });
});

describe('csv view', () => {
  it('converts an array of objects to CSV', () => {
    expect(csvView.render([{ a: 1, b: 2 }], 'json', {})).toBe('a,b\n1,2');
  });

  it('flattens nested objects by default and keeps them as JSON strings when disabled', () => {
    expect(csvView.render([{ user: { name: 'Ada' } }], 'json', {})).toBe('user.name\nAda');
    expect(csvView.render([{ user: { name: 'Ada' } }], 'json', { csvFlatten: false }))
      .toBe('user\n"{""name"":""Ada""}"');
  });

  it('is available for every structured input format except CSV when the IR is an array of objects', () => {
    for (const format of ['json', 'yaml', 'toml', 'xml'] as const) {
      expect(csvView.availability([{ a: 1 }], format).enabled).toBe(true);
    }
    const availability = csvView.availability([{ a: 1 }], 'csv');
    expect(availability.enabled).toBe(false);
    expect(availability.disabledReasonKey).toBe('tools.workbench.views.disabled.sameFormat');
  });

  it('is greyed with a reason when the IR is not an array of objects', () => {
    const reasonKey = 'tools.workbench.views.disabled.notArrayOfObjects';
    for (const data of [{ a: 1 }, 'scalar', 42, [1, 2], [1, 'a']]) {
      const availability = csvView.availability(data, 'json');
      expect(availability.enabled).toBe(false);
      expect(availability.disabledReasonKey).toBe(reasonKey);
    }
  });

  it('is unavailable for text and empty inputs', () => {
    expect(csvView.availability([{ a: 1 }], 'text').enabled).toBe(false);
    expect(csvView.availability(undefined, 'json').enabled).toBe(false);
  });
});

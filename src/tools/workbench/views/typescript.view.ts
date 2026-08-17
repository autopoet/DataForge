import type { ViewDescriptor } from './registry';
import { generateTypeScriptTypes } from '@/tools/type-generator/type-generator.service';

// M6 view: re-emit the IR as TypeScript type declarations (design doc M6 §3).
// The generator is a pure function over the JSON-compatible IR, so every
// structured input format can be typed. Availability mirrors the minified view:
// CSV and plain text have no meaningful types, and there is no data yet for an
// empty input.
export const typescriptView: ViewDescriptor = {
  id: 'typescript',
  labelKey: 'tools.workbench.views.typescript',
  language: () => 'typescript',
  extension: () => 'ts',
  availability: (data, format) => {
    if (data === undefined) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.noData' };
    }
    if (format === 'csv' || format === 'text' || format === null) {
      return {
        enabled: false,
        disabledReasonKey: format === 'csv'
          ? 'tools.workbench.views.disabled.csv'
          : 'tools.workbench.views.disabled.text',
      };
    }
    return { enabled: true };
  },
  render: data => generateTypeScriptTypes(data),
};

import { serialize } from '../services/convert.service';
import type { ViewDescriptor } from './registry';

// M5 view 4/4: re-emit the IR as CSV (design doc M2 csv.service). Only an
// array of objects has tabular meaning — any other IR shape (scalar, plain
// object, array of non-objects) keeps the tab greyed. CSV input itself is
// disabled too: it is already tabular. The flatten toggle (OutputViews) flows
// through the render options into toCsv.
export const csvView: ViewDescriptor = {
  id: 'csv',
  labelKey: 'tools.workbench.views.csv',
  // highlight.js has no CSV grammar — plain text keeps the rows readable
  language: () => 'txt',
  extension: () => 'csv',
  availability: (data, format) => {
    if (data === undefined) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.noData' };
    }
    if (format === 'text' || format === null) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.text' };
    }
    if (format === 'csv') {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.sameFormat' };
    }
    if (!isArrayOfObjects(data)) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.notArrayOfObjects' };
    }
    return { enabled: true };
  },
  render: (data, _format, opts) => serialize(data, 'csv', opts),
};

function isArrayOfObjects(data: unknown): boolean {
  return Array.isArray(data) && data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item));
}

import type { ViewDescriptor } from './registry';

// M4 view 2/2: the IR is always a JSON-compatible value (design doc A2), so
// every structured input minifies to a single-line JSON string. Plain text and
// CSV inputs have nothing meaningful to minify, so they stay disabled.
export const minifiedView: ViewDescriptor = {
  id: 'minified',
  labelKey: 'tools.workbench.views.minified',
  language: () => 'json',
  extension: () => 'json',
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
  render: data => JSON.stringify(data),
};

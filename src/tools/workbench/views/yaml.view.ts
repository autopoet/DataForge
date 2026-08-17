import { serialize } from '../services/convert.service';
import type { ViewDescriptor } from './registry';

// M5 view 1/4: re-emit the IR as YAML. Available for every structured input
// except YAML itself — converting YAML to YAML is meaningless (design doc M5
// availability matrix, same-format tabs stay greyed).
export const yamlView: ViewDescriptor = {
  id: 'yaml',
  labelKey: 'tools.workbench.views.yaml',
  language: () => 'yaml',
  extension: () => 'yaml',
  availability: (data, format) => {
    if (data === undefined) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.noData' };
    }
    if (format === 'text' || format === null) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.text' };
    }
    if (format === 'yaml') {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.sameFormat' };
    }
    return { enabled: true };
  },
  render: (data, _format, opts) => serialize(data, 'yaml', opts),
};

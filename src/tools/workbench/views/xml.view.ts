import { serialize } from '../services/convert.service';
import type { ViewDescriptor } from './registry';

// M5 view 3/4: re-emit the IR as XML (design doc A3 mapping — attributes as
// @-keys, sole _text children lifted to scalars). Available for every
// structured input except XML itself.
export const xmlView: ViewDescriptor = {
  id: 'xml',
  labelKey: 'tools.workbench.views.xml',
  language: () => 'xml',
  extension: () => 'xml',
  availability: (data, format) => {
    if (data === undefined) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.noData' };
    }
    if (format === 'text' || format === null) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.text' };
    }
    if (format === 'xml') {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.sameFormat' };
    }
    return { enabled: true };
  },
  render: (data, _format, opts) => serialize(data, 'xml', opts),
};

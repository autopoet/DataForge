import { serialize } from '../services/convert.service';
import type { SerializeTarget } from '../services/convert.service';
import type { DataFormat } from '../services/format-detect.service';
import type { ViewDescriptor } from './registry';

// M4 view 1/2: re-emit the parsed IR in the input's own format — pretty JSON
// for JSON input, pretty YAML for YAML input, and so on. The serialization
// target therefore follows the detected format, never a fixed one.
export const formattedView: ViewDescriptor = {
  id: 'formatted',
  labelKey: 'tools.workbench.views.formatted',
  language: format => languageForFormat(format),
  extension: format => format ?? 'txt',
  availability: (data, format) => {
    if (data === undefined) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.noData' };
    }
    if (format === 'csv') {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.csv' };
    }
    if (format === 'text' || format === null) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.text' };
    }
    return { enabled: true };
  },
  render: (data, format, opts) => serialize(data, format as SerializeTarget, opts),
};

function languageForFormat(format: DataFormat | null): string {
  switch (format) {
    case 'json':
    case 'yaml':
    case 'toml':
    case 'xml':
      return format;
    default:
      return 'txt';
  }
}

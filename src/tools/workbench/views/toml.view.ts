import { serialize } from '../services/convert.service';
import type { ViewDescriptor } from './registry';

// M5 view 2/4: re-emit the IR as TOML. Serialization throws a readable error
// for values TOML cannot hold (null, mixed arrays) — the view-level error
// contract (design doc §5.1 level 2) shows it in-view with the "convert to
// YAML instead" suggestion, never as a crash.
export const tomlView: ViewDescriptor = {
  id: 'toml',
  labelKey: 'tools.workbench.views.toml',
  language: () => 'toml',
  extension: () => 'toml',
  availability: (data, format) => {
    if (data === undefined) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.noData' };
    }
    if (format === 'text' || format === null) {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.text' };
    }
    if (format === 'toml') {
      return { enabled: false, disabledReasonKey: 'tools.workbench.views.disabled.sameFormat' };
    }
    return { enabled: true };
  },
  render: (data, _format, opts) => serialize(data, 'toml', opts),
};

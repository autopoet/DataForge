import type { DataFormat } from '../services/format-detect.service';
import type { SerializeOptions } from '../services/convert.service';
import { formattedView } from './formatted.view';
import { minifiedView } from './minified.view';
import { typescriptView } from './typescript.view';
import { yamlView } from './yaml.view';
import { tomlView } from './toml.view';
import { xmlView } from './xml.view';
import { csvView } from './csv.view';

// View registry (design doc M4 §1): every output slot of the workbench is a
// self-describing descriptor and the UI renders the tab bar straight from this
// list. Adding a view (M5: yaml/toml/xml/csv, M6: typescript) is therefore a
// registry-only change. The detected format is passed into the
// format-dependent members so a view can follow the input (the "Format" view
// re-emits the data in its own format) without holding global state.

export interface ViewAvailability {
  enabled: boolean
  disabledReasonKey?: string
}

export interface ViewDescriptor {
  id: string
  labelKey: string
  language: (format: DataFormat | null) => string
  extension: (format: DataFormat | null) => string
  availability(data: unknown, format: DataFormat | null): ViewAvailability
  // Throwing here is the view-level error contract (design doc §5.1 level 2):
  // the consumer catches it and shows an in-view error bar.
  render(data: unknown, format: DataFormat | null, opts: SerializeOptions): string
}

export const viewRegistry: ViewDescriptor[] = [
  formattedView,
  minifiedView,
  typescriptView,
  yamlView,
  tomlView,
  xmlView,
  csvView,
];

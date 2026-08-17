// RFC4180-lite CSV parsing and generation for the workbench (design doc M2).
//
// parseCsv understands quoted fields (with "" escaping and embedded line
// breaks); toCsv quotes any field that would otherwise be ambiguous and
// keeps nested objects flat via flattenObject so tabular output stays simple.

export { parseCsv, toCsv, flattenObject };

export interface CsvParseOptions {
  delimiter?: string
}

export interface CsvSerializeOptions {
  flatten?: boolean
  separator?: string
}

// --- parsing -----------------------------------------------------------------

function parseCsv(text: string, { delimiter = ',' }: CsvParseOptions = {}): Record<string, string>[] {
  const rows = readRows(text, delimiter);
  const header = rows.shift();

  if (!header || header.length === 0) {
    return [];
  }

  return rows.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? '';
    });
    return record;
  });
}

// Splits CSV text into rows of cells, honoring quoted fields so that a
// delimiter, doubled quotes or a line break inside quotes is kept verbatim.
function readRows(text: string, delimiter: string): string[][] {
  if (text === '') {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote is an escaped quote; anything else ends the field.
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
        }
        else {
          inQuotes = false;
          i += 1;
        }
      }
      else {
        cell += char;
        i += 1;
      }
      continue;
    }

    if (char === '"' && cell === '') {
      inQuotes = true;
      i += 1;
    }
    else if (char === delimiter) {
      endCell();
      i += 1;
    }
    else if (char === '\n') {
      endRow();
      i += 1;
    }
    else if (char === '\r') {
      // \r\n is a row break; a lone \r is folded into the row break too
      endRow();
      i += text[i + 1] === '\n' ? 2 : 1;
    }
    else {
      cell += char;
      i += 1;
    }
  }

  // A trailing newline closes the last row already; otherwise flush manually.
  if (cell !== '' || row.length > 0) {
    endRow();
  }

  return rows;
}

// --- generation ---------------------------------------------------------------

// Accepts an array of objects, or a single object that is wrapped implicitly.
function toCsv(data: unknown, { flatten = true, separator = '.' }: CsvSerializeOptions = {}): string {
  const records = asRecordArray(data);

  const normalized = flatten
    ? records.map(record => flattenObject(record, separator))
    : records;

  const headers = new Set<string>();
  normalized.forEach(record => Object.keys(record).forEach(key => headers.add(key)));
  const headerList = Array.from(headers);

  const rows = normalized.map(record => headerList.map(header => serializeValue(record[header])));

  return [headerList.join(','), ...rows].join('\n');
}

function asRecordArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    if (data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
      return data as Record<string, unknown>[];
    }
    throw new Error('CSV output requires an array of objects; the data is an array of non-objects.');
  }

  if (typeof data === 'object' && data !== null) {
    return [data as Record<string, unknown>];
  }

  throw new Error('CSV output requires an array of objects (a single object is also accepted); the root is a scalar.');
}

// Deep-flattens nested objects into dotted keys (a.b.c) while keeping arrays
// as JSON strings. A literal key always wins over a derived one.
function flattenObject(obj: Record<string, unknown>, separator: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (isPlainObject(value)) {
      Object.entries(flattenObject(value, separator)).forEach(([flatKey, flatValue]) => {
        const mergedKey = `${key}${separator}${flatKey}`;
        if (!(mergedKey in result)) {
          result[mergedKey] = flatValue;
        }
      });
    }
    else if (Array.isArray(value)) {
      // arrays stay as JSON strings (design doc: "[1,2]"), never flattened
      result[key] = JSON.stringify(value);
    }
    else {
      result[key] = value;
    }
  });

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// RFC4180 field escaping: quote when the value contains a delimiter, quote,
// line break or leading/trailing whitespace; embedded quotes are doubled.
function serializeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return '';
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';

  const needsQuoting = /[",\r\n]/.test(text) || /^\s|\s$/.test(text);

  if (!needsQuoting) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

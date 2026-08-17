import type { DataFormat } from '../services/format-detect.service';

export interface DetectionFixture {
  name: string
  tool: string
  content: string
  expectedFormat: DataFormat | null
  expectedConfidence: 'high' | 'low'
  expectParseError?: boolean
}

// Typical inputs of the 20 retained tools, used to assert detectFormat does not
// misjudge real-world pastes; reused by workbench e2e specs (design doc M1).
const scenarioAInput = JSON.stringify(JSON.stringify({ data: JSON.stringify({ a: 1 }) }));

export const detectionFixtures: DetectionFixture[] = [
  { name: 'json-object', tool: 'json-viewer', content: '{"name":"DataForge","stars":128,"tags":["json","yaml"]}', expectedFormat: 'json', expectedConfidence: 'high' },
  { name: 'json-array', tool: 'json-to-csv', content: '[{"id":1,"role":"admin"},{"id":2,"role":"viewer"}]', expectedFormat: 'json', expectedConfidence: 'high' },
  { name: 'json-dirty', tool: 'json-minify', content: '{\n  // team config\n  "name": "DataForge",\n  "tags": ["json",],\n}', expectedFormat: 'json', expectedConfidence: 'high' },
  { name: 'json-broken', tool: 'json-diff', content: '{"left": 1,,}', expectedFormat: 'json', expectedConfidence: 'high', expectParseError: true },
  { name: 'yaml-mapping', tool: 'yaml-viewer', content: 'server:\n  port: 8080\n  host: localhost', expectedFormat: 'yaml', expectedConfidence: 'low' },
  { name: 'yaml-list', tool: 'yaml-to-json', content: '- json\n- yaml\n- toml', expectedFormat: 'yaml', expectedConfidence: 'low' },
  { name: 'toml-kv', tool: 'toml-to-json', content: 'title = "DataForge config"\n\n[server]\nport = 8080', expectedFormat: 'toml', expectedConfidence: 'high' },
  { name: 'toml-table-first', tool: 'toml-to-yaml', content: '[database]\nhost = "localhost"\nport = 5432', expectedFormat: 'toml', expectedConfidence: 'high' },
  { name: 'xml-valid', tool: 'xml-formatter', content: '<?xml version="1.0" encoding="UTF-8"?><note><to>You</to></note>', expectedFormat: 'xml', expectedConfidence: 'high' },
  { name: 'xml-broken', tool: 'xml-to-json', content: '<note><to>x</note>', expectedFormat: 'xml', expectedConfidence: 'high', expectParseError: true },
  { name: 'url-query', tool: 'url-encoder', content: 'name=Data%20Forge&tool=workbench', expectedFormat: 'text', expectedConfidence: 'low' },
  { name: 'base64', tool: 'base64', content: 'SGVsbG8gRGF0YUZvcmdlIQ==', expectedFormat: 'text', expectedConfidence: 'low' },
  { name: 'html-entities', tool: 'html-entities', content: '&lt;div&gt;DataForge&lt;/div&gt;', expectedFormat: 'text', expectedConfidence: 'low' },
  { name: 'jwt', tool: 'jwt-parser', content: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', expectedFormat: 'text', expectedConfidence: 'low' },
  // CSV is never auto-detected (decision A5): manual selection or file import only
  { name: 'csv', tool: 'json-to-csv', content: 'name,role\nAlice,admin\nBob,viewer', expectedFormat: 'text', expectedConfidence: 'low' },
  { name: 'prose', tool: 'text-diff', content: 'The quick brown fox\njumps over the lazy dog', expectedFormat: 'text', expectedConfidence: 'low' },
  // String-encoded JSON is "text" to the detector; the decode banner (M7) handles it
  { name: 'encoded-json-string', tool: 'workbench', content: scenarioAInput, expectedFormat: 'text', expectedConfidence: 'low' },
];

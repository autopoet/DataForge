import { tool as jsonViewer } from './json-viewer';
import { tool as jsonMinify } from './json-minify';
import { tool as xmlFormatter } from './xml-formatter';
import { tool as yamlViewer } from './yaml-viewer';

import { tool as jsonToYaml } from './json-to-yaml-converter';
import { tool as yamlToJson } from './yaml-to-json-converter';
import { tool as jsonToToml } from './json-to-toml';
import { tool as tomlToJson } from './toml-to-json';
import { tool as jsonToXml } from './json-to-xml';
import { tool as xmlToJson } from './xml-to-json';
import { tool as jsonToCsv } from './json-to-csv';
import { tool as tomlToYaml } from './toml-to-yaml';
import { tool as yamlToToml } from './yaml-to-toml';

import { tool as jsonDiff } from './json-diff';
import { tool as textDiff } from './text-diff';

import { tool as urlEncoder } from './url-encoder';
import { tool as base64StringConverter } from './base64-string-converter';
import { tool as htmlEntities } from './html-entities';

import { tool as jwtParser } from './jwt-parser';
import { tool as httpStatusCodes } from './http-status-codes';
import { tool as workbench } from './workbench';
import { tool as typeGenerator } from './type-generator';
import type { ToolCategory } from './tools.types';

export const toolsByCategory: ToolCategory[] = [
  {
    name: 'workbench',
    components: [workbench],
  },
  {
    name: 'generation',
    components: [typeGenerator],
  },
  {
    name: 'data-formatting',
    components: [jsonViewer, jsonMinify, xmlFormatter, yamlViewer],
  },
  {
    name: 'data-conversion',
    components: [
      jsonToYaml,
      yamlToJson,
      jsonToToml,
      tomlToJson,
      jsonToXml,
      xmlToJson,
      jsonToCsv,
      tomlToYaml,
      yamlToToml,
    ],
  },
  {
    name: 'diff',
    components: [jsonDiff, textDiff],
  },
  {
    name: 'encoding',
    components: [urlEncoder, base64StringConverter, htmlEntities],
  },
  {
    name: 'api',
    components: [jwtParser, httpStatusCodes],
  },
];

export const tools = toolsByCategory.flatMap(({ components }) => components);
export const toolsWithCategory = toolsByCategory.flatMap(({ components, name }) =>
  components.map(tool => ({ category: name, ...tool })),
);

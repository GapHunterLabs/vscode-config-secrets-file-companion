/**
 * Pure text scanner -- no `vscode` dependency. Ported from the
 * IntelliJ-family config-secrets-file-companion's ConfigLineScanner
 * (already plain regex, zero PSI dependency in the original).
 *
 * Covers `.properties`/`.env` (`key=value` or `key = value`) and
 * simple YAML (`key: value`, top-level or nested -- indentation
 * doesn't affect matching). Comments (`#` at line start, after
 * trimming) are skipped.
 *
 * v0.1 scope, honestly noted (same as the original): single-line
 * `key: value`/`key=value` pairs only -- YAML block scalars (`|`,
 * `>`), multi-line values, and quoted values containing an escaped
 * delimiter aren't specially handled (a quoted value is scanned
 * including its quotes, which the entropy heuristic tolerates fine
 * in practice).
 */

import { scanLiteral, SecretFinding } from './secretDetector';

export interface ConfigSecretMatch {
  key: string;
  finding: SecretFinding;
  line: number; // 1-based
  valueStartCol: number; // 0-based
  valueEndCol: number; // 0-based, exclusive
}

const PROPERTIES_OR_ENV_LINE = /^([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/;
// 'd' flag (hasIndices): match.indices[3] gives the exact [start, end]
// offset of the value group within rawLine, needed because the value
// isn't reliably findable via indexOf alone (it could legitimately
// repeat earlier in the line).
const YAML_LINE = /^(\s*)([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s+(.+)$/d;

export function scan(text: string): ConfigSecretMatch[] {
  const results: ConfigSecretMatch[] = [];
  const lines = text.split('\n');

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;

    const match = propertiesOrEnvMatch(rawLine, index + 1) ?? yamlMatch(rawLine, index + 1);
    if (match) results.push(match);
  });

  return results;
}

function propertiesOrEnvMatch(rawLine: string, line: number): ConfigSecretMatch | null {
  const trimmedLine = rawLine.trim();
  const match = PROPERTIES_OR_ENV_LINE.exec(trimmedLine);
  if (!match) return null;
  const key = match[1];
  const value = match[2].trim();
  if (value === '') return null;
  const finding = scanLiteral(value, key);
  if (!finding) return null;

  const leadingWs = rawLine.length - rawLine.trimStart().length;
  const valueOffsetInTrimmed = trimmedLine.indexOf(value, key.length);
  if (valueOffsetInTrimmed < 0) return null;
  const valueStartCol = leadingWs + valueOffsetInTrimmed;
  return { key, finding, line, valueStartCol, valueEndCol: valueStartCol + value.length };
}

function yamlMatch(rawLine: string, line: number): ConfigSecretMatch | null {
  const match = YAML_LINE.exec(rawLine);
  if (!match) return null;
  const key = match[2];
  const rawValue = match[3];
  const value = rawValue.trim();
  if (value === '' || value === '|' || value === '>') return null;
  const finding = scanLiteral(value, key);
  if (!finding) return null;

  // @ts-expect-error -- `indices` exists at runtime with the 'd' flag; not in the default RegExpMatchArray type.
  const [groupStart]: [number, number] = match.indices[3];
  const trimmedLeadingLen = rawValue.length - rawValue.trimStart().length;
  const valueStartCol = groupStart + trimmedLeadingLen;
  return { key, finding, line, valueStartCol, valueEndCol: valueStartCol + value.length };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan } from '../configLineScanner';
import { scanLiteral, shannonEntropyBitsPerChar } from '../secretDetector';

// Built by concatenation, not a single literal -- same reason as the
// Kotlin catalog's own SecretDetectorTest.kt (and this project's own
// secret-scanner-cli tests): a literal-looking secret string in
// committed test code can trip GitHub's own push-protection scanner
// even when it's fake.
const fakeAwsKey = 'AKIA' + 'IOSFODNN7EXAMPLE';
const fakeGithubToken = 'ghp_' + 'a'.repeat(36);

test('scanLiteral detects a known AWS access key format', () => {
  const finding = scanLiteral(fakeAwsKey);
  assert.equal(finding?.kind, 'AWS_ACCESS_KEY');
});

test('scanLiteral detects a GitHub token format', () => {
  const finding = scanLiteral(fakeGithubToken);
  assert.equal(finding?.kind, 'GITHUB_TOKEN');
});

test('scanLiteral does not flag an obvious placeholder even with a secret-like key', () => {
  assert.equal(scanLiteral('changeme', 'password'), null);
  assert.equal(scanLiteral('your_api_key_here', 'api_key'), null);
});

test('shannonEntropyBitsPerChar is low for a repetitive string', () => {
  assert.ok(shannonEntropyBitsPerChar('aaaaaaaaaaaa') < 1);
});

test('scan detects an AWS key in .env-style unquoted properties syntax', () => {
  const hits = scan(`AWS_ACCESS_KEY_ID=${fakeAwsKey}\n`);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].finding.kind, 'AWS_ACCESS_KEY');
  assert.equal(hits[0].line, 1);
});

test('scan detects a GitHub token in properties syntax with spaces around =', () => {
  const hits = scan(`github.token = ${fakeGithubToken}\n`);
  assert.equal(hits.length, 1);
});

test('scan detects a secret in YAML key: value syntax', () => {
  const hits = scan(`database:\n  password: ${fakeAwsKey}\n`);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].key, 'password');
});

test('scan does not flag a plain non-secret config value', () => {
  const hits = scan('server.port=8080\nenvironment: production\n');
  assert.equal(hits.length, 0);
});

test('scan ignores comment lines', () => {
  const hits = scan(`# AWS_ACCESS_KEY_ID=${fakeAwsKey}\n`);
  assert.equal(hits.length, 0);
});

test('scan ignores blank lines', () => {
  const hits = scan('\n\n\nkey=value\n');
  assert.equal(hits.length, 0);
});

test('scan does not flag a YAML block scalar indicator', () => {
  const hits = scan('script: |\n  echo hello\n');
  assert.equal(hits.length, 0);
});

test('scan reports the correct 0-based column range for the value', () => {
  const hits = scan(`TOKEN=${fakeGithubToken}\n`);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].valueStartCol, 'TOKEN='.length);
  assert.equal(hits[0].valueEndCol, 'TOKEN='.length + fakeGithubToken.length);
});

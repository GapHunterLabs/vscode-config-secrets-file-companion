/**
 * Pure text-based secret detection -- no `vscode` dependency. Ported
 * from the IntelliJ-family config-secrets-file-companion's
 * SecretDetector.kt (itself already a manual copy of
 * api-security-companion's SecretDetector.kt, kept in sync by hand --
 * same deliberate trade-off documented there, extended here to a
 * third independent copy: this project's own `secret-scanner-cli`
 * (Kotlin/JVM) has yet another copy of the same logic, in TypeScript
 * form here since this is a VS Code extension. If the detection rules
 * change, mirror the change across all three by hand.
 *
 * Combines known credential-format signatures (AWS/GitHub/Slack/JWT/
 * PEM private keys/Stripe) with a variable-name + Shannon-entropy
 * heuristic for the generic "some secret assigned to a suspiciously-
 * named field" case that no fixed format covers.
 */

export interface SecretFinding {
  kind: string;
  description: string;
}

const AWS_ACCESS_KEY = /\b(AKIA|ASIA)[0-9A-Z]{16}\b/;
const GITHUB_TOKEN = /\bgh[pousr]_[A-Za-z0-9]{36,}\b/;
const SLACK_TOKEN = /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/;
const PRIVATE_KEY_HEADER = /-----BEGIN ((RSA|EC|OPENSSH|DSA|ENCRYPTED) )?PRIVATE KEY-----/;
const STRIPE_KEY = /\b[sr]k_(live|test)_[A-Za-z0-9]{20,}\b/;

const SECRET_LIKE_NAME = /(api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key|private[_-]?key)/i;

const OBVIOUS_PLACEHOLDER =
  /^(|changeme|change[_-]?me|todo|fixme|xxx+|your[_-].*|placeholder|example|test|dummy|<.*>|\$\{.*})$/i;

const MIN_ENTROPY_LENGTH = 12;
const MIN_ENTROPY_BITS_PER_CHAR = 3.3;

export function scanLiteral(value: string, variableNameHint: string | null = null): SecretFinding | null {
  const awsMatch = AWS_ACCESS_KEY.exec(value);
  if (awsMatch) return { kind: 'AWS_ACCESS_KEY', description: `Looks like an AWS access key ID (${awsMatch[0].slice(0, 8)}...)` };

  if (GITHUB_TOKEN.test(value)) return { kind: 'GITHUB_TOKEN', description: 'Looks like a GitHub personal access token' };
  if (SLACK_TOKEN.test(value)) return { kind: 'SLACK_TOKEN', description: 'Looks like a Slack API token' };
  if (JWT.test(value)) return { kind: 'JWT', description: 'Looks like a JWT (base64url header.payload.signature)' };
  if (PRIVATE_KEY_HEADER.test(value)) return { kind: 'PRIVATE_KEY', description: 'Contains a PEM private key block' };

  const stripeMatch = STRIPE_KEY.exec(value);
  if (stripeMatch) {
    return { kind: 'STRIPE_KEY', description: `Looks like a Stripe secret/restricted API key (${stripeMatch[0].slice(0, 11)}...)` };
  }

  if (variableNameHint !== null && SECRET_LIKE_NAME.test(variableNameHint) && looksLikeARealSecret(value)) {
    return {
      kind: 'GENERIC_HIGH_ENTROPY',
      description: `Assigned to a variable named '${variableNameHint}' and looks like a real credential, not a placeholder`,
    };
  }
  return null;
}

function looksLikeARealSecret(value: string): boolean {
  if (value.length < MIN_ENTROPY_LENGTH) return false;
  if (OBVIOUS_PLACEHOLDER.test(value.trim())) return false;
  if (new Set(value).size <= 2) return false;
  return shannonEntropyBitsPerChar(value) >= MIN_ENTROPY_BITS_PER_CHAR;
}

export function shannonEntropyBitsPerChar(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const length = value.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / length;
    entropy -= p * (Math.log(p) / Math.log(2));
  }
  return entropy;
}

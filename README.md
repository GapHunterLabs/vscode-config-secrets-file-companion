# Config Secrets File Companion (VS Code)

Flags a hardcoded secret (AWS access key, GitHub/Slack token, JWT, PEM
private key, Stripe key, or a high-entropy value assigned to a
secret-shaped key name) in `.properties`, `.env` (and its variants),
or `.yml`/`.yaml` files. No data leaves your editor.

**v0.1, pilot.** Part of the Gap Hunter Labs VS Code workstream,
ported from the IntelliJ-family `config-secrets-file-companion`.
Complements this workstream's own
[`secret-scanner-cli`](https://github.com/GapHunterLabs/secret-scanner-cli)
(a standalone CLI/GitHub Action, same detection engine) with live
in-editor diagnostics instead of a CI-time report — different UX for
the same underlying rules, not a duplicate: the CLI is for CI/batch
scans, this is for the moment you're typing a value into a config
file.

## What it does

Live, as you edit any config file matching `.env`/`.env.*`/
`*.properties`/`*.yml`/`*.yaml`: every `key = value`, `key=value`, or
YAML `key: value` line is checked. Flags:

- AWS access keys, GitHub/Slack tokens, JWTs, PEM private key blocks,
  Stripe secret/restricted keys — by format signature.
- Anything else assigned to a credential-shaped key name
  (`*_key`, `*secret*`, `*token*`, `*password*`, ...) that has real
  Shannon entropy (not an obvious placeholder like `changeme`/
  `your_key_here`/`<placeholder>`).

**v0.1 scope, honestly noted (same as the IntelliJ-family original):**
single-line `key: value`/`key=value` pairs only — YAML block scalars
(`|`, `>`) and multi-line values aren't specially handled. Files over
500,000 characters are skipped (avoids pathological cost on
generated/huge files).

## Privacy

See [PRIVACY.md](PRIVACY.md) — zero network calls, everything runs
against files already open in your editor.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).

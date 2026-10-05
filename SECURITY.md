# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability, please report it responsibly.

**DO NOT** open a public GitHub issue for security vulnerabilities.

### How to Report

1. Email: **security@noctura.io**
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment:** within 48 hours
- **Initial assessment:** within 5 business days
- **Fix/patch:** depends on severity, typically within 30 days

### Scope

The following are in scope:
- Wallet key management & derivation
- Transaction signing & broadcasting
- ZK proof generation & verification
- Authentication & session management
- Data storage & encryption

### Out of Scope

- Social engineering attacks
- Denial of service
- Issues in third-party dependencies (report upstream)

### Recognition

We appreciate responsible disclosure. Contributors who report valid vulnerabilities will be acknowledged (with permission) in our release notes.

## Dependency audit exceptions

CI fails on any high or critical `npm audit` advisory. Two narrowings exist, and both
are about what ships, never about how bad an advisory is:

- **App (root):** `scripts/audit-shipped.js` reports an advisory only when the package
  that carries it is in the Metro release bundle (read from its source map). A shipped
  package flagged only through a build-time dependency is printed as an info line.
- **Web (`web/`):** `web/scripts/check-audit.mjs` fails on every high or critical
  advisory except one listed in `web/audit-exceptions.json`.

An entry in `web/audit-exceptions.json` is a reviewed decision, not a mute button:

- **Only for advisories proven not to ship.** Before adding one, build `web/` and show
  from the source map that the package is not in `dist`. Record how in `reason`, and say
  why it cannot be fixed.
- **Specific.** One GHSA id on one package. If the same id starts to affect a different
  package, the gate fails.
- **Dated and owned.** `decidedBy` records who decided it and when. `reviewBy` is an ISO
  date. The day after it, the gate fails until someone checks again and either renews it
  with a new date or removes it.
- **Self-cleaning.** An exception that no longer matches any advisory (because it was
  fixed upstream or the dependency left the tree) fails as stale and must be deleted.

## Contact

- security@noctura.io
- licensing@noctura.io

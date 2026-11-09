# TOMORI common application

Both ICPM and PCPM use this shared application source. Instance configuration and deployment secrets remain in the infrastructure repository.

Upstream: Ingressi v2.10.0, commit `f9b7e42fc82f0f5a20c9d6d8d212327c7b981380` from https://github.com/ingres-si/ingressi.git.
The previous 15-patch series on v1.11.2 is consolidated and adapted to the asynchronous database facade and permission guards.

Preserved custom behavior:

- OAuth role synchronization from trusted claims and assigned access-list account protection.
- Authentik port, TLS identity and IPv6 handling; forward-auth browser nonce binding.
- Scoped Anubis controls, transactional settings and the supervised runtime without Docker access.
- TOMORI branding, local fonts, status pages, maintenance responses and error feedback.
- Tailnet-aware GeoIP attribution, request identifiers and client IP change compatibility.
- Reserved listener protection and shared images for both instance profiles.

`ANUBIS_PROTECTED_DOMAIN` enables the public profile. The internal profile leaves it empty. `CPM_EDGE_LABEL`, `CPM_FEEDBACK_UPSTREAM`, `BASE_URL` and `OAUTH_ISSUER` remain runtime settings.

Imported certificates and encrypted private keys remain in the existing database. The legacy encryption derivation labels are unchanged. Keep the existing session secret, database volumes and Cloudflare Full (strict) rule when deploying.

Build with `APP_VERSION=2.10.0+tomori.<patched-tree>` because the upstream tag's package metadata does not identify this release accurately. The web image uses Bun 1.4.4. The Caddy image uses Caddy 2.11.7 with the existing security dependency floor, including an explicit xcaddy replacement for golang.org/x/net v0.60.0.

Validation commands:

```sh
bun x tsc --noEmit
bun run test --maxWorkers=2
sh scripts/test-custom.sh
```

`scripts/db/verify-upgrade.ts` is an offline rehearsal tool. Run it against a disposable copy of each database with the original encryption environment. It verifies SQLite integrity, decrypts imported certificate keys, checks their public keys and writes a restricted Caddy document for validation. It does not apply configuration to a running Caddy server.

Production deployment requires database and Caddy-volume backups. Restore the pre-upgrade database along with the old image when rolling back after schema migration. See the infrastructure repository's upgrade report for the exact image identities and validation results.

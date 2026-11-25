#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Suites mock modules and databases: run each in an isolated Bun process.
for suite in tests/runtime/*.test.ts tests/runtime/*.test.tsx; do
  bun test "$suite"
done
bun tests/runtime/authentik-upstream.ts
bun tests/runtime/instance-profiles.ts

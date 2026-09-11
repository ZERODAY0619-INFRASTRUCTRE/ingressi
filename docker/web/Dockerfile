# syntax=docker/dockerfile:1.6

FROM oven/bun:1-slim AS base
WORKDIR /app

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
# --ignore-scripts skips native addon compilation (better-sqlite3 is a test-only devDep;
# production uses bun's built-in bun:sqlite which needs no compilation)
RUN --mount=type=cache,id=cpm-bun-install,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile --ignore-scripts

FROM deps AS builder
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/tmp/build.db
ENV DATABASE_URL=file:/tmp/build.db
# Application version baked into the UI/OpenAPI spec at build time (issue #259).
# Set by CI to the git tag (without the leading v) for release builds; when
# unset, next.config.mjs falls back to the package.json version.
ARG APP_VERSION
# Copy only web build inputs. Documentation, CI and Caddy changes do not
# invalidate the application build. Tests remain included for TypeScript checks.
COPY package.json bun.lock next.config.mjs next-env.d.ts postcss.config.mjs tsconfig.json proxy.ts drizzle.config.ts ./
COPY app ./app
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY tests ./tests
COPY drizzle ./drizzle
# Share the web build for both runtime profiles; persist Turbopack and
# Next.js incremental TypeScript data without shipping the cache in the image.
ARG BUILD_CACHE_SCOPE=shared
RUN --mount=type=cache,id=cpm-next-${BUILD_CACHE_SCOPE},target=/app/.next/cache,sharing=locked \
    bun run build && rm -f /tmp/build.db /tmp/build.db-shm /tmp/build.db-wal

FROM base AS runner
ARG PUID=10001
ARG PGID=10001

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

RUN (getent group ${PGID} && groupdel $(getent group ${PGID} | cut -d: -f1) || true) && \
    (getent passwd ${PUID} && userdel $(getent passwd ${PUID} | cut -d: -f1) || true) && \
    groupadd -g ${PGID} nodejs && \
    useradd -r -u ${PUID} -g nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

COPY --from=builder --chown=nextjs:nodejs /app/.next/server/instrumentation.js ./.next/server/instrumentation.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/instrumentation ./.next/server/instrumentation
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/chunks/ ./.next/server/chunks/
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

RUN mkdir -p /app/data /app/feedback && chown -R nextjs:nodejs /app/data /app/feedback

# Shared volume for the custom ACME CA root PEM (issue #192). The web container
# writes it here; Caddy mounts the same volume read-only. Mode 0777 so it stays
# writable regardless of which container (with differing UIDs) initializes the
# named volume first. The file only ever holds a public CA certificate.
RUN mkdir -p /acme-ca && chmod 0777 /acme-ca

COPY --chown=nextjs:nodejs docker/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
USER nextjs
ENTRYPOINT ["/entrypoint.sh"]

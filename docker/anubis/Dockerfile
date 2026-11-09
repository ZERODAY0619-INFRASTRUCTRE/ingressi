FROM ghcr.io/techarohq/anubis@sha256:8828275668b7bc675679f100970f9714f731388fbbf66ae94de8aca952e3fc4a AS anubis
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
COPY --from=anubis /ko-app/anubis /ko-app/anubis
WORKDIR /supervisor/docker/anubis
COPY docker/anubis/supervisor.ts ./supervisor.ts
COPY src/lib/anubis-options.ts /supervisor/src/lib/anubis-options.ts
RUN mkdir /control && chown 10001:10001 /control
USER 10001:10001
ENTRYPOINT ["bun", "/supervisor/docker/anubis/supervisor.ts"]

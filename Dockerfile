# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# Optional corporate/cloud CA: supplied as a BuildKit secret, never an image layer.
# Install, build and remove transient dependencies in one layer. Cache mounts
# retain download reuse without storing large intermediate dependency snapshots.
RUN --mount=type=secret,id=proxy_ca \
    --mount=type=cache,id=promospy-pnpm,target=/pnpm/store \
    --mount=type=cache,id=promospy-npm,target=/root/.npm \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm install --global pnpm@11.25.0 && \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store && \
    pnpm build && \
    mkdir -p /runtime/.next /runtime/scripts /runtime/data/search && \
    mv .next/standalone /runtime/.next/standalone && \
    cp package.json /runtime/package.json && \
    cp scripts/start.mjs scripts/test-container.mjs /runtime/scripts/ && \
    rm -rf node_modules .next

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    PROMO_SEARCH_DATA_DIR=/app/data/search
# A single runtime copy also avoids duplicating the complete filesystem for
# every tiny metadata layer on Docker engines using the vfs storage driver.
COPY --from=build --chown=node:node /runtime/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok||(await r.json()).status!=='ok')process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "scripts/start.mjs"]

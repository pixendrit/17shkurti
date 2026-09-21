# ---- build ----------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod

# ---- runtime --------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
ENV PORT=3000 DATABASE_URL=file:/app/data/hijeshi.db

# Migrate on boot so a deploy never lands on an out-of-date schema.
CMD ["sh", "-c", "node scripts/migrate.js && node build/index.js"]

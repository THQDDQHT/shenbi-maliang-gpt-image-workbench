FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3.14
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts/provision-qihua.ts ./scripts/provision-qihua.ts
COPY distribution/codex-marketplace ./distribution/codex-marketplace
COPY package.json ./
RUN mkdir -p /app/data && chown bun:bun /app/data
USER bun
ENV HOST=0.0.0.0 PORT=8787 GPT_IMAGE_DATA_DIR=/app/data
EXPOSE 8787
CMD ["bun", "server/index.ts"]

FROM oven/bun:1-alpine

WORKDIR /app

# Cache dependency layer
COPY package.json bun.lock* bunfig.toml ./
RUN bun install --frozen-lockfile || bun install

# Copy source
COPY . .

# Build assets if needed, then serve
RUN bun run build || true

ENV PORT=3000
ENV BACKEND_URL=http://backend:8000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "src/index.ts"]


FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
# Skip yt-dlp binary download — we use system yt-dlp installed in the runtime image
RUN YOUTUBE_DL_SKIP_DOWNLOAD=true npm ci
COPY . .
RUN npm run build && YOUTUBE_DL_SKIP_DOWNLOAD=true npm prune --omit=dev

# ──────────────────────────────────────────
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 curl ca-certificates && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
         -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/db/migrations ./src/db/migrations

RUN useradd -m app && chown -R app /app
USER app

EXPOSE 3334
CMD ["node", "dist/server.js"]

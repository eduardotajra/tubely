FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
# --ignore-scripts skips youtube-dl-exec preinstall (yt-dlp comes from system apt)
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

# ──────────────────────────────────────────
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-pip ca-certificates && \
    pip3 install --break-system-packages yt-dlp bgutil-ytdlp-pot-provider && \
    rm -rf /var/lib/apt/lists/* /root/.cache/pip

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/db/migrations ./src/db/migrations

RUN useradd -m app && chown -R app /app
USER app

EXPOSE 3334
CMD ["node", "dist/server.js"]

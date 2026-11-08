# NextMove production image. No npm dependencies are installed; the app uses Node built-ins only.
FROM node:22.13.1-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DATABASE_PATH=/data/nextmove.sqlite

WORKDIR /app
COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend

# SQLite lives on a mounted volume at /data so sessions survive restarts and redeploys.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-sqlite", "backend/server.mjs"]

# —— 构建前端 ——
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm install
COPY client client
RUN npm run build -w client

# —— 运行（Express 托管静态资源 + API + WebSocket）——
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    RESONANCE_DATA_DIR=/data \
    PORT=4000
COPY package.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm install --omit=dev
COPY server server
COPY --from=build /app/client/dist client/dist
VOLUME /data
EXPOSE 4000
CMD ["node", "server/index.js"]

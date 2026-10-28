FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Everything the server needs is bundled into build/, so the runtime
# image has no node_modules.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/app/data/app.db
COPY --from=build /app/package.json /app/server.js ./
COPY --from=build /app/build ./build
COPY --from=build /app/src/lib/server/proxy-headers.ts /app/src/lib/server/secure-compare.ts ./src/lib/server/
RUN mkdir -p /app/data && chown node /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# ---------- build stage: compile TypeScript ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- runtime stage: only prod deps + compiled JS ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY db ./db

USER node
EXPOSE 3000

# Apply pending SQL migrations (schema + triggers), then start the API
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src/ ./src/

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
RUN npm install --no-save --no-audit --no-fund tsx

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["npx", "tsx", "dist/index.js"]

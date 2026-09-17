FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TED_DATA_DIR=/app/data
# Không có hai dòng này, server standalone có thể chỉ lắng nghe ở localhost và
# reverse proxy của Dokploy sẽ không vào được.
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

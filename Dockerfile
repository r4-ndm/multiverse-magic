# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all source files and compile frontend with Vite
COPY . .
RUN npx vite build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2567

COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend, server, and character modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/client ./client
COPY --from=builder /app/scripts ./scripts

EXPOSE 2567

CMD ["node", "server/index.js"]

# --- Build Stage ---
# Use Node.js 20 Alpine as base image for lightweight build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (like bcrypt) and openssl for Prisma
RUN apk add --no-cache openssl make gcc g++ python3

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema first for generating client
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code and other files
COPY . .

# Build application
RUN npm run build

# --- Production Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# Install openssl for Prisma runtime compatibility in Alpine
RUN apk add --no-cache openssl

# Copy packages and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose backend port
EXPOSE 4000

# Run migrations and start NestJS app in production mode
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

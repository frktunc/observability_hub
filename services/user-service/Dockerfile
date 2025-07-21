# Stage 1: Build unified observability package
FROM node:18-alpine AS observability-builder
WORKDIR /observability
COPY packages/observability/package.json packages/observability/package-lock.json ./

RUN npm install
COPY packages/observability ./
RUN npm run build
RUN npm pack

# Stage 2: Build user-service
FROM node:18-alpine AS builder
WORKDIR /workspace

# Create the directory structure for the service
RUN mkdir -p services/user-service

# Copy the packed unified observability package to service directory
COPY --from=observability-builder /observability/observability-hub-observability-1.0.0.tgz ./services/user-service/

# Move to service directory for build
WORKDIR /workspace/services/user-service

# Copy package.json and install dependencies for user-service
COPY services/user-service/package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock

# Copy the rest of the source code
COPY services/user-service/src ./src
COPY services/user-service/tsconfig.json ./
COPY services/user-service/send-test-message.ts ./

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:18-alpine AS runner
WORKDIR /app

# Copy built code and production dependencies from the builder stage
COPY --from=builder /workspace/services/user-service/dist ./dist
COPY --from=builder /workspace/services/user-service/node_modules ./node_modules
COPY --from=builder /workspace/services/user-service/package.json ./package.json
COPY --from=builder /workspace/services/user-service/package-lock.json ./package-lock.json
COPY --from=builder /workspace/services/user-service/send-test-message.ts ./send-test-message.ts

EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "dist/index.js" ] 
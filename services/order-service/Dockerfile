# Stage 1: Build shared-middleware
FROM node:18-alpine AS shared-middleware-builder
WORKDIR /shared-middleware
COPY packages/shared-middleware/package.json packages/shared-middleware/package-lock.json ./
RUN npm install
COPY packages/shared-middleware ./
RUN npm run build
RUN npm pack

# Stage 2: Build log-client
FROM node:18-alpine AS log-client-builder
WORKDIR /log-client
COPY packages/log-client/package.json packages/log-client/package-lock.json ./
RUN npm install
COPY packages/log-client ./
RUN npm run build
RUN npm pack

# Stage 3: Build order-service
FROM node:18-alpine AS builder
WORKDIR /workspace

# Create the directory structure to match package.json relative paths
# package.json expects: ../../packages/shared-middleware/...
# So we need: workspace/services/order-service/ structure
RUN mkdir -p services/order-service packages/shared-middleware

# Copy the packed shared-middleware to the expected location
COPY --from=shared-middleware-builder /shared-middleware/observability-hub-shared-middleware-1.0.0.tgz ./packages/shared-middleware/

# Copy the packed log-client to service directory
COPY --from=log-client-builder /log-client/observability-hub-log-client-1.0.0.tgz ./services/order-service/

# Move to service directory for build
WORKDIR /workspace/services/order-service

# Copy package.json and install dependencies for order-service
COPY services/order-service/package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock

# Copy the rest of the source code
COPY services/order-service/src ./src
COPY services/order-service/tsconfig.json ./

# Build the application
RUN npm run build

# Stage 4: Production
FROM node:18-alpine AS runner
WORKDIR /app

# Copy built code and production dependencies from the builder stage
COPY --from=builder /workspace/services/order-service/dist ./dist
COPY --from=builder /workspace/services/order-service/node_modules ./node_modules
COPY --from=builder /workspace/services/order-service/package.json ./package.json
COPY --from=builder /workspace/services/order-service/package-lock.json ./package-lock.json

EXPOSE 8080
ENV NODE_ENV=production
CMD [ "node", "dist/index.js" ] 
# Stage 1: Build shared-middleware
FROM node:18-alpine AS shared-middleware-builder
WORKDIR /shared-middleware
COPY packages/shared-middleware/package.json packages/shared-middleware/package-lock.json ./
RUN npm install
COPY packages/shared-middleware ./
RUN npm run build
RUN npm pack

# Stage 2: Build product-service (no log-client dependency)
FROM node:18-alpine AS builder
WORKDIR /workspace

# Create the directory structure to match package.json relative paths
# package.json expects: ../../packages/shared-middleware/...
# So we need: workspace/services/product-service/ structure
RUN mkdir -p services/product-service packages/shared-middleware

# Copy the packed shared-middleware to the expected location
COPY --from=shared-middleware-builder /shared-middleware/observability-hub-shared-middleware-1.0.0.tgz ./packages/shared-middleware/

# Move to service directory for build
WORKDIR /workspace/services/product-service

# Copy package.json and install dependencies for product-service
COPY services/product-service/package*.json ./
RUN npm install --legacy-peer-deps --no-package-lock

# Copy the rest of the source code
COPY services/product-service/src ./src
COPY services/product-service/tsconfig.json ./

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:18-alpine AS runner
WORKDIR /app

# Copy built code and production dependencies from the builder stage
COPY --from=builder /workspace/services/product-service/dist ./dist
COPY --from=builder /workspace/services/product-service/node_modules ./node_modules
COPY --from=builder /workspace/services/product-service/package.json ./package.json
COPY --from=builder /workspace/services/product-service/package-lock.json ./package-lock.json

EXPOSE 8082
ENV NODE_ENV=production
CMD [ "node", "dist/index.js" ] 
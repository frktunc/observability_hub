# Stage 1: Build unified observability package
FROM node:18-alpine AS observability-builder
WORKDIR /observability
COPY packages/observability/package.json packages/observability/package-lock.json ./
RUN npm install
COPY packages/observability ./
RUN npm run build
RUN npm pack

# Stage 2: Build order-service
FROM node:18-alpine AS builder
WORKDIR /workspace

# Create the directory structure for the service
RUN mkdir -p services/order-service

# Copy the packed unified observability package to service directory
COPY --from=observability-builder /observability/observability-hub-observability-1.0.0.tgz ./services/order-service/

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

# Stage 3: Production
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
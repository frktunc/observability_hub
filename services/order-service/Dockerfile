# Stage 1: Build log-client
FROM node:18-alpine AS log-client-builder
WORKDIR /log-client
COPY packages/log-client/package.json packages/log-client/package-lock.json ./
RUN npm install
COPY packages/log-client ./
RUN npm run build
RUN npm pack

# Stage 2: Build order-service
FROM node:18-alpine AS builder
WORKDIR /app

# Copy the packed log-client from the previous stage
COPY --from=log-client-builder /log-client/observability-hub-log-client-1.0.0.tgz .

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
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

EXPOSE 8080
ENV NODE_ENV=production
CMD [ "node", "dist/index.js" ] 
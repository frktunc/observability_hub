# Temel imaj
FROM node:18-alpine AS builder

WORKDIR /app

# package.json ve package-lock.json'u kopyala
COPY services/order-service/package*.json ./

# Local dependency için log-client'i de kopyala
COPY packages/log-client ./packages/log-client

# Bağımlılıkları yükle
RUN npm install && npm run build

# Sadece production bağımlılıkları ve derlenmiş kodu içeren bir imaj oluştur
FROM node:18-alpine AS runner
WORKDIR /app

COPY services/order-service/dist ./dist
COPY services/order-service/package.json ./
COPY services/order-service/node_modules ./node_modules
COPY services/order-service/src/config ./src/config

EXPOSE 3002
ENV NODE_ENV=production
CMD ["npm", "start"] 
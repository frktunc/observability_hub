# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Docker katman önbelleğinden (cache) yararlanmak için önce bağımlılıkları kopyala
COPY services/order-service/package*.json ./
COPY packages/log-client ./packages/log-client

# Bağımlılıkları yükle
RUN npm install --legacy-peer-deps

# Şimdi kaynak kodunu kopyala
COPY services/order-service/src ./src
COPY services/order-service/tsconfig.json ./

# Uygulamayı derle
RUN npm run build

# --- Production Stage ---
FROM node:18-alpine AS runner
WORKDIR /app

# Derlenmiş kodları ve production bağımlılıklarını builder aşamasından kopyala
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
# Sembolik linkin çalışabilmesi için, işaret ettiği paketin kendisini de kopyalıyoruz.
COPY --from=builder /app/packages/log-client ./packages/log-client

EXPOSE 8080
ENV NODE_ENV=production
CMD [ "node", "dist/index.js" ] 
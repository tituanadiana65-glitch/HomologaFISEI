FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3003
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main"]
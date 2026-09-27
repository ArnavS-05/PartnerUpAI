FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8787 DATABASE_URL=file:/data/partnerup.db
EXPOSE 8787
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]

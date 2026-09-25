FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN cp src/db/schema.sql dist/db/schema.sql
EXPOSE 4000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/seed.js && node dist/server.js"]

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]

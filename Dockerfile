FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY api/ ./api/
COPY client/ ./client/

RUN npm install --ignore-scripts
RUN cd client && npm install && npm run build
RUN cd api && npm install && npx prisma generate

WORKDIR /app/api

EXPOSE 3000

RUN printf '#!/bin/sh\nnpx prisma migrate deploy\nnode src/index.js\n' > /start.sh && chmod +x /start.sh

ENTRYPOINT ["/start.sh"]

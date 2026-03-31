FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy api and client source
COPY api/ ./api/
COPY client/ ./client/

# Install root dependencies
RUN npm install --ignore-scripts

# Build client (React/Vite)
RUN cd client && npm install && npm run build

# Install api dependencies and generate Prisma client
RUN cd api && npm install && npx prisma generate

# Expose port
EXPOSE 3000

# Run migrations then start server
CMD cd api && npx prisma migrate deploy && node src/index.js

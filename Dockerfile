# Stage 1: Build Frontend
FROM node:18-alpine AS build-client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Create Production Server
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/
COPY --from=build-client /app/client/dist ./server/public

EXPOSE 3002
ENV PORT=3002
CMD ["node", "server/index.js"]

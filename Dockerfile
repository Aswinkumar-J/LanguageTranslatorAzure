# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Node.js backend
FROM node:20-alpine AS backend-build
WORKDIR /app/api
COPY api/package*.json ./
RUN npm install --production
COPY api/server.js ./

# Stage 3: Final Production Image
FROM node:20-alpine
WORKDIR /app

# Copy the built backend
COPY --from=backend-build /app/api /app/api

# Copy the built frontend
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Set working directory to the API since that's where we run the server
WORKDIR /app/api

# Expose port 3000
EXPOSE 3000

# Start the Node.js server
CMD ["npm", "start"]

FROM node:20-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Expose server port (default 5000)
EXPOSE 5000

# Start server using production entrypoint
CMD ["node", "index.js"]

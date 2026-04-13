# Use the official Node.js 18 image as the base
FROM node:18-alpine

# Install system dependencies required for Expo and native builds
RUN apk add --no-cache \
    bash \
    curl \
    git \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source
COPY . .

# Expose Expo dev server ports
# 19000: Expo DevTools / tunnel
# 19001: Metro bundler
# 19002: Expo web UI / inspector
EXPOSE 19000 19001 19002

# Start the Expo development server
CMD ["npm", "start"]

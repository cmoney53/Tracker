# Use the official Puppeteer image as a base
FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# Install missing system dependencies for WebGL and Software Rendering
RUN apt-get update && apt-get install -y \
    libgbm-dev \
    libasound2 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    mesa-utils \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
# Using --unsafe-perm=true helps avoid permission issues with post-install scripts
RUN npm install --unsafe-perm=true

# Copy the rest of the code
COPY . .

# Set environment variable to help Puppeteer find the installed Chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Run the bot
CMD ["node", "index.js"]

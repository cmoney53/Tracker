# 1. Start with the official Puppeteer image (highly recommended for 2026)
# This image already contains a stable Chrome and many dependencies.
FROM ghcr.io/puppeteer/puppeteer:latest

# 2. Switch to root to install software-rendering libraries
USER root

# 3. Install Mesa and GBM libraries
# These are essential for "SwiftShader" (Software WebGL) to work on Render.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libgbm-dev \
    mesa-utils \
    && rm -rf /var/lib/apt/lists/*

# 4. Set the working directory
WORKDIR /app

# 5. Copy package files first
# This speeds up future builds by only reinstalling packages if they change.
COPY package*.json ./

# 6. Install dependencies
# We removed --unsafe-perm to stop the npm warning. 
# Puppeteer's base image handles permissions correctly.
RUN npm install

# 7. Copy your bot code (index.js, etc.)
COPY . .

# 8. Set the path to the pre-installed Chrome
# This prevents Puppeteer from trying to download a second browser.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 9. Force the OS to use software rendering for any GL calls
ENV LIBGL_ALWAYS_SOFTWARE=1

# 10. Start the bot
CMD ["node", "index.js"]

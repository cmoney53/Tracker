# 1. Official Puppeteer image has Chrome pre-installed
FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# 2. Install Mesa libraries for Software WebGL (SwiftShader)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libgbm-dev \
    mesa-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 3. Use the latest version to avoid deprecation warnings
COPY package*.json ./
RUN npm install puppeteer@latest

# 4. Copy your project files
COPY . .

# 5. DO NOT set a manual path. Puppeteer finds it automatically in this image.
# We just force the software renderer at the OS level.
ENV LIBGL_ALWAYS_SOFTWARE=1

CMD ["node", "index.js"]

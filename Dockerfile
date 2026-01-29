FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Copy dependency files
COPY package*.json ./
# This bypasses the hang and skips the broken Chrome download step
RUN npm install puppeteer@latest --unsafe-perm=true

# Copy the rest of the code
COPY . .

# Run the bot
CMD ["node", "index.js"]

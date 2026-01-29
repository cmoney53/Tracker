FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Copy dependency files
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Run the bot
CMD ["node", "index.js"]

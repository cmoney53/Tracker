const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Forces the browser to download into the project folder
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};

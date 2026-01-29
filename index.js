const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 1. MONITORING SERVER
const PORT = process.env.PORT || 10000;
let lastScreenshot = null;

http.createServer(async (req, res) => {
    if (req.url === '/screenshot') {
        if (!lastScreenshot) return res.end("Bot starting... refresh in 30s");
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(lastScreenshot);
    } else {
        res.end("Bot is Online. Visit /screenshot");
    }
}).listen(PORT);

// 2. CONFIG
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/w-1CqdGdAXpS-fxZL6nSpVXc';

// HELPER: Finds the Chrome executable inside the local cache
function getChromePath() {
    const base = path.join(__dirname, '.cache', 'puppeteer', 'chrome');
    if (!fs.existsSync(base)) return null;
    const folders = fs.readdirSync(base);
    if (folders.length === 0) return null;
    // Navigates the standard Puppeteer folder structure
    return path.join(base, folders[0], 'chrome-linux64', 'chrome');
}

async function runBot() {
    const chromePath = getChromePath();
    console.log(`🛠️ Found Chrome at: ${chromePath || "NOT FOUND"}`);

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath, // Uses the local project browser
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--use-gl=swiftshader',
                '--enable-unsafe-swiftshader',
                '--enable-webgl',
                '--ignore-gpu-blocklist'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        setInterval(async () => {
            try { lastScreenshot = await page.screenshot(); } catch (e) {}
        }, 5000);

        console.log("🔗 Logging in...");
        await page.goto('https://drednot.io', { waitUntil: 'networkidle2' });
        await page.evaluate((key) => {
            localStorage.setItem('drednot_anon_id', key);
            localStorage.setItem('drednot_backup_id', key);
        }, ANON_KEY);

        console.log("🚀 Joining Ship...");
        await page.goto(INVITE_URL, { waitUntil: 'networkidle2' });

        await new Promise(r => setTimeout(r, 45000));
        await page.mouse.click(640, 360); 
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));
        await page.keyboard.press('Enter');

        console.log("📡 Starting Radar...");
        while (browser.isConnected()) {
            await updateRadar(page);
            await new Promise(r => setTimeout(r, 30000));
        }

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        setTimeout(runBot, 20000);
    }
}

async function updateRadar(page) {
    try {
        const data = await page.evaluate(() => {
            if (!window.game || !window.game.world) return null;
            const ents = window.game.world.entities;
            let ships = [];
            for (let id in ents) {
                const e = ents[id];
                if (e && (e.type === 'ship' || e.clazz === 'Ship')) {
                    ships.push(`${e.name || 'Ship'}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
            }
            return ships.length > 0 ? ships.slice(0, 3).join(' | ') : "Clear";
        });

        if (data) {
            await page.evaluate((msg) => {
                const btn = document.getElementById("motd-edit-button");
                const input = document.getElementById("motd-edit-text");
                const save = document.querySelector("#motd-edit .btn-green");
                if (btn && input && save) {
                    btn.click();
                    input.value = `Radar: ${msg}`;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    save.click();
                }
            }, data);
            console.log("📡 MOTD Updated.");
        }
    } catch (e) {}
}

runBot();

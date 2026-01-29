const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 1. MONITORING SERVER (Keeps Render service "alive")
const PORT = process.env.PORT || 10000;
let lastScreenshot = null;

http.createServer(async (req, res) => {
    if (req.url === '/screenshot') {
        if (!lastScreenshot) return res.end("Bot is booting... refresh in 30s.");
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(lastScreenshot);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Bot Status: Running</h1><p><a href="/screenshot">View Live Screen</a></p>');
    }
}).listen(PORT);

// 2. CONFIGURATION
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/w-1CqdGdAXpS-fxZL6nSpVXc';

// HELPER: Locates the Chrome binary in the local cache
function getChromePath() {
    const base = path.join(__dirname, '.cache', 'puppeteer', 'chrome');
    if (!fs.existsSync(base)) return null;
    const folders = fs.readdirSync(base);
    if (folders.length === 0) return null;
    return path.join(base, folders[0], 'chrome-linux64', 'chrome');
}

async function runBot() {
    const chromePath = getChromePath();
    console.log(`🛠️ Launching Chrome from: ${chromePath}`);

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--use-gl=swiftshader',
                '--enable-unsafe-swiftshader',
                '--enable-webgl',
                '--ignore-gpu-blocklist',
                '--disable-web-security'
            ]
        });

        const page = await browser.newPage();
        
        // --- TIMEOUT FIXES ---
        // Sets timeout to 0 (infinity) to prevent "Navigation Timeout" on slow loads
        await page.setDefaultNavigationTimeout(0); 
        await page.setDefaultTimeout(0); 
        
        await page.setViewport({ width: 1280, height: 720 });

        // Screenshot loop for monitoring
        setInterval(async () => {
            try { lastScreenshot = await page.screenshot(); } catch (e) {}
        }, 5000);

        // STEP 1: AUTHENTICATION
        console.log("🔗 Logging in...");
        await page.goto('https://drednot.io', { waitUntil: 'domcontentloaded' });
        await page.evaluate((key) => {
            localStorage.setItem('drednot_anon_id', key);
            localStorage.setItem('drednot_backup_id', key);
        }, ANON_KEY);

        // STEP 2: JOIN SHIP
        console.log("🚀 Navigating to ship...");
        await page.goto(INVITE_URL, { waitUntil: 'domcontentloaded' });

        // Wait for game engine to stabilize (Software rendering is slow)
        console.log("⏳ Initializing (60s)...");
        await new Promise(r => setTimeout(r, 60000));

        // STEP 3: SPAWN SEQUENCE
        console.log("⌨️ Clicking and Spawning...");
        await page.mouse.click(640, 360); 
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 5000));
        await page.keyboard.press('Enter');

        // STEP 4: RADAR TO MOTD LOOP
        console.log("📡 Radar Loop started.");
        while (browser.isConnected()) {
            await updateRadarMOTD(page);
            await new Promise(r => setTimeout(r, 30000)); // Every 30 seconds
        }

    } catch (err) {
        console.error("❌ CRASH:", err.message);
        setTimeout(runBot, 30000); // Wait 30s before restart
    }
}

async function updateRadarMOTD(page) {
    try {
        const radarData = await page.evaluate(() => {
            // Check if game engine is accessible
            if (!window.game || !window.game.world) return null;
            
            const entities = window.game.world.entities;
            let ships = [];

            for (let id in entities) {
                const e = entities[id];
                // Filters for other ships
                if (e && (e.type === 'ship' || e.clazz === 'Ship')) {
                    const name = e.name || "Unknown";
                    const x = Math.round(e.pos.x);
                    const y = Math.round(e.pos.y);
                    ships.push(`${name}: ${x},${y}`);
                }
            }
            // Return top 3 ships found
            return ships.length > 0 ? ships.slice(0, 3).join(' | ') : "Radar Clear";
        });

        if (radarData) {
            console.log("📡 Found:", radarData);
            // Inject radar data into the MOTD UI
            await page.evaluate((text) => {
                const editBtn = document.getElementById("motd-edit-button");
                const inputField = document.getElementById("motd-edit-text");
                const saveBtn = document.querySelector("#motd-edit .btn-green");

                if (editBtn && inputField && saveBtn) {
                    editBtn.click();
                    inputField.value = `📡 ${text}`;
                    inputField.dispatchEvent(new Event('input', { bubbles: true }));
                    saveBtn.click();
                }
            }, radarData);
        }
    } catch (e) {
        // Silent fail if game UI isn't ready
    }
}

runBot();

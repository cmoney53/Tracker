const puppeteer = require('puppeteer');
const http = require('http');

// 1. MONITORING SERVER
const PORT = process.env.PORT || 10000;
let lastScreenshot = null;

http.createServer(async (req, res) => {
    if (req.url === '/screenshot') {
        if (!lastScreenshot) return res.end("Bot is starting, refresh in 20s...");
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(lastScreenshot);
    } else {
        res.end("Bot Active. View /screenshot to see radar status.");
    }
}).listen(PORT);

// 2. CONFIG
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/w-1CqdGdAXpS-fxZL6nSpVXc';

async function runBot() {
    console.log("🛠️ Launching Bot (Native Mode + Radar)...");
    
    try {
        const browser = await puppeteer.launch({
            headless: "new",
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

        // Screenshot monitoring loop
        setInterval(async () => {
            try { lastScreenshot = await page.screenshot(); } catch (e) {}
        }, 5000);

        // STEP 1: AUTHENTICATION
        console.log("🔗 Setting up session...");
        await page.goto('https://drednot.io', { waitUntil: 'networkidle2' });
        await page.evaluate((key) => {
            localStorage.setItem('drednot_anon_id', key);
            localStorage.setItem('drednot_backup_id', key);
        }, ANON_KEY);

        // STEP 2: JOIN SHIP
        console.log("🚀 Navigating to ship...");
        await page.goto(INVITE_URL, { waitUntil: 'networkidle2' });

        // Wait for game engine (Software rendering is slow)
        await new Promise(r => setTimeout(r, 45000));

        // SPAWN
        console.log("⌨️ Spawning...");
        await page.mouse.click(640, 360); 
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));
        await page.keyboard.press('Enter');

        // STEP 3: RADAR TO MOTD LOOP
        console.log("📡 Starting Radar Loop...");
        while (browser.isConnected()) {
            await updateRadarMOTD(page);
            await new Promise(r => setTimeout(r, 30000)); // Update every 30 seconds
        }

    } catch (err) {
        console.error("❌ CRASH:", err.message);
        setTimeout(runBot, 20000);
    }
}

async function updateRadarMOTD(page) {
    try {
        const radarData = await page.evaluate(() => {
            if (!window.game || !window.game.world) return null;
            
            const entities = window.game.world.entities;
            let foundShips = [];

            for (let id in entities) {
                const e = entities[id];
                // Check if entity is a ship and not OUR ship (optional check)
                if (e && (e.type === 'ship' || e.clazz === 'Ship')) {
                    const name = e.name || "Unknown Ship";
                    const x = Math.round(e.pos.x);
                    const y = Math.round(e.pos.y);
                    foundShips.push(`${name} [${x}, ${y}]`);
                }
            }
            return foundShips.length > 0 ? foundShips.slice(0, 3).join(' | ') : "Radar Clear";
        });

        if (radarData) {
            console.log("📡 Radar Found:", radarData);
            await page.evaluate((text) => {
                const editBtn = document.getElementById("motd-edit-button");
                const textField = document.getElementById("motd-edit-text");
                const saveBtn = document.querySelector("#motd-edit .btn-green");

                if (editBtn && textField && saveBtn) {
                    editBtn.click();
                    textField.value = `RADAR: ${text}`;
                    textField.dispatchEvent(new Event('input', { bubbles: true }));
                    saveBtn.click();
                }
            }, radarData);
        }
    } catch (e) {
        console.log("📡 Radar scan skipped (Game busy)");
    }
}

runBot();

const puppeteer = require('puppeteer');
const http = require('http');

// 1. KEEP-ALIVE SERVER (Prevents Render from killing the bot)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Drednot Bot is active');
}).listen(PORT);

// 2. CONFIGURATION
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/JcuHzlW91Qd-z3tZ5HePVzfY';

async function main() {
    while (true) {
        try {
            await runBot();
        } catch (err) {
            console.error("❌ ERROR:", err.message);
            console.log("♻️ Restarting session in 15 seconds...");
            await new Promise(r => setTimeout(r, 15000));
        }
    }
}

async function runBot() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // --- STEP 1: DIRECT KEY INJECTION (FIXED) ---
    console.log("🔗 Loading Drednot...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2' });

    console.log("🔑 Injecting Account Key via LocalStorage...");
    await page.evaluate((key) => {
        // This sets the key directly in the browser memory
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
        // Force a page reload to apply the key
        window.location.reload();
    }, ANON_KEY);

    // Wait for reload
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log("✅ Key injected and page reloaded.");

    // --- STEP 2: JOIN SHIP ---
    console.log("🚢 Navigating to Ship Invite...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2' });

    console.log("⏳ Waiting for game to load...");
    await new Promise(r => setTimeout(r, 5000)); // Wait for assets

    // Try to click the Play button
    try {
        await page.waitForSelector('.btn-play', { timeout: 15000 });
        await page.click('.btn-play');
        console.log("🎮 Bot is in-game!");
    } catch (e) {
        console.log("⚠️ Play button not found, bot might already be in-game.");
    }

    // --- STEP 3: RADAR LOOP ---
    while (browser.isConnected()) {
        await updateRadar(page);
        await new Promise(r => setTimeout(r, 20000));
    }
}

async function updateRadar(page) {
    try {
        const shipData = await page.evaluate(() => {
            if (!window.game || !window.game.world) return null;
            const ents = window.game.world.entities;
            let spotted = [];
            for (let id in ents) {
                const e = ents[id];
                if (e && e.pos && (e.type === 'ship' || e.clazz === 'Ship')) {
                    spotted.push(`${e.name || 'Ship'}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
            }
            return spotted.slice(0, 3).join(' | ');
        });

        if (shipData) {
            console.log("📡 Radar Update:", shipData);
            await page.evaluate((text) => {
                // Try to find MOTD edit UI
                const editBtn = document.getElementById("motd-edit-button");
                const textField = document.getElementById("motd-edit-text");
                const saveBtn = document.querySelector("#motd-edit .btn-green");

                if (editBtn && textField && saveBtn) {
                    editBtn.click();
                    textField.value = `Radar: ${text}`;
                    textField.dispatchEvent(new Event('input', { bubbles: true }));
                    saveBtn.click();
                }
            }, shipData);
        }
    } catch (e) {
        console.log("Radar loop hiccup...");
    }
}

main();

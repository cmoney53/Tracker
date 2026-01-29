const puppeteer = require('puppeteer');
const http = require('http');

// 1. KEEP-ALIVE SERVER (Critical for Render Free Tier)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Drednot Radar is Online');
}).listen(PORT, () => {
    console.log(`🚀 Keep-alive server listening on port ${PORT}`);
});

// 2. CONFIGURATION
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/w-1CqdGdAXpS-fxZL6nSpVXc';

async function main() {
    while (true) {
        try {
            await runBot();
        } catch (err) {
            console.error("❌ ERROR:", err.message);
            console.log("♻️ Restarting session in 20 seconds...");
            await new Promise(r => setTimeout(r, 20000));
        }
    }
}

async function runBot() {
    console.log("🛠️ Launching Browser...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // --- STEP 1: LOGIN (HOMEPAGE) ---
    console.log("🔗 Connecting to Drednot home to apply credentials...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("🔑 Injecting Account Key...");
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);

    // --- STEP 2: AUTOMATIC JOIN ---
    console.log("🚀 Navigating to Invite Link...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Render is slow; give the game 20 seconds to load the 3D assets/ship data
    console.log("⏳ Initializing ship connection (20s)...");
    await new Promise(r => setTimeout(r, 20000));

    // Focus the center of the game and press Enter to "Spawn"
    console.log("⌨️ Pressing ENTER to join ship...");
    await page.mouse.click(640, 360); 
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.press('Enter');

    console.log("✅ Successfully on ship!");

    // --- STEP 3: RADAR LOOP ---
    // This updates the MOTD every 30 seconds with nearby ship locations
    while (browser.isConnected()) {
        await updateRadar(page);
        await new Promise(r => setTimeout(r, 30000)); 
    }
}

async function updateRadar(page) {
    try {
        const data = await page.evaluate(() => {
            if (!window.game || !window.game.world) return null;
            const ents = window.game.world.entities;
            let spotted = [];
            for (let id in ents) {
                const e = ents[id];
                // Look for other ships
                if (e && e.pos && (e.type === 'ship' || e.clazz === 'Ship')) {
                    spotted.push(`${e.name || 'Ship'}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
            }
            return spotted.length > 0 ? spotted.slice(0, 3).join(' | ') : "Scanning...";
        });

        if (data) {
            console.log("📡 Radar Update:", data);
            
            // Auto-update the ship's Motto (MOTD) with the data
            await page.evaluate((text) => {
                const editBtn = document.getElementById("motd-edit-button");
                const textField = document.getElementById("motd-edit-text");
                const saveBtn = document.querySelector("#motd-edit .btn-green");
                if (editBtn && textField && saveBtn) {
                    editBtn.click();
                    textField.value = `Radar: ${text}`;
                    textField.dispatchEvent(new Event('input', { bubbles: true }));
                    saveBtn.click();
                }
            }, data);
        }
    } catch (e) {
        // Silent retry if game is loading
    }
}

main();

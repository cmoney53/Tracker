const puppeteer = require('puppeteer');
const http = require('http');

// 1. KEEP-ALIVE SERVER
// This prevents Render from shutting down your bot due to inactivity.
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
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // --- STEP 1: LOGIN VIA HOME PAGE ---
    console.log("🔗 Connecting to Drednot home for login...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("🔑 Injecting Account Key...");
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);
    
    // --- STEP 2: JOIN VIA DIRECT INVITE ---
    console.log("🚀 Jumping directly to Sandim invite link...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("⏳ Waiting for game to initialize...");
    // We wait 15 seconds for the game assets and canvas to load in the background.
    await new Promise(r => setTimeout(r, 15000));

    console.log("⌨️ Pressing ENTER to join ship...");
    // Drednot uses the Enter key as a shortcut to join/spawn.
    // We press it twice to ensure it clears any overlays.
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1500));
    await page.keyboard.press('Enter');

    console.log("✅ Sequence complete. Waiting for world to load...");
    await new Promise(r => setTimeout(r, 20000));

    // --- STEP 3: RADAR LOOP ---
    while (browser.isConnected()) {
        await updateRadar(page);
        // We wait 30 seconds between updates to prevent Render's CPU from capping out.
        await new Promise(r => setTimeout(r, 30000)); 
    }
}

async function updateRadar(page) {
    try {
        const data = await page.evaluate(() => {
            // Check if the game engine is accessible in the window
            if (!window.game || !window.game.world) return null;
            
            const ents = window.game.world.entities;
            let spotted = [];
            
            for (let id in ents) {
                const e = ents[id];
                // Filter for ship entities with valid positions
                if (e && e.pos && (e.type === 'ship' || e.clazz === 'Ship')) {
                    spotted.push(`${e.name || 'Ship'}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
            }
            // Return the first 3 ships found to keep the MOTD clean
            return spotted.length > 0 ? spotted.slice(0, 3).join(' | ') : "Scanning...";
        });

        if (data) {
            console.log("📡 Radar Update:", data);
            
            // Attempt to update the in-game MOTD with the radar data
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
        console.log("Radar cycle skipped (Game loading or UI hidden).");
    }
}

main();

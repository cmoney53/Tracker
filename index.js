const puppeteer = require('puppeteer');
const http = require('http');

// 1. KEEP-ALIVE SERVER (For Render Free Tier)
// This tells Render the service is "healthy" so it doesn't restart it.
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Drednot Tracker is Running');
}).listen(PORT, () => {
    console.log(`🚀 Keep-alive server listening on port ${PORT}`);
});

// 2. CONFIGURATION
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/JcuHzlW91Qd-z3tZ5HePVzfY';
const UPDATE_INTERVAL = 25000; // 25 seconds (safe interval to avoid rate-limiting)

// 3. MAIN BOT ENGINE
async function main() {
    while (true) { // Auto-restart loop if browser crashes
        try {
            console.log("🛠️ Starting new browser session...");
            await runBot();
        } catch (err) {
            console.error("❌ Critical Error:", err.message);
            console.log("♻️ Restarting in 20 seconds...");
            await new Promise(r => setTimeout(r, 20000));
        }
    }
}

async function runBot() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--js-flags="--max-old-space-size=400"' // Helps stay under Render's 512MB RAM limit
        ]
    });

    const page = await browser.newPage();
    // Set a standard viewport so the game UI renders correctly
    await page.setViewport({ width: 1280, height: 720 });

    // --- STEP 1: LOGIN WITH ANON KEY ---
    console.log("🔗 Connecting to Drednot home for login...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("🔑 Restoring Account Key...");
    await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a, span, div'));
        const restoreLink = elements.find(el => el.innerText && el.innerText.includes('Restore old anonymous key'));
        if (restoreLink) restoreLink.click();
    });

    // Wait for the text input box to appear in the popup
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.type('input[type="text"]', ANON_KEY);
    
    // Click the "Submit" (green button)
    await page.click('.btn-green'); 
    console.log("✅ Key submitted.");
    await new Promise(r => setTimeout(r, 3000)); // Wait for session save

    // --- STEP 2: JOIN SHIP VIA INVITE ---
    console.log("🚢 Navigating to Ship Invite...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the big "Play" button
    await page.waitForSelector('.btn-play', { timeout: 20000 });
    await page.click('.btn-play');
    console.log("🎮 Bot is now in-game.");

    // --- STEP 3: RADAR & MOTD LOOP ---
    while (browser.isConnected()) {
        await updateRadarAndMOTD(page);
        await new Promise(r => setTimeout(r, UPDATE_INTERVAL));
    }
}

async function updateRadarAndMOTD(page) {
    try {
        // Search game memory for ship entities
        const shipData = await page.evaluate(() => {
            if (!window.game || !window.game.world) return null;
            
            const entities = window.game.world.entities;
            let spotted = [];
            
            for (let id in entities) {
                const e = entities[id];
                // Check for ships with names and valid positions
                if (e && e.pos && (e.type === 'ship' || e.clazz === 'Ship')) {
                    const name = e.name || "Unknown Ship";
                    const x = Math.round(e.pos.x);
                    const y = Math.round(e.pos.y);
                    spotted.push(`${name}: (${x}, ${y})`);
                }
            }
            // Return top 3 ships to keep MOTD length small
            return spotted.slice(0, 3).join(' | ');
        });

        if (shipData) {
            console.log("📡 Tracking:", shipData);

            // Automate the MOTD UI interaction using your provided IDs
            await page.evaluate((text) => {
                const editBtn = document.getElementById("motd-edit-button");
                const textField = document.getElementById("motd-edit-text");
                const saveBtn = document.querySelector("#motd-edit .btn-green");

                if (editBtn && textField && saveBtn) {
                    editBtn.click();
                    textField.value = `Radar: ${text}`;
                    // Trigger 'input' event so the game recognizes the text change
                    textField.dispatchEvent(new Event('input', { bubbles: true }));
                    saveBtn.click();
                }
            }, shipData);
        }
    } catch (e) {
        console.log("⚠️ Radar glitch (skipping cycle):", e.message);
    }
}

// Start the whole process
main();

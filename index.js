const puppeteer = require('puppeteer');
const http = require('http');

// 1. KEEP-ALIVE SERVER (For Render)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Drednot Bot is Online');
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

    // --- STEP 1: KEY INJECTION ---
    console.log("🔗 Connecting to Drednot...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("🔑 Injecting Account Key...");
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);
    
    // --- STEP 2: NAVIGATION & LOADING ---
    console.log("🚢 Heading to Ship Invite...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2', timeout: 90000 });

    console.log("⏳ Waiting for Game Assets (60s max)...");
    const playSelector = '.btn-play, button.btn-play, #join-btn';
    
    try {
        // Wait for the button to appear in the code
        await page.waitForSelector(playSelector, { visible: true, timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000)); // Extra 5s for the game to "settle"

        // Click the button via Page Context
        await page.click(playSelector);
        console.log("🎮 Play button clicked!");
    } catch (e) {
        console.log("⚠️ Play selector failed. Attempting Coordinate Click fallback...");
        // Fallback: Click the center-bottom area where the play button usually sits
        await page.mouse.click(640, 450); 
    }

    // Final check for entry
    await new Promise(r => setTimeout(r, 10000));
    console.log("✅ Bot should be in-game now.");

    // --- STEP 3: RADAR LOOP ---
    while (browser.isConnected()) {
        await updateRadar(page);
        await new Promise(r => setTimeout(r, 25000)); // 25s intervals
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
                if (e && e.pos && (e.type === 'ship' || e.clazz === 'Ship')) {
                    spotted.push(`${e.name || 'Ship'}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
            }
            return spotted.slice(0, 3).join(' | ');
        });

        if (data) {
            console.log("📡 Radar Update:", data);
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
        console.log("Radar loop failed, retrying...");
    }
}

main();

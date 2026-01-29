const puppeteer = require('puppeteer');
const http = require('http');

// 1. MONITOR SERVER
// This creates a web page you can visit to see the bot's screen.
let lastScreenshot = null;
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
    if (req.url === '/screenshot') {
        if (!lastScreenshot) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Bot is starting...</h1><p>Please refresh in 15 seconds.</p>');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(lastScreenshot);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Drednot Bot Monitor</h1><p>View the live screen here: <a href="/screenshot">/screenshot</a></p>');
    }
});

server.listen(PORT, () => console.log(`Monitor live on port ${PORT}`));

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

    // --- SCREENSHOT BACKGROUND THREAD ---
    // Updates the global variable every 3 seconds so you can watch live.
    setInterval(async () => {
        try {
            lastScreenshot = await page.screenshot();
        } catch (e) { /* ignore screenshot errors */ }
    }, 3000);

    // --- STEP 1: LOGIN ---
    console.log("🔗 Applying credentials...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2' });
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);

    // --- STEP 2: JOIN SHIP ---
    console.log("🚀 Navigating to Invite Link...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2' });

    console.log("⏳ Loading Game Engine (20s)... Check /screenshot for progress.");
    await new Promise(r => setTimeout(r, 20000));

    // Force focus and spawn
    console.log("⌨️ Pressing ENTER to join...");
    await page.mouse.click(640, 360); // Click center to focus
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.press('Enter');

    console.log("✅ Joined! Radar starting...");

    // --- STEP 3: RADAR LOOP ---
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
                if (e && e.pos && (e.type === 'ship' || e.clazz === 'Ship')) {
                    spotted.push(`${e.name || 'Ship'}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
            }
            return spotted.length > 0 ? spotted.slice(0, 3).join(' | ') : "Scanning...";
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
    } catch (e) { /* Game UI not ready yet */ }
}

main();

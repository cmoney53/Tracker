const puppeteer = require('puppeteer');
const http = require('http');

// 1. MONITOR & REMOTE CONTROL SERVER
let lastScreenshot = null;
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
    if (req.url === '/screenshot') {
        if (!lastScreenshot) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Bot Loading...</h1><p>Refresh in 15 seconds.</p>');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(lastScreenshot);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Bot Status: Online</h1><p><a href="/screenshot">View Live Screen</a></p>');
    }
});

server.listen(PORT);

// 2. CONFIGURATION
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/w-1CqdGdAXpS-fxZL6nSpVXc';

async function main() {
    while (true) {
        try {
            await runBot();
        } catch (err) {
            console.error("❌ ERROR:", err.message);
            await new Promise(r => setTimeout(r, 20000));
        }
    }
}

async function runBot() {
    console.log("🛠️ Launching with Software Rendering (SwiftShader)...");
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',                // No hardware GPU available
            '--use-gl=swiftshader',         // Force software rendering
            '--enable-unsafe-swiftshader',  // Needed for modern Chrome WebGL fallback
            '--enable-webgl',
            '--ignore-gpu-blocklist'        // Force bypass of hardware restrictions
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Background screenshot loop (Updates /screenshot every 4s)
    setInterval(async () => {
        try {
            lastScreenshot = await page.screenshot();
        } catch (e) {}
    }, 4000);

    // --- STEP 1: AUTHENTICATION ---
    console.log("🔗 Injecting Session Key...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);

    // --- STEP 2: NAVIGATION ---
    console.log("🚀 Moving to Invite Link...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Software rendering is slower. Wait 45s for the engine to initialize.
    console.log("⏳ Initializing Game (45s)... Check /screenshot to confirm loading.");
    await new Promise(r => setTimeout(r, 45000));

    // --- STEP 3: JOIN SEQUENCE ---
    console.log("⌨️ Sending Spawn Commands...");
    // 1. Click center to focus the game canvas
    await page.mouse.click(640, 360); 
    // 2. Press Enter to pass the server welcome screen
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    // 3. Press Enter again to Spawn
    await page.keyboard.press('Enter');

    console.log("✅ Join sequence complete. Starting Radar loop...");

    // --- STEP 4: RADAR LOOP ---
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
    } catch (e) {}
}

main();

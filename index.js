const puppeteer = require('puppeteer');
const http = require('http');

// 1. MONITOR SERVER
// Visit your Render URL + /screenshot to see the bot's screen.
let lastScreenshot = null;
const PORT = process.env.PORT || 10000;

http.createServer(async (req, res) => {
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
        res.end('<h1>Bot Live</h1><p>View: <a href="/screenshot">/screenshot</a></p>');
    }
}).listen(PORT);

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
    console.log("🛠️ Launching Browser with Software Rendering...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',                // Essential for servers
            '--use-gl=swiftshader',         // Force software-based WebGL
            '--enable-webgl',               // Ensure WebGL is allowed
            '--hide-scrollbars',
            '--mute-audio',
            '--ignore-gpu-blocklist'        // Force bypass of GPU requirement
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // BACKGROUND SCREENSHOT LOOP
    setInterval(async () => {
        try {
            lastScreenshot = await page.screenshot();
        } catch (e) {}
    }, 4000);

    // STEP 1: LOGIN
    console.log("🔗 Applying Session Key...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);

    // STEP 2: JOIN
    console.log("🚀 Navigating to Ship...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // ⏳ Software rendering is SLOW. We must wait longer for the "red box" to go away.
    console.log("⏳ Initializing (45s)... Check /screenshot to verify WebGL loaded.");
    await new Promise(r => setTimeout(r, 45000));

    // Automated Click & Spawn
    console.log("⌨️ Sending Join Command...");
    await page.mouse.click(640, 360); 
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.press('Enter');

    // STEP 3: RADAR LOOP
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
            console.log("📡 Radar:", data);
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

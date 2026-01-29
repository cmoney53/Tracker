const puppeteer = require('puppeteer');
const http = require('http');

// 1. MONITOR & REMOTE CONTROL SERVER
let lastScreenshot = null;
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
    // Check what the bot sees: tracker-1-ynsv.onrender.com/screenshot
    if (req.url === '/screenshot') {
        if (!lastScreenshot) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Loading...</h1><p>Wait 15s then refresh.</p>');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(lastScreenshot);
    } 
    // Force the bot to join: tracker-1-ynsv.onrender.com/join
    else if (req.url === '/join') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Command Sent: ENTER</h1>');
        console.log("⌨️ Manual Join triggered via URL");
        if (global.botPage) {
            await global.botPage.mouse.click(640, 360);
            await global.botPage.keyboard.press('Enter');
        }
    }
    else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Bot Control</h1><p><a href="/screenshot">View Screen</a> | <a href="/join">Force Join (Enter)</a></p>');
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
    console.log("🛠️ Launching Browser with Software Rendering...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',           // Essential to bypass the WebGL error
            '--use-gl=swiftshader',    // Forces CPU rendering
            '--enable-webgl',
            '--hide-scrollbars'
        ]
    });

    const page = await browser.newPage();
    global.botPage = page; 
    await page.setViewport({ width: 1280, height: 720 });

    // Background Screenshot Thread (Every 4 seconds)
    setInterval(async () => {
        try {
            lastScreenshot = await page.screenshot();
        } catch (e) {}
    }, 4000);

    // STEP 1: LOGIN
    console.log("🔗 Logging in...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2' });
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);

    // STEP 2: JOIN SHIP
    console.log("🚀 Navigating to Invite Link...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2' });

    console.log("⏳ Initializing (30s)... Check /screenshot to verify the error is gone.");
    await new Promise(r => setTimeout(r, 30000));

    // Automated Spawn Attempt
    await page.mouse.click(640, 360); 
    await page.keyboard.press('Enter');
    console.log("✅ Join sequence finished.");

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

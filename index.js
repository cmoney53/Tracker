const puppeteer = require('puppeteer');
const http = require('http');

// 1. STATUS MONITOR (URL/screenshot)
let lastScreenshot = null;
const PORT = process.env.PORT || 10000;

http.createServer(async (req, res) => {
    if (req.url === '/screenshot') {
        if (!lastScreenshot) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end('<h1>Loading...</h1><p>Wait 20s then refresh.</p>');
        }
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(lastScreenshot);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Bot Status: Running</h1><p><a href="/screenshot">View Screen</a></p>');
    }
}).listen(PORT);

// 2. CONFIG
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/w-1CqdGdAXpS-fxZL6nSpVXc';

async function main() {
    while (true) {
        try {
            await runBot();
        } catch (err) {
            console.error("❌ CRASH:", err.message);
            await new Promise(r => setTimeout(r, 20000));
        }
    }
}

async function runBot() {
    console.log("🛠️ Initializing Browser (Auto-detecting path)...");
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--use-gl=swiftshader',
            '--enable-unsafe-swiftshader', // Required for 2026 WebGL fallback
            '--enable-webgl',
            '--ignore-gpu-blocklist'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Live screenshot updates
    setInterval(async () => {
        try { lastScreenshot = await page.screenshot(); } catch (e) {}
    }, 5000);

    // STEP 1: LOGIN
    console.log("🔗 Logging in...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2' });
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);

    // STEP 2: JOIN SHIP
    console.log("🚀 Navigating to Invite...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2' });

    console.log("⏳ Initializing (45s)... Check /screenshot for 'red box' errors.");
    await new Promise(r => setTimeout(r, 45000));

    // Automated Spawn Sequence
    console.log("⌨️ Pressing Enter...");
    await page.mouse.click(640, 360); 
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.press('Enter');

    // STEP 3: RADAR LOOP
    while (browser.isConnected()) {
        try {
            const data = await page.evaluate(() => {
                if (!window.game || !window.game.world) return null;
                const ents = window.game.world.entities;
                let found = [];
                for (let id in ents) {
                    const e = ents[id];
                    if (e && e.type === 'ship') found.push(`${e.name}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
                return found.slice(0, 3).join(' | ');
            });
            if (data) console.log("📡 Radar:", data);
        } catch (e) {}
        await new Promise(r => setTimeout(r, 30000));
    }
}

main();

const puppeteer = require('puppeteer');

// Config - Using Environment Variables for safety
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const INVITE_URL = 'https://drednot.io/invite/JcuHzlW91Qd-z3tZ5HePVzfY';
const UPDATE_INTERVAL = 20000; // 20 seconds

async function main() {
    while (true) {
        try {
            await runBot();
        } catch (err) {
            console.error("CRITICAL ERROR:", err.message);
            console.log("Restarting in 15 seconds...");
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

    console.log("🔗 Opening Drednot...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2' });

    // --- LOGIN SEQUENCE ---
    console.log("🔑 Injecting Anon Key...");
    await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, span'));
        const restoreLink = links.find(el => el.textContent.includes('Restore old anonymous key'));
        if (restoreLink) restoreLink.click();
    });

    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.type('input[type="text"]', ANON_KEY);
    await page.click('.btn-green'); 
    await new Promise(r => setTimeout(r, 3000));

    // --- JOIN SHIP ---
    console.log("🚢 Navigating to Ship...");
    await page.goto(INVITE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.btn-play', { timeout: 15000 });
    await page.click('.btn-play');
    console.log("✅ In-game!");

    // --- RADAR LOOP ---
    while (browser.isConnected()) {
        await updateRadar(page);
        await new Promise(r => setTimeout(r, UPDATE_INTERVAL));
    }
}

async function updateRadar(page) {
    try {
        const data = await page.evaluate(() => {
            if (!window.game || !window.game.world) return null;
            const ents = window.game.world.entities;
            let found = [];
            for (let id in ents) {
                const e = ents[id];
                if (e && e.pos && (e.type === 'ship' || e.clazz === 'Ship')) {
                    found.push(`${e.name || 'Ship'}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
            }
            return found.slice(0, 3).join(' | ');
        });

        if (data) {
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
            console.log("📡 MOTD Updated:", data);
        }
    } catch (e) {
        console.log("Radar scan failed (retrying):", e.message);
    }
}

main();

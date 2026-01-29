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
const SHIP_ID = '4E10ED'; // Sandim Ship ID

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
            '--disable-gpu',
            '--window-size=1280,720'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // --- STEP 1: LOGIN ---
    console.log("🔗 Connecting to Drednot...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("🔑 Injecting Account Key...");
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);
    
    await page.reload({ waitUntil: 'networkidle2' });

    // --- STEP 2: SEARCH & JOIN SANDIM ---
    console.log(`🚢 Searching for Sandim {${SHIP_ID}}...`);
    
    // Give the UI time to load after reload
    await new Promise(r => setTimeout(r, 5000));

    try {
        // Find the search input by looking for any input field
        const searchInput = await page.waitForSelector('input', { timeout: 15000 });
        
        // Click and clear the input before typing
        await searchInput.click({ clickCount: 3 });
        await searchInput.type(SHIP_ID);
        console.log("⌨️ ID Typed. Filtering list...");

        await new Promise(r => setTimeout(r, 3000));

        // Attempt to find the ship card and click it
        const clickSuccess = await page.evaluate((id) => {
            const cards = Array.from(document.querySelectorAll('.ship-card, div, span'));
            const target = cards.find(c => c.innerText && c.innerText.includes(id));
            if (target) {
                target.click();
                return true;
            }
            return false;
        }, SHIP_ID);

        if (clickSuccess) {
            console.log("🎯 Ship card clicked.");
        } else {
            console.log("⚠️ Could not find card via text. Using keyboard to select...");
            await page.keyboard.press('Tab');
            await page.keyboard.press('ArrowDown');
        }

        // Final Join Sequence: Enter key is the most reliable way to trigger "Play"
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('Enter');
        console.log("🚀 Sent Enter command to join.");

    } catch (e) {
        console.log("⚠️ UI Interaction failed. Attempting brute-force Join...");
        await page.keyboard.press('Tab');
        await page.keyboard.type(SHIP_ID);
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
    }

    console.log("✅ Sequence complete. Waiting for game world...");
    // Render Free Tier needs a long time to load the actual game world
    await new Promise(r => setTimeout(r, 20000));

    // --- STEP 3: RADAR LOOP ---
    while (browser.isConnected()) {
        await updateRadar(page);
        // Wait 30 seconds between updates to avoid crashing the slow Render CPU
        await new Promise(r => setTimeout(r, 30000));
    }
}

async function updateRadar(page) {
    try {
        const radarData = await page.evaluate(() => {
            if (!window.game || !window.game.world) return null;
            const ents = window.game.world.entities;
            let spotted = [];
            for (let id in ents) {
                const e = ents[id];
                // Target other ships
                if (e && e.pos && (e.type === 'ship' || e.clazz === 'Ship')) {
                    spotted.push(`${e.name || 'Ship'}: ${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
                }
            }
            return spotted.length > 0 ? spotted.slice(0, 3).join(' | ') : "No ships in range";
        });

        if (radarData) {
            console.log("📡 Radar Update:", radarData);
            
            // Try to update MOTD
            await page.evaluate((text) => {
                const editBtn = document.getElementById("motd-edit-button");
                const textField = document.getElementById("motd-edit-text");
                const saveBtn = document.querySelector("#motd-edit .btn-green");

                if (editBtn && textField && saveBtn) {
                    editBtn.click();
                    textField.value = `RADAR: ${text}`;
                    textField.dispatchEvent(new Event('input', { bubbles: true }));
                    saveBtn.click();
                }
            }, radarData);
        }
    } catch (e) {
        console.log("Radar cycle skipped (Game loading or UI hidden).");
    }
}

main();

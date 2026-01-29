const puppeteer = require('puppeteer');
const http = require('http');

// 1. KEEP-ALIVE SERVER
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Drednot Radar is Online');
}).listen(PORT);

// 2. CONFIGURATION
const ANON_KEY = process.env.ANON_KEY || 'mpJSjS3N81osIeKsOEzikewb';
const SHIP_ID = '4E10ED'; // Your ship Sandim's ID

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

    // --- STEP 1: DIRECT KEY LOGIN ---
    console.log("🔗 Connecting to Drednot...");
    await page.goto('https://drednot.io', { waitUntil: 'networkidle2' });

    console.log("🔑 Injecting Account Key...");
    await page.evaluate((key) => {
        localStorage.setItem('drednot_anon_id', key);
        localStorage.setItem('drednot_backup_id', key);
    }, ANON_KEY);
    
    await page.reload({ waitUntil: 'networkidle2' });

    // --- STEP 2: SEARCH & JOIN SANDIM ---
    console.log(`🚢 Searching for Sandim {${SHIP_ID}}...`);
    
    try {
        // Wait for the search box (visible in your screenshot)
        const searchBoxSelector = 'input[placeholder="Search..."], .ship-list-search input, .sidebar input';
        await page.waitForSelector(searchBoxSelector, { timeout: 15000 });
        await page.type(searchBoxSelector, SHIP_ID);
        console.log("⌨️ Typed Ship ID into search...");

        await new Promise(r => setTimeout(r, 2000)); // Wait for list to filter

        // Find the ship card that contains the ID
        const clicked = await page.evaluate((targetId) => {
            const cards = Array.from(document.querySelectorAll('.ship-card'));
            const target = cards.find(c => c.innerText.includes(targetId));
            if (target) {
                target.click();
                return true;
            }
            return false;
        }, SHIP_ID);

        if (!clicked) throw new Error("Ship card not found after search.");
        console.log("🎯 Clicked Sandim card!");

        // Wait for the green "Play" button to appear on the card or popup
        await new Promise(r => setTimeout(r, 2000));
        await page.keyboard.press('Enter'); // Standard shortcut to join selected ship
        
        // Final fallback to click the 'btn-play' if Enter didn't work
        const playBtn = '.btn-play, .btn-green';
        await page.waitForSelector(playBtn, { visible: true, timeout: 5000 }).catch(() => {});
        await page.click(playBtn).catch(() => {});

    } catch (e) {
        console.log("⚠️ Search failed. Trying direct coordinate click on ship area...");
        await page.mouse.click(800, 570); // Right-side area where Sandim was in your pic
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('Enter');
    }

    console.log("✅ Should be entering game...");
    await new Promise(r => setTimeout(r, 10000));

    // --- STEP 3: RADAR LOOP ---
    while (browser.isConnected()) {
        await updateRadar(page);
        await new Promise(r => setTimeout(r, 25000));
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
                    // Filter out own ship if needed, but for now we list all
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
    } catch (e) { /* ignore loop errors */ }
}

main();

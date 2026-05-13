require("dotenv").config();

const cron = require("node-cron");

const fs = require("fs");

const path = require("path");

const config = require("./config");

const { generateDesign } = require("./design");

const { generateAllMockups } = require("./mockup");

const { generateListing, createListing, uploadMockupImages, uploadDigitalFile, publishListing

const { getNextTheme, markPublished, logSale } = require("./sheets");

const SHOP_NAME = "YourShopName"; // Change this

const TEMP_DIR = path.join(__dirname, "temp");

function cleanup(dir) {

if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

}

// ── MAIN PRODUCT PIPELINE ──────────────────────────────────────

async function runProductPipeline() {

console.log("\n Starting product pipeline...");

const outputDir = path.join(TEMP_DIR, `run_${Date.now()}`);

try {

// 1. Get next theme from Google Sheets

const { theme, productType, style, rowIndex } = await getNextTheme();

console.log(` Theme: "${theme}" | Type: ${productType}`);

// 2. Generate the design image

console.log(" Generating design...");

const { designPath, fileName, productType: resolvedType } = await generateDesign(theme, o

// 3. Generate 4 listing mockup images (free, no API needed)

console.log(" Creating mockups...");

const listing = await generateListing(theme, resolvedType || productType);

const mockupPaths = await generateAllMockups(designPath, { title: listing.title, shopName

// 4. Create draft Etsy listing

console.log(" Creating Etsy listing...");

const listingId = await createListing(listing);

// 5. Upload mockup images to listing

console.log(" Uploading mockups to Etsy...");

await uploadMockupImages(listingId, mockupPaths);// 6. Upload the design as the digital product file

console.log(" Attaching digital file...");

await uploadDigitalFile(listingId, designPath, `${fileName}.png`);

// 7. Publish listing live

console.log(" Publishing listing...");

await publishListing(listingId);

// 8. Mark as published in Google Sheets

await markPublished(rowIndex, listingId);

console.log(` Done! Listing #${listingId} is live on Etsy.\n`);

} catch (err) {

console.error(" Pipeline error:", err.message);

} finally {

cleanup(outputDir);

}

}

// ── SALES MONITOR ──────────────────────────────────────────────

async function runSalesMonitor() {

console.log(" Checking for new sales...");

try {

const orders = await getNewOrders();

if (orders.length === 0) {

console.log("No new orders.");

return;

}

for (const order of orders) {

await notifyBuyer(order);

await logSale(order);

}

console.log(` Processed ${orders.length} order(s).`);

} catch (err) {

console.error(" Sales monitor error:", err.message);

}

}

// ── SCHEDULER ─────────────────────────────────────────────────

const runOnce = process.argv.includes("--once");

if (runOnce) {

// Run immediately once (for testing)

runProductPipeline().then(() => runSalesMonitor());

} else {

console.log(" Scheduler running...");console.log(" Products: daily at 9am");

console.log(" Sales: every hour\n");

// New product every day at 9am

cron.schedule("0 9 * * *", runProductPipeline);

// Check sales every hour

cron.schedule("0 * * * *", runSalesMonitor);

// Run sales check immediately on start

runSalesMonitor();

}


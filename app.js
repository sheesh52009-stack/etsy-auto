const https = require("https");
const fs = require("fs");
const path = require("path");

// ─── CONFIG ───────────────────────────────────────────
const CONFIG = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ETSY_API_KEY: process.env.ETSY_API_KEY,
  ETSY_SHOP_ID: process.env.ETSY_SHOP_ID,
  PRICE: 4.99,
};

const DATA_FILE = path.join(__dirname, "data.json");

// ─── DATA STORAGE ─────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const starter = {
      themes: [
        { theme: "Funny Cat Mom", type: "Digital Clipart", style: "Bold Typography", status: "Pending" },
        { theme: "Boho Wildflowers", type: "Wall Art Print", style: "Watercolor", status: "Pending" },
        { theme: "Cottagecore Frogs", type: "Digital Clipart", style: "Illustrated", status: "Pending" },
        { theme: "Dark Academia Books", type: "Printable Poster", style: "Line Art", status: "Pending" },
        { theme: "Celestial Moon Stars", type: "Digital Clipart", style: "Boho/Watercolor", status: "Pending" },
        { theme: "Mushroom Forest Magic", type: "Wall Art Print", style: "Cottagecore", status: "Pending" },
        { theme: "Halloween Spooky Ghosts", type: "Digital Clipart", style: "Illustrated", status: "Pending" },
        { theme: "Retro Sunset Beach", type: "Wall Art Print", style: "Retro/Vintage", status: "Pending" },
        { theme: "Coquette Pink Bows", type: "Digital Clipart", style: "Maximalist", status: "Pending" },
        { theme: "Crystal Healing Spiritual", type: "Digital Clipart", style: "Boho/Watercolor", status: "Pending" },
      ],
      sales: [],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(starter, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getNextTheme() {
  const data = loadData();
  const next = data.themes.find((t) => t.status === "Pending");
  if (!next) throw new Error("No pending themes in data.json");
  return { ...next, index: data.themes.indexOf(next) };
}

function markPublished(index, listingId) {
  const data = loadData();
  data.themes[index].status = "Published";
  data.themes[index].listingId = listingId;
  data.themes[index].date = new Date().toISOString().split("T")[0];
  saveData(data);
}

// ─── HTTP HELPER ──────────────────────────────────────
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        try { resolve({ status: res.statusCode, body: JSON.parse(raw.toString()) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── STEP 1: GENERATE IMAGE PROMPT ────────────────────
async function generateImagePrompt(theme, type, style) {
  console.log("Generating image prompt...");
  const res = await request(
    {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}` },
    },
    {
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a print-on-demand graphic designer. Write DALL-E image prompts. Return only the prompt text, nothing else." },
        { role: "user", content: `Write a DALL-E image generation prompt for a ${type} with theme: "${theme}", style: ${style}. Requirements: centered design, white background, high contrast, no text, print-ready, clean lines.` },
      ],
      max_tokens: 200,
    }
  );
  return res.body.choices[0].message.content.trim();
}

// ─── STEP 2: GENERATE IMAGE ───────────────────────────
async function generateImage(prompt, outputDir) {
  console.log("Generating image with DALL-E...");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const res = await request(
    {
      hostname: "api.openai.com",
      path: "/v1/images/generations",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}` },
    },
    { model: "dall-e-3", prompt, n: 1, size: "1024x1024", quality: "standard" }
  );

  const imageUrl = res.body.data[0].url;
  const imgPath = path.join(outputDir, "design.png");

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(imgPath);
    https.get(imageUrl, (r) => { r.pipe(file); file.on("finish", () => { file.close(); resolve(); }); }).on("error", reject);
  });

  console.log("Image saved.");
  return imgPath;
}

// ─── STEP 3: GENERATE LISTING COPY ───────────────────
async function generateListingCopy(theme, type, style) {
  console.log("Generating Etsy listing copy...");
  const res = await request(
    {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}` },
    },
    {
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an Etsy SEO expert. Return only valid JSON, no extra text." },
        { role: "user", content: `Write an Etsy listing for a digital download ${type} with theme "${theme}" in ${style} style. Return ONLY this JSON: {"title":"SEO title under 140 chars","description":"150 word description mentioning instant download, file type PNG, 1024x1024, commercial use","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"]}` },
      ],
      max_tokens: 500,
    }
  );
  const raw = res.body.choices[0].message.content.trim().replace(/```json|```/g, "");
  return JSON.parse(raw);
}

// ─── STEP 4: CREATE ETSY LISTING ─────────────────────
async function createEtsyListing(listing) {
  console.log("Creating Etsy listing...");
  const body = JSON.stringify({
    title: listing.title,
    description: listing.description,
    price: CONFIG.PRICE,
    quantity: 999,
    taxonomy_id: 2078,
    type: "download",
    is_digital: true,
    tags: listing.tags,
    who_made: "i_did",
    when_made: "made_to_order",
    state: "draft",
  });

  const res = await request(
    {
      hostname: "openapi.etsy.com",
      path: `/v3/application/shops/${CONFIG.ETSY_SHOP_ID}/listings`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CONFIG.ETSY_API_KEY,
        Authorization: `Bearer ${CONFIG.ETSY_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );

  if (!res.body.listing_id) throw new Error("Etsy listing failed: " + JSON.stringify(res.body));
  console.log("Listing created: #" + res.body.listing_id);
  return res.body.listing_id;
}

// ─── STEP 5: UPLOAD IMAGE TO ETSY ────────────────────
async function uploadImageToEtsy(listingId, imagePath) {
  console.log("Uploading image to Etsy...");
  const imageData = fs.readFileSync(imagePath);
  const boundary = "----FormBoundary" + Date.now();
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="design.png"\r\nContent-Type: image/png\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, imageData, footer]);

  await request(
    {
      hostname: "openapi.etsy.com",
      path: `/v3/application/shops/${CONFIG.ETSY_SHOP_ID}/listings/${listingId}/images`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "x-api-key": CONFIG.ETSY_API_KEY,
        Authorization: `Bearer ${CONFIG.ETSY_API_KEY}`,
        "Content-Length": body.length,
      },
    },
    body
  );
  console.log("Image uploaded.");
}

// ─── STEP 6: UPLOAD DIGITAL FILE ─────────────────────
async function uploadDigitalFile(listingId, filePath) {
  console.log("Uploading digital file...");
  const fileData = fs.readFileSync(filePath);
  const boundary = "----FileBoundary" + Date.now();
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="digital_download.png"\r\nContent-Type: image/png\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileData, footer]);

  await request(
    {
      hostname: "openapi.etsy.com",
      path: `/v3/application/shops/${CONFIG.ETSY_SHOP_ID}/listings/${listingId}/files`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "x-api-key": CONFIG.ETSY_API_KEY,
        Authorization: `Bearer ${CONFIG.ETSY_API_KEY}`,
        "Content-Length": body.length,
      },
    },
    body
  );
  console.log("Digital file uploaded.");
}

// ─── STEP 7: PUBLISH LISTING ──────────────────────────
async function publishListing(listingId) {
  console.log("Publishing listing...");
  const body = JSON.stringify({ state: "active" });
  await request(
    {
      hostname: "openapi.etsy.com",
      path: `/v3/application/shops/${CONFIG.ETSY_SHOP_ID}/listings/${listingId}`,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CONFIG.ETSY_API_KEY,
        Authorization: `Bearer ${CONFIG.ETSY_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );
  console.log("Listing published!");
}

// ─── MAIN ─────────────────────────────────────────────
async function run() {
  console.log("\n=== ETSY AUTOMATION STARTING ===\n");
  const outputDir = path.join(__dirname, "temp", `run_${Date.now()}`);

  try {
    const { theme, type, style, index } = getNextTheme();
    console.log(`Theme: "${theme}"`);

    const imagePrompt = await generateImagePrompt(theme, type, style);
    const imagePath = await generateImage(imagePrompt, outputDir);
    const listing = await generateListingCopy(theme, type, style);
    const listingId = await createEtsyListing(listing);
    await uploadImageToEtsy(listingId, imagePath);
    await uploadDigitalFile(listingId, imagePath);
    await publishListing(listingId);
    markPublished(index, listingId);

    console.log("\n=== DONE! Product is live on Etsy ===\n");
  } catch (err) {
    console.error("\nError:", err.message);
  } finally {
    if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

run();

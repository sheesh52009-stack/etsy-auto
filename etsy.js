const axios = require("axios");

const fs = require("fs");

const FormData = require("form-data");

const OpenAI = require("openai");

const config = require("./config");

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const etsyHeaders = {

"x-api-key": config.ETSY_API_KEY,

Authorization: `Bearer ${config.ETSY_ACCESS_TOKEN}`,

};

async function generateListing(theme, productType) {

const completion = await openai.chat.completions.create({

model: "gpt-4",

messages: [

{

role: "system",

content: "You are an expert Etsy SEO copywriter for digital products. Return valid JS

},

{

role: "user",

content: `Write an Etsy listing for a digital download.

Theme: ${theme}

Product Type: ${productType}

Return ONLY this JSON:

{

"title": "SEO title under 140 chars, keyword first",

"description": "150-200 word description. Mention: what it is, file types included, resolut

"tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","ta

"price": 4.99

}`,

},

],

});

const raw = completion.choices[0].message.content.trim();

return JSON.parse(raw.replace(/```json|```/g, "").trim());

}

async function createListing(listing) {

const response = await axios.post(`https://openapi.etsy.com/v3/application/shops/${config.ETSY_SHOP_ID}/listings`,

{

title: listing.title,

description: listing.description,

price: listing.price,

quantity: config.PRODUCT_QUANTITY,

taxonomy_id: config.TAXONOMY_ID,

type: "download",

is_digital: true,

tags: listing.tags,

who_made: "i_did",

when_made: "made_to_order",

state: "draft",

},

{ headers: etsyHeaders }

);

return response.data.listing_id;

}

async function uploadMockupImages(listingId, mockupPaths) {

for (let i = 0; i < mockupPaths.length; i++) {

const form = new FormData();

form.append("image", fs.createReadStream(mockupPaths[i]));

form.append("rank", i + 1);

await axios.post(

form,

`https://openapi.etsy.com/v3/application/shops/${config.ETSY_SHOP_ID}/listings/${listin

{ headers: { ...etsyHeaders, ...form.getHeaders() } }

);

}

}

async function uploadDigitalFile(listingId, filePath, fileName) {

const form = new FormData();

form.append("file", fs.createReadStream(filePath), fileName);

form.append("rank", 1);

await axios.post(

form,

`https://openapi.etsy.com/v3/application/shops/${config.ETSY_SHOP_ID}/listings/${listingI

{ headers: { ...etsyHeaders, ...form.getHeaders() } }

);

}

async function publishListing(listingId) {await axios.patch(

`https://openapi.etsy.com/v3/application/shops/${config.ETSY_SHOP_ID}/listings/${listingI

{ state: "active" },

{ headers: etsyHeaders }

);

}

async function getNewOrders(minOrderId = 0) {

const response = await axios.get(

`https://openapi.etsy.com/v3/application/shops/${config.ETSY_SHOP_ID}/receipts`,

{

headers: etsyHeaders,

params: { min_created: Math.floor(Date.now() / 1000) - 86400 }, // Last 24 hours

}

);

return response.data.results || [];

}

async function notifyBuyer(order) {

// Etsy auto-delivers digital files — this logs the sale for your records

console.log(` New sale! Order #${order.receipt_id} — $${order.grandtotal.amount / order.g

return order;

}

module.exports = { generateListing, createListing, uploadMockupImages, uploadDigitalFile, pub


require("dotenv").config();

module.exports = {

// AI - Stability AI for images (~$0.03/image), OpenAI for text

STABILITY_API_KEY: process.env.STABILITY_API_KEY,

OPENAI_API_KEY: process.env.OPENAI_API_KEY,

// Etsy

ETSY_API_KEY: process.env.ETSY_API_KEY,

ETSY_SHOP_ID: process.env.ETSY_SHOP_ID,

ETSY_ACCESS_TOKEN: process.env.ETSY_ACCESS_TOKEN,

// Google Sheets

GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,

GOOGLE_CREDENTIALS_PATH: "./google-credentials.json",

// Product settings

PRODUCT_PRICE: 4.99, PRODUCT_QUANTITY: 999, SCHEDULE: "0 9 * * *", // USD — digital downloads

// Unlimited digital stock

// Run daily at 9am

// Image settings

DESIGN_WIDTH: 2000,

DESIGN_HEIGHT: 2000,

MOCKUP_WIDTH: 2700,

MOCKUP_HEIGHT: 2700,

// Etsy taxonomy ID for digital art

TAXONOMY_ID: 2078,

};
const axios = require("axios");

const fs = require("fs");

const path = require("path");

const OpenAI = require("openai");

const config = require("./config");

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

async function generateDesignConcept(theme) {

const completion = await openai.chat.completions.create({

model: "gpt-4",

messages: [

{

role: "system",

content: "You are a digital product designer for Etsy. Generate image prompts for dig

},

{

role: "user",

content: `Create a design concept for this theme: "${theme}"

Return ONLY this JSON:

{

"imagePrompt": "Detailed Stability AI prompt. Flat design, vector style, white background,

"productType": "e.g. Clipart Set, Wall Art, Printable, SVG Design",

"fileName": "snake_case_file_name_no_spaces"

}`,

},

],

});

const raw = completion.choices[0].message.content.trim();

return JSON.parse(raw.replace(/```json|```/g, "").trim());

}

async function generateImage(prompt, outputDir) {

const response = await axios.post(

"https://api.stability.ai/v2beta/stable-image/generate/core",

{

prompt,

output_format: "png",

width: config.DESIGN_WIDTH,

height: config.DESIGN_HEIGHT,

style_preset: "digital-art",

},{

headers: {

Authorization: `Bearer ${config.STABILITY_API_KEY}`,

Accept: "image/*",

"Content-Type": "application/json",

},

responseType: "arraybuffer",

}

);

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const filePath = path.join(outputDir, "design.png");

fs.writeFileSync(filePath, Buffer.from(response.data));

return filePath;

}

async function generateDesign(theme, outputDir) {

const concept = await generateDesignConcept(theme);

const designPath = await generateImage(concept.imagePrompt, outputDir);

return { ...concept, designPath };

}

module.exports = { generateDesign };
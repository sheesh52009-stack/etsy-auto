const fs = require("fs");
const path = require("path");
const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ themes: [], sales: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function getNextTheme() {
  const data = loadData();
  const next = data.themes.find((t) => t.status === "Pending" || !t.status);
  if (!next) throw new Error("No pending themes.");
  return { theme: next.theme, productType: next.productType, style: next.style, rowIndex: data.themes.indexOf(next) };
}

async function markPublished(rowIndex, listingId) {
  const data = loadData();
  data.themes[rowIndex].status = "Published";
  data.themes[rowIndex].listingId = listingId;
  data.themes[rowIndex].datePublished = new Date().toISOString().split("T")[0];
  saveData(data);
}

async function logSale(order) {
  const data = loadData();
  data.sales.push({ orderId: order.receipt_id, date: new Date(order.created_timestamp * 1000).toISOString().split("T")[0], buyer: order.name, total: order.grandtotal.amount / order.grandtotal.divisor, status: order.status });
  saveData(data);
}

module.exports = { getNextTheme, markPublished, logSale };

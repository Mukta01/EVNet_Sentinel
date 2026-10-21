// Renders poster.html to a print-ready A1 PDF and a PNG preview, with Chrome.
// Usage (from the repo root): node docs/poster/build.mjs
// Needs puppeteer-core (video/node_modules has it) and Google Chrome.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../video/package.json"));
const puppeteer = require("puppeteer-core");

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
// A1 at 96 px/in: 594 mm × 841 mm ≈ 2245 × 3179 px
await page.setViewport({ width: 2245, height: 3179, deviceScaleFactor: 1 });
await page.goto(`file://${path.join(here, "poster.html")}`, { waitUntil: "networkidle0" });

const overflow = await page.evaluate(() => {
  const body = document.body.getBoundingClientRect();
  const cols = [...document.querySelectorAll("main > div")].map((c) => Math.round(c.getBoundingClientRect().bottom));
  const footer = document.querySelector("footer").getBoundingClientRect().top;
  return { bodyHeight: Math.round(body.height), columnBottoms: cols, footerTop: Math.round(footer) };
});
console.log("layout", JSON.stringify(overflow));

await page.pdf({ path: path.join(here, "EVNet_Sentinel_Poster_A1.pdf"), width: "594mm", height: "841mm", printBackground: true, pageRanges: "1" });
await page.screenshot({ path: path.join(here, "EVNet_Sentinel_Poster_preview.png"), fullPage: false });
await browser.close();
console.log("wrote EVNet_Sentinel_Poster_A1.pdf and EVNet_Sentinel_Poster_preview.png");

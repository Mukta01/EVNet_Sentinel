// Captures every screen the video needs from the production build (next start on :3101).
// Usage: node capture.mjs   → public/shots/*.png
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3101";
const OUT = "public/shots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };

async function open(path) {
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  await page.evaluate(() => { localStorage.setItem("evnet-theme", "dark"); document.documentElement.dataset.theme = "dark"; document.documentElement.style.scrollBehavior = "auto"; });
  await sleep(1500);
}
async function scrollToId(id, offset = 140) {
  await page.evaluate((id, offset) => {
    const el = document.getElementById(id);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
  }, id, offset);
  await sleep(1200);
}
async function clickText(selector, re) {
  const ok = await page.evaluate((selector, src) => {
    const r = new RegExp(src, "i");
    const el = [...document.querySelectorAll(selector)].find((e) => r.test(e.textContent ?? "") && !e.disabled);
    if (el) el.click();
    return !!el;
  }, selector, re);
  if (!ok) throw new Error(`no ${selector} matching ${re}`);
  await sleep(400);
}
async function waitText(re, timeout = 60000) {
  await page.waitForFunction((src) => new RegExp(src, "i").test(document.body.innerText), { timeout, polling: 250 }, re);
  await sleep(600);
}
async function select(id, value) {
  await page.select(`#${id}`, value);
  await sleep(400);
}

// ── landing ───────────────────────────────────────────────
await open("/");
await sleep(5000); // particle headline gathers
await shot("hook");

// scroll story: chapter index c of 7, ~1.15 screen-heights each
async function storyChapter(c, into = 0.7) {
  await page.evaluate((c, into) => {
    const s = document.querySelector(".arch-story");
    const top = s.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (c + into) * 1.15 * window.innerHeight);
  }, c, into);
  await sleep(2500);
}
await storyChapter(2);           // the threat: attacker on the wifi, compromised car
await shot("story-threat");
await storyChapter(3);           // Sentinel on the mirror port
await shot("story");
await storyChapter(5, 0.9);      // the response loop
await shot("harden-story");

// ── dashboard ─────────────────────────────────────────────
await open("/dashboard");
await scrollToId("f-leak", 160);
await shot("leak");
await scrollToId("f-models", 160);
await shot("f1-models");
await scrollToId("f-classes", 160);
await shot("classes");
await scrollToId("f-response", 160);
await shot("result");
await clickText("button", "^Attack insights$");
await sleep(1000);
await scrollToId("matrix-heading", 200);
await shot("insights");

// ── simulation ────────────────────────────────────────────
async function sim() {
  await open("/simulation");
  await select("detector-model", "XGBoost");
}
// flood → quarantine
await sim();
await select("attack-class", "SYN_Flood");
await clickText("button", "Launch");
await waitText("Approve quarantine");
await scrollToId("containment-heading", 300);
await shot("flood-recommend");
await clickText("button", "Approve quarantine");
await sleep(6000);
await shot("flood-contained");

// scan → restrict, then the same laptop floods → escalation
await sim();
await select("attack-class", "TCP_Port_Scan");
await select("sent-from", "kali");
await clickText("button", "Launch");
await waitText("Approve restriction");
await scrollToId("containment-heading", 300);
await shot("scan-restrict");
// switching the attack mid-run keeps the site state, so the laptop stays watched
await select("attack-class", "SYN_Flood");
await waitText("escalation");
await scrollToId("containment-heading", 300);
await shot("scan-escalation");

// compromised car while charging → stop the session
await sim();
await clickText("button", "^charging$");
await select("attack-class", "Aggressive_Scan");
await select("sent-from", "evcc");
await clickText("button", "Launch");
await waitText("Stop session and block vehicle");
await scrollToId("containment-heading", 300);
await shot("car");

// recommended response (harden) panel for the flow at the tap
await page.evaluate(() => {
  const h = [...document.querySelectorAll("h3")].find((e) => /Recommended response/i.test(e.textContent ?? ""));
  h?.scrollIntoView({ block: "start" }); window.scrollBy(0, -120);
});
await sleep(1200);
await shot("harden");

await browser.close();

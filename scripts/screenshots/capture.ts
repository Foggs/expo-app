import * as fs from "node:fs/promises";
import * as path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(__dirname, "../..");
const RAW_DIR = path.join(ROOT, "attached_assets/app-store/raw");

const STATES: { id: string; key: string; title: string; caption: string }[] = [
  { id: "01-home", key: "home", title: "Home", caption: "Quick draw duels with friends" },
  { id: "02-matchmaking", key: "matchmaking", title: "Matchmaking", caption: "Match with players in seconds" },
  { id: "03-friends", key: "friends", title: "Friends Match", caption: "Private rooms with one tap" },
  { id: "04-get-ready", key: "get-ready", title: "Get Ready", caption: "Three… two… one… draw!" },
  { id: "05-your-turn", key: "your-turn", title: "Your Turn", caption: "Sketch your masterpiece" },
  { id: "06-color-picker", key: "color-picker", title: "Color Picker", caption: "12 vibrant colors at your fingertips" },
  { id: "07-opponent", key: "opponent", title: "Opponent's Turn", caption: "Watch your rival sketch in real time" },
  { id: "08-results", key: "results", title: "Results", caption: "Celebrate every round" },
  { id: "09-gallery", key: "gallery", title: "Gallery", caption: "Save and revisit your art" },
  { id: "10-detail", key: "detail", title: "Detail", caption: "Every duel, beautifully preserved" },
];

const VIEWPORT_W = 440;
const VIEWPORT_H = 956;
const DPR = 3;

const STATIC_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

const PATH_BIN_NAMES = ["chromium", "chromium-browser", "google-chrome", "chrome"];

async function which(bin: string): Promise<string | null> {
  const dirs = (process.env.PATH ?? "").split(":").filter(Boolean);
  for (const d of dirs) {
    const p = path.join(d, bin);
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  return null;
}

async function findInNixStore(): Promise<string | null> {
  try {
    const entries = await fs.readdir("/nix/store");
    const matches = entries.filter((e) => e.includes("chromium")).sort().reverse();
    for (const m of matches) {
      const candidate = path.join("/nix/store", m, "bin/chromium");
      try {
        await fs.access(candidate);
        return candidate;
      } catch {}
    }
  } catch {}
  return null;
}

async function findChromium(): Promise<string> {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROMIUM_PATH;
  if (fromEnv) {
    try {
      await fs.access(fromEnv);
      return fromEnv;
    } catch {}
  }
  for (const p of STATIC_PATHS) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  for (const bin of PATH_BIN_NAMES) {
    const found = await which(bin);
    if (found) return found;
  }
  const nix = await findInNixStore();
  if (nix) return nix;
  throw new Error(
    "No chromium binary found. Set PUPPETEER_EXECUTABLE_PATH or install chromium.",
  );
}

async function waitMs(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function main(): Promise<void> {
  await ensureDir(RAW_DIR);

  const baseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:8081";
  const executablePath = await findChromium();
  console.log(`Using chromium: ${executablePath}`);
  console.log(`Base URL: ${baseUrl}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--hide-scrollbars",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: DPR });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);

    page.on("pageerror", (err) => console.warn(`[pageerror]`, err.message));
    page.on("console", (msg) => {
      const t = msg.type();
      if (t === "error" || t === "warn") {
        console.warn(`[console.${t}]`, msg.text().slice(0, 200));
      }
    });

    for (const state of STATES) {
      const url = `${baseUrl}/screenshot?state=${encodeURIComponent(state.key)}`;
      console.log(`-> ${state.id} :: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
      // Hide Expo/React Native Web dev tooling overlays that would otherwise leak into the capture.
      await page.addStyleTag({
        content: `
          #expo-dev-launcher, #expo-dev-menu, [data-expo-dev-tools], [data-testid*="dev-menu"],
          [aria-label*="Open developer menu"], [aria-label*="developer menu"],
          [aria-label*="Open Expo"], [aria-label*="Expo Tools"],
          .__expo-dev-tools, .expo-dev-launcher, .expo-dev-menu,
          body > iframe[src*="expo"], body > div[id^="__expo"] { display: none !important; visibility: hidden !important; opacity: 0 !important; }
        `,
      });
      // Allow Expo router + animations to settle, fonts to flush.
      await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
      await waitMs(900);
      const dest = path.join(RAW_DIR, `${state.id}.png`);
      await page.screenshot({ path: dest as `${string}.png`, type: "png", omitBackground: false });
      const stat = await fs.stat(dest);
      console.log(`   wrote ${dest} (${stat.size} bytes)`);
    }
  } finally {
    await browser.close();
  }
}

export const SCREEN_META = STATES;
export const RAW_W = VIEWPORT_W * DPR;
export const RAW_H = VIEWPORT_H * DPR;

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

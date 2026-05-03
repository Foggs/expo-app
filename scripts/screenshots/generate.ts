import * as fs from "node:fs/promises";
import * as path from "node:path";
import sharp from "sharp";
import { SCREEN_META, RAW_W, RAW_H } from "./capture";

const ROOT = path.resolve(__dirname, "../..");
const RAW_DIR = path.join(ROOT, "attached_assets/app-store/raw");
const MKT_DIR = path.join(ROOT, "attached_assets/app-store/marketing");

interface Size {
  name: string;
  w: number;
  h: number;
}

const SIZES: Size[] = [
  { name: "1290x2796-portrait", w: 1290, h: 2796 },
  { name: "1320x2868-portrait", w: 1320, h: 2868 },
  { name: "2868x1320-landscape", w: 2868, h: 1320 },
  { name: "1260x2736-portrait", w: 1260, h: 2736 },
  { name: "2736x1260-landscape", w: 2736, h: 1260 },
];

const BG_GRADIENTS: [string, string][] = [
  ["#6c5ce7", "#a29bfe"],
  ["#00cec9", "#6c5ce7"],
  ["#fd79a8", "#fdcb6e"],
  ["#6c5ce7", "#fd79a8"],
  ["#0984e3", "#00cec9"],
  ["#a29bfe", "#74b9ff"],
  ["#fdcb6e", "#fd79a8"],
  ["#00b894", "#00cec9"],
  ["#6c5ce7", "#0984e3"],
  ["#fd79a8", "#a29bfe"],
];

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function marketingSvg(opts: {
  width: number;
  height: number;
  caption: string;
  gradient: [string, string];
  isLandscape: boolean;
}): string {
  const { width, height, caption, gradient, isLandscape } = opts;
  const captionAreaH = isLandscape ? Math.round(height * 0.18) : Math.round(height * 0.14);
  const sidePad = Math.round(width * 0.06);
  const maxTextWidth = width - sidePad * 2;
  // Estimate natural text width for a 700 Inter (~0.55em average advance) so we can clamp.
  const naturalFont = isLandscape ? Math.round(height * 0.07) : Math.round(width * 0.065);
  const naturalWidth = caption.length * naturalFont * 0.55;
  const captionFont = naturalWidth > maxTextWidth
    ? Math.max(20, Math.round(naturalFont * (maxTextWidth / naturalWidth)))
    : naturalFont;
  const safeCaption = escapeXml(caption);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${gradient[0]}"/>
        <stop offset="100%" stop-color="${gradient[1]}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.7">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <ellipse cx="${width / 2}" cy="${captionAreaH * 0.5}" rx="${width * 0.6}" ry="${captionAreaH * 0.8}" fill="url(#glow)"/>
    <text x="${width / 2}" y="${captionAreaH * 0.62}"
          font-family="Inter, -apple-system, system-ui, sans-serif"
          font-weight="700" font-size="${captionFont}" fill="#ffffff"
          text-anchor="middle" letter-spacing="-1"
          textLength="${Math.min(naturalWidth, maxTextWidth)}" lengthAdjust="spacingAndGlyphs">${safeCaption}</text>
  </svg>`;
}

function deviceFrameSvg(width: number, height: number, cornerRadius: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="${cornerRadius}" ry="${cornerRadius}"
          fill="none" stroke="#0a0a14" stroke-width="${Math.round(cornerRadius * 0.18)}"/>
  </svg>`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function loadRaws(): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  for (const s of SCREEN_META) {
    const p = path.join(RAW_DIR, `${s.id}.png`);
    const buf = await fs.readFile(p);
    out.set(s.id, buf);
  }
  return out;
}

async function roundCorners(buf: Buffer, radius: number): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`,
  );
  return sharp(buf).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function renderMarketing(rawByScreen: Map<string, Buffer>): Promise<void> {
  for (const size of SIZES) {
    const sizeDir = path.join(MKT_DIR, size.name);
    await ensureDir(sizeDir);
    for (let i = 0; i < SCREEN_META.length; i++) {
      const screen = SCREEN_META[i];
      const gradient = BG_GRADIENTS[i % BG_GRADIENTS.length];
      const isLandscape = size.w > size.h;
      const padding = Math.round(Math.min(size.w, size.h) * 0.05);
      const captionH = isLandscape ? Math.round(size.h * 0.18) : Math.round(size.h * 0.14);
      const availW = size.w - padding * 2;
      const availH = size.h - captionH - padding;
      const screenAR = RAW_W / RAW_H;
      let shotW = availW;
      let shotH = Math.round(shotW / screenAR);
      if (shotH > availH) {
        shotH = availH;
        shotW = Math.round(shotH * screenAR);
      }
      const cornerRadius = Math.round(shotW * 0.07);
      const rawBuf = rawByScreen.get(screen.id)!;
      const resized = await sharp(rawBuf).resize(shotW, shotH, { fit: "fill" }).png().toBuffer();
      const rounded = await roundCorners(resized, cornerRadius);
      const bgSvg = marketingSvg({ width: size.w, height: size.h, caption: screen.caption, gradient, isLandscape });
      const frameSvg = deviceFrameSvg(shotW, shotH, cornerRadius);
      const shotLeft = Math.round((size.w - shotW) / 2);
      const shotTop = captionH;
      const composed = await sharp(Buffer.from(bgSvg))
        .composite([
          { input: rounded, left: shotLeft, top: shotTop },
          { input: Buffer.from(frameSvg), left: shotLeft, top: shotTop },
        ])
        .png({ compressionLevel: 9 })
        .toBuffer();
      const dest = path.join(sizeDir, `${screen.id}.png`);
      await fs.writeFile(dest, composed);
    }
    console.log(`marketing: ${size.name} (${SCREEN_META.length} files)`);
  }
}

async function writeIndex(): Promise<void> {
  const lines: string[] = [];
  lines.push("# SketchDuel — App Store Screenshots\n");
  lines.push("All screenshots are real captures of the running Expo web build, taken with a headless Chromium at iPhone-class resolutions.\n");
  lines.push("## Folder layout\n");
  lines.push(`- \`raw/\` — Native captures at ${RAW_W}×${RAW_H} (440×956 CSS px @ 3x DPR), one per app state.`);
  lines.push("- `marketing/<resolution>/` — Polished marketing versions with caption + branded gradient + rounded device frame, sized for App Store Connect upload.\n");
  lines.push("## Screens captured\n");
  lines.push("| # | State | Caption | Raw file |");
  lines.push("|---|-------|---------|----------|");
  for (const s of SCREEN_META) {
    lines.push(`| ${s.id.split("-")[0]} | ${s.title} | ${s.caption} | \`raw/${s.id}.png\` |`);
  }
  lines.push("\n## Marketing resolutions\n");
  for (const size of SIZES) {
    lines.push(`- **${size.w} × ${size.h}** → \`marketing/${size.name}/\``);
  }
  lines.push("\nEach resolution folder contains the same 10 screens (`01-home.png` … `10-detail.png`).\n");
  lines.push("## How to regenerate\n");
  lines.push("1. Make sure both workflows are running: `Start Backend` (port 5000) and `Start Frontend` (port 8081).");
  lines.push("2. Capture raw screenshots from the live app: `npx tsx scripts/screenshots/capture.ts`.");
  lines.push("3. Build marketing variants from the raws: `npx tsx scripts/screenshots/generate.ts`.\n");
  lines.push("## How to upload\n");
  lines.push("1. In App Store Connect, open your app version → **App Previews and Screenshots**.");
  lines.push("2. Pick the iPhone 6.9\"/6.7\"/6.5\" Display row that matches the resolution you're filling.");
  lines.push("3. Drag the matching files from the corresponding `marketing/<resolution>/` folder.\n");
  await fs.writeFile(path.join(ROOT, "attached_assets/app-store/INDEX.md"), lines.join("\n"));
  console.log("index: INDEX.md written");
}

async function main(): Promise<void> {
  const raws = await loadRaws();
  await ensureDir(MKT_DIR);
  await renderMarketing(raws);
  await writeIndex();
  console.log("\n✓ Marketing variants generated.");
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

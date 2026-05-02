// SVG mockup definitions for each App Store screenshot state.
// Resolution: 1320 x 2868 (iPhone 6.9" portrait, native @3x).

export const W = 1320;
export const H = 2868;

const C = {
  bg1: "#f8f9ff",
  bg2: "#e8e9ff",
  text: "#1a1a2e",
  textSec: "#4a4a6a",
  card: "#ffffff",
  tint: "#6c5ce7",
  accent: "#00cec9",
  accentSec: "#fd79a8",
  warning: "#fdcb6e",
  error: "#d63031",
  border: "#e0e0f0",
  white: "#ffffff",
  success: "#00b894",
  shadow: "rgba(108,92,231,0.10)",
};

const FONT = `font-family="Inter, -apple-system, system-ui, sans-serif"`;

// ---------- Inline SVG icons (no emoji — librsvg has no emoji font) ----------
function icPeople(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="${color}">
    <circle cx="17" cy="14" r="6"/>
    <circle cx="33" cy="14" r="6"/>
    <path d="M 5 38 Q 5 26 17 26 Q 29 26 29 38 L 29 42 L 5 42 Z"/>
    <path d="M 21 38 Q 21 26 33 26 Q 45 26 45 38 L 45 42 L 21 42 Z"/>
  </g>`;
}
function icTimer(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round">
    <circle cx="24" cy="26" r="16"/>
    <line x1="24" y1="26" x2="24" y2="14"/>
    <line x1="24" y1="26" x2="32" y2="26"/>
    <line x1="20" y1="6" x2="28" y2="6"/>
    <line x1="24" y1="6" x2="24" y2="10"/>
  </g>`;
}
function icRepeat(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 8 18 Q 8 8 18 8 L 36 8"/>
    <polyline points="30,2 36,8 30,14"/>
    <path d="M 40 30 Q 40 40 30 40 L 12 40"/>
    <polyline points="18,46 12,40 18,34"/>
  </g>`;
}
function icSwords(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 6 6 L 30 30 L 26 38 L 18 38 L 18 30 Z"/>
    <path d="M 42 6 L 18 30 L 22 38 L 30 38 L 30 30 Z"/>
  </g>`;
}
function icImage(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round">
    <rect x="6" y="10" width="36" height="28" rx="3"/>
    <circle cx="16" cy="20" r="3" fill="${color}"/>
    <path d="M 6 34 L 18 24 L 28 32 L 36 26 L 42 32 L 42 38 L 6 38 Z" fill="${color}" stroke="none"/>
  </g>`;
}
function icShare(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="36" cy="10" r="6"/>
    <circle cx="12" cy="24" r="6"/>
    <circle cx="36" cy="38" r="6"/>
    <line x1="17" y1="21" x2="31" y2="13"/>
    <line x1="17" y1="27" x2="31" y2="35"/>
  </g>`;
}
function icSave(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round">
    <path d="M 6 6 L 36 6 L 42 12 L 42 42 L 6 42 Z"/>
    <rect x="14" y="6" width="20" height="12"/>
    <rect x="12" y="26" width="24" height="16"/>
  </g>`;
}
function icTrash(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 8 14 L 40 14"/>
    <path d="M 18 14 L 18 8 L 30 8 L 30 14"/>
    <path d="M 12 14 L 14 42 L 34 42 L 36 14"/>
    <line x1="20" y1="22" x2="20" y2="36"/>
    <line x1="28" y1="22" x2="28" y2="36"/>
  </g>`;
}
function icLayers(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round">
    <path d="M 24 6 L 44 16 L 24 26 L 4 16 Z"/>
    <path d="M 4 24 L 24 34 L 44 24"/>
    <path d="M 4 32 L 24 42 L 44 32"/>
  </g>`;
}
function icBack(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="28,8 14,24 28,40"/>
    <line x1="14" y1="24" x2="40" y2="24"/>
  </g>`;
}
function icPencil(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round">
    <path d="M 8 40 L 8 32 L 32 8 L 40 16 L 16 40 Z"/>
    <line x1="26" y1="14" x2="34" y2="22"/>
  </g>`;
}
function icEraser(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round">
    <path d="M 6 32 L 22 16 L 38 32 L 28 42 L 16 42 Z"/>
    <line x1="14" y1="24" x2="30" y2="40"/>
  </g>`;
}
function icUndo(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 8 18 L 18 8 L 18 14 L 30 14 Q 42 14 42 26 Q 42 38 30 38 L 14 38"/>
    <polyline points="14,32 8,38 14,44"/>
  </g>`;
}
function icBan(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="3.5">
    <circle cx="24" cy="24" r="18"/>
    <line x1="11" y1="11" x2="37" y2="37"/>
  </g>`;
}
function icArrowLeft(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48;
  return `<g transform="translate(${cx - 24 * s}, ${cy - 24 * s}) scale(${s})" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="22,8 8,24 22,40"/>
    <line x1="8" y1="24" x2="40" y2="24"/>
  </g>`;
}

// Status bar (iOS): time left, battery/signal right, notch in middle.
function statusBar(): string {
  return `
    <g>
      <rect x="0" y="0" width="${W}" height="180" fill="transparent"/>
      <text x="120" y="115" ${FONT} font-weight="600" font-size="48" fill="${C.text}">9:41</text>
      <rect x="540" y="55" width="240" height="95" rx="48" fill="#0a0a14"/>
      <g transform="translate(${W - 280}, 78)">
        <path d="M 0 36 L 12 36 L 12 24 L 0 24 Z M 24 36 L 36 36 L 36 14 L 24 14 Z M 48 36 L 60 36 L 60 4 L 48 4 Z M 72 36 L 84 36 L 84 -4 L 72 -4 Z" fill="${C.text}"/>
        <g transform="translate(110, 8)"><path d="M0 16 q22 -22 44 0 l-6 6 q-16 -16 -32 0 z M8 24 q14 -14 28 0 l-6 6 q-8 -8 -16 0 z M16 32 q6 -6 12 0 l-6 6 z" fill="${C.text}"/></g>
        <g transform="translate(180, 6)">
          <rect x="0" y="0" width="78" height="34" rx="8" fill="none" stroke="${C.text}" stroke-width="3"/>
          <rect x="80" y="11" width="6" height="12" rx="2" fill="${C.text}"/>
          <rect x="4" y="4" width="62" height="26" rx="4" fill="${C.text}"/>
        </g>
      </g>
    </g>`;
}

function bgGradient(): string {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${C.bg1}"/>
        <stop offset="50%" stop-color="${C.bg2}"/>
        <stop offset="100%" stop-color="${C.bg1}"/>
      </linearGradient>
      <linearGradient id="tintGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${C.tint}"/>
        <stop offset="100%" stop-color="#8b7dff"/>
      </linearGradient>
      <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="${C.tint}" flood-opacity="0.15"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>`;
}

function homeIndicator(): string {
  return `<rect x="${W / 2 - 175}" y="${H - 40}" width="350" height="14" rx="7" fill="${C.text}" opacity="0.35"/>`;
}

function wrap(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bgGradient()}
    ${content}
    ${statusBar()}
    ${homeIndicator()}
  </svg>`;
}

// ---------- 1. HOME ----------
function home(): string {
  return wrap(`
    <!-- logo -->
    <g transform="translate(${W / 2}, 320)">
      <rect x="-90" y="-18" width="180" height="36" rx="18" fill="${C.tint}" transform="rotate(-45)"/>
      <rect x="-90" y="-18" width="180" height="36" rx="18" fill="${C.accent}" transform="rotate(45)"/>
    </g>
    <text x="${W / 2}" y="540" ${FONT} font-weight="700" font-size="126" fill="${C.text}" text-anchor="middle" letter-spacing="-3">SketchDuel</text>

    <!-- info rows -->
    <g transform="translate(${W / 2 - 330}, 820)">
      ${[
        { label: "2 Players",         tint: C.tint,      icon: (cx: number, cy: number) => icPeople(cx, cy, 84, C.tint) },
        { label: "1 Minute per Turn", tint: C.accent,    icon: (cx: number, cy: number) => icTimer(cx, cy, 84, C.accent) },
        { label: "3 Rounds",          tint: C.accentSec, icon: (cx: number, cy: number) => icRepeat(cx, cy, 84, C.accentSec) },
      ].map((row, i) => `
          <g transform="translate(0, ${i * 220})">
            <rect x="0" y="0" width="156" height="156" rx="48" fill="${C.card}" filter="url(#cardShadow)"/>
            ${row.icon(78, 78)}
            <text x="200" y="100" ${FONT} font-weight="500" font-size="56" fill="${C.textSec}">${row.label}</text>
          </g>`).join("")}
    </g>

    <!-- primary buttons -->
    <g transform="translate(${W / 2}, 1900)">
      <rect x="-540" y="0" width="1080" height="200" rx="60" fill="url(#tintGrad)" filter="url(#cardShadow)"/>
      ${icSwords(-220, 100, 80, C.white)}
      <text x="40" y="125" ${FONT} font-weight="700" font-size="68" fill="${C.white}" text-anchor="middle">Find Match</text>
    </g>
    <g transform="translate(${W / 2}, 2160)">
      <rect x="-540" y="0" width="1080" height="170" rx="50" fill="${C.card}" stroke="${C.border}" stroke-width="3"/>
      ${icPeople(-260, 85, 64, C.text)}
      <text x="60" y="110" ${FONT} font-weight="600" font-size="58" fill="${C.text}" text-anchor="middle">Play with Friends</text>
    </g>
    <g transform="translate(${W / 2}, 2380)">
      <rect x="-540" y="0" width="1080" height="170" rx="50" fill="${C.card}" stroke="${C.border}" stroke-width="3"/>
      ${icImage(-160, 85, 64, C.text)}
      <text x="60" y="110" ${FONT} font-weight="600" font-size="58" fill="${C.text}" text-anchor="middle">Gallery</text>
    </g>
  `);
}

// ---------- helper: dim background ----------
function dimmedHomeBg(): string {
  return `
    <text x="${W / 2}" y="540" ${FONT} font-weight="700" font-size="126" fill="${C.text}" text-anchor="middle" opacity="0.15">SketchDuel</text>
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(20,20,40,0.55)"/>`;
}

// ---------- 2. MATCHMAKING ----------
function matchmaking(): string {
  return wrap(`
    ${dimmedHomeBg()}
    <g transform="translate(${W / 2 - 540}, 950)">
      <rect x="0" y="0" width="1080" height="900" rx="56" fill="${C.card}" filter="url(#cardShadow)"/>
      <!-- spinner -->
      <g transform="translate(540, 240)">
        <circle r="100" fill="none" stroke="${C.border}" stroke-width="14"/>
        <circle r="100" fill="none" stroke="${C.tint}" stroke-width="14" stroke-linecap="round"
                stroke-dasharray="200 600" transform="rotate(-90)"/>
      </g>
      <text x="540" y="500" ${FONT} font-weight="600" font-size="68" fill="${C.text}" text-anchor="middle">Searching for opponent...</text>
      <text x="540" y="585" ${FONT} font-weight="500" font-size="46" fill="${C.textSec}" text-anchor="middle">Queue position: 2</text>
      <text x="540" y="660" ${FONT} font-weight="400" font-size="42" fill="${C.textSec}" text-anchor="middle">This may take a moment</text>
      <g transform="translate(540, 760)">
        <rect x="-180" y="0" width="360" height="100" rx="50" fill="none" stroke="${C.border}" stroke-width="3"/>
        <text x="0" y="68" ${FONT} font-weight="500" font-size="46" fill="${C.error}" text-anchor="middle">Cancel</text>
      </g>
    </g>
  `);
}

// ---------- 3. FRIENDS ----------
function friends(): string {
  return wrap(`
    ${dimmedHomeBg()}
    <g transform="translate(${W / 2 - 540}, 700)">
      <rect x="0" y="0" width="1080" height="1450" rx="56" fill="${C.card}" filter="url(#cardShadow)"/>
      <text x="540" y="160" ${FONT} font-weight="700" font-size="76" fill="${C.text}" text-anchor="middle">Play with Friends</text>
      <text x="540" y="240" ${FONT} font-weight="400" font-size="42" fill="${C.textSec}" text-anchor="middle">Create a private room or join one</text>

      <!-- room code display -->
      <g transform="translate(540, 360)">
        <text x="0" y="0" ${FONT} font-weight="500" font-size="38" fill="${C.textSec}" text-anchor="middle">YOUR ROOM CODE</text>
        <g transform="translate(-460, 50)">
          ${["S", "K", "8", "F", "P", "Q"].map((ch, i) => `
            <g transform="translate(${i * 156}, 0)">
              <rect x="0" y="0" width="140" height="180" rx="24" fill="${C.bg2}" stroke="${C.tint}" stroke-width="4"/>
              <text x="70" y="130" ${FONT} font-weight="700" font-size="100" fill="${C.tint}" text-anchor="middle">${ch}</text>
            </g>`).join("")}
        </g>
      </g>

      <g transform="translate(540, 720)">
        <rect x="-300" y="0" width="600" height="110" rx="55" fill="${C.tint}"/>
        ${icShare(-130, 55, 50, C.white)}
        <text x="40" y="73" ${FONT} font-weight="600" font-size="46" fill="${C.white}" text-anchor="middle">Share Code</text>
      </g>

      <line x1="120" y1="900" x2="380" y2="900" stroke="${C.border}" stroke-width="2"/>
      <line x1="700" y1="900" x2="960" y2="900" stroke="${C.border}" stroke-width="2"/>
      <text x="540" y="912" ${FONT} font-weight="500" font-size="36" fill="${C.textSec}" text-anchor="middle">OR JOIN A ROOM</text>

      <g transform="translate(540, 980)">
        <rect x="-420" y="0" width="840" height="140" rx="32" fill="${C.bg1}" stroke="${C.border}" stroke-width="3"/>
        <text x="0" y="95" ${FONT} font-weight="600" font-size="64" fill="${C.text}" text-anchor="middle" letter-spacing="20">ENTER CODE</text>
      </g>
      <g transform="translate(540, 1180)">
        <rect x="-300" y="0" width="600" height="120" rx="60" fill="${C.accent}"/>
        <text x="0" y="80" ${FONT} font-weight="700" font-size="50" fill="${C.white}" text-anchor="middle">Join Room</text>
      </g>
    </g>
  `);
}

// ---------- Game header (used in 4-7) ----------
function gameHeader(round: number, time: string, timeColor = C.accent): string {
  return `
    <g transform="translate(0, 200)">
      <rect x="60" y="0" width="120" height="120" rx="36" fill="${C.card}"/>
      ${icArrowLeft(120, 60, 56, C.text)}
      <g transform="translate(${W / 2}, 0)">
        <rect x="-150" y="0" width="300" height="120" rx="36" fill="${C.card}"/>
        <text x="0" y="80" ${FONT} font-weight="700" font-size="68" fill="${timeColor}" text-anchor="middle">${time}</text>
      </g>
      <g transform="translate(${W - 60}, 0)">
        <rect x="-200" y="0" width="200" height="120" rx="36" fill="${C.card}"/>
        <text x="-100" y="78" ${FONT} font-weight="600" font-size="48" fill="${C.text}" text-anchor="middle">Round ${round}/3</text>
      </g>
    </g>`;
}

function gameToolbar(): string {
  type Btn = { x: number; ring: string; render: (cx: number, cy: number) => string };
  const btns: Btn[] = [
    { x: 180, ring: C.tint,   render: (cx, cy) => icPencil(cx, cy, 56, C.text) },
    { x: 360, ring: C.tint,   render: (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="34" fill="${C.tint}"/>` },
    { x: 540, ring: C.border, render: (cx, cy) => icEraser(cx, cy, 56, C.text) },
    { x: 720, ring: C.border, render: (cx, cy) => icUndo(cx, cy, 56, C.text) },
    { x: 900, ring: C.border, render: (cx, cy) => icBan(cx, cy, 56, C.text) },
  ];
  return `
    <g transform="translate(0, ${H - 320})">
      <rect x="60" y="0" width="${W - 120}" height="220" rx="48" fill="${C.card}" filter="url(#cardShadow)"/>
      ${btns.map((b) => `
        <g>
          <circle cx="${b.x}" cy="110" r="60" fill="${C.bg2}" stroke="${b.ring}" stroke-width="${b.ring === C.tint ? 5 : 2}"/>
          ${b.render(b.x, 110)}
        </g>
      `).join("")}
      <g transform="translate(${W - 240}, 110)">
        <rect x="-120" y="-60" width="240" height="120" rx="60" fill="${C.tint}"/>
        <text x="0" y="22" ${FONT} font-weight="700" font-size="48" fill="${C.white}" text-anchor="middle">Submit</text>
      </g>
    </g>`;
}

function turnBanner(myTurn: boolean, opponentName: string): string {
  const bg = myTurn ? C.tint : C.accent;
  const text = myTurn ? "Your Turn" : `${opponentName} is drawing...`;
  return `
    <g transform="translate(${W / 2}, 380)">
      <rect x="-500" y="0" width="1000" height="120" rx="36" fill="${bg}"/>
      <text x="0" y="80" ${FONT} font-weight="700" font-size="56" fill="${C.white}" text-anchor="middle">${text}</text>
    </g>`;
}

function canvasArea(strokes: string): string {
  return `
    <g transform="translate(60, 540)">
      <rect x="0" y="0" width="${W - 120}" height="1900" rx="48" fill="${C.white}" filter="url(#cardShadow)"/>
      ${strokes}
    </g>`;
}

const sketchStrokes = `
  <!-- a colorful sun + house sketch -->
  <g transform="translate(600, 800)">
    <circle r="180" fill="none" stroke="#fdcb6e" stroke-width="22" stroke-linecap="round"/>
    <circle r="120" fill="#fdcb6e" opacity="0.55"/>
  </g>
  <g stroke="${C.tint}" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 200 1500 L 600 1100 L 1000 1500 L 1000 1700 L 200 1700 Z"/>
    <rect x="450" y="1450" width="200" height="250" rx="8"/>
    <path d="M 200 1500 L 600 1100 L 1000 1500"/>
  </g>
  <g stroke="${C.accent}" stroke-width="14" fill="none" stroke-linecap="round">
    <path d="M 100 1750 Q 250 1700 400 1750 T 700 1750 T 1100 1750"/>
  </g>
  <g stroke="${C.accentSec}" stroke-width="10" fill="${C.accentSec}" opacity="0.7">
    <circle cx="280" cy="400" r="40"/>
    <circle cx="950" cy="350" r="32"/>
    <circle cx="700" cy="200" r="24"/>
  </g>
  <g stroke="#2d3436" stroke-width="14" fill="none" stroke-linecap="round">
    <path d="M 280 600 Q 320 540 380 580"/>
    <path d="M 950 500 Q 990 460 1030 510"/>
  </g>`;

// ---------- 4. GET READY ----------
function getReady(): string {
  return wrap(`
    ${gameHeader(1, "1:00")}
    ${turnBanner(true, "Alex")}
    ${canvasArea("")}
    ${gameToolbar()}
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(20,20,40,0.65)"/>
    <g transform="translate(${W / 2}, ${H / 2 - 100})">
      <text x="0" y="-200" ${FONT} font-weight="600" font-size="80" fill="${C.white}" text-anchor="middle">Get Ready</text>
      <circle r="240" fill="url(#tintGrad)"/>
      <text x="0" y="100" ${FONT} font-weight="700" font-size="320" fill="${C.white}" text-anchor="middle">3</text>
      <text x="0" y="380" ${FONT} font-weight="500" font-size="50" fill="${C.white}" text-anchor="middle" opacity="0.9">Round 1 starting...</text>
    </g>
  `);
}

// ---------- 5. YOUR TURN ----------
function yourTurn(): string {
  return wrap(`
    ${gameHeader(2, "0:42")}
    ${turnBanner(true, "Alex")}
    ${canvasArea(sketchStrokes)}
    ${gameToolbar()}
  `);
}

// ---------- 6. COLOR PICKER ----------
function colorPicker(): string {
  const palette = [
    "#1a1a2e", "#6c5ce7", "#a29bfe", "#0984e3", "#00cec9", "#00b894",
    "#fdcb6e", "#e17055", "#d63031", "#fd79a8", "#e84393", "#636e72",
    "#ffffff", "#dfe6e9", "#74b9ff", "#55efc4",
  ];
  return wrap(`
    ${gameHeader(2, "0:42")}
    ${turnBanner(true, "Alex")}
    ${canvasArea(sketchStrokes)}
    ${gameToolbar()}
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(20,20,40,0.55)"/>
    <g transform="translate(${W / 2 - 540}, ${H - 1200})">
      <rect x="0" y="0" width="1080" height="900" rx="56" fill="${C.card}" filter="url(#cardShadow)"/>
      <text x="540" y="120" ${FONT} font-weight="700" font-size="64" fill="${C.text}" text-anchor="middle">Choose a Color</text>
      <g transform="translate(120, 220)">
        ${palette.map((c, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const sel = c === "#6c5ce7";
          return `
            <g transform="translate(${col * 220}, ${row * 160})">
              ${sel ? `<circle cx="80" cy="80" r="92" fill="none" stroke="${C.tint}" stroke-width="6"/>` : ""}
              <circle cx="80" cy="80" r="70" fill="${c}" stroke="${C.border}" stroke-width="${c === "#ffffff" ? 4 : 0}"/>
            </g>`;
        }).join("")}
      </g>
    </g>
  `);
}

// ---------- 7. OPPONENT'S TURN ----------
function opponentTurn(): string {
  // Show the partial drawing they're making
  const partial = `
    <g transform="translate(600, 800)">
      <circle r="180" fill="none" stroke="#fdcb6e" stroke-width="22" stroke-linecap="round"/>
    </g>
    <g stroke="${C.tint}" stroke-width="20" fill="none" stroke-linecap="round">
      <path d="M 200 1500 L 600 1100 L 1000 1500"/>
    </g>`;
  return wrap(`
    ${gameHeader(2, "0:18", C.warning)}
    ${turnBanner(false, "Alex")}
    ${canvasArea(partial)}
    <g transform="translate(${W / 2}, ${H - 380})">
      <rect x="-540" y="0" width="1080" height="220" rx="48" fill="${C.card}" filter="url(#cardShadow)"/>
      <circle cx="-380" cy="110" r="60" fill="${C.accent}"/>
      <text x="-380" y="130" ${FONT} font-weight="700" font-size="56" fill="${C.white}" text-anchor="middle">A</text>
      <text x="-260" y="95" ${FONT} font-weight="600" font-size="48" fill="${C.text}">Alex is sketching</text>
      <text x="-260" y="160" ${FONT} font-weight="400" font-size="38" fill="${C.textSec}">Watch in real time...</text>
      <g transform="translate(380, 110)">
        ${[0, 1, 2].map(i => `<circle cx="${i * 30 - 30}" cy="0" r="12" fill="${C.tint}" opacity="${0.4 + i * 0.2}"/>`).join("")}
      </g>
    </g>
  `);
}

// ---------- 8. RESULTS ----------
function results(): string {
  const miniSketch = (color: string, fill: string) => `
    <g transform="translate(20, 20)">
      <rect x="0" y="0" width="320" height="320" rx="24" fill="${C.white}"/>
      <g stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round">
        <circle cx="100" cy="100" r="45"/>
        <path d="M 50 250 L 160 160 L 270 250 L 270 290 L 50 290 Z"/>
      </g>
      <circle cx="240" cy="80" r="20" fill="${fill}"/>
    </g>`;

  return wrap(`
    <!-- Header -->
    <text x="${W / 2}" y="320" ${FONT} font-weight="700" font-size="84" fill="${C.text}" text-anchor="middle">Game Complete!</text>
    <text x="${W / 2}" y="400" ${FONT} font-weight="400" font-size="42" fill="${C.textSec}" text-anchor="middle">Great match!</text>

    <!-- stats card -->
    <g transform="translate(${W / 2 - 540}, 480)">
      <rect x="0" y="0" width="1080" height="240" rx="40" fill="url(#tintGrad)" filter="url(#cardShadow)"/>
      <g transform="translate(360, 60)">
        <text x="0" y="60" ${FONT} font-weight="700" font-size="100" fill="${C.white}" text-anchor="middle">3</text>
        <text x="0" y="130" ${FONT} font-weight="500" font-size="36" fill="${C.white}" text-anchor="middle" opacity="0.9">Rounds</text>
      </g>
      <line x1="540" y1="60" x2="540" y2="180" stroke="${C.white}" opacity="0.3" stroke-width="2"/>
      <g transform="translate(720, 60)">
        <text x="0" y="60" ${FONT} font-weight="700" font-size="100" fill="${C.white}" text-anchor="middle">2:45</text>
        <text x="0" y="130" ${FONT} font-weight="500" font-size="36" fill="${C.white}" text-anchor="middle" opacity="0.9">Duration</text>
      </g>
    </g>

    <!-- round gallery -->
    <text x="120" y="820" ${FONT} font-weight="600" font-size="46" fill="${C.text}">Round Recap</text>
    ${[1, 2, 3].map(r => `
      <g transform="translate(120, ${860 + (r - 1) * 500})">
        <text x="0" y="44" ${FONT} font-weight="600" font-size="36" fill="${C.textSec}">Round ${r}</text>
        <g transform="translate(0, 70)">
          ${miniSketch(C.tint, C.accentSec)}
        </g>
        <g transform="translate(420, 70)">
          ${miniSketch(C.accent, C.warning)}
        </g>
        <text x="180" y="430" ${FONT} font-weight="500" font-size="30" fill="${C.textSec}" text-anchor="middle">You</text>
        <text x="600" y="430" ${FONT} font-weight="500" font-size="30" fill="${C.textSec}" text-anchor="middle">Alex</text>
      </g>
    `).join("")}

    <!-- action buttons -->
    <g transform="translate(${W / 2}, ${H - 540})">
      <rect x="-540" y="0" width="1080" height="160" rx="48" fill="${C.success}"/>
      ${icSave(-340, 80, 60, C.white)}
      <text x="40" y="105" ${FONT} font-weight="700" font-size="54" fill="${C.white}" text-anchor="middle">Save to Gallery</text>
    </g>
    <g transform="translate(${W / 2}, ${H - 350})">
      <rect x="-540" y="0" width="520" height="140" rx="42" fill="${C.tint}"/>
      <text x="-280" y="92" ${FONT} font-weight="600" font-size="46" fill="${C.white}" text-anchor="middle">Play Again</text>
      <rect x="20" y="0" width="520" height="140" rx="42" fill="${C.card}" stroke="${C.border}" stroke-width="3"/>
      <text x="280" y="92" ${FONT} font-weight="600" font-size="46" fill="${C.text}" text-anchor="middle">Home</text>
    </g>
  `);
}

// ---------- 9. GALLERY ----------
function gallery(): string {
  const card = (i: number, opp: string, date: string, rounds: number, primary: string, accent: string) => `
    <g transform="translate(60, ${320 + i * 460})">
      <rect x="0" y="0" width="${W - 120}" height="420" rx="40" fill="${C.card}" filter="url(#cardShadow)"/>
      <g transform="translate(40, 40)">
        <rect x="0" y="0" width="340" height="340" rx="28" fill="${C.white}" stroke="${C.border}" stroke-width="2"/>
        <g stroke="${primary}" stroke-width="10" fill="none" stroke-linecap="round">
          <circle cx="${80 + (i * 20) % 80}" cy="${100 + (i * 13) % 50}" r="40"/>
          <path d="M 60 270 L 170 ${160 + (i * 7) % 30} L 280 270 L 280 310 L 60 310 Z"/>
        </g>
        <circle cx="${250 + i * 10}" cy="80" r="22" fill="${accent}"/>
      </g>
      <g transform="translate(420, 80)">
        <text x="0" y="0" ${FONT} font-weight="400" font-size="32" fill="${C.textSec}">${date}</text>
        ${icPeople(30, 65, 48, C.textSec)}
        <text x="80" y="80" ${FONT} font-weight="500" font-size="42" fill="${C.text}">vs ${opp}</text>
        ${icLayers(30, 135, 48, C.textSec)}
        <text x="80" y="150" ${FONT} font-weight="500" font-size="42" fill="${C.text}">${rounds} rounds</text>
        <g transform="translate(0, 220)">
          <rect x="0" y="0" width="60" height="60" rx="14" fill="${C.bg2}"/>
          ${icTrash(30, 30, 36, C.error)}
        </g>
      </g>
    </g>`;

  return wrap(`
    <!-- header -->
    <g transform="translate(0, 220)">
      <rect x="60" y="0" width="120" height="120" rx="32" fill="${C.card}"/>
      ${icArrowLeft(120, 60, 56, C.text)}
      <text x="${W / 2}" y="86" ${FONT} font-weight="600" font-size="60" fill="${C.text}" text-anchor="middle">Gallery</text>
    </g>
    ${[
      { opp: "Alex", date: "May 2, 2026", rounds: 3, p: C.tint, a: C.accentSec },
      { opp: "Jordan", date: "May 1, 2026", rounds: 3, p: C.accent, a: C.warning },
      { opp: "Sam", date: "Apr 30, 2026", rounds: 3, p: C.accentSec, a: C.tint },
      { opp: "Taylor", date: "Apr 29, 2026", rounds: 3, p: C.warning, a: C.accent },
      { opp: "Morgan", date: "Apr 28, 2026", rounds: 3, p: C.tint, a: C.accent },
    ].map((d, i) => card(i, d.opp, d.date, d.rounds, d.p, d.a)).join("")}
  `);
}

// ---------- 10. DRAWING DETAIL ----------
function drawingDetail(): string {
  return wrap(`
    <g transform="translate(0, 220)">
      <rect x="60" y="0" width="120" height="120" rx="32" fill="${C.card}"/>
      ${icArrowLeft(120, 60, 56, C.text)}
      <text x="${W / 2}" y="86" ${FONT} font-weight="600" font-size="56" fill="${C.text}" text-anchor="middle">vs Alex</text>
    </g>

    <g transform="translate(60, 460)">
      <rect x="0" y="0" width="${W - 120}" height="${W - 120}" rx="48" fill="${C.white}" filter="url(#cardShadow)"/>
      <g transform="translate(0, 80) scale(0.95)">${sketchStrokes}</g>
    </g>

    <g transform="translate(${W / 2 - 540}, ${H - 760})">
      <rect x="0" y="0" width="1080" height="280" rx="40" fill="${C.card}" filter="url(#cardShadow)"/>
      <text x="60" y="100" ${FONT} font-weight="600" font-size="46" fill="${C.text}">Saved Duel</text>
      <text x="60" y="170" ${FONT} font-weight="400" font-size="38" fill="${C.textSec}">May 2, 2026 · 3 rounds</text>
      <text x="60" y="230" ${FONT} font-weight="400" font-size="38" fill="${C.textSec}">Sketched together with Alex</text>
    </g>
    <g transform="translate(${W / 2}, ${H - 410})">
      <rect x="-540" y="0" width="1080" height="160" rx="48" fill="${C.tint}" filter="url(#cardShadow)"/>
      ${icShare(-220, 80, 60, C.white)}
      <text x="40" y="105" ${FONT} font-weight="700" font-size="54" fill="${C.white}" text-anchor="middle">Share Drawing</text>
    </g>
  `);
}

export interface ScreenSpec {
  id: string;
  title: string;
  caption: string;
  svg: string;
}

export const SCREENS: ScreenSpec[] = [
  { id: "01-home",         title: "Home",                  caption: "Draw. Duel. Repeat.",                  svg: home() },
  { id: "02-matchmaking",  title: "Matchmaking",           caption: "Find an opponent in seconds",          svg: matchmaking() },
  { id: "03-friends",      title: "Friends",               caption: "Play private rooms with friends",      svg: friends() },
  { id: "04-get-ready",    title: "Get Ready",             caption: "3… 2… 1… Sketch!",                     svg: getReady() },
  { id: "05-your-turn",    title: "Your Turn",             caption: "Your turn to leave a mark",            svg: yourTurn() },
  { id: "06-color-picker", title: "Color Picker",          caption: "A full palette at your fingertips",    svg: colorPicker() },
  { id: "07-opponent",     title: "Opponent's Turn",       caption: "Watch your rival respond in real time", svg: opponentTurn() },
  { id: "08-results",      title: "Results",               caption: "See both sides of every duel",         svg: results() },
  { id: "09-gallery",      title: "Gallery",               caption: "Save your favorite battles",           svg: gallery() },
  { id: "10-detail",       title: "Drawing Detail",        caption: "Relive every stroke",                  svg: drawingDetail() },
];

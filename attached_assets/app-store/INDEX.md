# SketchDuel — App Store Screenshots

All screenshots are real captures of the running Expo web build, taken with a headless Chromium at iPhone-class resolutions.

## Folder layout

- `raw/` — Native captures at 1320×2868 (440×956 CSS px @ 3x DPR), one per app state.
- `marketing/<resolution>/` — Polished marketing versions with caption + branded gradient + rounded device frame, sized for App Store Connect upload.

## Screens captured

| # | State | Caption | Raw file |
|---|-------|---------|----------|
| 01 | Home | Quick draw duels with friends | `raw/01-home.png` |
| 02 | Matchmaking | Match with players in seconds | `raw/02-matchmaking.png` |
| 03 | Friends Match | Private rooms with one tap | `raw/03-friends.png` |
| 04 | Get Ready | Three… two… one… draw! | `raw/04-get-ready.png` |
| 05 | Your Turn | Sketch your masterpiece | `raw/05-your-turn.png` |
| 06 | Color Picker | 12 vibrant colors at your fingertips | `raw/06-color-picker.png` |
| 07 | Opponent's Turn | Watch your rival sketch in real time | `raw/07-opponent.png` |
| 08 | Results | Celebrate every round | `raw/08-results.png` |
| 09 | Gallery | Save and revisit your art | `raw/09-gallery.png` |
| 10 | Detail | Every duel, beautifully preserved | `raw/10-detail.png` |

## Marketing resolutions

- **1290 × 2796** → `marketing/1290x2796-portrait/`
- **1320 × 2868** → `marketing/1320x2868-portrait/`
- **2868 × 1320** → `marketing/2868x1320-landscape/`
- **1260 × 2736** → `marketing/1260x2736-portrait/`
- **2736 × 1260** → `marketing/2736x1260-landscape/`

Each resolution folder contains the same 10 screens (`01-home.png` … `10-detail.png`).

## How to regenerate

1. Make sure both workflows are running: `Start Backend` (port 5000) and `Start Frontend` (port 8081).
2. Capture raw screenshots from the live app: `npx tsx scripts/screenshots/capture.ts`.
3. Build marketing variants from the raws: `npx tsx scripts/screenshots/generate.ts`.

## How to upload

1. In App Store Connect, open your app version → **App Previews and Screenshots**.
2. Pick the iPhone 6.9"/6.7"/6.5" Display row that matches the resolution you're filling.
3. Drag the matching files from the corresponding `marketing/<resolution>/` folder.

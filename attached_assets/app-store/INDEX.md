# SketchDuel — App Store Screenshots

All screenshots target iPhone 6.5"/6.7"/6.9" Display sizes (Apple's required iPhone classes for App Store Connect).

## Folder layout

- `raw/` — Native-resolution (1320×2868) renders of each app state, no captions or framing.
- `marketing/<resolution>/` — Polished marketing versions with caption + branded gradient + device frame, sized for App Store Connect upload.

## Screens captured

| # | State | Caption | Raw file |
|---|-------|---------|----------|
| 01 | Home | Draw. Duel. Repeat. | `raw/01-home.png` |
| 02 | Matchmaking | Find an opponent in seconds | `raw/02-matchmaking.png` |
| 03 | Friends | Play private rooms with friends | `raw/03-friends.png` |
| 04 | Get Ready | 3… 2… 1… Sketch! | `raw/04-get-ready.png` |
| 05 | Your Turn | Your turn to leave a mark | `raw/05-your-turn.png` |
| 06 | Color Picker | A full palette at your fingertips | `raw/06-color-picker.png` |
| 07 | Opponent's Turn | Watch your rival respond in real time | `raw/07-opponent.png` |
| 08 | Results | See both sides of every duel | `raw/08-results.png` |
| 09 | Gallery | Save your favorite battles | `raw/09-gallery.png` |
| 10 | Drawing Detail | Relive every stroke | `raw/10-detail.png` |

## Marketing resolutions

- **1290 × 2796** → `marketing/1290x2796-portrait/`
- **1320 × 2868** → `marketing/1320x2868-portrait/`
- **2868 × 1320** → `marketing/2868x1320-landscape/`
- **1260 × 2736** → `marketing/1260x2736-portrait/`
- **2736 × 1260** → `marketing/2736x1260-landscape/`

Each resolution folder contains the same 10 screens (`01-home.png` … `10-detail.png`), so you can upload whichever set App Store Connect asks for.

## How to upload

1. In App Store Connect, open your app version → **App Previews and Screenshots**.
2. Pick the iPhone 6.9" Display row (or 6.7"/6.5" depending on which size you're filling).
3. Drag the matching files from the corresponding `marketing/<resolution>/` folder.
4. Reorder if desired (the file numbers reflect the recommended order).

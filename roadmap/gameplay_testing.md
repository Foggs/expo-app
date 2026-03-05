# Objective
Add a persistent Playwright e2e test to `lib/state/__tests__/` that opens two browser contexts, matches them together, plays through turns, and verifies the full gameplay flow works after the state machine migration.

# Tasks

### T001: Install Playwright and configure
- **Blocked By**: []
- **Details**:
  - Install `@playwright/test` as a dev dependency
  - Create `playwright.config.ts` with:
    - `webServer` pointing to the already-running app on port 8081
    - `use.baseURL` = `http://localhost:8081`
    - Mobile viewport (400×720)
    - Test directory: `lib/state/__tests__/e2e/`
  - Add an npm script `"test:e2e": "npx playwright test"` to package.json
  - Install Chromium browser binary via `npx playwright install chromium`
  - Files: `playwright.config.ts` (new)
  - Acceptance: `npx playwright test --list` runs without error

### T002: Write the two-player gameplay e2e test
- **Blocked By**: [T001]
- **Details**:
  - Create `lib/state/__tests__/e2e/gameplay.spec.ts`
  - Test opens **two separate browser contexts** (Player 1 and Player 2)
  - Flow:
    1. Both navigate to `/` — verify "SketchDuel" title and "Find Match" button visible
    2. Both click "Find Match" — wait for matchmaking modal to appear
    3. Wait for both to be navigated to `/game` (match found, auto-navigates)
    4. Verify game screen: timer visible, round display ("Round 1/3"), turn indicator visible
    5. Active player (player1 draws first): draw on canvas by performing mouse drag gestures on the canvas element, then click the submit button (checkmark icon, accessibilityLabel="Submit your drawing and end turn")
    6. Verify turn switches — the other player now sees "Your Turn" indicator
    7. Player 2 draws and submits
    8. Continue alternating until all 6 turns complete (3 rounds × 2 players)
    9. Verify both players navigate to `/results` screen
    10. Check for no uncaught JS errors throughout
  - Key selectors/labels:
    - Find Match button: `text="Find Match"` or `role=button[name="Find a match to play"]`
    - Cancel search: `role=button[name="Cancel search"]`
    - Submit turn: `role=button[name="Submit your drawing and end turn"]`
    - Timer: `role=timer`
    - Turn text: text containing "Your Turn" or "Opponent's Turn"
    - Canvas: accessible label contains "Drawing canvas"
    - Game complete: navigation to `/results`
    - Results screen: text "Game Complete" or similar on results page
  - Drawing simulation: mouse down → move → mouse up on the canvas area
  - Timeout: generous timeouts (30s) for matchmaking since WS connection takes a moment
  - Files: `lib/state/__tests__/e2e/gameplay.spec.ts` (new)
  - Acceptance: `npx playwright test` passes with both players matched, turns submitted, game completed

### T003: Verify and add npm script documentation
- **Blocked By**: [T002]
- **Details**:
  - Run the full test suite: `npx vitest run` (unit tests) and `npx playwright test` (e2e)
  - Update `replit.md` with the new e2e test command
  - Acceptance: Both test suites pass, documentation updated

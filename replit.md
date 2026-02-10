# SketchDuel

## Overview

SketchDuel is a turn-based multiplayer drawing game built as an Expo React Native application with an Express backend. Two players take turns drawing on a shared canvas, competing in real-time drawing challenges. The app targets iOS, Android, and web platforms through Expo's cross-platform capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Expo SDK 54 with React Native 0.81
- **Navigation**: Expo Router with file-based routing (app directory contains index, game, results, and gallery screens)
- **State Management**: React Query (@tanstack/react-query) for server state, React hooks for local state
- **UI Components**: React Native core components with custom styling, Reanimated for animations
- **Design Pattern**: Component-based architecture with shared constants for theming (Colors)

### Backend Architecture
- **Framework**: Express 5 running on Node.js
- **API Structure**: REST API with routes registered in server/routes.ts, prefixed with /api
- **Storage Pattern**: Interface-based storage abstraction (IStorage) with in-memory implementation (MemStorage) that can be swapped for database implementation
- **CORS**: Dynamic origin handling supporting Replit domains and localhost development

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in shared/schema.ts using Drizzle's pgTable, with Zod validation via drizzle-zod
- **Migrations**: Managed through drizzle-kit (migrations output to ./migrations directory)
- **Current Models**: Users table with id, username, password; GalleryDrawings table with id, playerName, opponentName, strokes (JSONB), roundCount, createdAt

### Cross-Platform Considerations
- Platform-specific code handling (Platform.OS checks for web vs native)
- Safe area insets for different device types
- Haptic feedback on native platforms only
- Keyboard handling with platform-specific implementations

### Build System
- **Development**: Concurrent Expo dev server and Express API server
- **Production Build**: Custom build script (scripts/build.js) for static export, esbuild for server bundling
- **Environment**: Uses Replit environment variables for domain configuration

## External Dependencies

### Database
- PostgreSQL database (configured via DATABASE_URL environment variable)
- Drizzle ORM for type-safe database queries

### Third-Party Services
- **Expo Services**: Font loading, splash screen, secure storage, haptics
- **Google Fonts**: Inter font family (@expo-google-fonts/inter)

### Key Runtime Dependencies
- expo-router: File-based navigation
- react-native-reanimated: Advanced animations
- react-native-gesture-handler: Touch gesture support
- react-native-safe-area-context: Device safe area handling
- expo-linear-gradient: Gradient UI effects
- @tanstack/react-query: Async state management

### Development Tools
- TypeScript with strict mode
- ESLint with Expo configuration
- Babel with expo preset
- patch-package for dependency patches

## Game Features (Current Implementation)

### Drawing Canvas
- **Component**: DrawingCanvas.tsx using react-native-svg
- **Gesture Handling**: PanResponder for touch/mouse input
- **Features**: 12 colors, 5 brush sizes, eraser, undo, clear
- **Canvas**: Always white background, full-area drawing support

### Game Timer & State
- **useGameTimer Hook**: 2-minute countdown per turn, auto-submit on expiry
- **Timer States**: Active (teal), Warning (yellow, <30s), Critical (red, <10s)
- **useGameState Hook**: Server-driven state management, accepts playerRole and serverGameState from WebSocket

### WebSocket Architecture
- **Server**: `server/websocket.ts` - ws library attached to Express HTTP server on port 5000, path /ws
- **Security**: Origin validation (matches CORS rules), Zod message validation, rate limiting (300 msg/min per connection for live drawing), heartbeat ping/pong (30s interval, 10s timeout), 512KB max message size, SVG path sanitization regex, color hex validation
- **Matchmaking**: Queue-based with automatic pairing, 2-minute timeout protection, queue position tracking
- **Game Rooms**: Server-authoritative state transitions, turn validation, opponent disconnect detection
- **Live Drawing Sync**: Real-time stroke broadcasting via `draw_stroke`/`draw_clear` messages; opponent sees strokes as they're drawn with 50ms throttling. `onStrokeComplete` callback guarantees final complete stroke is always sent on touch-up, bypassing throttle to prevent dropped strokes.
- **Client Connection**: `contexts/WebSocketContext.tsx` - Single shared WebSocket via React context (WebSocketProvider), persists across screen navigations from matchmaking through gameplay. Screens register/unregister event callbacks via `setCallbacks()`. Includes:
  - Client-side Zod validation of all incoming server messages (wsServerMessageSchema discriminated union)
  - Send guards: `sendStroke`/`submitTurn`/`sendClear` blocked unless `matchStatus === "playing"`, `joinQueue` blocked unless `matchStatus === "idle"`
  - Exponential backoff reconnection [1s, 2s, 4s, 8s, 16s], WSS/WS protocol auto-detection
  - `useGameWebSocket()` hook for accessing context from any screen
- **Message Types**: Defined in `shared/schema.ts` with Zod validation for both client and server messages
  - Client: join_queue, leave_queue, draw_stroke, draw_clear, submit_turn, ping
  - Server: queue_joined, queue_left, match_found, game_state, turn_submitted, round_complete, game_complete, opponent_stroke, opponent_clear, opponent_disconnected, error, pong

### Game Flow
- Home screen: Connect WebSocket -> Join matchmaking queue -> Wait for opponent
- Match found: Navigate to /game with gameId, playerRole, opponentName params
- Gameplay: 3 rounds, 2 players alternating turns, 1 minute per turn
- Timer runs only during player's own turn, pauses during opponent's turn
- Live drawing: Player's strokes broadcast to opponent in real-time; opponent sees strokes appear on canvas
- Canvas clears when turn switches to player, strokes submitted via WebSocket
- Game completion navigates to results screen with opponentName param
- Opponent disconnection shows alert and returns to home

### Security
- **Helmet**: Enabled with full CSP (script-src self + unpkg.com, connect-src ws:/wss:, img-src data:/blob:, frame/object blocked)
- **Rate Limiting**: 200 req/15min on /api, 30 req/min on /api/games, 20 req/min on /api/gallery, 300 msg/min on WebSocket; trust proxy enabled for accurate client IP detection behind Replit proxy
- **Body Size Limits**: 2MB JSON body limit globally, content-length check on gallery POST
- **Input Validation**: Zod schemas on all WebSocket messages and gallery submissions (stroke path max 50KB, max 500 strokes per save), SVG path regex sanitization, hex color validation
- **Gallery Ownership**: Session token stored with gallery drawings; DELETE requires matching `x-session-token` header. Tokens generated per-device via expo-secure-store (native) or localStorage (web). GET responses strip sessionToken from public data.
- **CORS**: Dynamic origin validation for Replit domains and localhost
- **WebSocket Origin**: Proper URL hostname parsing (not substring matching) to prevent bypass via malicious subdomains (e.g., replit.dev.evil.com is rejected)
- **Game Abandonment**: DB game status updated to "abandoned" when player disconnects mid-game, preventing stale active games
- **Matchmaking Timeout**: joinedAt timestamp set on queue join (not connection), so timeout accurately reflects queue wait time
- **Memory Leak Prevention**: mountedRef guards on game.tsx opponent timer and WebSocketContext reconnect timer; server-side game room cleanup timer removes completed/abandoned rooms after 2 minutes

### SEO & Landing Page
- **Landing Page**: `server/templates/landing-page.html` with Open Graph tags, Twitter cards (summary_large_image), JSON-LD structured data (MobileApplication schema with game metadata)
- **Deep Linking**: al:ios:url and al:android:url meta tags for sketchduel:// scheme
- **Mobile Web App**: apple-mobile-web-app-capable and mobile-web-app-capable meta tags

### Accessibility Features
- All buttons have accessibilityLabel and accessibilityRole
- Timer has accessibilityRole="timer" with time remaining
- Screen reader hints for key interactions
- Haptic feedback on native platforms
- WCAG AA contrast: timer warning color #b8860b (dark goldenrod) passes 4.5:1 on light backgrounds
- Live regions: assertive for turn changes, polite for timer/search/queue status
- Color picker: Uses friendly names (Red, Blue, etc.) instead of hex values for screen readers
- Brush size picker: accessibilityHint on each size option
- Canvas: Dynamic accessibilityLabel for drawing vs view-only states
- Info rows on home screen: Grouped with accessible labels
- Results screen: All stats and player cards have accessibility labels

### Drawing Persistence (Cumulative Canvas)
- Drawings accumulate across rounds: each player builds on previous rounds' work
- `backgroundStrokes` array accumulates all completed strokes from prior turns
- `DrawingCanvas` renders backgroundStrokes as a frozen non-editable layer beneath active drawing
- Undo/clear only affect the current turn's strokes, not previous rounds
- Round thumbnails show cumulative snapshots (Round 2 shows Round 1 + Round 2 strokes)

### Results Screen
- Displays game stats: rounds, total time, artists
- **Round Gallery**: Shows round-by-round cumulative drawing thumbnails from both players side by side
- **DrawingThumbnail** component renders SVG strokes in 120x120 mini canvas with viewBox "0 0 400 400"
- **Save to Gallery**: Button saves final drawing to PostgreSQL gallery table via POST /api/gallery
- **Game Store** (`lib/gameStore.ts`): Module-level storage persists drawings across screens
  - `addRoundDrawing()`: Saves player/opponent strokes per round during gameplay (includes backgroundStrokes for cumulative snapshots)
  - `getRoundDrawings()`: Retrieves all stored drawings for results display
  - `clearRoundDrawings()`: Resets on game start and results unmount
- Shows "No drawings recorded" when no strokes are available

### Gallery Feature
- **Screen**: `app/gallery.tsx` - accessible from home screen via "Gallery" button
- **API Endpoints**: POST /api/gallery (save), GET /api/gallery (list, ordered by createdAt desc), DELETE /api/gallery/:id (delete)
- **Database**: `galleryDrawings` table in PostgreSQL with playerName, opponentName, strokes (JSONB), roundCount, createdAt
- **UI**: Card-based list with SVG thumbnails, opponent name, round count, date, delete button
- **Empty State**: Icon + message when no drawings saved

### Get Ready Modal
- 10-second countdown modal appears for the waiting player when opponent's turn is about to end
- Client-side opponent timer starts when turn switches away from player (120s countdown)
- Modal shows at ≤10 seconds with animated countdown number, brush icon, "Your turn starts in" text
- Haptic feedback (Heavy impact) on each countdown tick
- Countdown number turns red at ≤3 seconds
- Modal auto-dismisses when turn switches to player, on opponent disconnect, or game complete
- Accessibility: role="alert", assertive live region, descriptive label

### Haptic Feedback
- Turn start: Warning notification when it becomes player's turn
- Timer warning (30s): Medium impact feedback
- Timer critical (10s): Error notification feedback
- Turn submit: Success notification
- Match found: Success notification
- Get Ready countdown: Heavy impact on each tick
- Button interactions: Light/Medium impact on native platforms only

### Future Roadmap
- Private game rooms (create/join with room codes)
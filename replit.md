# SketchDuel

## Overview

SketchDuel is a turn-based multiplayer drawing game built as an Expo React Native application with an Express backend. Two players take turns drawing on a shared canvas, competing in real-time drawing challenges. The app targets iOS, Android, and web platforms through Expo's cross-platform capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Expo SDK 54 with React Native 0.81
- **Navigation**: Expo Router with file-based routing (app directory contains index, game, and results screens)
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
- **Current Models**: Users table with id, username, and password fields

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
- **Live Drawing Sync**: Real-time stroke broadcasting via `draw_stroke`/`draw_clear` messages; opponent sees strokes as they're drawn with 50ms throttling
- **Client Hook**: `hooks/useWebSocket.ts` - connection lifecycle management, exponential backoff reconnection [1s, 2s, 4s, 8s, 16s], WSS/WS protocol auto-detection, sendStroke/sendClear methods for live drawing
- **Message Types**: Defined in `shared/schema.ts` with Zod validation for both client and server messages
  - Client: join_queue, leave_queue, draw_stroke, draw_clear, submit_turn, ping
  - Server: queue_joined, queue_left, match_found, game_state, turn_submitted, round_complete, game_complete, opponent_stroke, opponent_clear, opponent_disconnected, error, pong

### Game Flow
- Home screen: Connect WebSocket -> Join matchmaking queue -> Wait for opponent
- Match found: Navigate to /game with gameId, playerRole, opponentName params
- Gameplay: 3 rounds, 2 players alternating turns, 2 minutes per turn
- Timer runs only during player's own turn, pauses during opponent's turn
- Live drawing: Player's strokes broadcast to opponent in real-time; opponent sees strokes appear on canvas
- Canvas clears when turn switches to player, strokes submitted via WebSocket
- Game completion navigates to results screen with opponentName param
- Opponent disconnection shows alert and returns to home

### Security
- **Helmet**: Enabled with full CSP (script-src self + unpkg.com, connect-src ws:/wss:, img-src data:/blob:, frame/object blocked)
- **Rate Limiting**: 200 req/15min on /api, 30 req/min on /api/games, 300 msg/min on WebSocket
- **Input Validation**: Zod schemas on all WebSocket messages, SVG path regex sanitization, hex color validation
- **CORS**: Dynamic origin validation for Replit domains and localhost

### SEO & Landing Page
- **Landing Page**: `server/templates/landing-page.html` with Open Graph tags, Twitter cards (summary_large_image), JSON-LD structured data (MobileApplication schema with game metadata)
- **Deep Linking**: al:ios:url and al:android:url meta tags for sketchduel:// scheme
- **Mobile Web App**: apple-mobile-web-app-capable and mobile-web-app-capable meta tags

### Accessibility Features
- All buttons have accessibilityLabel and accessibilityRole
- Timer has accessibilityRole="timer" with time remaining
- Screen reader hints for key interactions
- Haptic feedback on native platforms

### Future Roadmap
- Private game rooms (create/join with room codes)
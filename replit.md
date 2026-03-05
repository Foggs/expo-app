# SketchDuel

## Overview

SketchDuel is a turn-based multiplayer drawing game built using Expo React Native for the frontend and Express for the backend. It allows two players to compete in real-time drawing challenges on a shared canvas. The application is designed for iOS, Android, and web platforms, emphasizing cross-platform compatibility and a seamless user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: Expo SDK 54 with React Native 0.81.
- **Navigation**: Expo Router for file-based routing.
- **State Management**: React Query for server state and React hooks for local state.
- **UI/UX**: Custom components with React Native core, Reanimated for animations, and a component-based architecture with shared theming constants.

### Backend
- **Framework**: Express 5 on Node.js.
- **API**: RESTful API with routes in `server/routes.ts`.
- **Storage**: Interface-based abstraction (`IStorage`) with an in-memory implementation (`MemStorage`), designed for future database integration.
- **CORS**: Dynamic origin handling for Replit domains and localhost.
- **WebSocket**: `ws` library attached to the Express HTTP server, supporting real-time drawing synchronization, matchmaking, and game state management. Includes robust security features like origin validation, Zod message validation, rate limiting, and heartbeat checks.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Defined in `shared/schema.ts` with Drizzle's `pgTable` and Zod validation.
- **Models**: `Users` and `GalleryDrawings` tables.

### Cross-Platform
- Platform-specific code using `Platform.OS` checks.
- Safe area insets and platform-specific keyboard handling.
- Haptic feedback exclusively on native platforms.

### Build & Environment
- Development with concurrent Expo and Express servers.
- Production builds use a custom script for static export and `esbuild` for server bundling.
- Environment variables are managed via Replit.

### Core Features
- **Drawing Canvas**: `DrawingCanvas.tsx` using `react-native-svg` with 12 colors, 5 brush sizes, eraser, undo, and clear functionalities. Supports live drawing sync via WebSocket.
- **Game Flow**: 3 rounds, alternating turns, with a 1-minute timer per turn. Drawings are cumulative across rounds, with `backgroundStrokes` accumulating previous turns' work. Game screen unmount calls `ws.disconnect()` (guarded by `navigatedRef`) to immediately notify opponent on abandonment. Submit retry capped at 5 attempts to prevent permanent UI lockout.
- **Matchmaking**: Queue-based system for automatic pairing and private rooms for playing with friends using 4-letter codes. All match-start handlers (`handleFindMatch`, `handleCreateRoom`, `handleJoinRoom`) call `ws.resetState()` to clear stale `matchStatus` (e.g., `"completed"`) before attempting to queue or create rooms.
- **Results Screen**: Displays game statistics, round-by-round cumulative drawing thumbnails, and an option to save the final drawing to a gallery.
- **Gallery**: A dedicated screen (`app/gallery.tsx`) to view, save, and delete saved drawings.
- **Security**: Comprehensive measures including Helmet for HTTP headers, rate limiting on API (200 req/15min) and WebSocket (1500 msg/min per connection), Zod validation for all inputs, body size limits, CORS, and WebSocket origin validation. Server clears `conn.gameId`/`conn.playerRole` immediately on game completion and opponent disconnect, allowing instant re-queuing without waiting for the 2-minute room cleanup timer.
- **Accessibility**: WCAG AA compliance with accessibility labels, roles, screen reader hints, haptic feedback, and live regions.

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL`).
- Drizzle ORM.

### Third-Party Services
- Expo Services (fonts, splash screen, secure storage, haptics).
- Google Fonts (`@expo-google-fonts/inter`).
- `expo-clipboard` for private room code copying.

### Key Runtime Libraries
- `expo-router`
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-safe-area-context`
- `expo-linear-gradient`
- `@tanstack/react-query`
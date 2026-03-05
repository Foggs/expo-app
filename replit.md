# SketchDuel

## Overview

SketchDuel is a turn-based multiplayer drawing game built with Expo React Native for the frontend and an Express backend. Players take turns drawing on a shared canvas in real-time, competing across iOS, Android, and web platforms. The project aims to provide an engaging and accessible drawing game experience with a focus on real-time interaction and competitive play.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: Expo SDK with React Native
- **Navigation**: Expo Router with file-based routing
- **State Management**: React Query for server state, GoF State Pattern machines for game flow (MatchFlowMachine, TurnFlowMachine), React hooks for local state
- **UI/UX**: React Native core components with custom styling, Reanimated for animations, shared constants for theming (Colors). WCAG AA contrast, accessibility labels, roles, and live regions are implemented.
- **Design Pattern**: Component-based architecture and GoF State Pattern for game lifecycle.

### Backend
- **Framework**: Express running on Node.js
- **API Structure**: REST API with `/api` prefix
- **Storage Pattern**: Interface-based abstraction (`IStorage`) with an in-memory implementation (`MemStorage`) designed for swappable database integration
- **CORS**: Dynamic origin handling for Replit domains and localhost.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation
- **Migrations**: Managed by `drizzle-kit`
- **Models**: Users and GalleryDrawings tables.

### Cross-Platform
- Platform-specific code handling for web vs. native, safe area insets, and conditional haptic feedback.

### Build System
- **Development**: Concurrent Expo and Express servers.
- **Production**: Custom build script for static export and `esbuild` for server bundling.
- **Environment**: Replit environment variables for domain configuration.

### WebSocket Architecture
- **Server**: `ws` library on Express HTTP server (port 5000, path `/ws`).
- **Security**: Origin validation, Zod message validation, rate limiting, heartbeat, max message size, SVG path sanitization, color hex validation.
- **Matchmaking**: Queue-based with automatic pairing and timeout protection.
- **Game Rooms**: Server-authoritative state, turn validation, opponent disconnect detection.
- **Live Drawing Sync**: Real-time stroke broadcasting with throttling and guaranteed stroke delivery.
- **Client Connection**: Shared WebSocket via `WebSocketContext` with client-side Zod validation, send guards, and reconnection logic.

### Game Features
- **Drawing Canvas**: `react-native-svg` with PanResponder for input, 12 colors, 5 brush sizes, eraser, undo, clear. Drawings accumulate across rounds, with previous rounds forming a non-editable background layer.
- **Game Timer**: 2-minute countdown per turn with auto-submit and visual state indicators.
- **State Machines**: Core `createMachine` factory with FIFO dispatch. `MatchFlowMachine` handles match lifecycle, `TurnFlowMachine` manages turn states. After a player submits a turn, `SUBMIT_SEND_OK` is dispatched to advance TurnFlow from `submitting_turn` → `awaiting_server_ack`. The `submitting_turn` state also handles `SERVER_GAME_STATE_ACK` and `SERVER_TURN_CHANGED` as safety-net transitions.
- **Results Screen**: Displays game stats, round-by-round cumulative drawing thumbnails, and an option to save to gallery. `GameStore` persists drawings across screens.
- **Gallery Feature**: Dedicated screen to view, save, and delete drawings from a PostgreSQL table.
- **Get Ready Modal**: 10-second countdown before a player's turn with haptic feedback and accessibility features.
- **Haptic Feedback**: Implemented for key game events (turn start, timer warnings, submits, match found, countdown ticks).

### Security
- **Helmet**: Full CSP.
- **Rate Limiting**: On API and WebSocket endpoints.
- **Body Size Limits**: Configured for JSON bodies and content-length checks.
- **Input Validation**: Zod schemas for all WebSocket messages and gallery submissions, SVG path sanitization, hex color validation.
- **Gallery Ownership**: Session tokens for drawing deletion.
- **CORS & WebSocket Origin**: Dynamic and secure origin validation.
- **Game Abandonment**: Database status updates for disconnected players.
- **Matchmaking Timeout**: Accurate tracking of queue wait time.
- **Memory Leak Prevention**: Guards on timers and machine state cleanups.

### SEO & Landing Page
- Landing page with Open Graph, Twitter cards, and JSON-LD structured data.
- Deep linking support for `sketchduel://` scheme.
- Mobile Web App meta tags for enhanced mobile experience.

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL`)
- Drizzle ORM

### Third-Party Services
- Expo Services (Font loading, splash screen, secure storage, haptics)
- Google Fonts (`@expo-google-fonts/inter`)

### Key Runtime Libraries
- `expo-router`
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-safe-area-context`
- `expo-linear-gradient`
- `@tanstack/react-query`
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
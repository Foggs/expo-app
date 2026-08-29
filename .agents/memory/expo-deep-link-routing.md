---
name: Expo deep-link routing
description: Custom-scheme invite links need a matching Expo Router route for cold-start handling.
---

Custom-scheme links should have an Expo Router route that validates their parameters and redirects into the app’s existing screen; an in-screen URL listener alone is not sufficient for cold starts.

**Why:** Expo Router can resolve a cold-start URL before the destination screen mounts, so an unmatched invite path can land on the not-found screen without giving the home screen a chance to process it.

**How to apply:** When adding a new deep-link path, register a matching route, validate all incoming values before redirecting, and keep auto-join behavior separate from prefilled UI state.
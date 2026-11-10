---
name: Apple app identity
description: Owner-confirmed bundle identifier of the existing App Store Connect app.
---
The owner reported that the existing SketchDuel App Store Connect record uses
`app.replit.sketchduel` on 2026-11-10.

**Why:** Preserve the existing Apple app record instead of creating a duplicate
or assuming that a placeholder identifier in source is authoritative.

**How to apply:** Align any approved iOS build and server Game Center
verification changes with that record. Verify current configuration and any
environment overrides before editing; this fact does not authorize changing
Android identity or modifying Apple's record.

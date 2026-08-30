---
name: React Native window capabilities
description: Native runtimes may define window without browser event APIs.
---

Do not treat `typeof window !== "undefined"` as proof that browser APIs are available in React Native. Capability-check the specific method and register global browser listeners from a mounted effect with cleanup.

**Why:** The iOS runtime exposed a `window` object but no `window.addEventListener`; a module-level listener crashed Expo Router before the root layout could mount, producing a misleading downstream provider error.

**How to apply:** For browser-only globals, check both the object and required function, keep side effects out of module initialization, and verify native as well as web bundles.
---
name: React Native cryptographic randomness
description: Native iOS may not expose the browser crypto global used for secure random tokens.
---

Use a native-compatible cryptographic API for random session or ownership tokens; do not assume the browser `crypto` global exists in React Native.

**Why:** On iOS, token generation failed before SecureStore or AsyncStorage could persist a value because the runtime did not provide global `crypto`, which surfaced as unrelated gallery save/delete errors.

**How to apply:** Use the Expo-native cryptography module for secure random bytes and verify token-dependent flows with a fresh native session as well as web.
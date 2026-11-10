---
name: Remote Expo authentication
description: Why browser-based CLI login callbacks fail when the CLI runs in a remote workspace.
---

Use an authentication flow intended for remote terminals when Expo CLI runs in Replit and the owner's browser runs on their computer.

**Why:** Default EAS browser login can redirect to localhost, which refers to the owner's computer rather than the remote CLI. A successful browser sign-in therefore does not establish a CLI session.

**How to apply:** Check the installed CLI's supported device-login option before guiding authentication. Keep approval codes, callback URLs, and credentials out of chat and memory. Never treat dashboard access as proof of CLI authentication.

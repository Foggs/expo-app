---
name: Remote Expo authentication
description: Why browser-based CLI login callbacks fail when the CLI runs in a remote workspace.
---

Use an authentication flow intended for remote terminals when Expo CLI runs in Replit and the owner's browser runs on their computer.

**Why:** Default EAS browser login can redirect to localhost, which refers to the owner's computer rather than the remote CLI. A successful browser sign-in therefore does not establish a CLI session.

**How to apply:** Check the installed CLI's supported device-login option before guiding authentication. Keep approval codes, callback URLs, and credentials out of chat and memory. Never treat dashboard access as proof of CLI authentication.

Interactive EAS device login can require a final matching-number selection in the terminal after browser approval. Have the owner complete that selection in their Shell, wait for `Logged in as`, and verify with `whoami` before retrying a build.

**Why:** Browser-side approval and owner confirmation did not establish an authenticated CLI session; both the agent's and owner's build commands still rejected authentication. Completing device login through its final terminal confirmation restored CLI access. The CLI implements a separate terminal matching step.

**How to apply:** Explain the full browser-to-terminal sequence rather than repeatedly asking whether the owner is signed in. Never ask them to send the matching number or authentication codes through chat.

Agent-shell EAS authentication may not persist across turns; verify `eas whoami` immediately before each cloud build or submission. If it is unavailable, use the owner's already-authenticated Shell rather than restarting login unnecessarily.

**Why:** The CLI session that started an approved cloud build was unavailable to the agent in a later turn, preventing status checks and submission.

**How to apply:** Treat build authorization as distinct from shell authentication; do not claim a follow-on EAS action started unless its command returned a submission/build record.

The Expo connection can read builds but may lack permission to read stored iOS credentials for submission. Connecting Expo does not establish EAS CLI authentication.

**Why:** Submission returned an iOS-credentials authorization denial with scoped RUN/VIEW access even after one OAuth reauthorization.

**How to apply:** If this denial recurs after a single reconnect, stop reconnecting. Use EAS CLI instead; chain device login, `whoami`, and the separately approved submission in the same Shell invocation to avoid gaps between authentication and execution.

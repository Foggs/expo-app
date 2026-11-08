---
name: Moderation alert recovery tests
description: Stable integration-test patterns for leased webhook delivery and periodic retries.
---

When testing alert recovery across a server restart, hold the test webhook response open until the test has observed the claimed attempt and persisted lease. Release a controlled response only after asserting state.

**Why:** The background scan interval can be longer than a retry delay, and server startup plus polling can allow several retries to happen before an exact request-count assertion runs.

**How to apply:** In real-process restart tests, gate webhook responses and assert the report ID, attempt count, and lease state from the database before allowing the worker to advance.

## Simulated crashes must kill the real server process
Spawn test servers as `node --import tsx server/index.ts`, never via the tsx CLI (`tsx/dist/cli.mjs`).

**Why:** The tsx CLI runs the app in a child process. SIGKILL to the wrapper cannot be relayed, so the real server survived "crashes" as an orphan and kept retrying webhooks, producing extra deliveries that failed exact-count assertions.

**How to apply:** Any test that SIGKILLs a spawned server process must load tsx in-process.

## The restart test uses a hand-written schema
The restart test creates its tables with raw SQL, not from `shared/schema.ts`. Any table the report/identity path reads (e.g. `player_accounts` for identity lookups) must be added there too.

**Why:** A new identity lookup made report submission fail inside the spawned server, which only showed up as "Timed out waiting for first webhook attempt".

**How to apply:** When storage code starts reading a table or column on the reports/identity path, mirror it in that test's CREATE TABLE block.

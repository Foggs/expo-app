---
name: Moderation alert recovery tests
description: Stable integration-test patterns for leased webhook delivery and periodic retries.
---

When testing alert recovery across a server restart, hold the test webhook response open until the test has observed the claimed attempt and persisted lease. Release a controlled response only after asserting state.

**Why:** The background scan interval can be longer than a retry delay, and server startup plus polling can allow several retries to happen before an exact request-count assertion runs.

**How to apply:** In real-process restart tests, gate webhook responses and assert the report ID, attempt count, and lease state from the database before allowing the worker to advance.

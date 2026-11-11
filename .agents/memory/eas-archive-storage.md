---
name: EAS archive temporary storage
description: Prevent local EAS packaging from copying dependency caches into the small temporary filesystem.
---
Exclude the workspace's generated dependency cache from EAS uploads, and
check temporary-filesystem capacity independently of workspace capacity.

**Why:** EAS staging uses `/tmp`, which has a much smaller quota than the
workspace. Copying a multi-gigabyte Bun cache exhausted `/tmp` despite ample
workspace space, before upload or native compilation began.

**How to apply:** EAS defaults to Git ignore rules when no `.easignore` exists.
If adding `.easignore`, preserve those exclusions and verify an actual archive
still includes local Game Center native source. Clean only disposable test
copies or abandoned staging directories after checking no job uses them.
Failed attempts can already have incremented remote numbering; never reset it.

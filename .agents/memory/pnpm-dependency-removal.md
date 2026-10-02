---
name: pnpm dependency removal
description: A workspace package-removal helper may leave manifest and lockfile declarations unchanged.
---

After removing packages in this pnpm monorepo, verify the owning workspace manifests and lockfile directly instead of relying only on the package helper's success status.

**Why:** The helper reported success while the affected workspace `package.json` files still declared the old packages; the lockfile also retained them until it was synchronized.

**How to apply:** Inspect each affected workspace manifest and `pnpm-lock.yaml`, reconcile any remaining declarations, then run the canonical workspace typecheck.
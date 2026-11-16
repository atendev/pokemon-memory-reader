---
type: task
blocked_by: []
---

# Add the MIT terms text to Bun's manifest entry

## Question

Build what [Is Bun's own `LICENSE.md` enough as its MIT text?](./045-bun-license-text.md) decided, per [its amendment](../assets/045-bun-license-text.md): keep Bun's `LICENSE.md` byte for byte and add `bun_1.4.2__MIT-terms.txt` with the SPDX MIT permission and warranty paragraphs, enforced in `bun-runtime.test.ts`. The `v2.0.0-beta.1` prerelease waits on it.

## Acceptance

- The Bun entry lists both texts, and the test fails if either is missing or changed.

---
type: grilling
blocked_by: [041]
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:40:24Z
---

# How do releases meet the LGPL terms for Bun's statically linked JavaScriptCore and tinycc?

## Question

The compiled executable links Bun's JavaScriptCore and tinycc statically, and both are LGPL. [Bun runtime notices manifest](./041-bun-runtime-notices-manifest.md) lists them. Decide what each release ships or links so it meets the LGPL terms, such as source offers, relinking material or object files. The `v2.0.0-beta.1` prerelease waits on this.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

---
type: grilling
blocked_by: [001, 002, 013, 016]
claimed_by: wayfinder-master v2-build-master-1794582779
claimed_at: 2026-11-13T15:12:59Z
---

# Core module interfaces

## Question

What are the TypeScript types and module boundaries every build slice will code against? Use the `architect` and `codebase-design` skills alongside grilling and domain-modeling.

Sketch signatures, not implementations, for:

- the `Adapter` interface: probing, connection lifecycle, the batched multi-range read in memory domains, ROM access, and the hello and game events;
- the `SliceAdapter` used by fixtures;
- the game profile Zod schema's module and the profile registry;
- the `Decoder` contract per data format, plus the shared byte-reading helpers, and how a resource declares the reads it needs so the read loop can batch them;
- reference data modules;
- the resource registry linking decoders to the API package's schemas;
- where the read loop, identification and the Hono app sit in `server/`.

Record the result as a code sketch in `assets/` that later tickets copy from. The tracer tickets should fill in this shape, not invent it.

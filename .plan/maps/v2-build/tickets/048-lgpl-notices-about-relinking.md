---
type: task
blocked_by: [040]
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T15:46:14Z
---

# LGPL notices section, About line and relinking doc

## Question

Per [the 042 amendment](../assets/042-bun-lgpl-terms.md): `THIRD-PARTY-NOTICES.txt` opens with an LGPL section, the About page shows the JavaScriptCore and tinycc copyright lines, and `docs/lgpl-relinking.md` explains rebuilding Bun and using `--compile-executable-path`.

## Acceptance

- Tests on `scripts/notices.ts` output check the LGPL section comes first, and a viewer test checks the About lines.

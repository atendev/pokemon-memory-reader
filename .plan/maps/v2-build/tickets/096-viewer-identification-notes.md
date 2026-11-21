---
type: task
blocked_by: [072]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T14:40:00Z
---

# Viewer identification and missing-field notes

## What to build

Show the identification notes in the viewer once [full identification](./072-full-identification.md) exists: a header match, and a manual pick after a signature mismatch. Add the missing-field notes for profiles that read fewer fields. The shell comes from [Viewer shell and connection screen](./081-viewer-shell.md).

## Acceptance criteria

- The viewer shows a note for a header-only match and for a manual pick after a signature mismatch.
- A missing-field note appears where a field is null because the profile can't read it.
- Component tests cover each note, and the compile smoke still passes.

## Answer

Built. `IdentificationNotes` sits above Party, Battle, Boxes and Trainer & bag once a game is identified. A `header` match says it matched by header (and signature when it passed), not by hash. A `manual` pick warns on a signature `mismatch` (tables moved) and on `unchecked` (couldn't check the ROM). An `exact` match never warns. A `names` or `speciesData` source of `unavailable` adds a missing-field note naming the affected categories, since the profile can't read them and the fields show as `#<id>`, `—` or blank. Component tests cover each note, and the compile smoke passes locally. The expansion refusal and the no-ROM-access core suggestion stay out: the server doesn't report them yet. Audit: Claude seat only, approved in round 2 with score 8. [Report](../assets/096-viewer-identification-notes-report.md).

Timing: wall 3m, active 3m, user 0s, wait 0s, blocked 0s | implement 1m, audit 1m (2 rounds) | tools 36 (7 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 94k | cost $0.96 sonnet-5-5 + $0.01 haiku-5-5

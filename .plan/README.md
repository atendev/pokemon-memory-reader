# Plan layout

This folder holds Wayfinder maps for the project. Commit it. It is the record of why decisions were made.

The layout follows chartr's map conventions so chartr, the T3 Code Wayfinder panel, and the `/wayfinder` skill all read the same files.

```
.plan/
  README.md                 this file
  maps/<slug>/
    map.md                  the map: Destination, Notes, Decisions so far, Not yet specified, Out of scope
    spec.md                 optional settled specification
    tickets/NN-slug.md      one ticket per file, numbered from 01, numbers never reused
    assets/                 supporting files, research findings, prototypes
```

## Rules

- Load one `map.md` and the one ticket being worked. Never read the whole folder.
- Resolve one ticket per session. Research tickets are the exception.
- Status is derived, never stored. A ticket with a non-empty `## Answer` is resolved. One with a non-empty `## Ruled out` is out of scope. One with `claimed_by` set is claimed. Otherwise it is open.
- The frontier is every open ticket whose `blocked_by` tickets all exist and are resolved.
- Frontmatter keys: `type` (grilling, research, prototype, task), `blocked_by`, `undermined_by`, `assets`, `claimed_by`, `claimed_at`. Agents never write `claimed_by` or `claimed_at`.

## Resolving a ticket

1. Add `## Answer` with the decision, the reason, and what was excluded. The ticket is now resolved; nothing moves.
2. Add one bullet to Decisions so far in `map.md`: `- [Title](./tickets/NN-slug.md) — gist.`
3. Create any tickets the answer surfaced. Move fog from Not yet specified into a ticket once the question can be stated sharply.
4. To rule a ticket out, add `## Ruled out` instead and list it under Out of scope.

---
type: task
blocked_by: [072]
---

# Viewer identification and missing-field notes

## What to build

Show the identification notes in the viewer once [full identification](./072-full-identification.md) exists: a header match, and a manual pick after a signature mismatch. Add the missing-field notes for profiles that read fewer fields. The shell comes from [Viewer shell and connection screen](./081-viewer-shell.md).

## Acceptance criteria

- The viewer shows a note for a header-only match and for a manual pick after a signature mismatch.
- A missing-field note appears where a field is null because the profile can't read it.
- Component tests cover each note, and the compile smoke still passes.

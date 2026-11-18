---
type: task
blocked_by: [048]
---

# Verify the LGPL relink steps end to end

## Question

HITL. Follow `docs/lgpl-relinking.md` twice on linux-x64, per [the 042 amendment](../assets/042-bun-lgpl-terms.md), and fix the doc where it fails.

## Acceptance

- Two clean runs produce a working relinked executable, recorded in the ticket.

## Answer

Both relink runs passed on linux-x64 on 2026-11-18 (Arch Linux, Bun 1.4.2 at `bun-v1.4.2`, clang 21.1.8, 20 cores). The owner ran the first attempt, and the agent ran the rest in `~/lgpl-relink`. Sources came from the upstream fetches in the doc's step 1, not release archives, which don't exist yet.

- **Run 1, changed tinycc, prebuilt WebKit.** `tcc.h.patch` applied to the tinycc clone by hand, a marker added to a `libtcc.c` error message, then `--profile=release --local-deps=tinycc=<path>`. 318 s. The marker is in the binary, the app compiled onto it with `--compile-executable-path`, and `scripts/smoke.ts` passed. The owner's first attempt didn't count: its `strings` check found no marker because the tinycc edit was never made.
- **Run 2, changed local WebKit.** A marker in `ExceptionHelpers.cpp`, WebKit symlinked at `vendor/WebKit`, then `--profile=release-local`. Two attempts failed at WebKit's configure step (Ruby missing, then Ruby's `erb` library). The third was cut off by a session end after about 19 minutes. The fourth reused its work and finished in 14 minutes, exit 0. The marker is in the binary, and the app compiled onto it passed smoke.

Doc changes in `docs/lgpl-relinking.md`: the "Last verified" line is filled in; the tools table gains Ruby with `erb`, make, libtool and gcc, with the `libxml2.so.2` note for the LLVM tarball; tinycc uses `--local-deps` with a hand-applied patch instead of editing `tinycc.ts`; a `strings` check, separate build commands and a concrete clone tag are added. Amendment 042 carries a revision note, since its §4, §6 and §7 still said to edit the pin.

Excluded. macOS, Windows and linux-arm64 relinks stay untested. The release-archive route (unpacking the three source archives) is untested until a release builds them. No test checks the doc's step text beyond the existing offline check, which still passes.

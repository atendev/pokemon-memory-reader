---
type: task
blocked_by: [068, 081]
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T11:02:23Z
---

# Viewer Battle screen

## What to build

Spec §11.4. The Battle screen reads the `battle` resource, including the hidden opponent party (unrevealed mons stay hidden), the `field`, and `lastBattle` when inactive. It follows the spec's text for what shows and what stays hidden.

## Acceptance criteria

- Component tests render an inactive state with a `lastBattle`, a wild battle, a trainer battle with unrevealed mons, and a double battle.
- An unrevealed opponent mon shows no species, level or moves anywhere in the DOM.
- The screen runs against the fake bridge in the compiled executable.

## Handoff

Branch `t3/viewer-battle-screen`, SHA 0378f26 (wip commits, not pushed yet). Council: Claude seat only (Gemini and GPT seats skipped, out of quota). Last audit round: 1.

**Done.** `viewer/src/BattleScreen.tsx`, `battle.ts` (setting, `?showUnrevealed` override, Pokémon left, field badges, last-battle summary), `useBattle` in `useResource.ts`, App wiring plus sidebar red dot, CSS, test fixtures in `testing.ts`, tests (`battle.test.ts`, `BattleScreen.test.tsx`, 90 viewer tests pass), and `server/test/e2e/battle-executable.test.ts` (compiled exe on the fake bridge with a wild battle, gated on `PMR_EXECUTABLE`, passes locally, step added to the compile-smoke job in `ci.yml`). Lint, typecheck and `bun test` are clean except the known Lua 5.5 failure in `server/test/bridge/core.test.ts`.

**Round 1 (claude, haiku): DISAPPROVE 7.** Problem 1, blocking: an unrevealed opponent active battler showed species and moves. Fixed in 0378f26 (`isHiddenBattler`, `HiddenBattlerCard`, with tests). Minor, to decline in the report: no sprites (no icon system yet, Party has none either); null HP counts as alive (now pinned by a test); the hidden active tile gets no highlight (highlighting would leak which slot is active).

**Left, in order.** 1. Round 2: send the claude seat the diff since round 1 (`git diff 0378f26~1 0378f26`) plus its problem rows. Diff file approach: write to `out/` (gitignored). 2. On APPROVE, write `.plan/maps/v2-build/assets/082-viewer-battle-screen-report.md` (decisions, options, who chose, audit verdict, declined minors), run unslop, commit. 3. Push the branch without forcing, open a PR against `wayfinder/v2-build-master` if the repo uses PRs, and link it. 4. Run the Timing close, record the resolution in this ticket (delete this section), commit, push, return DONE with the Decisions line and surfaced tickets (none so far; candidate: battle sprites and type icons when the icon ticket lands).

**Read first.** `viewer/src/BattleScreen.tsx`, `viewer/src/battle.ts`, `viewer/src/BattleScreen.test.tsx`.

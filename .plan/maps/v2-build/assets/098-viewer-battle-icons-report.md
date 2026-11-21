# Decision report: Battle sprites and type icons

## Finding

Tickets 082 and 087 had already wired the art into the Battle screen. `BattlerCard` renders `SpeciesArt` (64 px sprite) and a `TypeArt` for each type, `Tile` renders the 40 px menu icon, and `HiddenBattlerCard` and `HiddenTile` render a ball and "?" with no art. The `IconsProvider` is mounted in `App.tsx`. No production code needed to change. The missing piece was test coverage for the three acceptance criteria.

## Decisions

1. **Add production code or tests only?** Options: rewire the screen, or add tests against the existing wiring. Choice: tests only, made by the implementer. Reason: every behaviour in the ticket already worked, and a mutation check confirmed that.
2. **Where do the tests go?** Options: `icons.test.tsx` or `BattleScreen.test.tsx`. Choice: `BattleScreen.test.tsx`, by the implementer, because it already has the `SECRET` fixture and the `withLocation` helper.
3. **What counts as "names its species"?** Choice: the tests check the whole markup for the species name, id, moves and type, then check every `<img>` tag on its own for the id, the name and the type. This covers sprite URL, alt text and file name. Made by the implementer.
4. **Fallback coverage.** Choice: a test fails every icon URL the screen asks for and expects no `<img>`, tinted tiles and type dots. A second test checks that mode `off`, an unknown mode and no game request no image.
5. **Opt-in path.** Choice: a test with `?showUnrevealed=1` expects the Mewtwo sprite and the psychic type icon to appear, so the hidden state is proven to come from the setting and not from missing art.

## Evidence

- Seven new tests in `viewer/src/BattleScreen.test.tsx`. `bun test viewer` passes 266 tests.
- Mutation check: adding a `SpeciesArt` for species 150 to `HiddenBattlerCard` made two tests fail. The change was reverted.
- `biome ci`, `bun run typecheck` and the local compile smoke (`bun scripts/smoke.ts`) pass.

## Audit

Council round 1, Claude seat only (Gemini and GPT: not run, out of quota). APPROVE, score 9, one minor problem.

Declined minor problem: the psychic-type check matches only `art-tile type-psychic` and `/type/psychic`, so a bare `type-psychic` class elsewhere would pass. Reason: `HiddenBattlerCard` renders no type, the per-tag check already covers images, and only one seat raised it.

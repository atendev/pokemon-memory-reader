---
type: grilling
blocked_by: []
assets: []
---

# Decoder test fixtures

## Question

How do decoders get tested against real game data without committing ROMs?

The owner can produce savestates and RAM dumps, and the [License](./007-license.md) decision allows only trimmed RAM slices in the repo. Decide the slice file format, which game states to capture per data format (party, bag, battle, boxes, edge cases), the tool that cuts a slice from a local dump, and how tests run without the local dumps.

Input from [Battle tracker data model](./012-battle-tracker-data-model.md): battle fixtures must confirm the Gen1 and Gen2 `wEnemyMon` DV read, an Emerald multi or in-game-partner battle (whether partner mons sit in player party memory), a turn counter address per generation if one exists, each `modes` value shipped in v2.0, and a double battle with a partner, and the Gen1 and Gen2 prize formulas against `wAmountMoneyWon` and `wBattleReward` after a win, and the Gen1 and Gen2 `wBattleResult` mask and outcome mapping against won, lost, drew, ran and caught savestates.

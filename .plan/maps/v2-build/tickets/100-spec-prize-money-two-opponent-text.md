---
type: task
blocked_by: []
---

# Fix spec §7.8 prize money text for two-opponent battles

## What to build

[Gen 3 trainers and prize money](./069-gen3-trainers-and-prize-money.md) found that pokeemerald's `GetTrainerMoneyToGive` doubles prize money only for a double battle against one trainer. A two-opponent battle pays each trainer its own undoubled amount. Spec §7.8 in `../v2-rebuild/spec.md` and the text of ticket 069 say to double whenever `BATTLE_TYPE_DOUBLE` is set. Correct §7.8 to match, and check any other spec line or `.describe()` text that repeats the old rule. The code already follows the game.

## Acceptance criteria

- Spec §7.8 states the single-trainer double rule and the undoubled two-opponent rule.
- No other spec or `api/` description repeats the old rule.
- No code changes unless a description string in `api/` needs the text.

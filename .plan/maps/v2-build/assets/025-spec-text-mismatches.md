# Spec text mismatches: amendment for spec §17 item 13

Resolves [Do these text mismatches read the way the spec shows them?](../tickets/025-spec-text-mismatches.md).

These were decided in auto mode on 2026-11-16 (UTC). The owner handed every question to the runner's Auto mode loop: the main thread asked each question with a recommendation, and a grilling subagent answered it. When the spec text is next updated, spec §5.4, §5.5, §7.4, §7.8, §8.3, §8.6, §12.5 and §12.7 will cite this amendment for §17 item 13. The source tickets this amendment overrides will get an "Amended by" pointer to it at the same time, not a silent rewrite. This ticket edits neither the spec nor those tickets. Each numbered item below replaces the text it names.

## Amendment

1. **Official profiles and ROM reads.** Official profiles read no **names** from ROM. Species, move, item and ability names come from shipped reference data (§5.5, §6.2). They do read ROM for header identification, the signature words (§5.4), and the optional trainer tables: `gTrainers`, `gTrainerClassNames` and `gTrainerMoneyTable` (§5.1, §7.8). Ticket 020's "read nothing from ROM" now means "read no names from ROM". The spec already says this in §5.5.
   - **No ROM reads.** If the adapter can't read ROM, every trainer table counts as missing. `className`, `name` and `prizeMoney` follow the existing null rule (§5.1 table row, §7.8 `Trainer`), with no error and no new status field. `status.game.signature` already reports `"unchecked"` in that case (item 3).

2. **Battle validation warning.** The two warnings are one rule. It replaces ticket 012's "logs one de-duplicated warning per battle", ticket 018's "Warn in the log after 2 s of consecutive failures", and the §7.8 "Warnings" bullet that cites both. The program logs one warning once the in-battle flag has stayed set and battle validation has failed for 2 s of consecutive reads. It logs at most one per flag-set period, which runs from the flag reading set until it reads clear.
   - A valid read resets the 2 s clock.
   - The rule applies whether the resource hasn't gone active yet or is already active. In both cases it keeps the last valid state and emits nothing (§8.6).
   - The period keys on the flag, not on `battleId`, because `battleId` only increments when `battle` goes active.
   - Ticket 012's "no timer" covers the active flip only, not this log line.
   - Ticket 018's "count it" is the existing validation-failure counter at `GET /debug/metrics` under `--debug` (§8.10). Public `status` gains nothing.

3. **`status.game.signature`.** `"match" | "mismatch" | "unchecked" | null`, a closed enum. This confirms ticket 023's values, which §5.4 already shows. §7.4's schema comment ("values per 023's body, see §17 item 13") can now cite this item instead. `"unchecked"` means a signature word couldn't be read. `null` means the profile declares no signature. This replaces the three-value list in ticket 006's "Amended by" note. Ticket 023 needs no change.

4. **Gen 1 end marker.** Gen 1 `wIsInBattle == 0xFF` always ends the battle: the resource goes inactive and `lastBattle` goes out. Only its outcome value waits for verification.
   - Until verified, the outcome is `unknown`, under the Gen 1-2 outcome fallback in §7.8. A synthetic unit test pins this.
   - The Gen 1 `0xFF` sequence fixture that §12.5 already lists is the confirmation. It must be captured after a loss the owner knows was a loss, and its expected value must not come from the decoder's own output. Its expected post-battle outcome is `lost`, and when it lands the marker maps to `lost`.
   - **Change to §12.7.** §12.7's verification list has no gate for the marker today. This amendment adds one: "the Gen 1 `wIsInBattle == 0xFF` end marker against a known loss", met by that sequence fixture. The existing `wBattleResult` gate (mask and mapping against won, lost, drew, ran and caught savestates) still gates the `wBattleResult` mapping. It does not confirm the marker, and the marker gate does not confirm the mapping.
   - **Change to §12.7: lifting per data format.** §12.7 lists one joint "Gen 1-2" `wBattleResult` gate. This amendment splits it into a Gen 1 gate and a Gen 2 gate, each met by that format's own savestates. The `unknown` fallback then lifts separately for each. The marker lifts on the marker gate, the Gen 1 `wBattleResult` mapping on the Gen 1 gate, and Gen 2 outcomes on the Gen 2 gate. The joint Gen 1-2 prize-formula gate is out of this ticket's scope and stays as it is.

5. **Box cadence and caps.** The later tickets replace ticket 013's text. The mGBA GDB stub, its 512-byte cap, chunking and the "about every 2 seconds" cadence are all dropped. Boxes follow §8.3: read when demanded, at most once per 1000 ms, in their own request after the main batch, with their own 1000 ms timeout. Bridge caps follow §4.4 (512 ranges, 64 KiB). The [RetroArch probe and batch caps](./026-retroarch-probe-and-batch-caps.md) decision applies: each profile's box request is checked against the caps at profile load and never split at run time.

## Excluded

- Official profiles that read nothing from ROM at all, which would drop trainer data and the signature check.
- Two independent battle warnings, or a warning on the first failure with no 2 s threshold.
- A battle validation field in public `status`, or a separate "no ROM reads" status flag.
- A three-value signature enum that folds "couldn't read" into `null`.
- Mapping `0xFF` to `lost` before a fixture confirms it, one joint Gen 1-2 fallback switch, and a sequence fixture that expects `unknown`.
- Keeping 013's 2 s box cadence or its GDB-stub chunking.

# Decision report: Radical Red plain Pokémon layout

| Decision | Options | Choice | Who | Audit |
| --- | --- | --- | --- | --- |
| How to get RAM evidence | Run a headless script, drive the emulator from a script, or hand the owner steps | The owner ran a throwaway Lua script in mGBA's scripting window, on copies of the ROM and save in `/tmp`. The owner stopped the scripted driver and asked for steps instead. | Owner | Approved |
| What to scan for | Fixed address, or the saved Pokémon's personality plus trainer ID | The 8-byte personality and trainer ID from the save, so no Radical Red address was assumed. Two hits, at `0x02024284` and `0x02025564`. | Main thread | Approved |
| What to compare | Both copies, or the first | The first copy only. Its 100 bytes equal the save record. The second is only guessed to be the save-block mirror. | Main thread | Approved |
| What the hack profile declares | A plain-layout flag on `gen3`, a decoder switch, or the `cfru` data format alone | `dataFormat: "cfru"` and nothing else, because CFRU's decryption patch is unconditional | Main thread, from the research subagent | Approved |
| Boxes | Test now, or record as untested | Untested. A vanilla-layout scan of the save found nothing, but it can't see CFRU's records, and the owner has one party Pokémon. Follow-up is ticket 061. | Main thread | Approved |
| Other CFRU hacks | Assume plain, or leave unverified | Unverified. Unbound has third-party evidence only and Dark Violet looks non-CFRU. | Research subagent | Approved |

## Audit

The council ran on the Claude seat only, because the other seats are out of quota. Round 1: DISAPPROVE, 6, two blocking problems. The box claim said the save has no boxed Pokémon, though the scan used the vanilla layout and can't see CFRU's records. The `cfru` rule outran the evidence for hacks other than Radical Red. Both fixed by rewording, plus two minor wording fixes. Round 2: APPROVE, 8, one minor problem (the research summary stated unverified items as settled), fixed.

## Declined minor problems

None.

## Skipped gates

- No `claimed_by` was written, because `.plan/README.md` says agents never write it.
- The thread rename to the ticket's name was not done.
- The audit has one seat, not three.

# Decision report: Radical Red Nature Changer save test

| Decision | Options | Choice | Who | Audit |
| --- | --- | --- | --- | --- |
| How to get the evidence | Ask the owner to run the NPC on a real save, or leave the ticket blocked | Owner ran it on Radical Red 4.1 and saved before and after. The main thread read both saves. | Main thread | Approved |
| How to read the saves | Reuse the repo's Gen 3 decoder, or a throwaway reader | A throwaway Python reader in `/tmp`, not committed. It reads the personality word, which is unencrypted, so it needs no decoder. | Main thread | Approved |
| Is the nature stored apart from personality | Compare shown nature with personality % 25 before and after, and diff the whole party record | Both shown natures matched personality % 25. Only personality and three recalculated stats changed in the record. Answer: yes, no separate field. | Main thread | Approved after a scope fix |
| Wording scope of the answer | Say flat "no field", or scope it to one Pokémon in party storage | Scoped. Bytes outside the record changed and were not identified, so a nature stored there is not ruled out. | Main thread, council seat | Fixed |
| What to do about the plain-layout finding | Fold it into this answer, or surface a ticket | Surfaced a new HITL research ticket, [Does Radical Red keep Pokémon plain in RAM](../tickets/060-radical-red-plain-pokemon-layout.md). The map's CFRU fog now waits on it too. | Main thread | Approved |
| Council seats | Three seats, or fewer if two fail | The Gemini and GPT seats hit quota errors twice. The owner chose to go on with the Haiku seat only. | You (the owner) | One seat |

## Audit

- Round 1, Haiku seat: DISAPPROVE, 7, three minor problems. All fixed: the whole-record diff was done, the vanilla order for pid % 24 = 13 was corrected to EGMA, and the plain-layout wording on the map was scoped to the one save tested.
- Round 2, Haiku seat: APPROVE, 8, two minor wording problems. Both fixed: "party count and item area" became the offset range 1723 to 1952, and the answer now says the party record holds no separate field.
- Gemini and GPT seats: failed twice on quota errors, so they gave no verdict. The gate rests on one seat, by your choice.
- Declined problems: none.

## Skipped gates and deviations

- No research subagent ran. The evidence came from the owner's play session, so the main thread analysed it directly.
- The ticket's `claimed_by` was not written, because the plan README says agents never write it. The chat was not renamed to the ticket name.
- Local checks only: the reader's offsets were checked by decoding a real species and its moves. No code in the repo changed.

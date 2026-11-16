# Decision report: Radical Red nature storage

## Decisions

1. **Does Radical Red store a nature apart from personality % 25?**
   - Options: yes, no, unknown.
   - Choice: unknown, leaning no. Made by the research subagent, accepted by the main thread.
   - Reason: no public source shows a separate field. CFRU derives nature from personality only. Radical Red's source is closed, and its changelog describes a Nature Changer NPC without saying how it works.

2. **Where would the hack profile read a stored nature?**
   - Options: declare a new field now, or declare nothing.
   - Choice: declare nothing. Made by the main thread after the Claude seat found the answer and findings contradicted each other.
   - Reason: no field was found to point at. If a save test later finds one, the profile would need its offset, bit width and an override flag.

3. **Close the v4.1 changelog and item-list gaps?**
   - Choice: left open and recorded as gaps. One extra search found nothing new. Settling it needs a ROM or save check, which the ticket rules out.

## Audit

- Round 1, Claude seat (haiku): DISAPPROVE, 6. Two blocking problems, both fixed: the CFRU claim had no cited source, and the answer contradicted the findings on the profile declaration. Minor problems fixed: broken report link, overstated "no mints" and an unquoted Bulbapedia claim.
- Round 1: Gemini APPROVE 9. GPT DISAPPROVE 6, one blocking problem: the answer concluded "no" though the evidence shows only "unknown". Fixed by rewording the answer to "Unknown".
- Round 2: Gemini APPROVE 10, GPT APPROVE 9, Claude DISAPPROVE 7 with three minor problems, fixed.
- Round 3: Claude APPROVE 8. Final: APPROVE, scores Claude 8, Gemini 10, GPT 9.

## Declined minor problems

Claude seat, round 3: the CFRU citation (assets/016-pokemon-schema-cfru.md section 4) was not read by the seat. The main thread read it and confirmed the quoted lines.

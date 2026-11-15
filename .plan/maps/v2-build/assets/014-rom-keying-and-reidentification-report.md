# Decision report: How are ROMs keyed and re-identified?

Ticket: [How are ROMs keyed and re-identified?](../tickets/014-rom-keying-and-reidentification.md), a grilling ticket for spec §17 item 2. Branch `t3/rom-keying-reidentification`, run as a child of the v2-build wayfinder-master. The result is [the amendment](./014-rom-keying-and-reidentification.md), a glossary change in `CONTEXT.md`, and three research files.

## Round 1 (owner, 2026-11-13)

1. **Which hashes key a manual pick?** Options: any supplied hash (`sha1:`, else `crc32:`, else the header); SHA-1 only, else the header (§9.6 as written); always the header. The main thread recommended any hash and noted that each randomizer seed would then need its own pick. Owner chose any hash.
2. **How is a GB ROM keyed without a hash?** Options: mask ROM version, global checksum and title; version and title only; a CRC32 of the whole header block. Recommended and chosen: version, checksum and title. GBA uses game code, version and title.
3. **How are RetroArch picks keyed without a hash?** Options: the header key plus the content name, or the name alone on gpSP; the header key, with the name only on gpSP; the header key, with gpSP picks lasting only for the session. Recommended and chosen: header plus content name.
4. **Which adapters run the re-check timer, and how often?** Options: RetroArch only, every 2 s; every adapter every 2 s; RetroArch reads the header in every batch. Recommended and chosen: RetroArch only, every 2 s. Bridges rely on the game message.

## Research (subagents and main thread)

Three `sonnet` research subagents each took one sub-question: mGBA checksum types, RetroArch `GET_STATUS`, and randomizer ROM identity. All three hit the account's rate limit, but only after writing most of their findings. The main thread then checked four facts itself:

- mGBA master's `GBAApplyPatch` and `GBApplyPatch` leave `romVf` set, and the SHA-1 branches hash `romVf` first. With a soft patch, SHA-1 is the unpatched file's hash, while CRC32 is computed over the patched ROM.
- RetroArch's `runloop_path_set_basename` cuts the content path at the last dot, on both master and v1.22.2.
- Each research file names its gaps. Nobody researched the other RetroArch commands or the Ironmon quickload naming, and the decisions don't need either.

The main thread decided not to ask whether the mGBA bridge should send SHA-1 where mGBA master offers it, because the soft-patch evidence decides it. The bridge stays CRC32-only (amendment item 7), and the owner confirmed this in the final check.

## Round 2 (owner, 2026-11-14)

5. **Can one pick cover every modified ROM of a base game?** Options: an opt-in base-game pick; one that applies automatically; per-ROM picks only. Recommended and chosen: opt-in, saved as `base:<profileId>`, and only for ROMs that pass the signature.
6. **How is a bridge ROM keyed without a hash?** Options: the header alone; the header plus `romName`. Recommended and chosen: the header alone, with `romName` staying log-only.

## Final check (owner, 2026-11-14)

7. The owner confirmed the whole resolution. It covers:
   - the key forms, including `name:<platform>:<contentName>` and CRC32 zero-padded to 8 digits;
   - saving under both hashes if an emulator ever sends both;
   - the file shape `{ version: 1, picks }`;
   - the lookup order and the skip rule for missing profiles;
   - what forget removes;
   - the RetroArch check's comparisons;
   - the CRC32-only mGBA bridge;
   - the glossary changes.

## Details the main thread added after the final check

The owner didn't see these as separate questions. Each follows from a confirmed rule or from the research.

- A RetroArch `crc32=0` counts as no hash, because RetroArch reports 0 when it skipped the hash.
- In titles and content names, `%` and `:` are escaped, so the keys stay unambiguous.
- If more than one profile qualifies for a base-game pick, the ROM stays unidentified.
- Timeouts on the RetroArch check don't count toward `stalled`.
- On 1.22.2 the first `GET_STATUS` after a load can time out once while RetroArch hashes the file.
- The sketch is a shape for [Core module interfaces](../tickets/004-core-module-interfaces.md) to absorb, not a contract.
- The hand-offs go to the viewer-routes, RetroArch-probe and core-interfaces tickets.

## Audit

- **Round 1 (`haiku` auditor): not approved, 8 objections.** The main thread accepted seven and rejected one:
  - Accepted, objection 1: the gpSP name key applies only once RetroArch stops sending CRC32.
  - Accepted, objection 3: GBA's field is `<version>`, as in the option the owner approved, and both version fields are defined as `status.rom.revision`.
  - Accepted, objection 4: the glossary keeps the signature condition.
  - Accepted, objections 5 and 6: the randomizer claims name the header words the signature checks, the `YJencrypted` exception and the repointed tables, and the GB checksum claim is marked as read from the source, not run.
  - Accepted, objection 7: the 1.22.2 claims were verified or narrowed to the cases the research covered.
  - Accepted, objection 8: added the `UNKNOWN` rule and the mGBA hex encoding, verified the GB soft-patch claim, and reworded one Excluded line.
  - Rejected, objection 2 (drop the platform from the gpSP key): the owner confirmed `name:<platform>:<contentName>` word for word in the final check.
- **Round 2: not approved, 5 objections.** The auditor accepted objection 2's rejection on the owner's confirmation. The main thread accepted all five new points:
  - Item 3 now cites §5.4 for what the vanilla signature checks, and names the header words UPR ZX only reads.
  - The `YJencrypted` exception now also names the complement byte.
  - Item 7 now claims only SHA-1, since GB MD5 wasn't checked and the game message has no MD5 field.
  - Item 2's platform clause moved back to the `name:` key. The main thread had already caught this one after the style pass.
  - `status.rom.revision` now cites §7.4.
- **Round 3: not approved, 1 objection.** The main thread had also sent the wording-only hunks from its `unslop` pass, and the auditor confirmed they keep the meaning. Its one objection was the Excluded bullet on mGBA SHA-1, which gave no reason. The main thread accepted it, cited item 7 and §4.3, and declined the suggested "SHA-1 or MD5" wording because round 2 had removed the GB MD5 claim as unverified.
- **Round 4: not approved, 1 objection.** The bullet said the game message has fields for `crc32` and `sha1` only, but it has other fields too. The main thread accepted the fix, saying instead that its hash fields are `crc32` and `sha1` only.
- **Round 5: APPROVE.** The auditor approved the reworded bullet.

Audit verdict: APPROVE in round 5 of 5.

## Gates and skills

- **Commit gate.** The master's brief says to commit without asking, so the main thread skipped the runner's commit question. The master merges, and this branch never merges to `main`.
- **Jev audit.** The parent session already ran it, so this run skipped it.
- **Skills.** `grilling` and `domain-modeling` ran the interview and the glossary change. The main thread used `architect` at a reduced scale, writing the caller's usage first and the type sketch after it. It skipped the `arena` step with Codex runners, because the ticket ships no code and those runners are paid external calls. The `to-spec` synthesis went straight into the amendment, since this repo's tracker is `.plan/`.
- **ADR.** None. The amendment records why.

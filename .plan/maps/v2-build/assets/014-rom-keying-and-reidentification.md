# ROM keying and re-identification: amendment for spec §17 item 2

Resolves [How are ROMs keyed and re-identified?](../tickets/014-rom-keying-and-reidentification.md).

The owner settled each choice in a grilling interview on 2026-11-13 and 2026-11-14. The evidence is in three research files: [mGBA checksum types](./014-mgba-checksum-types.md), [RetroArch `GET_STATUS`](./014-retroarch-get-status.md) and [Randomizer ROM identity](./014-randomizer-rom-identity.md). Spec §3.4, §4.3, §5.4, §8.10 and §9.6 will cite this amendment for §17 item 2 when the spec text is next updated. This ticket doesn't edit the spec.

## Amendment

1. **ROM signals.** Identification and pick keys use four signals. Each one is null when the adapter can't supply it.
   - `sha1` comes from BizHawk on the cores its spike confirms (§4.3).
   - `crc32` comes from the mGBA bridge, and from RetroArch 1.22.2 through `GET_STATUS`. RetroArch prints it with `%lx`, so the adapter zero-pads it to 8 digits. The mGBA bridge hex-encodes the 4 big-endian bytes `emu:checksum` returns. RetroArch reports `crc32=0` when it skipped the hash, and that counts as no hash. Every hash is lowercase hex.
   - `header` comes from the program's own header read wherever the adapter can read `rom`. On GBA it is the game code, software version and title. On GB it is the mask ROM version, the 16-bit global checksum and the title (§5.4).
   - `contentName` is RetroArch's content name: the file name without its extension, which `GET_STATUS` reports after the system id in 1.22.2 and on master. For an archive it is the member's file name. A system id or content name of `UNKNOWN`, which master writes when it has none, counts as missing. Only the RetroArch adapter supplies it. The bridge game message's `romName` stays log-only, as §4.3 says.

2. **The ROM key.** The program saves a manual pick for one ROM under the first key the signals allow:
   - `sha1:<40 hex digits>` when the emulator gives SHA-1;
   - `crc32:<8 hex digits>` when it gives CRC32;
   - with a readable header, `header:gba:<gameCode>:<version>:<title>` or `header:gb:<maskRomVersion>:<globalChecksum>:<title>`. `<version>` is the GBA software version byte and `<maskRomVersion>` the GB mask ROM version byte, both shown as `status.rom.revision` (§7.4) and written in decimal, and `<globalChecksum>` is 4 lowercase hex digits. On RetroArch the header key ends with `:name:<contentName>`;
   - on RetroArch with no hash and no header, as with the gpSP core once RetroArch stops sending CRC32, `name:<platform>:<contentName>`, where `<platform>` is `gb` or `gba`. 1.22.2 still hashes gpSP content on the first `GET_STATUS`, so gpSP gets a `crc32:` key there;
   - otherwise there is no key. The pick lasts until the content changes, the adapter disconnects or the program exits, and it isn't saved. No v2.0 adapter is expected to reach this case.

   `<title>` is the string `status.rom.title` shows (§17 item 8). Keys write `%` as `%25` and `:` as `%3A` in `<title>` and `<contentName>`, and escape nothing else. If an emulator ever supplies both hashes, the pick is saved under both keys and found by either, SHA-1 first. No v2.0 adapter supplies both.

3. **The base-game pick.** When the user picks the base profile for a modified ROM, the viewer offers to use that profile for every modified ROM of the same game.
   - The viewer offers it only when the emulator gave a hash, the header matched that profile, and the ROM passes the profile's signature or the profile declares none, as in Gen 1-2. Without a hash, a ROM that passes the header and signature already loads by header (§5.4), so the option has nothing to add.
   - The program saves it as `base:<profileId>` instead of the ROM key.
   - A later ROM loads profile P through it when the emulator gave a hash that matched nothing, P's header matches, the ROM passes P's signature or P declares none, and `base:P` exists. It loads with `match: "manual"`, and the viewer treats it like any manual pick.
   - Universal Pokémon Randomizer ZX keeps the base header byte for byte. The one exception is an unofficial Emerald translation titled `YJencrypted`, whose game code and complement byte (0xBD) it rewrites. The vanilla signature checks the Game Freak ROM header words that point to the species, item and move tables (§5.4). UPR ZX only reads those words, which sit at 0x1BC, 0x1C8 and 0x1CC in its `Gen3Constants`, and never writes them. It does repoint trainer parties, learnsets and TM text into free space, but those pointers sit in table entries, not in the header words. Its source shows no step that recomputes the GB global checksum, though nobody has run it to confirm. One base-game pick therefore covers every seed of a game. See [Randomizer ROM identity](./014-randomizer-rom-identity.md).

4. **Lookup.** The program checks saved picks only after automatic identification leaves the ROM unidentified. The §5.4 order is unchanged, and a ROM with an expansion block never loads a pick (§5.7).
   1. The ROM key from item 2 comes first. When there are two hash keys, SHA-1 goes first.
   2. Then comes `base:<P>` for the profile P that meets item 3's conditions. If more than one profile qualifies, the ROM stays unidentified.
   - The program skips a pick whose profile doesn't load, because the profile was removed or fails validation, and logs a warning. The ROM stays unidentified, and the entry stays until the user picks again or forgets it.
   - Forgetting removes the entry that applied: the ROM key's entries, both hash keys when there are two, or the `base:` entry. The routes for picking and forgetting stay with §17 item 9.

5. **`manual-picks.json`.** The file is `{ "version": 1, "picks": { "<key>": { "profileId": "<id>" } } }`. The §9.6 rules for the Zod check, re-read, merge, atomic rename and `.bad` rename still apply.

6. **Re-identification.**
   - **Bridges** run no timer. The game message is their only content-change signal. The bridge sends it before answering any read on a new ROM (§4.3), and a reconnect sends the hello and game message again, so a reconnect re-identifies too.
   - **RetroArch** pushes nothing, so the RetroArch adapter checks every 2 s while it is the live adapter, with or without content. The interval is `romCheckIntervalMs`, an internal constant for §8.10's list. Each check reads two things:
     - `GET_STATUS`, parsed as the status word, then the system id up to the first comma, then the content name, with a trailing `,crc32=<hex>` removed on 1.22.2. Content names may contain commas, so the name runs to the end of the line;
     - the header bytes, where the core maps ROM.
   - Any difference in system id, content name, CRC32 or header bytes since the last check triggers re-identification. That includes the header read switching between data and an unmapped-address error, as when the user swaps the gpSP core for the mGBA core. `PLAYING` and `PAUSED` are the same content. `CONTENTLESS` means no ROM. A timeout or a `GET_STATUS ERROR` reply changes nothing, and check timeouts don't count toward `stalled`.
   - On 1.22.2, when RetroArch didn't hash at load, the first `GET_STATUS` after a content load hashes the file, so that reply can time out once. That covers a plain ROM file and a core such as gpSP that loads by path. The next check gets the cached value. RetroArch hashes at load when a core that loads into memory gets content from an archive or with a soft patch.
   - A change resets every resource and emits `status` first, as §5.4 says. How RetroArch is probed and when it counts as usable stays with §17 item 14.

7. **mGBA stays on CRC32.** mGBA's master branch, the coming 0.11, adds SHA-1 and MD5 to `emu:checksum`. On both GBA and GB, its SHA-1 hashes the unpatched ROM file even after mGBA soft-patches it, while CRC32 covers the patched ROM. A soft-patched hack would report its base game's SHA-1 and load that game's profile as an exact match. So the mGBA bridge keeps filling only `crc32` on every mGBA version, as §4.3 says. See [mGBA checksum types](./014-mgba-checksum-types.md).

8. **Glossary.** `CONTEXT.md` now says a manual pick is remembered for that ROM, and a base-game pick covers every modified ROM of the same official game as long as any signature bytes the profile lists still match. It also adds **Modified ROM**.

## Sketch

This shows the shape, not a contract. [Core module interfaces](../tickets/004-core-module-interfaces.md) decides names and modules.

Caller's view first:

```ts
// After the §5.4 automatic order leaves the ROM unidentified:
const id = romIdentity(content, header);           // item 1
const hit = picks.lookup(id, baseCandidates);      // item 4; baseCandidates = profiles meeting item 3
// Viewer pick and forget actions (routes: §17 item 9):
picks.save(id, profileId, scope);                  // scope "rom" | "base"
picks.forget(hit.key);
```

Types derived from it:

```ts
type RomHeader =
  | { platform: "gba"; gameCode: string; revision: number; title: string }
  | { platform: "gb"; revision: number; globalChecksum: number; title: string };

interface RomIdentity {
  platform: "gb" | "gba";
  sha1: string | null;          // lowercase hex
  crc32: string | null;         // 8 lowercase hex digits; RetroArch "0" becomes null
  header: RomHeader | null;     // null when rom can't be read
  contentName: string | null;   // RetroArch only
}

type PickKey = `sha1:${string}` | `crc32:${string}` | `header:${string}` | `name:${string}` | `base:${string}`;

declare function romKeys(id: RomIdentity): PickKey[];  // item 2, strongest first; [] when there's no key

interface ManualPicksFile {
  version: 1;
  picks: Record<string, { profileId: string }>;
}

interface PickStore {
  lookup(id: RomIdentity, baseCandidates: readonly string[]): { key: PickKey; profileId: string } | null;
  save(id: RomIdentity, profileId: string, scope: "rom" | "base"): void;
  forget(key: PickKey): void;
}

// Adapter side (item 6). Bridges emit on each game message. RetroArch emits when its 2 s check sees a change.
interface AdapterContent {
  platform: "gb" | "gba" | "other";
  crc32: string | null;
  sha1: string | null;
  contentName: string | null;
  domains: Record<string, number>;
}
```

## Why

- Hash keys keep two hacks on one base header apart on mGBA, the top-priority adapter, and on RetroArch 1.22.2. §9.6's SHA-1-only rule came from [Config file](../../v2-rebuild/tickets/019-config-file.md), which assumed every hash was SHA-1. [Game identification](../../v2-rebuild/tickets/009-game-identification.md) already said "hash, or header when no hash exists".
- The GB key carries the global checksum because it is the only GB header field that tells official ROMs apart, and §5.4's header signal already uses it.
- RetroArch keys its own per-game overrides by content name. Adding the name keeps hacks on one base header apart now that RetroArch is dropping CRC32. Master removed `crc32=` on 2026-07-23 in commit `8b91d207`. 1.22.2 is still the newest release, so the next release is the first without it.
- The base-game pick keeps per-ROM picks strict for hacks and spares randomizer players a pick for every seed. It needs the signature to pass, so a hack that moves the tables under the same header still waits for its own pick. It is opt-in because it covers ROMs the user hasn't loaded yet.
- Bridges already send the game message before any read on a new ROM, so a timer would only re-check what the protocol guarantees. RetroArch pushes nothing, so it polls. 2 s is the "about 2 s" from [Read loop and latency budget](../../v2-rebuild/tickets/018-read-loop.md). A RetroArch content switch can take that long to show up, and the new game is still booting during that time.

## Excluded

- §9.6's SHA-1-only rule, and header keys on emulators that give a hash.
- A GB key without the global checksum, and a CRC32 of the whole header block as the key.
- Picks on gpSP that last only for the session, and a header-only key on RetroArch without a hash.
- A base-game pick that applies without asking, and no base-game pick at all, which would leave every seed waiting for its own pick.
- `romName` in bridge keys.
- A timer on bridges, and reading the header in every RetroArch batch.
- Sending mGBA's SHA-1 from the bridge, because it hashes the unpatched file (item 7). The hash fields in §4.3's game message are `crc32` and `sha1` only, so MD5 isn't an option.
- Hashing the ROM over the adapter, which §5.4 already rules out.

## Hand-offs

- [Which routes serve the viewer's controls and info?](../tickets/021-viewer-control-routes.md): the pick route takes a scope (`"rom"` or `"base"`, item 3), and forget removes the entry that applied (item 4).
- [How is RetroArch probed, and what happens when a batch is too big?](../tickets/026-retroarch-probe-and-batch-caps.md): the probe may use `GET_STATUS` too. The 2 s check runs only after RetroArch is the live adapter.
- [Core module interfaces](../tickets/004-core-module-interfaces.md): the adapter's game event carries `contentName`, and RetroArch emits it from the 2 s check.

## Spec sections to update later

- §3.4: the 2 s check, the `GET_STATUS` parse rule and CRC32 zero-padding (items 1 and 6).
- §4.3: why the mGBA bridge sends only `crc32` (item 7).
- §5.4: "Manual picks" and "When" cite items 2 to 6, and the §17 item 2 pointers go.
- §8.10: add `romCheckIntervalMs`, 2000 ms, to the internal constants.
- §9.6: the keys, lookup, base-game picks and file shape from items 2 to 5.
- §17 item 2: mark it resolved.

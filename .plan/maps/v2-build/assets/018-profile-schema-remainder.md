# Profile schema remainder: amendment for spec §17 item 6

Resolves [What else does the profile schema hold?](../tickets/018-profile-schema-remainder.md).

The owner settled each choice in a grilling interview on 2026-11-13. Spec §5.1, §5.2, §7.4, §7.8 and §12.8 will cite this amendment for §17 item 6 when the spec text is next updated. This ticket doesn't edit the spec.

## Amendment

1. **`name`.** Every profile requires a free-text `name`, which feeds `status.game.name`, such as `"Pokémon FireRed (US 1.1)"` or `"Radical Red 4.1"`. A child profile states its own `name` and never inherits it. The "profiles hold no names" rule still covers only species, move and item names and charmaps.

2. **What `extends` inherits.**
   - **Not inherited:** `id`, `kind`, `name`, `identify`, `fixture`, provenance and `features`. Each one is specific to a single ROM revision: its identity (`id`, `kind`, `name`), how it is matched (`identify`), what was verified for it (`fixture`, `features`) and where its data came from (provenance). Blue states its own `identify`, so it never matches Red's header. A hack never inherits its base game's fixture or box verification.
   - **Inherited:** data format, `language`, `artVersion`, addresses, constants, `trainerTables`, `nameTables` and `speciesData`. `artVersion` is inherited on purpose. It names whose sprites to show, Blue shares Red's `red-blue` art, and a hack takes its base game's value with no extra line. A child that needs other art states it.
   - **Merge.** addresses, constants, `nameTables`, `speciesData` and `trainerTables` merge one level deep. Each top-level key the child states replaces that key's whole value. For example, a child with `"nameTables": { "moves": { … } }` replaces only the inherited `moves` table and keeps `species`, `items` and `abilities`. The scalar fields (data format, `language`, `artVersion`) are replaced whole when the child states them. Arrays and table entries are never deep-merged.
   - **Removal.** In a merged block, a child key set to `null` removes the inherited key, such as `"trainerTables": { "money": null }`. Only optional keys can be removed. These are every `trainerTables` key and any address or constant that the full schema for that data format marks optional. On an official profile, the whole `nameTables` block is optional (§5.1), so a child can null the block, and omission means reference data. On a hack, every `nameTables` key is required (§5.5), so a child that wants reference data for a category sets it to `"vanilla"`, not `null`. Nulling a required key fails the resolved-profile check.
   - **Chains.** Chains are allowed. A missing parent fails the child's load with an error naming the missing parent ID. A cycle fails every profile in it, and the error lists the whole chain, such as `a → b → a`.
   - **Kind.** A hack may extend an official profile or another hack. The resolved-profile check rejects a `kind: "official"` profile with a hack anywhere in its chain.
   - **Parent lookup.** Parents resolve by ID after user replacements apply (§5.2). A valid user profile that replaces `firered-us-1.0` becomes the parent of every profile that extends it.
   - **Broken replacement.** If a user replacement fails the file check or the resolved-profile check, the program skips it, logs an error naming its path, and keeps the built-in profile for that ID. Its children resolve against the built-in. This follows the bad-file rule for `config.json` in §9.4. The viewer's profile list shows the error. A child that fails for its own reasons fails alone.
   - **Order.** Loading runs in three steps. First, each user replacement is resolved with built-in and user profiles in place. A replacement that fails for any reason, including a missing parent or a cycle that runs through it, counts as broken and is skipped. Second, the program builds the final ID set from the built-in profiles, the valid replacements and the new user profiles. Third, every profile resolves against that set, and the Chains rules apply to whatever fails there. For example, a user `firered-us-1.0` that extends `x`, where `x` extends `firered-us-1.0`, is skipped in the first step, and `x` then resolves against the built-in `firered-us-1.0`.

3. **Validation.** There are two Zod schemas.
   - The **file schema** checks each file as written. `id`, `kind` and `name` are always required. A file without `extends` is a root and must state every field the full schema requires. A file with `extends` may omit inherited fields.
   - The **full schema** checks the resolved profile. The resolved profile needs `id`, `kind`, `name`, data format, `language`, `artVersion` and addresses. A `kind: "hack"` profile also needs `nameTables` and `speciesData` (§5.5, §5.6). `identify`, `trainerTables`, `features` and provenance stay optional. A profile with no `identify` never matches by hash, header or signature. It loads only through a manual pick (§5.4), and its `status.game.match` is `"manual"`, one of `"exact" | "header" | "manual"` (§7.4).
   - **`fixture`** is required on built-in profiles, where the coverage test checks it (§12.8). On user profiles it is optional, and omitting it means `"none"`, with the once-per-session warning of §5.2. It is never inherited, so a built-in child states its own.
   - The exported JSON Schema comes from the file schema, so editors don't flag inherited fields as missing.

4. **Trainer tables.** One optional block, `trainerTables: { trainers?, classNames?, money? }`, uses keys that work for every generation. Each entry is `{ base, count }`, with `base` in the §5.1 address form, pointer entries included. Entry layouts stay in decoder code, one per data format.
   - `trainers` is the trainer table, `gTrainers` in Gen 3 and CFRU. `trainers.count` bounds the trainer ID. An ID at or beyond it nulls every `Trainer` field read from that table, such as `name` and `items`.
   - `classNames` is the trainer class name table, `gTrainerClassNames` in Gen 3 and CFRU. `classNames.count` bounds the class ID for `className`.
   - `money` is `gTrainerMoneyTable`, used only by Gen 3 and CFRU. `money.count` bounds the class ID for the money-table lookup in `prizeMoney`. Gen 1 and Gen 2 prize money comes from RAM (§7.8), so those profiles set no `money` entry, and its absence changes nothing there.
   - An ID beyond `count` behaves like a missing table: the dependent fields are null and no error is raised (§7.8).
   - Generated official profiles take `base` from the pret symbols and `count` from the decomp's trainer and class counts. A hack whose table differs from its parent's states the whole entry, `base` and `count` together, because entries replace whole. CFRU, which relocates and extends `gTrainers`, must do so. The owner finds hack trainer-table values by hand. `scripts/find-rom-tables` (§5.5) prints only name-table and species-data fragments. Like other ROM tables, they are checked by synthetic tests and `test:local` (§12.2).

5. **`features.boxes`.** This is an optional profile field, `features: { boxes?: boolean }`, and it is not inherited.
   - **Default.** The default follows `kind`: `true` for `"official"`, `false` for `"hack"`. A built-in hack whose box layout has been verified sets `boxes: true` explicitly. Official profiles need no box test of their own. The support gate (§12.8) already requires box states on every primary revision before a data format is `supported`.
   - **Effective value.** `status.game.features.boxes` is true only when the data format supports boxes and the resolved flag is true. When it is false, `boxes` returns `503 unsupported` (§7.2).
   - **Box fixture.** For this rule, a box fixture is a promoted golden, an `.expected.json` and not an `.expected.draft.json` (§12.5), under `server/test/fixtures/<profile-id>/` (§12.1) that covers the `boxes` resource with its fields verified (§12.5, §12.7).
   - **Test.** A default-suite test, next to the `fixture` check in §12.8, fails when a built-in hack profile resolves to `boxes: true` and has no box fixture.
   - **User profiles.** A user hack profile may set `boxes: true` with no fixture, at the user's own risk. This is a deliberate exception. It replaces, for user profiles only, the §7.4 sentence that hack profiles with an unverified storage layout set the flag false and the §12.8 rule that hack boxes stay false until a box fixture exists. Both rules still bind built-in profiles through the test above.

## Why

Identity, matching, coverage and provenance stay with the ROM revision they describe. Layout data is shared, so `extends` stays useful for Blue and Red and for hacks without the wrong-header bug §17 names. `count` on trainer tables follows the bounds rule for name tables (§5.5). The field plus a test lets a user opt in for their own hack, while built-in hacks still can't claim box support nobody verified. Skipping a broken user replacement matches the program's rule that a bad file never stops it.

## Excluded

- An optional `name` that falls back to the profile ID, and a name taken from the ROM header.
- Inheritance limited to a whitelist, and blanket inheritance with no exclusions.
- Built-in children that ignore valid user replacements, and a broken replacement that takes the built-in profile down with it.
- Children that can't remove an inherited key.
- Official profiles that extend a hack.
- Trainer tables given as an address with no count, or placed in `addresses`.
- A `features.boxes` derived only from fixtures. A flag with no fixture test for built-in hacks. User profiles remain the stated exception.
- Checking only the resolved profile.
- Requiring `fixture` in user profiles.

## Spec sections to update later

- §5.1: the field table (`name`, `trainerTables`, `features`, inheritance per field, `null` removal, `fixture` optional on user profiles, and the consequence of omitting `identify`) and the open-points bullet.
- §5.2: the three-step load order, parent resolution, broken replacements, missing parents and cycles, and `fixture` omitted on a user profile meaning `"none"`, with its warning.
- §7.4: the `features.boxes` bullet.
- §7.8: the trainer-table bounds.
- §12.8: the hack-boxes test and the user-profile exception.

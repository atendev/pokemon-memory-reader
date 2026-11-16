---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:19:17Z
---

# Which bytes form the Ruby/Sapphire signature?

## Question

[What happens to signatures for revisions the owner doesn't own?](./022-unowned-revision-signatures.md) found that Ruby and Sapphire headers carry no table pointers, unlike Emerald and FireRed's `struct GFRomHeader`. Until this ticket decides, Ruby/Sapphire profiles declare no signature. Decide which ROM bytes form their signature words, how the generator finds them in pret's pokeruby, and what the profile records. See [the 022 amendment](../assets/022-unowned-revision-signatures.md).

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

Every pokeruby retail build, English and German, uses the same two signature words. Both come from pret source and the `.sym` files, with no ROM. The `gBattleMoves` word sits at `atk93_tryKO + 0x16C`, inside a naked asm function. The `gMoveNames` word sits at `sPokemonMenuActions + 0x50` and holds `gMoveNames + 13 * 15`. The profile keeps the `[{ address, bytes }]` shape. The generator gets an anchored word form, and it reads named local symbols with a size check. One owned Ruby ROM confirms the mapping for every revision, and 022's evidence levels apply unchanged.

The reason is that pokeruby puts its GF ROM header inside `.ifdef GERMAN`, so English builds have no header words. Nothing at a source-fixed position holds `gBaseStats` or `gItems`, so the species and item tables stay an unguarded gap.

Excluded:
- German header words alongside different English words (two mappings)
- no signature for English builds
- literal-pool words picked from the owner's ROM
- an inferred `gItems` word

Decided in auto mode. Details are in the [amendment](../assets/036-ruby-sapphire-signature-bytes.md), the [facts](../assets/036-ruby-sapphire-signature-bytes-facts.md) and the [decision report](../assets/036-ruby-sapphire-signature-bytes-report.md).

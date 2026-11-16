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

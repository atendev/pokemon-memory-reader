---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T16:21:08Z
---

# May an open enum lose a value within `/api/v2`?

## Question

[Is `battle.modes` an open enum?](./015-battle-modes-enum.md) made `battle.modes` an open enum that only ever gains values. Decide whether that append-only rule holds for every open enum in `/api/v2`, or whether some open enum may drop or rename a value without a major version, and if so under which release rule. See [the 015 amendment](../assets/015-battle-modes-enum.md).

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

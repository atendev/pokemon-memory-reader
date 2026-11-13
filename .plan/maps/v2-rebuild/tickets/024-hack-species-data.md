---
type: grilling
blocked_by: [023]
assets: []
---

# Hack species data

## Question

Where do hack profiles get the per-species data that computed fields need, and when does the `null` fallback go?

[Expansion hack data format](./023-expansion-hack-data-format.md) gives `kind: "hack"` profiles `null` for `gender`, `ability` and `species.dex`, and for a boxed mon's `level`, because no decision gives them gender ratio, ability slots, growth rate or National Dex numbers. Official profiles use shipped reference data, and CFRU repoints the species data table behind header word `0x080001BC`. Decide whether hack profiles read species data from ROM the way they read name tables, what layout they declare, what these fields return when the table is missing, fails validation or the adapter can't read ROM, and how the `null` fallback is removed.

---
type: grilling
blocked_by: [041]
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:40:24Z
---

# Is Bun's own `LICENSE.md` enough as its MIT text?

## Question

[Bun runtime notices manifest](./041-bun-runtime-notices-manifest.md) ships Bun's `LICENSE.md` as the text for the `bun` entry, but that file has no copyright line or MIT grant. [Which licenses does the third-party allowlist accept?](./027-third-party-license-allowlist.md) requires real license text. Decide what text the notices carry for Bun itself. The `v2.0.0-beta.1` prerelease waits on this.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

No, `LICENSE.md` isn't enough on its own. It only says "Bun itself is MIT-licensed." It gives neither MIT's terms nor a copyright line, and no place checked in Bun 1.4.2 names a copyright holder. The `bun` entry keeps `LICENSE.md` byte for byte and adds a second text, `texts/bun_1.4.2__MIT-terms.txt`. That file is a two-line header followed by lines 5 to 18 of SPDX `MIT.txt` (v3.29.0), the permission and warranty paragraphs word for word, with no copyright line. This is a narrow exception to 027 item 6: canonical text may be added, never substituted, and only for this entry until another amendment extends it. A case in `bun-runtime.test.ts` enforces it, with no schema change. Each Bun pin bump re-checks for a real upstream MIT text and switches to it if one appears.

Excluded: an MIT text with a copyright holder we fill in, because no source names one. Also excluded: trimming `LICENSE.md`, holding beta.1 until upstream acts, and filing an upstream issue, which stays an optional owner action. The owner confirms the MIT notice reading before `v2.0.0-beta.1`. Decided in auto mode. Building it is the surfaced task "Add the MIT terms text to Bun's manifest entry". Full text in [the amendment](../assets/045-bun-license-text.md), and the decision report is [here](../assets/045-bun-license-text-report.md).

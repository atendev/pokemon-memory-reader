# Item icons on the Trainer and bag screen: decision report

## Decisions

**Reuse `ItemArt` for bag rows.**
- Question: how should a bag row show an icon?
- Options: write a new bag-specific component, or reuse `ItemArt` from the viewer icons ticket.
- Choice: reuse `ItemArt` (main thread, implementer). It already shows the icon beside the name, falls back to the name or `#<id>`, makes no request without a provider and remembers failed URLs. Party and Battle screens use it for held items, so the three screens behave the same.

**Keep the name as text and leave the layout alone.**
- Question: does the row need new styling?
- Choice: no (main thread). `ItemArt` keeps the name as text beside the image, and the existing `.art-item-icon` negative margin keeps the row height, so a missing icon doesn't move the row. `App.tsx` already wraps every screen in `IconsProvider`, so the screen needs no wiring.

**Test through the real provider.**
- Question: how do the tests cover icon, missing icon and unknown item?
- Choice: render `TrainerScreen` inside `IconsProvider` with the Emerald settings. Four tests: icon beside the name with the name still text, a failed icon falling back to the plain row, an unknown item (`name: null`) shown as `#<id>` with an icon request that falls back when it fails, and no `<img>` without icon settings. The 263 viewer tests pass, `biome ci` and strict `tsc` are clean, and the 14 compiled-executable tests pass against a fresh build with `PMR_EXECUTABLE`.

## Audit

Council with the Claude seat only (Gemini and GPT out of quota). Round 1: APPROVE, score 8.

Minor problems declined:
1. The no-provider test doesn't cover `off` mode at screen level. Declined: `icons.test.tsx` already shows `itemIconUrl` is null in `off` mode, and `ItemArt` renders no image on a null URL.
2. The "row height doesn't change" claim isn't in the diff. Declined: the CSS comes from the viewer icons ticket and is unchanged here, and the same row pattern is already in use on the Party screen.

## Not done

No CI run and no merge, per the master's instructions. No screenshot of the rendered screen was taken.

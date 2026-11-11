---
type: grilling
blocked_by: []
assets: []
---

# Game identification

## Question

How does the app tell which game profile is loaded, especially for ROM hacks whose hash is unknown and whose game code copies the base game?

Profiles reserve an `identify` block (`sha1` list, `gameCode`) from [Game profile source and format](./005-game-profile-source.md). Decide the identification signals and their order, how a Gen 1-2 game without a game code is told apart, how unknown hacks are handled (refuse, guess a base game, or let the user pick a profile in the viewer), and what `status.game` reports when the match is uncertain.

# Synthetic fixtures

These files test the fixture format, `SliceAdapter` and golden comparison. They are not captures of a game.

- They live here, not in `server/test/fixtures/<profile-id>/`, so the coverage guard over `fixtures/` never mistakes them for real captures.
- `emerald-us-1.0/two-mon-party.fixture.json` holds a party count byte and six party slots built with the test encoder (`server/test/gen3/encode.ts`).
- `two-mon-party.expected.json` is the party decoder's output for it. Its values were checked by hand against the encoder inputs (species 277 and 280, nicknames LEAFY and SPARK, levels 5 and 12, HP 19 and 30). `verified` is empty because nobody checked it against a game, so the test shows the output stays the same, not that it is right.

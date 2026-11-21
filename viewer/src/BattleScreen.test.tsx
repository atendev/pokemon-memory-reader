import { describe, expect, test } from "bun:test";
import type { Battle } from "@pokemon-memory-reader/api/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { Screen } from "./App";
import {
  BattleScreen,
  isHiddenBattler,
  OpponentPartyView,
} from "./BattleScreen";
import { activeBattle, battler, opponentMon, status, trainer } from "./testing";

const ready = (value: Battle) => ({ kind: "ready", value }) as const;
const render = (battle: Battle) =>
  renderToStaticMarkup(<BattleScreen battle={ready(battle)} />);

/** Values the unrevealed mon carries in the API body that no markup may repeat. */
const SECRET = {
  species: { id: 150, dex: 150, name: "Mewtwo" },
  level: 77,
  hp: 31,
  maxHp: 233,
  moves: [
    {
      id: 94,
      name: "Psychic",
      type: "psychic" as const,
      pp: 10,
      maxPp: 16,
      ppUps: 0,
    },
  ],
};
const SECRET_WORDS = ["Mewtwo", "Psychic", "77", "233", "150"];

describe("the screen's loading and failure states", () => {
  test("loading and unavailable say so and name no battle", () => {
    const loading = renderToStaticMarkup(
      <BattleScreen battle={{ kind: "loading" }} />,
    );
    expect(loading).toContain("Reading the battle");
    const down = renderToStaticMarkup(
      <BattleScreen battle={{ kind: "unavailable", code: "no_data" }} />,
    );
    expect(down).toContain("be read right now");
  });

  test("the app routes to it once a game is identified", () => {
    const html = renderToStaticMarkup(
      <Screen
        route="battle"
        status={status("game")}
        party={{ kind: "loading" }}
        battle={ready({ active: false, lastBattle: null })}
      />,
    );
    expect(html).toContain("No battle");
    expect(html).not.toContain("isn't built yet");
  });

  test("with no game it still gives way to the connection screen", () => {
    const html = renderToStaticMarkup(
      <Screen
        route="battle"
        status={status("disconnected")}
        party={{ kind: "loading" }}
        battle={ready(activeBattle())}
      />,
    );
    expect(html).toContain("Waiting for an emulator");
    expect(html).not.toContain("Wild encounter");
  });
});

describe("no battle", () => {
  test("an empty state with no last battle shows no summary", () => {
    const html = render({ active: false, lastBattle: null });
    expect(html).toContain("No battle");
    expect(html).not.toContain("Last battle");
  });

  test("a last battle gets a one-line summary, and its opponent party never shows", () => {
    const html = render({
      active: false,
      lastBattle: {
        battleId: 4,
        outcome: "won",
        endedAt: "2026-11-21T10:00:00.000Z",
        kind: "trainer",
        format: "single",
        modes: [],
        trainers: [trainer({ name: "JOEY", className: "YOUNGSTER" })],
        opponentParty: [
          opponentMon({ ...SECRET, partySlot: 0, trainer: 0, revealed: false }),
        ],
      },
    });
    expect(html).toContain("Last battle");
    expect(html).toContain("Won · JOEY · single");
    for (const word of SECRET_WORDS) expect(html).not.toContain(word);
  });
});

describe("a wild battle", () => {
  const html = render(
    activeBattle({
      turn: 3,
      modes: ["safari"],
      player: {
        active: [
          battler({
            species: { id: 277, dex: 277, name: "Grovyle" },
            level: 18,
            types: ["grass"],
            moves: [{ id: 33, name: "Tackle", pp: 30, maxPp: 35 }],
            stats: { hp: 50, atk: 40, def: 30, spa: 45, spd: 35, spe: 60 },
            statStages: {
              atk: 2,
              def: 0,
              spa: 0,
              spd: 0,
              spe: -1,
              acc: 0,
              eva: 0,
            },
          }),
        ],
        partner: null,
      },
      opponent: {
        active: [
          battler({
            owner: "opponent",
            species: { id: 261, dex: 261, name: "Poochyena" },
            level: 3,
            hp: 5,
            maxHp: 12,
            status: "poison",
            heldItem: { id: 4, name: "Oran Berry" },
            moves: [{ id: 33, name: "Tackle", pp: 35, maxPp: 35 }],
          }),
        ],
        party: [opponentMon({ trainer: null, partySlot: 0 })],
        trainers: [],
      },
    }),
  );

  test("has a Wild encounter header with kind, format, modes and turn, and no trainer card", () => {
    expect(html).toContain("Wild encounter");
    expect(html).toContain("<dt");
    expect(html).toMatch(/Kind<\/dt><dd>Wild</);
    expect(html).toMatch(/Format<\/dt><dd>Single</);
    expect(html).toMatch(/Modes<\/dt><dd>safari</);
    expect(html).toMatch(/Turn<\/dt><dd>3</);
    expect(html).not.toContain("Prize money");
  });

  test("your active card is full, the opponent's has no stats", () => {
    expect(html).toContain("Grovyle");
    expect(html).toContain("ATK +2");
    expect(html).toContain("SPE -1");
    expect(html).toContain(">60<");
    expect(html).toContain("Poochyena");
    expect(html).toContain("Oran Berry");
    expect(html).toContain("poison");
    expect(html.match(/class="stats /g)).toHaveLength(1);
  });

  test("shows no field card while nothing is active", () => {
    expect(html).not.toContain('aria-label="Field"');
  });
});

describe("a trainer battle with unrevealed mons", () => {
  const battle = activeBattle({
    kind: "trainer",
    format: "single",
    turn: null,
    opponent: {
      active: [
        battler({
          owner: "opponent",
          partySlot: 0,
          species: { id: 261, dex: 261, name: "Poochyena" },
          level: 5,
        }),
      ],
      party: [
        opponentMon({ partySlot: 0, trainer: 0, hp: 8, revealed: true }),
        opponentMon({ ...SECRET, partySlot: 1, trainer: 0, revealed: false }),
        opponentMon({ ...SECRET, partySlot: 2, trainer: 0, revealed: false }),
      ],
      trainers: [
        trainer({
          id: 7,
          className: "YOUNGSTER",
          name: "JOEY",
          prizeMoney: 120,
          items: [{ id: 13, name: "Potion" }],
        }),
      ],
    },
  });

  test("an unrevealed mon shows no species, level, HP or moves anywhere in the DOM", () => {
    const html = render(battle);
    for (const word of SECRET_WORDS) expect(html).not.toContain(word);
    expect(html).not.toContain("31");
  });

  test("hidden tiles keep their place: the tile count is the party size", () => {
    const html = render(battle);
    expect(html.match(/class="tile[ "]/g)).toHaveLength(3);
    expect(html.match(/tile-hidden/g)).toHaveLength(2);
    expect(html.match(/class="ball"/g)).toHaveLength(2);
    expect(html).toContain("?");
  });

  test("the active tile is highlighted", () => {
    const html = render(battle);
    expect(html.match(/tile-active/g)).toHaveLength(1);
    expect(html).toMatch(/tile tile-active"><span[^>]*>Poochyena/);
  });

  test("the trainer card carries class, name, prize money, items and Pokémon left", () => {
    const html = render(battle);
    expect(html).toContain("JOEY");
    expect(html).toContain("YOUNGSTER");
    expect(html).toMatch(/Prize money<\/dt><dd[^>]*>120</);
    expect(html).toContain("Potion");
    // Three mons with HP above 0, one revealed and two not: the count includes the hidden ones.
    expect(html).toMatch(/Pokémon left<\/dt><dd[^>]*>3</);
    expect(html).toMatch(/Kind<\/dt><dd>Trainer</);
  });

  test("with the setting on, unrevealed tiles render like revealed ones", () => {
    const html = renderToStaticMarkup(
      <OpponentPartyView
        battle={battle as never}
        show
        overridden={false}
        onChange={() => {}}
      />,
    );
    expect(html).toContain("Mewtwo");
    expect(html).toContain("Lv. 77");
    expect(html).not.toContain("tile-hidden");
    expect(html).toContain("checked");
  });

  test("an override disables the checkbox and says why", () => {
    const html = renderToStaticMarkup(
      <OpponentPartyView
        battle={battle as never}
        show={false}
        overridden
        onChange={() => {}}
      />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("page address");
    expect(html).not.toContain("Mewtwo");
  });

  test("the toggle is labelled as the spec words it", () => {
    expect(render(battle)).toContain("Show unrevealed opponent Pokémon");
  });
});

describe("trainer card fallbacks", () => {
  const base = (trainers: ReturnType<typeof trainer>[]) =>
    render(
      activeBattle({
        kind: "trainer",
        opponent: {
          active: [],
          party: [],
          trainers,
        },
      }),
    );

  test("a null name falls back to the class name, then Trainer, with — for nulls", () => {
    const html = base([
      trainer({ id: 1, className: "LASS" }),
      trainer({ id: 2 }),
    ]);
    expect(html).toContain(">LASS<");
    expect(html).toContain(">Trainer<");
    expect(html).toMatch(/Prize money<\/dt><dd[^>]*>—</);
    expect(html).toMatch(/Items<\/dt><dd>—</);
  });

  test("kind, format, modes and turn go on the first card only", () => {
    const html = base([trainer({ id: 1 }), trainer({ id: 2 })]);
    expect(html.match(/Kind<\/dt>/g)).toHaveLength(1);
  });

  test("a trainer battle with no trainer entry still shows its facts", () => {
    const html = base([]);
    expect(html).toContain("Trainer battle");
    expect(html).toMatch(/Kind<\/dt><dd>Trainer</);
  });
});

describe("a double battle", () => {
  const html = render(
    activeBattle({
      kind: "trainer",
      format: "double",
      player: {
        active: [
          battler({
            position: 0,
            species: { id: 252, dex: 252, name: "Treecko" },
          }),
          battler({
            position: 2,
            owner: "partner",
            species: { id: 255, dex: 255, name: "Torchic" },
          }),
        ],
        partner: trainer({ id: 3, name: "STEVEN", className: "CHAMPION" }),
      },
      opponent: {
        active: [
          battler({
            position: 1,
            owner: "opponent",
            partySlot: 0,
            species: { id: 261, dex: 261, name: "Poochyena" },
          }),
          battler({
            position: 3,
            owner: "opponent",
            partySlot: 1,
            species: { id: 263, dex: 263, name: "Zigzagoon" },
          }),
        ],
        party: [
          opponentMon({ partySlot: 0, trainer: 0, hp: 9 }),
          opponentMon({
            partySlot: 1,
            trainer: 0,
            hp: 9,
            species: { id: 263, dex: 263, name: "Zigzagoon" },
          }),
          opponentMon({ ...SECRET, partySlot: 2, trainer: 1, revealed: false }),
        ],
        trainers: [
          trainer({ id: 5, name: "TATE" }),
          trainer({ id: 6, name: "LIZA" }),
        ],
      },
      field: {
        weather: "sandstorm",
        terrain: null,
        sides: {
          player: {
            reflect: null,
            lightScreen: true,
            safeguard: null,
            mist: null,
            spikes: null,
          },
          opponent: {
            reflect: null,
            lightScreen: null,
            safeguard: null,
            mist: null,
            spikes: 3,
          },
        },
      },
    }),
  );

  test("stacks two battler cards on each side", () => {
    for (const name of ["Treecko", "Torchic", "Poochyena", "Zigzagoon"]) {
      expect(html).toContain(name);
    }
    expect(html.match(/class="card mon battler"/g)).toHaveLength(4);
    expect(html).toContain("Partner");
    expect(html).toMatch(/Format<\/dt><dd>Double</);
  });

  test("shows one trainer card per entry, with Pokémon left split between them", () => {
    expect(html).toContain("TATE");
    expect(html).toContain("LIZA");
    expect(html).toContain("STEVEN");
    const lefts = [
      ...html.matchAll(/Pokémon left<\/dt><dd[^>]*>([^<]+)</g),
    ].map((m) => m[1]);
    expect(lefts).toEqual(["2", "1", "—"]);
  });

  test("shows field badges for active effects only", () => {
    expect(html).toContain("Sandstorm");
    expect(html).toContain("Light Screen");
    expect(html).toContain("Spikes ×3");
    expect(html).not.toContain("Reflect");
    expect(html).not.toContain("Terrain");
  });

  test("still hides the unrevealed mon", () => {
    for (const word of SECRET_WORDS) expect(html).not.toContain(word);
  });
});

describe("an unrevealed opponent battler", () => {
  const battle = activeBattle({
    kind: "trainer",
    opponent: {
      active: [
        battler({
          owner: "opponent",
          partySlot: 1,
          species: SECRET.species,
          level: SECRET.level,
          moves: [{ id: 94, name: "Psychic", pp: 10, maxPp: 16 }],
        }),
      ],
      party: [
        opponentMon({ partySlot: 0, trainer: 0 }),
        opponentMon({ ...SECRET, partySlot: 1, trainer: 0, revealed: false }),
      ],
      trainers: [trainer({ id: 1, name: "JOEY" })],
    },
  });

  test("shows no species, level or moves on its battler card either", () => {
    const html = render(battle);
    for (const word of SECRET_WORDS) expect(html).not.toContain(word);
    expect(html).toContain("battler-hidden");
  });

  test("shows the battler once the setting is on", () => {
    expect(
      isHiddenBattler(
        battle as never,
        battle.opponent.active[0] as never,
        true,
      ),
    ).toBe(false);
    expect(
      isHiddenBattler(
        battle as never,
        battle.opponent.active[0] as never,
        false,
      ),
    ).toBe(true);
  });
});

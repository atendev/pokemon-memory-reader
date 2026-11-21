import { describe, expect, test } from "bun:test";
import type { Bag, Player, Pocket } from "@pokemon-memory-reader/api/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { Screen } from "./App";
import { IconsProvider } from "./Art";
import { IconFailures, type IconSettings } from "./icons";
import { TrainerScreen } from "./TrainerScreen";
import { status } from "./testing";
import type { Loaded } from "./useResource";

const ready = <T,>(value: T): Loaded<T> => ({ kind: "ready", value });
const LOADING = { kind: "loading" } as const;
const GYM = [
  "Stone Badge",
  "Knuckle Badge",
  "Dynamo Badge",
  "Heat Badge",
  "Balance Badge",
  "Feather Badge",
  "Mind Badge",
  "Rain Badge",
];
const badges = (names: readonly (string | null)[], obtained: number[]) =>
  names.map((name, id) => ({ id, name, obtained: obtained.includes(id) }));
const player = (overrides: Partial<Player> = {}): Player => ({
  name: "BRENDAN",
  trainerId: 12345,
  secretId: 6789,
  money: 4200,
  badges: badges(GYM, [0, 1]),
  location: {
    mapGroup: 0,
    mapNumber: 9,
    x: 4,
    y: 7,
    section: { id: 3, name: "LITTLEROOT TOWN" },
  },
  playTime: { hours: 12, minutes: 5, seconds: 9, frames: 30 },
  ...overrides,
});
const pocket = (
  id: Pocket["id"],
  capacity: number,
  items: Pocket["items"] = [],
): Pocket => ({ id, capacity, items });
const stacks = (count: number): Pocket["items"] =>
  Array.from({ length: count }, (_, i) => ({
    item: { id: i + 1, name: `ITEM${i + 1}` },
    quantity: 1,
  }));
const bag = (...pockets: Pocket[]): Bag => ({ pockets });
const render = (p: Loaded<Player>, b: Loaded<Bag> = LOADING) =>
  renderToStaticMarkup(<TrainerScreen player={p} bag={b} />);

describe("the trainer card", () => {
  test("shows the name, IDs, money, play time and location", () => {
    const html = render(ready(player()));
    expect(html).toContain("BRENDAN");
    expect(html).toContain("12345");
    expect(html).toContain("06789");
    expect(html).toContain("₽4,200");
    expect(html).toContain("12:05:09");
    expect(html).toContain("LITTLEROOT TOWN");
    expect(html).toContain("Map 0:9 · x 4, y 7");
  });

  test("a null secret ID and a null name are hidden, not shown as text", () => {
    const html = render(
      ready(
        player({
          secretId: null,
          name: null as unknown as string,
        }),
      ),
    );
    expect(html).not.toContain("Secret ID");
    expect(html).not.toContain("Name</dt>");
    expect(html).not.toContain("null");
    expect(html).toContain("Trainer ID");
  });

  test("an empty name is hidden too", () => {
    expect(render(ready(player({ name: "" })))).not.toContain("Name</dt>");
  });

  test("a map with no section says the area is unknown, and an unnamed one prints its ID", () => {
    const at = player().location;
    expect(
      render(ready(player({ location: { ...at, section: null } }))),
    ).toContain("Unknown area");
    expect(
      render(
        ready(player({ location: { ...at, section: { id: 88, name: null } } })),
      ),
    ).toContain("#88");
  });

  test("Gen 1 has no map group", () => {
    const at = player().location;
    const html = render(ready(player({ location: { ...at, mapGroup: null } })));
    expect(html).toContain("Map 9 · x 4, y 7");
  });
});

describe("the badge row", () => {
  test("marks obtained and missing badges in words, not only colour", () => {
    const html = render(ready(player()));
    expect(html.match(/badge-obtained/g)).toHaveLength(2);
    expect(html.match(/badge-missing/g)).toHaveLength(6);
    expect(html.match(/Obtained/g)).toHaveLength(2);
    expect(html.match(/Not yet/g)).toHaveLength(6);
    expect(html).toContain("2 of 8");
    expect(html).not.toContain("Johto");
  });

  test("a Gen 2 player gets two labelled rows of eight", () => {
    const names = Array.from({ length: 16 }, (_, i) => `B${i}`);
    const html = render(ready(player({ badges: badges(names, [0, 8, 9]) })));
    expect(html.match(/<ul class="badge-row"/g)).toHaveLength(2);
    expect(html).toContain("Johto");
    expect(html).toContain("Kanto");
    expect(html).toContain("3 of 16");
  });

  test("a hack badge with no name prints Badge <n>", () => {
    const html = render(ready(player({ badges: badges([null, "X"], [0]) })));
    expect(html).toContain("Badge 1");
  });
});

describe("the bag", () => {
  test("lists each pocket with its fill and stacks", () => {
    const html = render(
      ready(player()),
      ready(
        bag(
          pocket("items", 30, [
            { item: { id: 13, name: "POTION" }, quantity: 5 },
          ]),
          pocket("balls", 16),
        ),
      ),
    );
    expect(html).toContain("Items");
    expect(html).toContain("1 / 30");
    expect(html).toContain("POTION");
    expect(html).toContain("×5");
    expect(html).toContain("Balls");
    expect(html).toContain("0 / 16");
  });

  test("an empty pocket says Empty", () => {
    const html = render(ready(player()), ready(bag(pocket("keyItems", 30))));
    expect(html).toContain("Key items");
    expect(html).toContain("pocket-empty");
    expect(html).toContain("Empty");
    expect(html).not.toContain("Full");
  });

  test("a full pocket is flagged", () => {
    const html = render(
      ready(player()),
      ready(bag(pocket("balls", 16, stacks(16)))),
    );
    expect(html).toContain("16 / 16 · Full");
    expect(html).toContain("pocket-full");
  });

  test("a pocket one short of full is not flagged", () => {
    const html = render(
      ready(player()),
      ready(bag(pocket("balls", 16, stacks(15)))),
    );
    expect(html).toContain("15 / 16");
    expect(html).not.toContain("Full");
  });

  test("an item the name table doesn't know prints #<id>", () => {
    const html = render(
      ready(player()),
      ready(
        bag(
          pocket("items", 30, [{ item: { id: 377, name: null }, quantity: 2 }]),
        ),
      ),
    );
    expect(html).toContain("#377");
    expect(html).toContain("×2");
  });

  test("a stack of zero in a slot pocket still shows", () => {
    const html = render(
      ready(player()),
      ready(
        bag(
          pocket("tmhm", 64, [
            { item: { id: 289, name: "TM01" }, quantity: 0 },
          ]),
        ),
      ),
    );
    expect(html).toContain("TMs &amp; HMs");
    expect(html).toContain("×0");
  });
});

describe("loading and failure", () => {
  test("each resource shows its own loading line", () => {
    const html = render(LOADING, LOADING);
    expect(html).toContain("Reading the trainer");
    expect(html).toContain("Reading the bag");
  });

  test("one resource failing leaves the other showing", () => {
    const html = render(
      { kind: "unavailable", code: "no_data" },
      ready(bag(pocket("items", 30))),
    );
    expect(html).toContain("The trainer can&#x27;t be read right now");
    expect(html).toContain("0 / 30");
    const other = render(ready(player()), { kind: "unavailable", code: null });
    expect(other).toContain("BRENDAN");
    expect(other).toContain("The bag can&#x27;t be read right now");
  });

  test("a bag with no pockets says so", () => {
    expect(render(ready(player()), ready(bag()))).toContain("no bag pockets");
  });
});

describe("item icons", () => {
  const emerald: IconSettings = {
    profileId: "emerald-us-1.0",
    generation: 3,
    mode: "online",
  };
  const withIcons = (failures = new IconFailures()) =>
    renderToStaticMarkup(
      <IconsProvider settings={emerald} failures={failures}>
        <TrainerScreen
          player={LOADING}
          bag={ready(
            bag(
              pocket("items", 30, [
                { item: { id: 13, name: "Potion" }, quantity: 5 },
                { item: { id: 999, name: null }, quantity: 1 },
              ]),
            ),
          )}
        />
      </IconsProvider>,
    );

  test("an item shows its icon beside its name, with the name still text", () => {
    expect(withIcons()).toMatch(/<img[^>]*item\/13[^>]*\/>Potion/);
  });

  test("an item whose icon is missing falls back to the plain row", () => {
    const failures = new IconFailures();
    failures.fail("/icons/emerald-us-1.0/item/13");
    const html = withIcons(failures);
    expect(html).not.toContain("item/13");
    expect(html).toContain("Potion");
    expect(html).toContain("×5");
  });

  test("an unknown item shows #<id> and asks for its icon like any other", () => {
    expect(withIcons()).toMatch(/<img[^>]*item\/999[^>]*\/>#999/);
    const failures = new IconFailures();
    failures.fail("/icons/emerald-us-1.0/item/999");
    const html = withIcons(failures);
    expect(html).toContain("#999");
    expect(html).not.toContain("item/999");
  });

  test("without icon settings no image is requested", () => {
    expect(
      render(LOADING, ready(bag(pocket("items", 30, stacks(2))))),
    ).not.toContain("<img");
  });
});

describe("the route", () => {
  test("opens in a game and gives way to the connection screen without one", () => {
    const inGame = renderToStaticMarkup(
      <Screen
        route="trainer"
        status={status("game")}
        party={LOADING}
        player={ready(player())}
        bag={ready(bag(pocket("items", 30)))}
      />,
    );
    expect(inGame).toContain('id="trainer-title"');
    expect(inGame).toContain("BRENDAN");
    const out = renderToStaticMarkup(
      <Screen route="trainer" status={status("no_game")} party={LOADING} />,
    );
    expect(out).toContain("No game loaded");
  });
});

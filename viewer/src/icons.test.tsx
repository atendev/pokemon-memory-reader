import { describe, expect, test } from "bun:test";
import type { Pokemon } from "@pokemon-memory-reader/api/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { IconsProvider, ItemArt, SpeciesArt, TypeArt } from "./Art";
import { BattleScreen } from "./BattleScreen";
import { BoxesScreen } from "./BoxesScreen";
import {
  IconFailures,
  type IconSettings,
  itemIconUrl,
  menuIconUrl,
  parseIconMode,
  spriteUrl,
  typeIconUrl,
} from "./icons";
import { PartyCard } from "./PartyScreen";
import { activeBattle, mon, opponentMon } from "./testing";

const emerald: IconSettings = {
  profileId: "emerald-us-1.0",
  generation: 3,
  mode: "online",
};

const render = (
  node: React.ReactNode,
  settings: IconSettings = emerald,
  failures = new IconFailures(),
) =>
  renderToStaticMarkup(
    <IconsProvider settings={settings} failures={failures}>
      {node}
    </IconsProvider>,
  );

describe("the icon URLs", () => {
  test("are built from the profile ID and the IDs the API sends", () => {
    expect(spriteUrl(emerald, 252, false)).toBe(
      "/icons/emerald-us-1.0/pokemon/252",
    );
    expect(spriteUrl(emerald, 252, true)).toBe(
      "/icons/emerald-us-1.0/pokemon/252/shiny",
    );
    expect(menuIconUrl(emerald, 252)).toBe("/icons/emerald-us-1.0/icon/252");
    expect(itemIconUrl(emerald, 13)).toBe("/icons/emerald-us-1.0/item/13");
    expect(typeIconUrl(emerald, "fire")).toBe(
      "/icons/emerald-us-1.0/type/fire",
    );
    expect(typeIconUrl(emerald, "mystery")).toBe(
      "/icons/emerald-us-1.0/type/mystery",
    );
  });

  test("never ask for a Gen 1 shiny sprite", () => {
    const gen1 = { ...emerald, profileId: "red-us", generation: 1 };
    expect(spriteUrl(gen1, 25, true)).toBe("/icons/red-us/pokemon/25");
  });

  test("are not built with no game, in off mode, or before the mode is known", () => {
    for (const settings of [
      { ...emerald, profileId: null },
      { ...emerald, mode: "off" as const },
      { ...emerald, mode: null },
    ]) {
      expect(spriteUrl(settings, 252, false)).toBeNull();
      expect(menuIconUrl(settings, 252)).toBeNull();
      expect(itemIconUrl(settings, 13)).toBeNull();
      expect(typeIconUrl(settings, "fire")).toBeNull();
    }
  });

  test("are built in local mode, where the program reads the pack only", () => {
    expect(spriteUrl({ ...emerald, mode: "local" }, 1, false)).not.toBeNull();
  });
});

describe("parseIconMode", () => {
  test("reads the mode from a settings body and ignores what it doesn't know", () => {
    const body = (mode: unknown) => ({
      settings: { icons: { value: { mode, baseUrl: null } }, port: {} },
    });
    expect(parseIconMode(body("local"))).toBe("local");
    expect(parseIconMode(body("sideways"))).toBeNull();
    expect(parseIconMode({})).toBeNull();
    expect(parseIconMode(null)).toBeNull();
  });
});

describe("a found icon", () => {
  test("shows the image in a box of the sprite's size", () => {
    const html = render(
      <SpeciesArt variant="sprite" id={252} name="Treecko" />,
    );
    expect(html).toContain('src="/icons/emerald-us-1.0/pokemon/252"');
    expect(html).toContain('width="64" height="64"');
    expect(html).toContain("width:64px;height:64px");
    expect(html).not.toContain("art-tile");
  });

  test("a shiny Pokémon asks for the shiny route", () => {
    const html = render(
      <SpeciesArt variant="sprite" id={252} name="Treecko" shiny />,
    );
    expect(html).toContain("/pokemon/252/shiny");
  });

  test("a menu icon asks the icon route", () => {
    const html = render(<SpeciesArt variant="menu" id={252} name="Treecko" />);
    expect(html).toContain('src="/icons/emerald-us-1.0/icon/252"');
  });

  test("an item shows its icon beside the name, and a type its icon beside the type", () => {
    expect(render(<ItemArt id={13} name="Potion" />)).toMatch(
      /<img[^>]*item\/13[^>]*\/>Potion/,
    );
    expect(render(<TypeArt type="fire" />)).toMatch(
      /<img[^>]*type\/fire[^>]*\/>fire/,
    );
  });
});

describe("a missing icon", () => {
  const missing = () => {
    const failures = new IconFailures();
    failures.fail("/icons/emerald-us-1.0/pokemon/252");
    failures.fail("/icons/emerald-us-1.0/item/13");
    failures.fail("/icons/emerald-us-1.0/type/fire");
    return failures;
  };

  test("shows a tinted tile at the same size with the name's first letter", () => {
    const html = render(
      <SpeciesArt variant="sprite" id={252} name="Treecko" type="grass" />,
      emerald,
      missing(),
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("art-tile type-grass");
    expect(html).toContain("width:64px;height:64px");
    expect(html).toContain(">T<");
  });

  test("a nameless species shows #<id>", () => {
    const html = render(
      <SpeciesArt variant="sprite" id={252} name={null} />,
      emerald,
      missing(),
    );
    expect(html).toContain(">#252<");
  });

  test("an item falls back to its name or #<id>, and a type to a dot in its colour", () => {
    const failures = missing();
    expect(render(<ItemArt id={13} name="Potion" />, emerald, failures)).toBe(
      "Potion",
    );
    expect(render(<ItemArt id={13} name={null} />, emerald, failures)).toBe(
      "#13",
    );
    const type = render(<TypeArt type="fire" />, emerald, failures);
    expect(type).not.toContain("<img");
    expect(type).toContain("type-dot type-fire");
  });

  test("shows the fallback with no provider, as a screen under test has none", () => {
    const html = renderToStaticMarkup(
      <SpeciesArt variant="sprite" id={252} name="Treecko" />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("art-tile");
  });

  test("an egg shows a tile and makes no request", () => {
    const html = render(
      <SpeciesArt variant="sprite" id={252} name="Treecko" egg />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain(">E<");
  });

  test("the failure is remembered until the URL changes, and tells the screen to re-render", () => {
    const failures = new IconFailures();
    let calls = 0;
    const stop = failures.subscribe(() => {
      calls += 1;
    });
    failures.fail("/icons/p/pokemon/1");
    failures.fail("/icons/p/pokemon/1");
    stop();
    failures.fail("/icons/p/pokemon/2");
    expect(calls).toBe(1);
    expect(failures.has("/icons/p/pokemon/1")).toBe(true);
    expect(failures.has("/icons/q/pokemon/1")).toBe(false);
  });
});

describe("a pack switch", () => {
  const species = <SpeciesArt variant="sprite" id={252} name="Treecko" />;

  test("a new profile is a new key, so a failed icon is tried again", () => {
    const failures = new IconFailures();
    failures.fail("/icons/emerald-us-1.0/pokemon/252");
    expect(render(species, emerald, failures)).toContain("art-tile");
    const hack = { ...emerald, profileId: "radical-red-4.1" };
    const html = render(species, hack, failures);
    expect(html).toContain('src="/icons/radical-red-4.1/pokemon/252"');
    expect(html).not.toContain("art-tile");
  });

  test("switching the mode to off drops every image, and back to local brings them back", () => {
    expect(render(species, { ...emerald, mode: "off" })).not.toContain("<img");
    expect(render(species, { ...emerald, mode: "local" })).toContain("<img");
  });
});

describe("the party card", () => {
  const card = (overrides: Partial<Pokemon> = {}, settings = emerald) =>
    render(<PartyCard mon={mon(overrides)} />, settings);

  test("shows the sprite and a held item icon", () => {
    const html = card({ heldItem: { id: 13, name: "Potion" } });
    expect(html).toContain("/icons/emerald-us-1.0/pokemon/252");
    expect(html).toContain("/icons/emerald-us-1.0/item/13");
  });

  test("keeps its sprite box the same size whether the image shows or not, so the layout doesn't shift", () => {
    const withImage = card();
    const without = card({}, { ...emerald, mode: "off" });
    const box = (html: string) => html.match(/width:64px;height:64px/g);
    expect(box(withImage)).toHaveLength(1);
    expect(box(without)).toHaveLength(1);
  });

  test("an egg asks for no icon", () => {
    expect(card({ isEgg: true })).not.toContain("/icons/");
  });
});

describe("the other screens", () => {
  test("the Boxes grid shows a menu icon in each filled slot", () => {
    const slots = Array.from({ length: 30 }, (_, i) =>
      i === 0 ? mon() : null,
    );
    const html = render(
      <BoxesScreen
        boxes={{
          kind: "ready",
          value: {
            currentBox: 0,
            boxes: [
              {
                index: 0,
                name: "BOX1",
                wallpaper: 0,
                readable: true,
                corruptSlots: [],
                slots,
              },
            ],
          },
        }}
        generation={3}
      />,
    );
    expect(html).toContain('src="/icons/emerald-us-1.0/icon/252"');
  });

  test("Battle shows battler sprites and revealed opponent menu icons, and none for an unrevealed mon", () => {
    const html = render(
      <BattleScreen
        battle={{
          kind: "ready",
          value: activeBattle({
            kind: "trainer",
            opponent: {
              ...activeBattle().opponent,
              party: [
                opponentMon({ partySlot: 0, revealed: true }),
                opponentMon({
                  partySlot: 1,
                  revealed: false,
                  species: { id: 150, dex: 150, name: "Mewtwo" },
                }),
              ],
            },
          }),
        }}
      />,
    );
    expect(html).toContain("/icons/emerald-us-1.0/pokemon/252");
    expect(html).toContain("/icons/emerald-us-1.0/icon/261");
    expect(html).not.toContain("/150");
  });
});

describe("the fallback tile's tint", () => {
  test("the grey base rule comes before the type colours, so a typed tile keeps its tint", async () => {
    const css = await Bun.file(new URL("./styles.css", import.meta.url)).text();
    const base = css.indexOf(".art-tile {\n  background: var(--gray);");
    expect(base).toBeGreaterThan(-1);
    expect(base).toBeLessThan(css.indexOf(".type-fire {"));
    expect(css).not.toMatch(
      /\.art-tile \{[^}]*border-radius: 12px;\n {2}background/,
    );
  });
});

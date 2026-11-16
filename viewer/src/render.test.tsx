import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Screen } from "./App";
import { mon, status } from "./testing";

const ready = <T,>(value: T) => ({ kind: "ready", value }) as const;

describe("the empty states, shown while there is no game to read", () => {
  test("a fresh run is disconnected, so it tells the user to load the bridge and links the download", () => {
    const html = renderToStaticMarkup(
      <Screen status={status("disconnected")} party={{ kind: "loading" }} />,
    );
    expect(html).toContain("Waiting for an emulator");
    expect(html).toContain('href="/bridges/mgba.lua"');
    expect(html).not.toContain("Party");
  });

  test("a loaded emulator with no game explains it without install steps", () => {
    const html = renderToStaticMarkup(
      <Screen status={status("no_game")} party={{ kind: "loading" }} />,
    );
    expect(html).toContain("No game loaded");
    expect(html).not.toContain("/bridges/mgba.lua");
  });

  test("an unreachable program says so", () => {
    const html = renderToStaticMarkup(
      <Screen status={null} party={{ kind: "loading" }} />,
    );
    expect(html).toContain("Cannot reach the program");
  });
});

describe("the party screen", () => {
  const game = status("game");

  test("shows six slots: cards for the members and placeholders for the rest", () => {
    const html = renderToStaticMarkup(
      <Screen
        status={game}
        party={ready({ pokemon: [mon({ nickname: "LEAFY" }), mon()] })}
      />,
    );
    expect(html.match(/class="card mon"/g)).toHaveLength(2);
    expect(html.match(/slot-empty/g)).toHaveLength(4);
    expect(html).toContain("LEAFY");
    expect(html).toContain("Lv. 5");
    expect(html).toContain("20 / 20");
  });

  test("falls back to #id for a missing species name and a dash for null fields", () => {
    const html = renderToStaticMarkup(
      <Screen
        status={game}
        party={ready({
          pokemon: [
            mon({
              species: { id: 411, dex: null, name: null },
              level: null,
              hp: null,
              maxHp: null,
            }),
          ],
        })}
      />,
    );
    expect(html).toContain("#411");
    expect(html).toContain("Lv. —");
    expect(html).toContain("— / —");
  });

  test("shows a note instead of cards while the party is unavailable", () => {
    const html = renderToStaticMarkup(
      <Screen status={game} party={{ kind: "unavailable", code: "no_data" }} />,
    );
    expect(html).toContain("be read right now");
    expect(html).not.toContain('class="card mon"');
  });
});

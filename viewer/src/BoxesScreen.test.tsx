import { describe, expect, test } from "bun:test";
import type { Box, Boxes } from "@pokemon-memory-reader/api/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { Screen } from "./App";
import { BoxesScreen } from "./BoxesScreen";
import { mon, status } from "./testing";

const ready = (value: Boxes) => ({ kind: "ready", value }) as const;
const slotsOf = (
  size: number,
  filled: Record<number, ReturnType<typeof mon>>,
) => Array.from({ length: size }, (_, i) => filled[i] ?? null);
const box = (overrides: Partial<Box> = {}): Box => ({
  index: 0,
  name: "BOX1",
  wallpaper: 3,
  readable: true,
  corruptSlots: [],
  slots: slotsOf(30, {}),
  ...overrides,
});
const render = (
  boxes: Boxes,
  generation = 3,
  initial?: { box: number; slot?: number },
) =>
  renderToStaticMarkup(
    <BoxesScreen
      boxes={ready(boxes)}
      generation={generation}
      initial={initial}
    />,
  );

describe("the boxes screen", () => {
  test("shows the box name, wallpaper, mons and empty slots in a six-wide grid", () => {
    const html = render({
      currentBox: 0,
      boxes: [box({ slots: slotsOf(30, { 0: mon({ nickname: "LEAFY" }) }) })],
    });
    expect(html).toContain("BOX1 (current)");
    expect(html).toContain("Wallpaper 3");
    expect(html).toContain("LEAFY");
    expect(html.match(/box-slot-empty/g)).toHaveLength(29);
    expect(html).toContain("repeat(6, 1fr)");
  });

  test("a Gen 1-2 box has 20 slots, five across, and carries the staleness note", () => {
    const html = render(
      { currentBox: 0, boxes: [box({ slots: slotsOf(20, {}) })] },
      2,
    );
    expect(html).toContain("repeat(5, 1fr)");
    expect(html.match(/box-slot-empty/g)).toHaveLength(20);
    expect(html).toContain("only as fresh as the last in-game save");
  });

  test("Gen 3 shows no staleness note", () => {
    const html = render({ currentBox: 0, boxes: [box()] });
    expect(html).not.toContain("only as fresh as");
  });

  test("a corrupt slot is marked apart from an empty one", () => {
    const html = render({
      currentBox: 0,
      boxes: [box({ corruptSlots: [1] })],
    });
    expect(html.match(/box-slot-corrupt/g)).toHaveLength(1);
    expect(html).toContain("Slot 2: corrupt");
    expect(html.match(/box-slot-empty/g)).toHaveLength(29);
    expect(html).toContain("1 slot could not be read and is marked corrupt");
  });

  test("an unreadable box shows a note and no grid, and keeps its name and wallpaper", () => {
    const html = render(
      {
        currentBox: 0,
        boxes: [
          box(),
          box({ index: 1, name: "SPARE", readable: false, slots: [] }),
        ],
      },
      2,
      { box: 1 },
    );
    expect(html).toContain("This box can&#x27;t be read");
    expect(html).toContain("save RAM access");
    expect(html).toContain("SPARE (unreadable)");
    expect(html).not.toContain('class="box-grid"');
  });

  test("an unreadable Gen 3 box blames the storage block", () => {
    const html = render({
      currentBox: null,
      boxes: [box({ readable: false, slots: [] })],
    });
    expect(html).toContain("PC storage couldn&#x27;t be decoded");
  });

  test("a null name falls back to Box <n>, and a null wallpaper is not shown", () => {
    const html = render({
      currentBox: 4,
      boxes: [box({ index: 4, name: null, wallpaper: null })],
    });
    expect(html).toContain("Box 5 (current)");
    expect(html).not.toContain("Wallpaper");
  });

  test("the selected mon opens its card with null fields as a dash", () => {
    const html = render(
      {
        currentBox: 0,
        boxes: [
          box({
            slots: slotsOf(30, {
              2: mon({ nickname: "LEAFY", hp: null, maxHp: null, level: null }),
            }),
          }),
        ],
      },
      3,
      { box: 0, slot: 2 },
    );
    expect(html).toContain("BOX1, slot 3");
    expect(html).toContain('class="card mon"');
    expect(html).toContain("— / —");
    expect(html).toContain('aria-pressed="true"');
  });

  test("a selection that belongs to another box opens no card", () => {
    const html = render(
      {
        currentBox: 0,
        boxes: [
          box({ slots: slotsOf(30, { 2: mon() }) }),
          box({ index: 1, slots: slotsOf(30, { 2: mon() }) }),
        ],
      },
      3,
      { box: 1, slot: 2 },
    );
    expect(html).toContain("BOX1, slot 3");
    const other = render(
      {
        currentBox: 0,
        boxes: [box({ slots: slotsOf(30, { 2: mon() }) })],
      },
      3,
      { box: 5, slot: 2 },
    );
    expect(other).not.toContain('class="card mon"');
  });

  test("says so while loading, when unavailable and when the game reports no boxes", () => {
    const loading = renderToStaticMarkup(
      <BoxesScreen boxes={{ kind: "loading" }} />,
    );
    expect(loading).toContain("Reading the boxes");
    const down = renderToStaticMarkup(
      <BoxesScreen boxes={{ kind: "unavailable", code: null }} />,
    );
    expect(down).toContain("can&#x27;t be read right now");
    expect(render({ currentBox: null, boxes: [] })).toContain(
      "reports no boxes",
    );
  });
});

describe("the boxes route", () => {
  test("gives way to the connection screen until a game is identified", () => {
    const html = renderToStaticMarkup(
      <Screen
        route="boxes"
        status={status("disconnected")}
        party={{ kind: "loading" }}
      />,
    );
    expect(html).toContain("Waiting for an emulator");
  });

  test("opens the Boxes screen in a game", () => {
    const html = renderToStaticMarkup(
      <Screen
        route="boxes"
        status={status("game")}
        party={{ kind: "loading" }}
        boxes={ready({ currentBox: 0, boxes: [box()] })}
      />,
    );
    expect(html).toContain('id="boxes-title"');
    expect(html).toContain("BOX1");
  });
});

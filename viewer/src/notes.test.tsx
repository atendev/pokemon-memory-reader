import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Screen } from "./App";
import { IdentificationNotes } from "./IdentificationNotes";
import { identificationNotes, missingFieldNotes } from "./notes";
import { game, status } from "./testing";

const unavailable = { species: "unavailable", moves: "unavailable" } as const;

describe("identification notes", () => {
  test("a header match says it matched without a hash, and by signature when it did", () => {
    expect(
      identificationNotes(game({ match: "header", signature: "match" })),
    ).toEqual([
      {
        kind: "info",
        text: "This ROM matched by header and signature, not by hash.",
      },
    ]);
    expect(
      identificationNotes(game({ match: "header", signature: null })),
    ).toEqual([
      { kind: "info", text: "This ROM matched by header, not by hash." },
    ]);
  });

  test("a manual pick after a signature mismatch warns that the tables moved", () => {
    const notes = identificationNotes(
      game({ match: "manual", signature: "mismatch" }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]?.kind).toBe("warning");
    expect(notes[0]?.text).toContain("data tables moved");
  });

  test("a manual pick that couldn't be checked warns that the program couldn't check", () => {
    const notes = identificationNotes(
      game({ match: "manual", signature: "unchecked" }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]?.kind).toBe("warning");
    expect(notes[0]?.text).toContain("couldn't check");
  });

  test("a clean manual pick, an exact match and a mismatch after an exact match show nothing", () => {
    expect(
      identificationNotes(game({ match: "manual", signature: "match" })),
    ).toEqual([]);
    expect(
      identificationNotes(game({ match: "manual", signature: null })),
    ).toEqual([]);
    expect(identificationNotes(game())).toEqual([]);
    expect(identificationNotes(game({ signature: "mismatch" }))).toEqual([]);
  });
});

describe("missing-field notes", () => {
  test("a profile that reads every table has no note", () => {
    expect(missingFieldNotes(game())).toEqual([]);
    expect(
      missingFieldNotes(game({ names: { ...game().names, abilities: null } })),
    ).toEqual([]);
  });

  test("an unreadable name table says its names show as #<id>", () => {
    const notes = missingFieldNotes(
      game({ names: { ...game().names, ...unavailable } }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]?.text).toBe(
      "This profile can't read species and move names, so they show as #<id>.",
    );
  });

  test("unreadable species data says those fields show as — or stay blank", () => {
    const notes = missingFieldNotes(
      game({
        speciesData: {
          info: "unavailable",
          dex: "builtin",
          exp: "unavailable",
        },
      }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]?.text).toBe(
      "This profile can't read types, gender and ability and levels of boxed Pokémon, so those fields show as — or stay blank.",
    );
  });
});

describe("the notes in the viewer", () => {
  test("they render as a labelled list, with warnings apart from plain notes", () => {
    const html = renderToStaticMarkup(
      <IdentificationNotes
        game={game({
          match: "manual",
          signature: "mismatch",
          names: { ...game().names, ...unavailable },
        })}
      />,
    );
    expect(html).toContain('aria-label="Identification notes"');
    expect(html).toContain("footnote warning");
    expect(html).toContain("footnote muted");
    expect(html).toContain("data tables moved");
    expect(html).toContain("species and move names");
  });

  test("they render nothing without a game or notes", () => {
    expect(renderToStaticMarkup(<IdentificationNotes game={null} />)).toBe("");
    expect(renderToStaticMarkup(<IdentificationNotes game={game()} />)).toBe(
      "",
    );
  });

  test("the game screens show them above the screen, and About and Settings do not", () => {
    const loading = { kind: "loading" } as const;
    const header = status("game", { game: game({ match: "header" }) });
    for (const route of ["party", "battle", "boxes", "trainer"] as const) {
      const html = renderToStaticMarkup(
        <Screen route={route} status={header} party={loading} />,
      );
      expect(html).toContain("matched by header and signature");
    }
    const about = renderToStaticMarkup(
      <Screen route="about" status={header} party={loading} />,
    );
    expect(about).not.toContain("matched by header");
  });
});

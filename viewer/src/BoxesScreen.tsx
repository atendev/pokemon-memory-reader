import type { Box, Boxes } from "@pokemon-memory-reader/api/schemas";
import { useState } from "react";
import { SpeciesArt } from "./Art";
import {
  boxName,
  gridColumns,
  hasStaleBoxes,
  monAt,
  pickBox,
  slotKind,
} from "./boxes";
import { cardTitle, orDash } from "./display";
import { PartyCard } from "./PartyScreen";
import type { Loaded } from "./useResource";

function Heading() {
  return (
    <h2 id="boxes-title" className="title-1">
      Boxes
    </h2>
  );
}

function Note({ children }: { children: string }) {
  return <p className="footnote muted box-note">{children}</p>;
}

/** What an unreadable box says depends on why it can't be read in that generation (spec §7.9). */
function unreadableNote(stale: boolean): string {
  return stale
    ? "This box can't be read. Without save RAM access only the box the game has open can be read."
    : "This box can't be read. The game's PC storage couldn't be decoded.";
}

export function BoxGrid({
  box,
  selected,
  onSelect,
}: {
  box: Box;
  selected: number | null;
  onSelect?: (slot: number) => void;
}) {
  return (
    <ul
      className="box-grid"
      style={{ gridTemplateColumns: `repeat(${gridColumns(box)}, 1fr)` }}
    >
      {box.slots.map((_, slot) => {
        const kind = slotKind(box, slot);
        const mon = monAt(box, slot);
        const number = slot + 1;
        if (mon === null) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
            <li key={slot} className={`box-slot box-slot-${kind}`}>
              <span className="footnote">
                {kind === "corrupt" ? `Slot ${number}: corrupt` : "Empty"}
              </span>
            </li>
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
          <li key={slot} className="box-slot box-slot-mon">
            <button
              type="button"
              className={
                selected === slot ? "box-mon box-mon-selected" : "box-mon"
              }
              aria-pressed={selected === slot}
              aria-label={`Slot ${number}: ${cardTitle(mon)}, level ${orDash(mon.level)}`}
              onClick={() => onSelect?.(slot)}
            >
              <SpeciesArt
                variant="menu"
                id={mon.species.id}
                name={mon.species.name}
                type={mon.types?.[0] ?? null}
                egg={mon.isEgg}
              />
              <span className="footnote box-mon-name">{cardTitle(mon)}</span>
              <span className="caption muted tabular">
                Lv. {orDash(mon.level)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Boxes screen: a selector and a grid for the chosen box, with the clicked mon's card below
 * (spec §11.5). `initial` sets the starting selection, which tests use because a static render
 * has no clicks.
 */
export function BoxesScreen({
  boxes,
  generation,
  initial,
}: {
  boxes: Loaded<Boxes>;
  generation?: number;
  initial?: { box: number; slot?: number };
}) {
  const [chosen, setChosen] = useState<number | null>(initial?.box ?? null);
  const [picked, setPicked] = useState<{ box: number; slot: number } | null>(
    initial?.slot === undefined
      ? null
      : { box: initial.box, slot: initial.slot },
  );
  if (boxes.kind === "loading") {
    return (
      <section aria-labelledby="boxes-title">
        <Heading />
        <p className="body muted">Reading the boxes…</p>
      </section>
    );
  }
  if (boxes.kind === "unavailable") {
    return (
      <section aria-labelledby="boxes-title">
        <Heading />
        <p className="body muted">
          The boxes can't be read right now. They appear as soon as the game
          provides them.
        </p>
      </section>
    );
  }
  const stale = hasStaleBoxes(generation);
  const box = pickBox(boxes.value, chosen);
  if (box === null) {
    return (
      <section aria-labelledby="boxes-title">
        <Heading />
        <p className="body muted">The game reports no boxes.</p>
      </section>
    );
  }
  const slot = picked?.box === box.index ? picked.slot : null;
  const mon = slot === null ? null : monAt(box, slot);
  return (
    <section aria-labelledby="boxes-title">
      <Heading />
      <div className="box-bar">
        <label className="subheadline" htmlFor="box-select">
          Box
        </label>
        <select
          id="box-select"
          className="box-select"
          value={box.index}
          onChange={(event) => setChosen(Number(event.target.value))}
        >
          {boxes.value.boxes.map((b) => (
            <option key={b.index} value={b.index}>
              {boxName(b)}
              {b.index === boxes.value.currentBox ? " (current)" : ""}
              {b.readable ? "" : " (unreadable)"}
            </option>
          ))}
        </select>
        {box.wallpaper === null ? null : (
          <span className="footnote muted">Wallpaper {box.wallpaper}</span>
        )}
      </div>
      {stale ? (
        <Note>
          Boxes other than the current one are only as fresh as the last in-game
          save or box switch.
        </Note>
      ) : null}
      {box.readable ? (
        <>
          <BoxGrid
            box={box}
            selected={slot}
            onSelect={(index) => setPicked({ box: box.index, slot: index })}
          />
          {box.corruptSlots.length > 0 ? (
            <Note>
              {`${box.corruptSlots.length} slot${box.corruptSlots.length === 1 ? "" : "s"} could not be read and ${box.corruptSlots.length === 1 ? "is" : "are"} marked corrupt, which is not the same as empty.`}
            </Note>
          ) : null}
        </>
      ) : (
        <p className="card box-unreadable body">{unreadableNote(stale)}</p>
      )}
      {mon === null ? null : (
        <div className="box-detail">
          <h3 className="headline">
            {boxName(box)}, slot {(slot ?? 0) + 1}
          </h3>
          <ul className="party">
            <PartyCard mon={mon} />
          </ul>
        </div>
      )}
    </section>
  );
}

import type { Party, Pokemon } from "@pokemon-memory-reader/api/schemas";
import { ItemArt, SpeciesArt } from "./Art";
import {
  cardTitle,
  type HpFields,
  hpPercent,
  hpTone,
  orDash,
  partySlots,
  refName,
  speciesName,
} from "./display";
import type { Loaded } from "./useResource";

export function HpBar({ mon }: { mon: HpFields }) {
  const percent = hpPercent(mon);
  return (
    <div className="hp">
      <div
        className="hp-track"
        role="progressbar"
        aria-label="HP"
        aria-valuemin={0}
        aria-valuemax={mon.maxHp ?? undefined}
        aria-valuenow={mon.hp ?? undefined}
      >
        <div
          className={`hp-fill hp-${hpTone(mon)}`}
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      <span className="caption tabular">
        {orDash(mon.hp)} / {orDash(mon.maxHp)}
      </span>
    </div>
  );
}

export function PartyCard({ mon }: { mon: Pokemon }) {
  const title = cardTitle(mon);
  const showSpecies = !mon.isEgg && mon.nickname !== null;
  return (
    <li className="card mon">
      <div className="mon-head">
        <SpeciesArt
          variant="sprite"
          id={mon.species.id}
          name={mon.species.name}
          type={mon.types?.[0] ?? null}
          shiny={mon.shiny}
          egg={mon.isEgg}
        />
        <div className="mon-names">
          <h3 className="headline mon-title">{title}</h3>
          {showSpecies ? (
            <p className="subheadline muted">{speciesName(mon)}</p>
          ) : null}
        </div>
        <span className="footnote muted tabular">Lv. {orDash(mon.level)}</span>
      </div>
      <HpBar mon={mon} />
      <dl className="facts footnote">
        <div>
          <dt className="muted">Item</dt>
          <dd>
            {mon.heldItem ? (
              <ItemArt id={mon.heldItem.id} name={mon.heldItem.name} />
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="muted">Ability</dt>
          <dd>{mon.ability ? refName(mon.ability) : "—"}</dd>
        </div>
        <div>
          <dt className="muted">Status</dt>
          <dd>{mon.status ?? "—"}</dd>
        </div>
      </dl>
    </li>
  );
}

function EmptySlot({ slot }: { slot: number }) {
  return (
    <li className="card slot-empty">
      <span className="footnote muted">Slot {slot}: empty</span>
    </li>
  );
}

export function PartyScreen({ party }: { party: Loaded<Party> }) {
  if (party.kind === "loading") {
    return (
      <section aria-labelledby="party-title">
        <h2 id="party-title" className="title-1">
          Party
        </h2>
        <p className="body muted">Reading the party…</p>
      </section>
    );
  }
  if (party.kind === "unavailable") {
    return (
      <section aria-labelledby="party-title">
        <h2 id="party-title" className="title-1">
          Party
        </h2>
        <p className="body muted">
          The party can't be read right now. It appears as soon as the game
          provides it.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="party-title">
      <h2 id="party-title" className="title-1">
        Party
      </h2>
      <ul className="party">
        {partySlots(party.value.pokemon).map((mon, index) =>
          mon === null ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
            <EmptySlot key={index} slot={index + 1} />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
            <PartyCard key={index} mon={mon} />
          ),
        )}
      </ul>
    </section>
  );
}

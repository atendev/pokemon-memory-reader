import type {
  ActiveBattle,
  Battle,
  Battler,
  OpponentMon,
  Trainer,
} from "@pokemon-memory-reader/api/schemas";
import {
  fieldBadges,
  lastBattleSummary,
  partyOf,
  pokemonLeft,
  trainerTitle,
  useShowUnrevealed,
} from "./battle";
import { orDash, refName } from "./display";
import { HpBar } from "./PartyScreen";
import type { Loaded } from "./useResource";

function Title({ children }: { children: string }) {
  return (
    <h2 id="battle-title" className="title-1">
      {children}
    </h2>
  );
}

function Types({ types }: { types: readonly string[] | null }) {
  if (types === null || types.length === 0) return <span>—</span>;
  return (
    <span className="types">
      {types.map((type) => (
        <span key={type} className="type">
          <span className={`type-dot type-${type}`} aria-hidden="true" />
          {type}
        </span>
      ))}
    </span>
  );
}

const STAGES = ["atk", "def", "spa", "spd", "spe", "acc", "eva"] as const;
const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

function BattlerCard({ battler, full }: { battler: Battler; full: boolean }) {
  const stages = STAGES.filter((key) => battler.statStages[key] !== 0);
  return (
    <li className="card mon battler">
      <div className="mon-head">
        <div className="mon-names">
          <h4 className="headline mon-title">{refName(battler.species)}</h4>
          {battler.owner === "partner" ? (
            <p className="subheadline muted">Partner</p>
          ) : null}
        </div>
        <span className="footnote muted tabular">Lv. {battler.level}</span>
      </div>
      <HpBar mon={battler} />
      <dl className="facts footnote">
        <div>
          <dt className="muted">Types</dt>
          <dd>
            <Types types={battler.types} />
          </dd>
        </div>
        <div>
          <dt className="muted">Status</dt>
          <dd>{battler.status ?? "—"}</dd>
        </div>
        <div>
          <dt className="muted">Item</dt>
          <dd>{battler.heldItem ? refName(battler.heldItem) : "—"}</dd>
        </div>
        {full ? (
          <div>
            <dt className="muted">Ability</dt>
            <dd>{battler.ability ? refName(battler.ability) : "—"}</dd>
          </div>
        ) : null}
      </dl>
      <ul className="moves footnote">
        {battler.moves.map((move, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: move slots are positional
          <li key={index}>
            <span>{refName(move)}</span>
            <span className="muted tabular">
              {move.pp}
              {move.maxPp === null ? "" : ` / ${move.maxPp}`}
            </span>
          </li>
        ))}
      </ul>
      {full ? (
        <>
          <dl className="stats footnote tabular">
            {STATS.map((key) => (
              <div key={key}>
                <dt className="muted">{key.toUpperCase()}</dt>
                <dd>{battler.stats[key]}</dd>
              </div>
            ))}
          </dl>
          {stages.length > 0 ? (
            <p className="badges footnote">
              {stages.map((key) => (
                <span key={key} className="badge tabular">
                  {key.toUpperCase()} {battler.statStages[key] > 0 ? "+" : ""}
                  {battler.statStages[key]}
                </span>
              ))}
            </p>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/** An opponent battler whose party mon is unrevealed says nothing about it, like a hidden tile. */
function HiddenBattlerCard() {
  return (
    <li className="card mon battler battler-hidden">
      <BallIcon />
      <span className="headline">?</span>
      <span className="visually-hidden">Unrevealed Pokémon</span>
    </li>
  );
}

function Side({
  label,
  battlers,
  full,
  hidden = () => false,
}: {
  label: string;
  battlers: readonly Battler[];
  full: boolean;
  /** True for a battler whose details must not show. */
  hidden?: (battler: Battler) => boolean;
}) {
  return (
    <section className="side" aria-label={label}>
      <h3 className="headline">{label}</h3>
      <ul className="battlers">
        {battlers.map((battler) =>
          hidden(battler) ? (
            <HiddenBattlerCard key={`${battler.owner}-${battler.position}`} />
          ) : (
            <BattlerCard
              key={`${battler.owner}-${battler.position}`}
              battler={battler}
              full={full}
            />
          ),
        )}
      </ul>
    </section>
  );
}

function Meta({ battle }: { battle: ActiveBattle }) {
  return (
    <dl className="facts footnote">
      <div>
        <dt className="muted">Kind</dt>
        <dd>{battle.kind === "wild" ? "Wild" : "Trainer"}</dd>
      </div>
      <div>
        <dt className="muted">Format</dt>
        <dd>{battle.format === "double" ? "Double" : "Single"}</dd>
      </div>
      <div>
        <dt className="muted">Modes</dt>
        <dd>{battle.modes.length > 0 ? battle.modes.join(", ") : "—"}</dd>
      </div>
      <div>
        <dt className="muted">Turn</dt>
        <dd>{orDash(battle.turn)}</dd>
      </div>
    </dl>
  );
}

/** The wild header, or the stand-in for a trainer battle that has no trainer entry to carry the facts. */
function BattleHeader({ battle }: { battle: ActiveBattle }) {
  return (
    <li className="card trainer">
      <h3 className="headline">
        {battle.kind === "wild" ? "Wild encounter" : "Trainer battle"}
      </h3>
      <Meta battle={battle} />
    </li>
  );
}

function TrainerCard({
  trainer,
  left,
  battle,
}: {
  trainer: Trainer;
  left: number | null;
  battle: ActiveBattle | null;
}) {
  return (
    <li className="card trainer">
      <div className="mon-names">
        <h3 className="headline mon-title">{trainerTitle(trainer)}</h3>
        {trainer.name !== null && trainer.className !== null ? (
          <p className="subheadline muted">{trainer.className}</p>
        ) : null}
      </div>
      {battle ? <Meta battle={battle} /> : null}
      <dl className="facts footnote">
        <div>
          <dt className="muted">Prize money</dt>
          <dd className="tabular">{orDash(trainer.prizeMoney)}</dd>
        </div>
        <div>
          <dt className="muted">Pokémon left</dt>
          <dd className="tabular">{orDash(left)}</dd>
        </div>
        <div>
          <dt className="muted">Items</dt>
          <dd>
            {trainer.items === null
              ? "—"
              : trainer.items.length === 0
                ? "None"
                : trainer.items.map(refName).join(", ")}
          </dd>
        </div>
      </dl>
    </li>
  );
}

function BallIcon() {
  return (
    <svg
      className="ball"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function Tile({ mon, active }: { mon: OpponentMon; active: boolean }) {
  return (
    <li className={active ? "tile tile-active" : "tile"}>
      <span className="headline mon-title">{refName(mon.species)}</span>
      <span className="footnote muted tabular">Lv. {orDash(mon.level)}</span>
      <HpBar mon={mon} />
      <span className="footnote">{mon.status ?? ""}</span>
    </li>
  );
}

/**
 * An unrevealed tile keeps its place and says nothing about the mon: no species, level, HP, moves
 * or status, in text, labels or attributes (spec §11.4).
 */
function HiddenTile() {
  return (
    <li className="tile tile-hidden">
      <BallIcon />
      <span className="headline">?</span>
      <span className="visually-hidden">Unrevealed Pokémon</span>
    </li>
  );
}

export function OpponentPartyView({
  battle,
  show,
  overridden,
  onChange,
}: {
  battle: ActiveBattle;
  show: boolean;
  overridden: boolean;
  onChange: (show: boolean) => void;
}) {
  const activeSlots = new Set(
    battle.opponent.active.flatMap((b) =>
      b.partySlot === null ? [] : [b.partySlot],
    ),
  );
  const party = [...battle.opponent.party].sort(
    (a, b) => a.partySlot - b.partySlot,
  );
  return (
    <section className="card opponent-party" aria-labelledby="party-heading">
      <div className="mon-head">
        <h3 id="party-heading" className="headline">
          Opponent party
        </h3>
        <label className="footnote toggle">
          <input
            type="checkbox"
            checked={show}
            disabled={overridden}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
          Show unrevealed opponent Pokémon
        </label>
      </div>
      {overridden ? (
        <p className="caption muted">Set by the page address for this load.</p>
      ) : null}
      <ul className="tiles">
        {party.map((mon) =>
          mon.revealed || show ? (
            <Tile
              key={mon.partySlot}
              mon={mon}
              active={activeSlots.has(mon.partySlot)}
            />
          ) : (
            <HiddenTile key={mon.partySlot} />
          ),
        )}
      </ul>
    </section>
  );
}

function Field({ field }: { field: ActiveBattle["field"] }) {
  const { shared, player, opponent } = fieldBadges(field);
  if (shared.length + player.length + opponent.length === 0) return null;
  const group = (label: string, items: typeof shared) =>
    items.length === 0 ? null : (
      <div className="field-group">
        <span className="footnote muted">{label}</span>
        <span className="badges">
          {items.map((item) => (
            <span key={item.key} className="badge">
              {item.label}
            </span>
          ))}
        </span>
      </div>
    );
  return (
    <section className="card field" aria-label="Field">
      <h3 className="headline">Field</h3>
      {group("Field", shared)}
      {group("Your side", player)}
      {group("Opponent's side", opponent)}
    </section>
  );
}

/**
 * An opponent battler is hidden unless the setting is on or its party mon is revealed. A null
 * `partySlot` or a slot with no party entry fails closed, like the party tiles.
 */
export function isHiddenBattler(
  battle: ActiveBattle,
  battler: Battler,
  show: boolean,
): boolean {
  if (show) return false;
  const mon = battle.opponent.party.find(
    (m) => m.partySlot === battler.partySlot,
  );
  return mon === undefined || !mon.revealed;
}

function ActiveView({ battle }: { battle: ActiveBattle }) {
  const { show, overridden, set } = useShowUnrevealed();
  const { trainers, party } = battle.opponent;
  return (
    <>
      <Title>Battle</Title>
      <div className="versus">
        <Side label="You" battlers={battle.player.active} full />
        <span className="vs headline" aria-hidden="true">
          VS
        </span>
        <Side
          label="Opponent"
          battlers={battle.opponent.active}
          full={false}
          hidden={(battler) => isHiddenBattler(battle, battler, show)}
        />
      </div>
      <ul className="trainers">
        {battle.kind === "wild" || trainers.length === 0 ? (
          <BattleHeader battle={battle} />
        ) : (
          trainers.map((trainer, index) => (
            <TrainerCard
              // biome-ignore lint/suspicious/noArrayIndexKey: two trainers can share an id, and the index is what the party's `trainer` refers to
              key={`${trainer.id}-${index}`}
              trainer={trainer}
              left={pokemonLeft(partyOf(party, trainers, index))}
              battle={index === 0 ? battle : null}
            />
          ))
        )}
        {battle.player.partner ? (
          <TrainerCard
            trainer={battle.player.partner}
            left={null}
            battle={null}
          />
        ) : null}
      </ul>
      <OpponentPartyView
        battle={battle}
        show={show}
        overridden={overridden}
        onChange={set}
      />
      <Field field={battle.field} />
    </>
  );
}

function InactiveView({
  battle,
}: {
  battle: Extract<Battle, { active: false }>;
}) {
  const last = battle.lastBattle;
  return (
    <section className="empty" aria-labelledby="battle-title">
      <Title>No battle</Title>
      <p className="body muted">
        Nothing is being fought. The battle appears here as soon as one starts.
      </p>
      {last ? (
        <p className="footnote">
          <span className="muted">Last battle: </span>
          {lastBattleSummary(last)}
          {" · "}
          <time dateTime={last.endedAt}>
            {new Date(last.endedAt).toLocaleString()}
          </time>
        </p>
      ) : null}
    </section>
  );
}

/** The Battle screen (spec §11.4). */
export function BattleScreen({ battle }: { battle: Loaded<Battle> }) {
  if (battle.kind === "loading") {
    return (
      <section aria-labelledby="battle-title">
        <Title>Battle</Title>
        <p className="body muted">Reading the battle…</p>
      </section>
    );
  }
  if (battle.kind === "unavailable") {
    return (
      <section aria-labelledby="battle-title">
        <Title>Battle</Title>
        <p className="body muted">
          The battle can't be read right now. It appears as soon as the game
          provides it.
        </p>
      </section>
    );
  }
  return battle.value.active ? (
    <section aria-labelledby="battle-title" className="battle">
      <ActiveView battle={battle.value} />
    </section>
  ) : (
    <InactiveView battle={battle.value} />
  );
}

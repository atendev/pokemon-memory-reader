import type { Bag, Player, Pocket } from "@pokemon-memory-reader/api/schemas";
import type { ReactNode } from "react";
import { ItemArt } from "./Art";
import {
  areaName,
  badgeName,
  badgeRowLabel,
  badgeRows,
  formatId,
  formatMoney,
  formatPlayTime,
  mapLabel,
  obtainedCount,
  pocketFill,
  pocketLabel,
} from "./trainer";
import type { Loaded } from "./useResource";

function Heading() {
  return (
    <h2 id="trainer-title" className="title-1">
      Trainer &amp; bag
    </h2>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="trainer-field">
      <dt className="footnote muted">{label}</dt>
      <dd className="body tabular">{children}</dd>
    </div>
  );
}

function Badges({ badges }: { badges: Player["badges"] }) {
  const rows = badgeRows(badges);
  return (
    <div className="badges">
      <h4 className="subheadline">
        Badges{" "}
        <span className="muted tabular">
          {obtainedCount(badges)} of {badges.length}
        </span>
      </h4>
      {rows.map((row, index) => {
        const label = badgeRowLabel(badges.length, index);
        return (
          <div key={row[0]?.id ?? index} className="badge-group">
            {label === null ? null : (
              <p className="caption muted badge-region">{label}</p>
            )}
            <ul className="badge-row">
              {row.map((badge) => (
                <li
                  key={badge.id}
                  className={
                    badge.obtained
                      ? "badge badge-obtained"
                      : "badge badge-missing"
                  }
                >
                  <span className="caption badge-name">{badgeName(badge)}</span>
                  <span className="caption badge-state">
                    {badge.obtained ? "Obtained" : "Not yet"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The name and secret ID are hidden when they are null or empty rather than shown as text. Gen 1-2
 * have no secret ID, and a hack profile can fail to read a name.
 */
function PlayerCard({ player }: { player: Player }) {
  const name: string | null | undefined = player.name;
  const secretId: number | null | undefined = player.secretId;
  const area = areaName(player.location);
  return (
    <div className="card trainer-card">
      <dl className="trainer-fields">
        {name ? <Field label="Name">{name}</Field> : null}
        <Field label="Trainer ID">{formatId(player.trainerId)}</Field>
        {secretId === null || secretId === undefined ? null : (
          <Field label="Secret ID">{formatId(secretId)}</Field>
        )}
        <Field label="Money">{formatMoney(player.money)}</Field>
        <Field label="Play time">{formatPlayTime(player.playTime)}</Field>
        <Field label="Location">
          {area ?? "Unknown area"}
          <span className="footnote muted trainer-map">
            {`${mapLabel(player.location)} · x ${player.location.x}, y ${player.location.y}`}
          </span>
        </Field>
      </dl>
      <Badges badges={player.badges} />
    </div>
  );
}

function PocketCard({ pocket }: { pocket: Pocket }) {
  const fill = pocketFill(pocket);
  return (
    <li className={`card pocket pocket-${fill}`}>
      <div className="pocket-head">
        <h4 className="headline">{pocketLabel(pocket.id)}</h4>
        <span className="footnote muted tabular">
          {pocket.items.length} / {pocket.capacity}
          {fill === "full" ? " · Full" : ""}
        </span>
      </div>
      {fill === "empty" ? (
        <p className="body muted pocket-empty">Empty</p>
      ) : (
        <ul className="pocket-items">
          {pocket.items.map((entry, slot) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional and an item can sit in two stacks
            <li key={slot} className="pocket-item">
              <span className="body pocket-item-name">
                <ItemArt id={entry.item.id} name={entry.item.name} />
              </span>
              <span className="body muted tabular">×{entry.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PlayerSection({ player }: { player: Loaded<Player> }) {
  if (player.kind === "loading") {
    return <p className="body muted">Reading the trainer…</p>;
  }
  if (player.kind === "unavailable") {
    return (
      <p className="body muted">
        The trainer can't be read right now. It appears as soon as the game
        provides it.
      </p>
    );
  }
  return <PlayerCard player={player.value} />;
}

function BagSection({ bag }: { bag: Loaded<Bag> }) {
  if (bag.kind === "loading") {
    return <p className="body muted">Reading the bag…</p>;
  }
  if (bag.kind === "unavailable") {
    return (
      <p className="body muted">
        The bag can't be read right now. It appears as soon as the game provides
        it.
      </p>
    );
  }
  if (bag.value.pockets.length === 0) {
    return <p className="body muted">The game reports no bag pockets.</p>;
  }
  return (
    <ul className="pockets">
      {bag.value.pockets.map((pocket) => (
        <PocketCard key={pocket.id} pocket={pocket} />
      ))}
    </ul>
  );
}

/**
 * The Trainer & bag screen (spec §11.6): the player's details and badges, then each bag pocket
 * with its fill and stacks. The two resources load on their own, so one failing leaves the other
 * showing. Each item shows its icon beside its name when the icon system has one.
 */
export function TrainerScreen({
  player,
  bag,
}: {
  player: Loaded<Player>;
  bag: Loaded<Bag>;
}) {
  return (
    <section aria-labelledby="trainer-title">
      <Heading />
      <h3 className="headline trainer-section">Trainer</h3>
      <PlayerSection player={player} />
      <h3 className="headline trainer-section">Bag</h3>
      <BagSection bag={bag} />
    </section>
  );
}

import { BATTLE_MODES } from "@pokemon-memory-reader/api/meanings";
import type { DataFormatId } from "../../src/profile/schema";

/**
 * The coverage matrix (spec §12.7): the states each data format's fixtures must cover and the
 * golden fields each must verify. A fixture sits at `<profile-id>/<slug>.fixture.json` beside this
 * file. Field names are paths into the golden's `resources`, written the way `diffValues` writes
 * them. ROM-derived and anonymized fields are never named: a species name, a location name or a
 * trainer name can't be verified from a fixture that holds no ROM bytes or was anonymized.
 */
export interface RequiredState {
  /** The fixture slug, kebab-case (spec §12.1). */
  readonly slug: string;
  readonly tier: 1 | 2;
  /** The in-game state to capture, for the generated docs. */
  readonly state: string;
  /** Golden fields the owner must have confirmed on the in-game screens. */
  readonly verifies: readonly string[];
  /** The data formats that need it. Every format when absent. */
  readonly formats?: readonly DataFormatId[];
  /** A verification fixture's fact, proved by a targeted assertion (spec §12.7). */
  readonly proves?: string;
}

const PARTY_MON = [
  "species.id",
  "level",
  "hp",
  "maxHp",
  "status",
  "moves",
] as const;

const partyFields = (indexes: readonly number[]) =>
  indexes.flatMap((i) =>
    PARTY_MON.map((field) => `party.pokemon[${i}].${field}`),
  );

const GEN12: readonly DataFormatId[] = ["gen1", "gen2"];
const GEN3_ON: readonly DataFormatId[] = ["gen3", "cfru"];

export const REQUIRED_STATES: readonly RequiredState[] = [
  {
    slug: "new-game-empty-party",
    tier: 1,
    state: "A new game with an empty party",
    verifies: ["party.pokemon", "player.name", "player.money"],
  },
  {
    slug: "full-party-status",
    tier: 1,
    state: "A full party of 6 with a status condition",
    verifies: partyFields([0, 1, 2, 3, 4, 5]),
  },
  {
    slug: "nickname-special-characters",
    tier: 1,
    state: "A nickname with special characters",
    verifies: ["party.pokemon[0].nickname"],
  },
  {
    slug: "bag-all-pockets",
    tier: 1,
    state: "A bag with every pocket non-empty",
    verifies: ["bag.pockets"],
  },
  {
    slug: "player-data",
    tier: 1,
    state: "Player data: money, badges, name, play time",
    verifies: [
      "player.name",
      "player.trainerId",
      "player.money",
      "player.badges",
      "player.playTime",
    ],
  },
  {
    slug: "boxes-filled",
    tier: 1,
    state:
      "Boxes: Gen 3 storage with several boxes filled, or the Gen 1-2 current box plus at least one non-current SRAM box",
    verifies: ["boxes.currentBox", "boxes.boxes[0].slots"],
  },
  {
    slug: "wild-battle-turn-1",
    tier: 1,
    state: "A wild single battle on turn 1",
    verifies: [
      "battle.active",
      "battle.kind",
      "battle.format",
      "battle.turn",
      "battle.opponent.active",
    ],
  },
  {
    slug: "trainer-battle-turn-1",
    tier: 1,
    state: "A trainer single battle on turn 1 with a partly revealed party",
    verifies: [
      "battle.active",
      "battle.kind",
      "battle.format",
      "battle.turn",
      "battle.opponent.active",
      "battle.opponent.party",
    ],
  },
  {
    slug: "egg",
    tier: 2,
    state: "An egg",
    formats: ["gen2", "gen3", "cfru"],
    verifies: ["party.pokemon[0].isEgg", "party.pokemon[0].eggCycles"],
  },
  {
    slug: "box-switch-unsaved",
    tier: 2,
    state: "A capture after switching box without saving",
    formats: GEN12,
    verifies: ["boxes.currentBox", "boxes.boxes[0].slots"],
  },
  {
    slug: "trainer-double-battle",
    tier: 2,
    state: "A trainer double battle",
    formats: GEN3_ON,
    verifies: [
      "battle.format",
      "battle.player.active",
      "battle.opponent.active",
    ],
  },
  {
    slug: "battle-intro-invalid-frame",
    tier: 2,
    state: "The battle intro frame that doesn't validate",
    verifies: [],
  },
  {
    slug: "proves-enemy-mon-dvs",
    tier: 2,
    state: "A wild battle that shows the enemy mon's DVs",
    formats: GEN12,
    proves: "the `wEnemyMon` DV read",
    verifies: [],
  },
  {
    slug: "proves-partner-in-party-memory",
    tier: 2,
    state: "An Emerald multi or in-game-partner battle",
    formats: GEN3_ON,
    proves: "whether partner mons sit in player party memory",
    verifies: [],
  },
  {
    slug: "proves-double-battle-partner",
    tier: 2,
    state: "A double battle with a partner",
    formats: GEN3_ON,
    proves: "the partner's place in a double battle",
    verifies: [],
  },
  {
    slug: "proves-turn-counter",
    tier: 2,
    state: "A battle past turn 1",
    proves: "the turn counter address",
    verifies: ["battle.turn"],
  },
  ...Object.keys(BATTLE_MODES).map(
    (mode): RequiredState => ({
      slug: `proves-mode-${mode}`,
      tier: 2,
      state: `A battle with the \`${mode}\` mode`,
      proves: `the \`${mode}\` mode`,
      verifies: ["battle.modes"],
    }),
  ),
  {
    slug: "proves-prize-formula",
    tier: 2,
    state: "A win, with `wAmountMoneyWon` and `wBattleReward` read",
    formats: GEN12,
    proves: "the prize formulas",
    verifies: [],
  },
  {
    slug: "proves-battle-result-won",
    tier: 2,
    state: "A won battle, for the `wBattleResult` mask and mapping",
    formats: GEN12,
    proves: "the `wBattleResult` mapping for won",
    verifies: [],
  },
  {
    slug: "proves-battle-result-lost",
    tier: 2,
    state: "A lost battle, for the `wBattleResult` mask and mapping",
    formats: GEN12,
    proves: "the `wBattleResult` mapping for lost",
    verifies: [],
  },
  {
    slug: "proves-battle-result-drew",
    tier: 2,
    state: "A drawn battle, for the `wBattleResult` mask and mapping",
    formats: GEN12,
    proves: "the `wBattleResult` mapping for drew",
    verifies: [],
  },
  {
    slug: "proves-battle-result-ran",
    tier: 2,
    state:
      "A battle the player ran from, for the `wBattleResult` mask and mapping",
    formats: GEN12,
    proves: "the `wBattleResult` mapping for ran",
    verifies: [],
  },
  {
    slug: "proves-battle-result-caught",
    tier: 2,
    state:
      "A battle that ended in a catch, for the `wBattleResult` mask and mapping",
    formats: GEN12,
    proves: "the `wBattleResult` mapping for caught",
    verifies: [],
  },
  {
    slug: "proves-gen1-end-marker",
    tier: 2,
    state:
      "The last in-battle frame and the post-battle frame after a known loss",
    formats: ["gen1"],
    proves: "the Gen 1 `wIsInBattle == 0xFF` end marker against a known loss",
    verifies: [],
  },
  {
    slug: "proves-cfru-box-leveling",
    tier: 2,
    state: "A boxed mon",
    formats: ["cfru"],
    proves: "CFRU box leveling (spec §5.6)",
    verifies: ["boxes.boxes[0].slots"],
  },
];

/** The revisions that need the full matrix (spec §12.6), by data format, as profile ids. */
export const PRIMARY_REVISIONS: Readonly<
  Record<DataFormatId, readonly string[]>
> = {
  gen1: ["red-us-1.0"],
  gen2: ["crystal-us-1.1"],
  gen3: ["emerald-us-1.0", "firered-us-1.0", "ruby-us-1.0"],
  cfru: ["radical-red-4.1"],
};

/** A smoke fixture (party and player) checks a revision's generated addresses and charmap (spec §12.6). */
export const SMOKE_STATES: readonly string[] = ["smoke-party", "smoke-player"];

export const requiredFor = (
  format: DataFormatId,
  tier?: 1 | 2,
): readonly RequiredState[] =>
  REQUIRED_STATES.filter(
    (state) =>
      (state.formats === undefined || state.formats.includes(format)) &&
      (tier === undefined || state.tier === tier),
  );

import type { Player } from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../../profile/schema";
import { BADGE_NAMES } from "../../reference/badges";
import { type Region, region } from "../regions";
import { fail, ok, type ResourceDecoder } from "../types";
import { at } from "./save";
import { PLAYER } from "./structs";

interface PlayerRegions {
  readonly [name: string]: Region;
  readonly identity: Region;
  readonly position: Region;
  readonly money: Region;
  readonly flags: Region;
  readonly section: Region;
  readonly key: Region;
}

const signed16 = (value: number) => (value >= 0x8000 ? value - 0x10000 : value);

const badgeBytes = (flags: readonly number[]) => {
  const first = Math.min(...flags) >> 3;
  return { first, length: (Math.max(...flags) >> 3) - first + 1 };
};

/**
 * The player: name, IDs and play time from save block 2, and the position, money and badge flags
 * from save block 1. Money is XORed with the save's encryption key where the profile names one
 * (Emerald and FireRed). The map section is `gMapHeader.regionMapSectionId`, read from RAM so a hack
 * that adds maps needs no table (amendment 017 §4). Each part is its own region, since the two
 * blocks sit apart and the loop merges nearby ranges. A play time with minutes, seconds or frames
 * above 59 fails the resource, because the game is mid-write or the memory isn't a save block.
 */
export const gen3Player: ResourceDecoder<
  Profile<"gen3">,
  PlayerRegions,
  Player
> = {
  regions({ addresses, player }) {
    const { first, length } = badgeBytes(player.badgeFlags);
    return {
      identity: region(addresses.gSaveBlock2, PLAYER.identitySize),
      position: region(addresses.gSaveBlock1, PLAYER.positionSize),
      money: region(at(addresses.gSaveBlock1, player.moneyOffset), 4),
      flags: region(
        at(addresses.gSaveBlock1, player.flagsOffset + first),
        length,
      ),
      section: region(
        {
          ...addresses.gMapHeader,
          offset: addresses.gMapHeader.offset + PLAYER.section,
        },
        1,
      ),
      // A region name can't be optional, so a game with no key reads the money word twice and decode ignores the copy.
      key:
        player.encryptionKeyOffset === undefined
          ? region(at(addresses.gSaveBlock1, player.moneyOffset), 4)
          : region(at(addresses.gSaveBlock2, player.encryptionKeyOffset), 4),
    };
  },
  decode({ identity, position, money, flags, section, key }, ctx) {
    const { player } = ctx.profile;
    const minutes = identity.u8(PLAYER.minutes);
    const seconds = identity.u8(PLAYER.seconds);
    const frames = identity.u8(PLAYER.frames);
    if (minutes > 59 || seconds > 59 || frames > 59)
      return fail(`play time ${minutes}:${seconds}:${frames} is out of range`);
    const sectionId = section.u8(0);
    const first = badgeBytes(player.badgeFlags).first;
    const names =
      ctx.profile.kind === "official"
        ? BADGE_NAMES[ctx.profile.artVersion]
        : undefined;
    return ok({
      name: ctx.charmap.decode(
        identity.sub(PLAYER.name, PLAYER.nameLength),
        PLAYER.nameLength,
      ),
      trainerId: identity.u16le(PLAYER.trainerId),
      secretId: identity.u16le(PLAYER.secretId),
      money:
        player.encryptionKeyOffset === undefined
          ? money.u32le(0)
          : (money.u32le(0) ^ key.u32le(0)) >>> 0,
      badges: player.badgeFlags.map((flag, id) => ({
        id,
        name: names?.[id] ?? null,
        obtained: (flags.u8((flag >> 3) - first) & (1 << (flag & 7))) !== 0,
      })),
      location: {
        mapGroup: position.u8(PLAYER.mapGroup),
        mapNumber: position.u8(PLAYER.mapNumber),
        x: signed16(position.u16le(PLAYER.x)),
        y: signed16(position.u16le(PLAYER.y)),
        section: { id: sectionId, name: ctx.names.locations(sectionId) },
      },
      playTime: {
        hours: identity.u16le(PLAYER.hours),
        minutes,
        seconds,
        frames,
      },
    });
  },
};

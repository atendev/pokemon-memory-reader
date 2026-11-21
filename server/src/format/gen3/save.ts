import type { Profile } from "../../profile/schema";

/** The profile's address moved by `add` bytes. A pointer entry adds to its target offset. */
export const at = (
  address: Profile<"gen3">["addresses"]["gSaveBlock1"],
  add: number,
) => ({ ...address, offset: address.offset + add }) as typeof address;

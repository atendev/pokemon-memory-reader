import { z } from "zod";
import { anyAddress } from "../../profile/address";

/** Placeholder: the Gen 1 build ticket types the key set, as gen3 is typed. */
export const gen1Addresses = z.record(z.string(), anyAddress("gb"));

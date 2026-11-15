import { z } from "zod";
import { anyAddress } from "../../profile/address";

/** Placeholder: the Gen 2 build ticket types the key set, as gen3 is typed. */
export const gen2Addresses = z.record(z.string(), anyAddress("gb"));

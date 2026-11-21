import type { Decoder } from "../types";
import { gen3Battle } from "./battle";
import { gen3Party } from "./party";

export const gen3Decoder: Decoder<"gen3"> = {
  party: gen3Party,
  battle: gen3Battle,
};

import type { Decoder } from "../types";
import { gen3Battle } from "./battle";
import { gen3Boxes } from "./box";
import { gen3Party } from "./party";
import { gen3Player } from "./player";

export const gen3Decoder: Decoder<"gen3"> = {
  party: gen3Party,
  boxes: gen3Boxes,
  battle: gen3Battle,
  player: gen3Player,
};

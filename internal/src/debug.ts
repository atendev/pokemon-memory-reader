import { z } from "zod";

export const RAW_READ_MIN_LENGTH = 1;
export const RAW_READ_MAX_LENGTH = 4096;

/** `GET /debug/read` (amendment 021, item 11). */
export const rawReadBody = z.object({
  address: z.string(),
  domain: z.enum(["rom", "ewram", "iwram", "wram", "hram", "sram"]),
  offset: z.number().int().min(0),
  length: z.number().int().min(RAW_READ_MIN_LENGTH).max(RAW_READ_MAX_LENGTH),
  hex: z.string(),
});
export type RawReadBody = z.infer<typeof rawReadBody>;

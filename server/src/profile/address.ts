import {
  type MemoryAddress,
  type Platform,
  type ProfileAddress,
  parseAddress,
  parseProfileAddress,
} from "@pokemon-memory-reader/internal/memory";
import { z } from "zod";

export const pointerText = z
  .object({ ptr: z.string(), offset: z.string(), bank: z.string().optional() })
  .strict();
export const addressText = z.union([z.string(), pointerText]);

/** A bus-notation string that must map to one static location (amendment §17.1). */
export function staticAddress(
  platform: Platform,
): z.ZodType<MemoryAddress, string> {
  return z.string().transform((text, ctx) => {
    const parsed = parseAddress(platform, text);
    if (parsed.ok) return parsed.value;
    ctx.issues.push({ code: "custom", message: parsed.error, input: text });
    return z.NEVER;
  });
}

/** A static address or a pointer entry, translated at load. */
export function anyAddress(
  platform: Platform,
): z.ZodType<ProfileAddress, z.input<typeof addressText>> {
  return addressText.transform((entry, ctx) => {
    const parsed = parseProfileAddress(platform, entry);
    if (parsed.ok) return parsed.value;
    ctx.issues.push({ code: "custom", message: parsed.error, input: entry });
    return z.NEVER;
  });
}

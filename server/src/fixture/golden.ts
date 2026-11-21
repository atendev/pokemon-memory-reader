import { z } from "zod";

/** The decoded resources, keyed by topic, and the fields the owner confirmed on the in-game screens (spec §12.5). */
export const GoldenFile = z
  .object({
    resources: z.record(z.string(), z.unknown()),
    verified: z.array(z.string()),
  })
  .strict();
export type GoldenFile = z.infer<typeof GoldenFile>;

export function parseGolden(text: string, source = "golden"): GoldenFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: not JSON (${(error as Error).message})`);
  }
  const parsed = GoldenFile.safeParse(json);
  if (!parsed.success) {
    throw new Error(`${source}:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export async function loadGolden(path: string): Promise<GoldenFile> {
  return parseGolden(await Bun.file(path).text(), path);
}

const show = (value: unknown): string => {
  const text = JSON.stringify(value) ?? "undefined";
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Deep equality as one line per difference: the path, then what the golden says and what the decoder gave. */
export function diffValues(
  expected: unknown,
  actual: unknown,
  path = "",
): string[] {
  const at = path === "" ? "(root)" : path;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const lines: string[] = [];
    if (expected.length !== actual.length) {
      lines.push(
        `${at}.length: expected ${expected.length}, got ${actual.length}`,
      );
    }
    for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
      lines.push(...diffValues(expected[i], actual[i], `${path}[${i}]`));
    }
    return lines;
  }
  if (isRecord(expected) && isRecord(actual)) {
    const lines: string[] = [];
    const join = (key: string) => (path === "" ? key : `${path}.${key}`);
    for (const key of Object.keys(expected)) {
      if (!Object.hasOwn(actual, key)) {
        lines.push(
          `${join(key)}: expected ${show(expected[key])}, but it is missing`,
        );
      } else {
        lines.push(...diffValues(expected[key], actual[key], join(key)));
      }
    }
    for (const key of Object.keys(actual)) {
      if (!Object.hasOwn(expected, key)) {
        lines.push(`${join(key)}: not in the golden, got ${show(actual[key])}`);
      }
    }
    return lines;
  }
  return Object.is(expected, actual)
    ? []
    : [`${at}: expected ${show(expected)}, got ${show(actual)}`];
}

/**
 * Compares decoded resources with a golden by deep equality and throws one error that lists every
 * difference. `actual` goes through JSON first, so it meets the golden as the API would send it.
 * An agent never regenerates a golden to make this pass (spec §12.5).
 */
export function assertGolden(
  golden: GoldenFile,
  actual: Readonly<Record<string, unknown>>,
  source = "golden",
): void {
  const lines = diffValues(
    golden.resources,
    JSON.parse(JSON.stringify(actual)),
  );
  if (lines.length > 0) {
    const count =
      lines.length === 1
        ? "1 decoded value differs"
        : `${lines.length} decoded values differ`;
    throw new Error(
      `${source}: ${count} from the golden\n${lines.map((line) => `  ${line}`).join("\n")}\nA golden changes only after a human reviews this diff against the game.`,
    );
  }
}

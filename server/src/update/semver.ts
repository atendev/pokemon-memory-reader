export interface Semver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** The dot-separated prerelease identifiers, empty for a stable version. */
  readonly pre: readonly string[];
}

const IDENT = "(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)";
const SEMVER = new RegExp(
  `^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${IDENT}(?:\\.${IDENT})*))?(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?$`,
);

/** Parses a semver 2.0.0 version with no leading `v`. Build metadata is dropped. */
export function parseSemver(text: string): Semver | null {
  const match = SEMVER.exec(text);
  if (!match) return null;
  const [major, minor, patch] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch, pre: match[4] ? match[4].split(".") : [] };
}

const NUMERIC = /^\d+$/;

function comparePre(a: readonly string[], b: readonly string[]): number {
  // A version with no prerelease part outranks one with.
  if (a.length === 0 || b.length === 0) return b.length - a.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const [x, y] = [a[i] as string, b[i] as string];
    if (x === y) continue;
    const [xn, yn] = [NUMERIC.test(x), NUMERIC.test(y)];
    if (xn && yn) return Number(x) - Number(y);
    // A numeric identifier ranks below an alphanumeric one.
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

/** Semver precedence: negative when `a` is older, positive when newer, 0 when equal. `rc.2` ranks before `rc.10`. */
export function compareSemver(a: Semver, b: Semver): number {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    comparePre(a.pre, b.pre)
  );
}

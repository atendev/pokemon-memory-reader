import { mappedUpstreamPaths } from "../server/src/icons/coverage";
import {
  fallbackUrl,
  resolveSource,
  upstreamUrl,
} from "../server/src/icons/source";

/** Sends a HEAD request for every upstream path the icon maps can reach and lists the ones that don't resolve. Dev-time and networked, so CI never runs it. */
const CONCURRENCY = 6;
const RETRIES = 2;
const RECHECKS = 3;

const baseUrl = process.argv[2] ?? null;
const source = resolveSource(baseUrl);
const paths = mappedUpstreamPaths();

/** jsDelivr sometimes refuses a HEAD for a file it serves, so a refusal other than 404 is checked again with a one-byte GET. */
async function probe(url: string): Promise<string | null> {
  const head = await fetch(url, { method: "HEAD" });
  if (head.ok) return null;
  if (head.status === 404) return String(head.status);
  if (head.status === 429 || head.status >= 500) return String(head.status);
  const get = await fetch(url, { headers: { range: "bytes=0-0" } });
  await get.body?.cancel();
  return get.ok ? null : String(get.status);
}

/** A 403 from the first source is asked of the second, the way the `/icons` route does. */
async function resolves(path: string): Promise<string | null> {
  let reason = "";
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      reason = (await probe(upstreamUrl(source, path))) ?? "";
      if (reason === "") return null;
      const second = reason === "403" ? fallbackUrl(source, path) : null;
      if (second !== null) {
        reason = (await probe(second)) ?? "";
        if (reason === "") return null;
      }
      if (reason === "404") return reason;
    } catch (error) {
      reason = String(error);
    }
    await Bun.sleep(500 * (attempt + 1));
  }
  return reason;
}

const failed: { path: string; reason: string }[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < paths.length) {
      const path = paths[next++] as string;
      const reason = await resolves(path);
      if (reason !== null) failed.push({ path, reason });
    }
  }),
);

// jsDelivr throttles a burst with 403s that clear on their own, so the failures are asked again one at a time.
let misses = failed;
for (let pass = 0; pass < RECHECKS && misses.length > 0; pass++) {
  const still: typeof failed = [];
  for (const { path } of misses) {
    await Bun.sleep(300);
    const reason = await resolves(path);
    if (reason !== null) still.push({ path, reason });
  }
  misses = still;
}

console.log(`Checked ${paths.length} paths at ${source.base}`);
if (misses.length > 0) {
  console.log(`${misses.length} do not resolve:`);
  for (const { path, reason } of misses.sort((a, b) =>
    a.path.localeCompare(b.path),
  ))
    console.log(`  ${reason} ${path}`);
  process.exit(1);
}
console.log("Every mapped path resolves.");

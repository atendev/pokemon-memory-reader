import { mappedUpstreamPaths } from "../server/src/icons/coverage";
import { resolveSource, upstreamUrl } from "../server/src/icons/source";

/** Sends a HEAD request for every upstream path the icon maps can reach and lists the ones that don't resolve. Dev-time and networked, so CI never runs it. */
const CONCURRENCY = 8;
const RETRIES = 2;

const baseUrl = process.argv[2] ?? null;
const source = resolveSource(baseUrl);
const paths = mappedUpstreamPaths();

async function resolves(path: string): Promise<string | null> {
  const url = upstreamUrl(source, path);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return null;
      if (response.status < 500 && response.status !== 429)
        return String(response.status);
      if (attempt >= RETRIES) return String(response.status);
    } catch (error) {
      if (attempt >= RETRIES) return String(error);
    }
    await Bun.sleep(500 * (attempt + 1));
  }
}

const misses: string[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < paths.length) {
      const path = paths[next++] as string;
      const reason = await resolves(path);
      if (reason !== null) misses.push(`${reason} ${path}`);
    }
  }),
);

console.log(`Checked ${paths.length} paths at ${source.base}`);
if (misses.length > 0) {
  console.log(`${misses.length} do not resolve:`);
  for (const miss of misses.sort()) console.log(`  ${miss}`);
  process.exit(1);
}
console.log("Every mapped path resolves.");

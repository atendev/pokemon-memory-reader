import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProfile, renderIndex, renderProfile } from "./build";
import { definitions } from "./definitions";
import { parseSymFile } from "./sym";

const OUT = join(import.meta.dir, "../../server/src/profile/builtin");

async function fetchSymbols(
  repo: string,
  commit: string,
  file: string,
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

await mkdir(OUT, { recursive: true });
for (const stale of await readdir(OUT)) {
  if (stale.endsWith(".json")) await rm(join(OUT, stale));
}
for (const definition of definitions) {
  const { repo, commit, symbolFile } = definition.source;
  const symbols = parseSymFile(await fetchSymbols(repo, commit, symbolFile));
  await writeFile(
    join(OUT, `${definition.id}.json`),
    renderProfile(buildProfile(definition, symbols)),
  );
}
await writeFile(
  join(OUT, "index.ts"),
  renderIndex(definitions.map((d) => d.id)),
);

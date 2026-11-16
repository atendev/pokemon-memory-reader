import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProfile, checkSha1, renderIndex, renderProfile } from "./build";
import { definitions } from "./definitions";
import { parseSymFile } from "./sym";

const OUT = join(import.meta.dir, "../../server/src/profile/builtin");

async function fetchText(
  repo: string,
  ref: string,
  file: string,
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

// Fetch and render everything first so a failed fetch never leaves the committed output half deleted.
const rendered = new Map<string, string>();
for (const definition of definitions) {
  const { repo, commit, symbolFile } = definition.source;
  checkSha1(
    await fetchText(repo, definition.sha1.commit, definition.sha1.file),
    definition.identify.sha1,
    definition.sha1.file,
  );
  const symbols = parseSymFile(await fetchText(repo, commit, symbolFile));
  rendered.set(
    `${definition.id}.json`,
    renderProfile(buildProfile(definition, symbols)),
  );
}
rendered.set("index.ts", renderIndex(definitions.map((d) => d.id)));

await mkdir(OUT, { recursive: true });
for (const stale of await readdir(OUT)) {
  if (stale.endsWith(".json")) await rm(join(OUT, stale));
}
for (const [name, text] of rendered) await writeFile(join(OUT, name), text);

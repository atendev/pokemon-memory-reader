import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildReference, renderReference, type Source } from "./build";
import { decodeSource } from "./c";
import { sources } from "./definition";
import { extract, type Files } from "./extract";

const OUT = join(import.meta.dir, "../../server/src/reference/data");

async function fetchText(
  repo: string,
  ref: string,
  file: string,
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return decodeSource(new Uint8Array(await response.arrayBuffer()));
}

// Fetch and build everything first so a failed fetch or a disagreement never leaves the committed output half written.
const read: Source[] = [];
for (const definition of sources) {
  const files = Object.fromEntries(
    await Promise.all(
      Object.entries(definition.files).map(
        async ([role, path]) =>
          [
            role,
            await fetchText(definition.repo, definition.commit, path),
          ] as const,
      ),
    ),
  ) as Files;
  read.push({
    repo: definition.repo,
    artKey: definition.artKey,
    commit: definition.commit,
    files: [...new Set(Object.values(definition.files))].sort(),
    extracted: extract(definition.layout, files),
  });
}

await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, "gen3-en.json"),
  renderReference(buildReference(read)),
);

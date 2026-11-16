import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProfile, renderIndex, renderProfile } from "./build";
import { definitions } from "./definitions";
import { parseNoIntroDat, parsePretSha1, resolveHashes } from "./hashes";
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

// One DAT serves every profile on its platform, so parse each pinned file once.
const dats = new Map<string, Promise<ReturnType<typeof parseNoIntroDat>>>();
function noIntroDat(commit: string, file: string) {
  const key = `${commit}:${file}`;
  let dat = dats.get(key);
  if (!dat) {
    dat = fetchText("libretro/libretro-database", commit, encodeURI(file)).then(
      parseNoIntroDat,
    );
    dats.set(key, dat);
  }
  return dat;
}

// Fetch and render everything first so a failed fetch never leaves the committed output half deleted.
const rendered = new Map<string, string>();
for (const definition of definitions) {
  const { repo, commit, symbolFile } = definition.source;
  const sha1s = parsePretSha1(
    await fetchText(repo, definition.sha1.commit, definition.sha1.file),
    `${repo} ${definition.sha1.file}`,
  );
  const hashes = resolveHashes(
    sha1s,
    await noIntroDat(definition.noIntro.commit, definition.noIntro.file),
    {
      pret: `${repo} ${definition.sha1.file}`,
      noIntro: definition.noIntro.file,
    },
  );
  const symbols = parseSymFile(await fetchText(repo, commit, symbolFile));
  rendered.set(
    `${definition.id}.json`,
    renderProfile(buildProfile(definition, symbols, hashes)),
  );
}
rendered.set("index.ts", renderIndex(definitions.map((d) => d.id)));

await mkdir(OUT, { recursive: true });
for (const stale of await readdir(OUT)) {
  if (stale.endsWith(".json")) await rm(join(OUT, stale));
}
for (const [name, text] of rendered) await writeFile(join(OUT, name), text);

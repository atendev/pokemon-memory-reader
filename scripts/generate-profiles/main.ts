import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { definitions, heldBack } from "./definitions";
import { parseLedger } from "./evidence";
import { parseNoIntroDat, parsePretSha1 } from "./hashes";
import { planGeneration } from "./plan";
import { parseLocalSymbols, parseSymFile } from "./sym";

const OUT = join(import.meta.dir, "../../server/src/profile/builtin");
const LEDGER = join(import.meta.dir, "signature-ledger.json");

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

const ledger = parseLedger(await readFile(LEDGER, "utf8"));

// Fetch everything first so a failed fetch never leaves the committed output half deleted.
const held = [];
for (const entry of heldBack) {
  held.push({
    held: entry,
    pretSha1s: parsePretSha1(
      await fetchText(entry.repo, entry.sha1.commit, entry.sha1.file),
      `${entry.repo} ${entry.sha1.file}`,
    ),
    noIntro: await noIntroDat(entry.noIntro.commit, entry.noIntro.file),
  });
}
const built = [];
for (const definition of definitions) {
  const { repo, commit, symbolFile } = definition.source;
  const symbolText = await fetchText(repo, commit, symbolFile);
  built.push({
    definition,
    pretSha1s: parsePretSha1(
      await fetchText(repo, definition.sha1.commit, definition.sha1.file),
      `${repo} ${definition.sha1.file}`,
    ),
    noIntro: await noIntroDat(
      definition.noIntro.commit,
      definition.noIntro.file,
    ),
    symbols: parseSymFile(symbolText),
    locals: parseLocalSymbols(symbolText),
  });
}

const { files, messages } = planGeneration({ built, held, ledger });
for (const message of messages) console.log(message);

await mkdir(OUT, { recursive: true });
for (const stale of await readdir(OUT)) {
  if (stale.endsWith(".json")) await rm(join(OUT, stale));
}
for (const [name, text] of files) await writeFile(join(OUT, name), text);

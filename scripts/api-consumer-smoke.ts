import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import rootPackage from "../package.json";

/**
 * Amendment 054 §5: installs the packed API tarball in a temp project outside the workspace, so a
 * hoisted `zod` cannot leak in, and typechecks `/types` and `/client` with `skipLibCheck: false`
 * under both resolutions that attw's esm-only profile covers.
 */
const RESOLUTIONS = [
  { module: "nodenext", moduleResolution: "nodenext" },
  { module: "esnext", moduleResolution: "bundler" },
];

const CONSUMER = `import { getParty, getStatus, type ClientOptions } from "@pokemon-memory-reader/api/client";
import type { ErrorBody, ErrorCode, KnownErrorCode, Pokemon, ResourceMap, Topic } from "@pokemon-memory-reader/api/types";

const options: ClientOptions = {};
const status: Promise<ResourceMap["status"]> = getStatus(options);
const party: Promise<ResourceMap["party"]> = getParty(options);
const topic: Topic = "party";
const known: KnownErrorCode = "no_game";
const open: ErrorCode = "a_code_a_newer_server_adds";
declare const body: ErrorBody;
declare const pokemon: Pokemon;
export { body, known, open, party, pokemon, status, topic };
`;

const tarballArg = process.argv[2];
if (!tarballArg) {
  console.error("Usage: bun scripts/api-consumer-smoke.ts <api-tarball>");
  process.exit(2);
}
const tarball = resolve(tarballArg);

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.status}\n${result.stdout}${result.stderr}`,
    );
  }
}

const dir = await mkdtemp(join(tmpdir(), "pmr-api-consumer-"));
try {
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }),
  );
  run(
    "bun",
    ["add", tarball, `typescript@${rootPackage.devDependencies.typescript}`],
    dir,
  );
  if (existsSync(join(dir, "node_modules", "zod"))) {
    throw new Error("zod was installed, so this check proves nothing");
  }
  await writeFile(join(dir, "consumer.ts"), CONSUMER);
  for (const { module, moduleResolution } of RESOLUTIONS) {
    await writeFile(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module,
          moduleResolution,
          target: "ES2022",
          lib: ["ES2022", "DOM"],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
        },
        files: ["consumer.ts"],
      }),
    );
    run("bunx", ["tsc", "-p", "tsconfig.json"], dir);
    console.log(`ok: ${module}/${moduleResolution}`);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}

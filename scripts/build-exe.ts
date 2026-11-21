import { join } from "node:path";
import { parseArgs } from "node:util";
import tailwind from "bun-plugin-tailwind";

/**
 * Compiles the program into one executable. This is the only build entry point. `bun build --compile`
 * on the command line ignores plugins, so it would ship the viewer's stylesheet with its Tailwind
 * directives unprocessed. The `Bun.build` API runs `bun-plugin-tailwind` and then attaches the result.
 */
export const USAGE = `Usage: bun scripts/build-exe.ts --outfile <path> [--target <bun-target>] [--compile-executable-path <bun>] [--label <name>] [--commit <sha>]

  --outfile                  where the executable goes
  --target                   a Bun compile target such as bun-linux-x64-baseline. The default is the host.
  --compile-executable-path  compile onto this Bun instead of the official one (docs/lgpl-relinking.md)
  --label                    the PMR_TARGET define, the name --version and /about report for the build
  --commit                   the PMR_COMMIT define, the commit the build came from`;

export interface BuildOptions {
  outfile: string;
  target?: string;
  executablePath?: string;
  label?: string;
  commit?: string;
}

/** Maps the flags onto `Bun.build`'s options. Exported for the test. */
export function buildConfig(options: BuildOptions): Bun.BuildConfig {
  if (options.target !== undefined && options.executablePath !== undefined) {
    throw new Error(
      "--target and --compile-executable-path cannot be used together",
    );
  }
  const define: Record<string, string> = {};
  if (options.label) define.PMR_TARGET = JSON.stringify(options.label);
  if (options.commit) define.PMR_COMMIT = JSON.stringify(options.commit);
  const compile: Bun.CompileBuildOptions = {
    outfile: options.outfile,
    ...(options.target === undefined
      ? {}
      : { target: options.target as Bun.Build.CompileTarget }),
    ...(options.executablePath === undefined
      ? {}
      : { executablePath: options.executablePath }),
  };
  return {
    entrypoints: [join(import.meta.dir, "../server/src/main.ts")],
    plugins: [tailwind],
    define,
    compile,
  };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      outfile: { type: "string" },
      target: { type: "string" },
      "compile-executable-path": { type: "string" },
      label: { type: "string" },
      commit: { type: "string" },
    },
    strict: true,
  });
  if (values.outfile === undefined) {
    console.error(USAGE);
    process.exit(2);
  }
  const result = await Bun.build(
    buildConfig({
      outfile: values.outfile,
      target: values.target,
      executablePath: values["compile-executable-path"],
      label: values.label,
      commit: values.commit,
    }),
  );
  for (const log of result.logs) console.error(String(log));
  if (!result.success) process.exit(1);
  console.log(`built ${values.outfile}`);
}

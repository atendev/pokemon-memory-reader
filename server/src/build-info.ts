import { APP_VERSION } from "./version";

// CI injects these with `scripts/build-exe.ts`. A local build leaves them out.
declare const PMR_TARGET: string | undefined;
declare const PMR_COMMIT: string | undefined;

const ARCH: Readonly<Record<string, string>> = { x64: "x64", arm64: "arm64" };
const OS: Readonly<Record<string, string>> = {
  win32: "windows",
  darwin: "darwin",
  linux: "linux",
};

/** The target this binary was built for, such as `linux-x64-baseline`. A local run reports the host. */
export function buildTarget(): string {
  if (typeof PMR_TARGET === "string" && PMR_TARGET !== "") return PMR_TARGET;
  return `${OS[process.platform] ?? process.platform}-${ARCH[process.arch] ?? process.arch}`;
}

export function buildCommit(): string {
  return typeof PMR_COMMIT === "string" && PMR_COMMIT !== ""
    ? PMR_COMMIT
    : "dev";
}

/** `2.0.0-rc.1 (windows-x64-baseline, a1b2c3d)` (spec §9.3). */
export function versionLine(): string {
  return `${APP_VERSION} (${buildTarget()}, ${buildCommit()})`;
}

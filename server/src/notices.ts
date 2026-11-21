/**
 * `THIRD-PARTY-NOTICES.txt`, which `bun run notices` writes at the repo root. The release build
 * runs it before `scripts/build-exe.ts`, so the file is bundled into the executable. A dev build
 * without the file still builds, since the import is dynamic and caught, and answers null.
 */
export async function loadNotices(): Promise<string | null> {
  try {
    const module = await import("../../THIRD-PARTY-NOTICES.txt", {
      with: { type: "text" },
    });
    return module.default;
  } catch {
    return null;
  }
}

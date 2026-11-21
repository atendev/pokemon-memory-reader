export type CopyOutcome = "copied" | "failed";

/** Writes to the clipboard, which a page served over plain HTTP from another machine isn't allowed to do. */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator
    ?.clipboard,
): Promise<CopyOutcome> {
  if (!clipboard) return "failed";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

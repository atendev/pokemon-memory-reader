/**
 * The LGPL components in Bun's runtime, as the About page names them. `scripts/notices.test.ts` checks this list against
 * the LGPL entries of `scripts/notices/bun-runtime.json`, so a Bun bump that adds one fails until it is added here.
 */
export const LGPL_COMPONENTS: readonly {
  displayName: string;
  copyright: string;
}[] = [
  {
    displayName: "JavaScriptCore (WebKit)",
    copyright: "Copyright the WebKit contributors",
  },
  {
    displayName: "tinycc",
    copyright: "Copyright Fabrice Bellard and the tinycc contributors",
  },
];

/** "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

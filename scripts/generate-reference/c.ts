/** Small readers for the C and assembly syntax pret uses. They pull values out and never copy source text. */

export function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/^[ \t]*@[^\n]*/gm, "");
}

/** Reads bytes as UTF-8, or as Latin-1 when they are not valid UTF-8 (pokeruby's sources are Latin-1). */
export function decodeSource(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

export type Constants = Map<string, number>;

/** Integer expressions over known names: numbers, names, parentheses, `+` and `-`. */
export function evaluate(expr: string, constants: Constants): number | null {
  const tokens = expr.match(/0x[0-9a-fA-F]+|\d+|[A-Za-z_]\w*|[()+\-]/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) return null;
  let position = 0;
  const primary = (): number | null => {
    const token = tokens[position++];
    if (token === undefined) return null;
    if (token === "(") {
      const inner = sum();
      return tokens[position++] === ")" ? inner : null;
    }
    if (token === "-") {
      const inner = primary();
      return inner === null ? null : -inner;
    }
    if (/^(0x[0-9a-fA-F]+|\d+)$/.test(token)) return Number(token);
    return constants.get(token) ?? null;
  };
  const sum = (): number | null => {
    let total = primary();
    while (total !== null && (tokens[position] === "+" || tokens[position] === "-")) {
      const op = tokens[position++];
      const next = primary();
      if (next === null) return null;
      total = op === "+" ? total + next : total - next;
    }
    return total;
  };
  const value = sum();
  return position === tokens.length ? value : null;
}

/**
 * Reads `#define NAME expr` lines and `enum { A, B = 5, C }` bodies into one table.
 * A name whose expression cannot be evaluated is skipped, except that the caller may fail on a missing key later.
 */
export function readConstants(text: string, into: Constants = new Map()): Constants {
  const clean = stripComments(text).replace(/\\\n/g, " ");
  const pending: Array<[string, string]> = [];
  for (const match of clean.matchAll(/^[ \t]*#define[ \t]+([A-Za-z_]\w*)[ \t]+([^\n]+)$/gm)) {
    pending.push([match[1] ?? "", (match[2] ?? "").trim()]);
  }
  for (const match of clean.matchAll(/enum\s*\w*\s*\{([^}]*)\}/g)) {
    let next = 0;
    for (const raw of (match[1] ?? "").split(",")) {
      const entry = raw.trim();
      if (!entry) continue;
      const assign = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(entry);
      if (assign) {
        const value = evaluate((assign[2] ?? "").trim(), into);
        if (value === null) throw new Error(`enum value not evaluable: ${entry}`);
        into.set(assign[1] ?? "", value);
        next = value + 1;
      } else if (/^[A-Za-z_]\w*$/.test(entry)) {
        into.set(entry, next++);
      }
    }
  }
  // Defines may refer to each other, so retry until nothing more resolves.
  let progress = true;
  while (progress && pending.length) {
    progress = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const [name, expr] = pending[i] ?? ["", ""];
      const value = evaluate(expr, into);
      if (value !== null) {
        into.set(name, value);
        pending.splice(i, 1);
        progress = true;
      }
    }
  }
  return into;
}

/** `#define NAME ... \` bodies, joined to one line. Used for entry macros such as an unknown-species block. */
export function readMacros(text: string): Map<string, string> {
  const macros = new Map<string, string>();
  const clean = stripComments(text);
  for (const match of clean.matchAll(/^[ \t]*#define[ \t]+([A-Za-z_]\w*)[ \t]*((?:\\\n|[^\n])*)$/gm)) {
    macros.set(match[1] ?? "", (match[2] ?? "").replace(/\\\n/g, " ").trim());
  }
  return macros;
}

/** The text of the `{ ... }` that opens at `open`, braces included. */
export function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(open, i + 1);
  }
  throw new Error("unbalanced braces");
}

/**
 * Splits `[KEY] = { ... }` entries (or `[KEY] = MACRO,`) of one table into key to body.
 * `macros` resolves a bare macro name to its body.
 */
export function readEntries(
  text: string,
  keyPattern: RegExp,
  macros: Map<string, string> = new Map(),
): Map<string, string> {
  const clean = stripComments(text);
  const entries = new Map<string, string>();
  const head = new RegExp(`\\[(${keyPattern.source})\\]\\s*=\\s*`, "g");
  for (const match of clean.matchAll(head)) {
    const key = match[1] ?? "";
    const after = match.index + match[0].length;
    if (clean[after] === "{") {
      entries.set(key, balanced(clean, after));
      continue;
    }
    const word = /^([A-Za-z_]\w*)\s*,/.exec(clean.slice(after, after + 80));
    const body = word ? macros.get(word[1] ?? "") : undefined;
    if (body?.startsWith("{")) entries.set(key, body);
  }
  return entries;
}

export function field(body: string, name: string): string | null {
  const match = new RegExp(`\\.${name}\\s*=\\s*(\\{[^}]*\\}|[^,\\n}]+)`).exec(body);
  return match ? (match[1] ?? "").trim() : null;
}

/** The contents of a pret `_("...")` string literal, with C escapes. Fails on an unhandled `{CODE}`. */
export function stringLiteral(source: string): string {
  const match = /^_\(\s*"((?:[^"\\]|\\.)*)"\s*\)$/.exec(source.trim());
  if (!match) throw new Error(`not a string literal: ${source}`);
  const inner = (match[1] ?? "").replace(/\\(['"\\])/g, "$1");
  if (/[{}\\]/.test(inner)) throw new Error(`unhandled control code in ${JSON.stringify(inner)}`);
  return inner;
}

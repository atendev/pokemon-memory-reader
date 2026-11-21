export interface SymbolInfo {
  readonly address: number;
  readonly size: number;
}

const LINE = /^([0-9a-f]{8}) (\w) ([0-9a-f]{8}) (\S+)$/;

/** Parses an objdump-style pret `.sym` file. Only global symbols count, and a repeated one is an error. */
export function parseSymFile(text: string): ReadonlyMap<string, SymbolInfo> {
  const symbols = new Map<string, SymbolInfo>();
  for (const line of text.split("\n")) {
    const match = LINE.exec(line.trim());
    if (match?.[2] !== "g") continue;
    const name = match[4] ?? "";
    if (symbols.has(name)) throw new Error(`duplicate global symbol ${name}`);
    symbols.set(name, {
      address: Number.parseInt(match[1] ?? "", 16),
      size: Number.parseInt(match[3] ?? "", 16),
    });
  }
  return symbols;
}

export function requireSymbol(
  symbols: ReadonlyMap<string, SymbolInfo>,
  name: string,
): SymbolInfo {
  const symbol = symbols.get(name);
  if (!symbol)
    throw new Error(`symbol ${name} is missing from the symbol file`);
  return symbol;
}

/**
 * The local symbols of a pret `.sym` file by exact name, for signature anchors only (amendment 036
 * item 4). A name can repeat, so each maps to every entry in file order.
 */
export function parseLocalSymbols(
  text: string,
): ReadonlyMap<string, readonly SymbolInfo[]> {
  const locals = new Map<string, SymbolInfo[]>();
  for (const line of text.split("\n")) {
    const match = LINE.exec(line.trim());
    if (match === null || match[2] === "g") continue;
    const name = match[4] ?? "";
    const entries = locals.get(name) ?? [];
    entries.push({
      address: Number.parseInt(match[1] ?? "", 16),
      size: Number.parseInt(match[3] ?? "", 16),
    });
    locals.set(name, entries);
  }
  return locals;
}

/**
 * Finds an anchor symbol by exact name among the local and the global symbols. It must appear exactly
 * once and have exactly `size` bytes, so a pret change that moves the word inside the anchor fails the run.
 */
export function requireAnchor(
  globals: ReadonlyMap<string, SymbolInfo>,
  locals: ReadonlyMap<string, readonly SymbolInfo[]>,
  anchor: { readonly symbol: string; readonly size: number },
): SymbolInfo {
  const global = globals.get(anchor.symbol);
  const found = [
    ...(global ? [global] : []),
    ...(locals.get(anchor.symbol) ?? []),
  ];
  const [only] = found;
  if (only === undefined)
    throw new Error(
      `anchor symbol ${anchor.symbol} is missing from the symbol file`,
    );
  if (found.length > 1)
    throw new Error(
      `anchor symbol ${anchor.symbol} appears ${found.length} times in the symbol file`,
    );
  if (only.size !== anchor.size)
    throw new Error(
      `anchor symbol ${anchor.symbol} is 0x${only.size.toString(16)} bytes, not 0x${anchor.size.toString(16)}, so the signature word may have moved`,
    );
  return only;
}

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

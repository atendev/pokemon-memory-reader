import { DEFAULT_HOST, DEFAULT_PORT } from "@pokemon-memory-reader/api/client";

export interface Options {
  readonly port: number;
  readonly host: string;
  readonly openBrowser: boolean;
  /** null: the default for this OS, or `PMR_DATA_DIR`. */
  readonly dataDir: string | null;
  readonly debug: boolean;
}

export type Command =
  | { readonly kind: "run"; readonly options: Options }
  | { readonly kind: "version" }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

export const USAGE = `Usage: pokemon-memory-reader [options]

  --port <n>         Port for the viewer and API (default ${DEFAULT_PORT})
  --host <addr>      Address to bind (default ${DEFAULT_HOST})
  --no-browser       Don't open the viewer in the default browser
  --data-dir <path>  Keep everything the program writes under this folder
  --debug            Print debug detail
  --version          Print the version and exit
  --help             Print this text and exit
`;

function parsePort(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const port = Number(text);
  return port >= 1 && port <= 65535 ? port : null;
}

/** Flags only. Config file values arrive with the config ticket, and a flag will win over them. */
export function parseArgs(argv: readonly string[]): Command {
  let port = DEFAULT_PORT;
  let host: string = DEFAULT_HOST;
  let openBrowser = true;
  let dataDir: string | null = null;
  let debug = false;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] as string;
    const value = (): string | null => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) return null;
      i++;
      return next;
    };
    switch (flag) {
      case "--help":
        return { kind: "help" };
      case "--version":
        return { kind: "version" };
      case "--no-browser":
        openBrowser = false;
        break;
      case "--debug":
        debug = true;
        break;
      case "--port": {
        const text = value();
        const parsed = text === null ? null : parsePort(text);
        if (parsed === null)
          return {
            kind: "error",
            message: `--port needs a whole number from 1 to 65535, got ${text ?? "nothing"}`,
          };
        port = parsed;
        break;
      }
      case "--host": {
        const text = value();
        if (text === null)
          return { kind: "error", message: "--host needs an address" };
        host = text;
        break;
      }
      case "--data-dir": {
        const text = value();
        if (text === null || text === "")
          return { kind: "error", message: "--data-dir needs a folder path" };
        dataDir = text;
        break;
      }
      default:
        return { kind: "error", message: `unknown option ${flag}` };
    }
  }
  return { kind: "run", options: { port, host, openBrowser, dataDir, debug } };
}

export interface Log {
  debug(message: string, data?: object): void;
  info(message: string, data?: object): void;
  warn(message: string, data?: object): void;
  error(message: string, data?: object): void;
}

export const silentLog: Log = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function describe(data: object | undefined): string {
  if (data === undefined) return "";
  const parts = Object.entries(data).map(([key, value]) =>
    value instanceof Error
      ? `${key}=${value.message}`
      : `${key}=${JSON.stringify(value)}`,
  );
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
}

/** Logs to stderr. Debug lines show only with `--debug` (spec §9.3). */
export function consoleLog(debug: boolean): Log {
  const write = (level: string, message: string, data?: object) =>
    console.error(`[${level}] ${message}${describe(data)}`);
  return {
    debug: (message, data) => {
      if (debug) write("debug", message, data);
    },
    info: (message, data) => write("info", message, data),
    warn: (message, data) => write("warn", message, data),
    error: (message, data) => write("error", message, data),
  };
}

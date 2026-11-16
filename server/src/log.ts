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

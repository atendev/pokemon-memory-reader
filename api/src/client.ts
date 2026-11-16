export const API_VERSION = 2;
export const API_BASE_PATH = `/api/v${API_VERSION}`;
/** Fixed within 2.x. The host is an IP literal because `localhost` can resolve to `::1` first. */
export const DEFAULT_PORT = 7425;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

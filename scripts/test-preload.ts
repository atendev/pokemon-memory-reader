// Runs before every `bun test` file. No request may leave the machine in the default suite,
// and the programs the tests spawn skip the update check (spec §9.8).
process.env.PMR_UPDATE_CHECK = "off";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const realFetch = globalThis.fetch;

function hostOf(input: Parameters<typeof fetch>[0]): string {
  const text =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return new URL(text).hostname.toLowerCase();
}

globalThis.fetch = Object.assign((...args: Parameters<typeof fetch>) => {
  const host = hostOf(args[0]);
  if (!LOCAL_HOSTS.has(host))
    return Promise.reject(
      new Error(`the test suite may not fetch ${host}; use a fake feed`),
    );
  return realFetch(...args);
}, realFetch) as typeof fetch;

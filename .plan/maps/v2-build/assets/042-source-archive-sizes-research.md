# 042 source archive sizes research

## Findings (2026-11-16)
- tinycc tarball (codeload, commit 05f0faf): 1,036,641 bytes (downloaded to /tmp, counted). codeload sends no Content-Length. Repo size (gh api) 7,336 KB.
- WebKit tarball (codeload, commit 2e2aa22): HTTP 422 "Content creation is blocked" on codeload.github.com/oven-sh/WebKit/tar.gz/<sha>. Archive cannot be generated from GitHub. Repo size (gh api, NOT tarball size): 13,086,889 KB (~12.5 GiB, includes full history).
- bun repo size (gh api, NOT tarball size): 1,648,797 KB (~1.6 GiB, includes history).
- WebKit release autobuild-2e2aa2290fac856d6f451ceacb58f7f5b44dd057 exists in oven-sh/WebKit (prebuilt binaries only, not source). Sample assets: bun-webkit-linux-amd64.tar.gz 453,126,608; -lto 247,437,947; linux-amd64-musl 403,025,387; linux-arm64 451,769,957; macos-amd64-lto 145,654,219; asan 764,454,659; freebsd-amd64-debug 797,096,600.
- bun-v1.4.2 tarball (codeload refs/tags/bun-v1.4.2): 64,582,774 bytes (streamed fully, gzip -t OK; no Content-Length header). bun tree at the tag has no gitlink/submodule entries and no .gitmodules (404); deps are fetched at build time (scripts/build/deps/*.ts, e.g. tinycc kind "github-archive" repo oven-sh/tinycc commit pinned).
- Bun 1.4.2 scripts/build/deps/webkit.ts: WEBKIT_VERSION = 2e2aa229...; prebuilt URL https://github.com/oven-sh/WebKit/releases/download/autobuild-<sha>/<name>.tar.gz, name encodes os/arch/musl/debug|lto/asan. So Bun's build downloads prebuilt binaries, not WebKit source.
- GitHub docs (https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases): each release file under 2 GiB; up to 1000 assets per release; no limit on total release size or bandwidth.
- Gap: WebKit source tarball size unknown (codeload 422). Repo size 12.5 GiB with history. A tarball of one commit likely hundreds of MB but unmeasured; would need git clone --depth 1 + local tar to measure.

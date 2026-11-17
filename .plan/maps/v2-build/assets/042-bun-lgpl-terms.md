# Amendment 042: LGPL terms for Bun's statically linked libraries

Spec §13.4 and §13.5 cite this as "amendment 042". It is the project's engineering reading of LGPL-2.1 §6. It is not legal advice, and no lawyer review gates a release. Decided in auto mode.

**Revised 2026-11-17 (lighter route).** Releases no longer depend on owner forks or protected tags. The release workflow fetches Bun, WebKit and tinycc from upstream at the pinned versions, attaches the archives itself and fails the release if it can't. Ticket 047 (fork and tag wizard) is dropped. The sections below already reflect this.

Evidence: [relink path research](./042-bun-relink-path-research.md) and [source archive sizes research](./042-source-archive-sizes-research.md), both at Bun 1.4.2 (tag `bun-v1.4.2`, commit `744846f8`).

## 1. What triggers the rule

- A Bun runtime manifest entry (`scripts/notices/bun-runtime.json`) is an **LGPL component** when its SPDX expression can't pass the allowlist (amendment 027) without an LGPL term. `LGPL-2.1-or-later OR MIT` doesn't trigger it. WebKit's `LGPL-2.0-or-later AND … AND BSD-3-Clause …` does.
- At Bun 1.4.2 the LGPL components are WebKit (JavaScriptCore, WTF, bmalloc and the WebCore files Bun uses, oven-sh/WebKit `2e2aa229`) and tinycc (oven-sh/tinycc `05f0fafa`). Both are listed for all six release targets in the manifest's `targets` (linux, windows and darwin, each x64 and arm64). Bun's build turns tinycc off only for Android and FreeBSD (`scripts/build/config.ts:893` at the Bun tag, per the relink research).
- The rule is keyed to the license expression, not to these two names. A Bun upgrade that adds an LGPL component falls under the same rule and the same check without a new ticket.
- It applies to every published compiled executable: stable releases, prereleases (`beta`, `rc`) and any executable on a public page. Unpublished drafts are the only exception. `v2.0.0-beta.1` is the first release it covers.

## 2. Which terms apply

- The project reads every LGPL component under LGPL-2.1 §6. tinycc's headers grant "version 2 of the License, or (at your option) any later version" (`tcc.c`, `libtcc.c` and `tccgen.c` at the pinned commit, [041 report](./041-bun-runtime-notices-manifest-report.md)). The sampled WebKit headers grant "or any later version" (for example `JSObject.cpp`, `Lexer.cpp`, `WTFString.cpp` and `RegExp.cpp`, [027 research](./027-bun-runtime-licenses.md) row (b)). The census is a sample, so a WebKit file that is LGPL-2.0-only can't be ruled out. That is a known limit (§8). The project doesn't assert how 2.0 §6 would apply to such a file.
- The project does not use §3 to convert copies to the plain GPL. Conversion is per copy and can't be undone, and it would still need the full corresponding source of the whole executable, so it saves nothing.
- §6 needs the work's terms to permit modification for the user's own use and reverse engineering for debugging. The app's GPL-3.0-or-later terms permit both. The executable also contains Bun's own code, whose license text [ticket 045](../tickets/045-bun-license-text.md) settles, so this condition holds subject to 045's outcome. README, release bodies, the About page and any later text must never add terms that restrict either. `RELEASING.md` carries this as a checklist line, because no script can test it.

## 3. Which §6 option

- Releases use **§6(d)**. Users download from a designated place, the GitHub release, so the project offers equivalent access to the materials from the same place. There is no written offer under §6(c). (d) is enough, and a three-year offer is an ongoing duty a solo owner can't easily keep.
- §6(b), a shared library, is impossible because Bun links statically. §6(a), materials inside every per-OS archive, would add hundreds of MB to each archive.
- The materials must be reachable from the release page itself, as release assets and through links in the release body. A link only in the README is not enough.

## 4. The materials

The "work that uses the Library" is Bun's runtime (its own license text is the subject of [ticket 045](../tickets/045-bun-license-text.md)) plus the app's bundled JavaScript (GPL-3.0-or-later). Both are given in **source form**, which §6(a) allows ("object code and/or source code"). The project doesn't build Bun itself or publish Bun object files, and it keeps shipping oven-sh's official binaries.

| Material | Where |
| --- | --- |
| The app at the release tag | the tag's own source, already on the release page |
| Bun at the pinned tag | release asset `bun-<bun version>-source.tar.gz`, fetched from `oven-sh/bun` at tag `bun-v<bun version>` |
| WebKit at the pinned commit | release asset `webkit-<sha>-source.tar.xz`, or numbered parts of it (see below), fetched from `oven-sh/WebKit` at the pinned commit |
| tinycc at the pinned commit | release asset `tinycc-<sha>-source.tar.gz`, fetched from `oven-sh/tinycc` at the pinned commit |
| Relink steps | `docs/lgpl-relinking.md` at the release tag |

- **Release assets.** `release.yml` runs `scripts/lgpl-sources.ts`. It reads the pins from the manifest, fetches each one from upstream with `git fetch --depth 1 <repo> <commit>` and builds the three archives. It attaches them to every release and adds them to `SHA256SUMS`. The WebKit archive keeps the whole tree, LayoutTests included. If it is 2 GiB or more, it is split with `split -b 1900M` into numbered parts (assets must be under 2 GiB each, up to 1000 per release, with no total cap), and the doc gives the `cat` and `tar` line that rebuilds it. Each release re-uploads hundreds of MB, and that cost is accepted. Nothing is done by hand per release. If a fetch fails, the draft release fails its check and can't be published.
- **Upstream only, no forks.** The project does not fork Bun, WebKit or tinycc and creates no protected tags. GitHub refuses to make a codeload tarball for oven-sh/WebKit at the pinned commit (HTTP 422, "Content creation is blocked"), so WebKit comes from a shallow git fetch of the commit, not a tarball URL. The archives on a published release are the copy users rely on, and they stay there even if upstream later deletes or rewrites a commit. What can go wrong is a pinned commit vanishing before the next release is built. The online check (§7) looks every pinned commit up on each Bun-pin PR and on the draft release, so that shows up as a failed check, not a silent gap. Upstream losing a pinned commit is an accepted risk. The earlier fork-and-tag design existed only to remove it.
- **Patches.** Bun's build applies `patches/tinycc/tcc.h.patch` from the Bun tag to tinycc at the pinned commit (`scripts/build/deps/tinycc.ts`, relink research Q3). So the tinycc materials are the upstream commit plus that patch from the Bun tag. The relinking doc task checks Bun's build for patches to WebKit as well and records any it finds. Patches Bun's build applies are expected to live in the Bun tag, which is part of the materials, and the doc task confirms that. The relinking doc task lists every patch Bun's build applies to WebKit or tinycc, and the doc tells the reader to check that each patch still applies to modified source.
- **Other Bun dependencies.** Bun's build fetches its non-LGPL dependencies from pinned upstream URLs at build time (`scripts/build/deps/*.ts`, size research item 4). The manifest lists them, for example boringssl, zstd, libarchive and mimalloc. They are not mirrored. If one vanished upstream, relinking would break, and that is an accepted risk.
- **Toolchain.** The project doesn't claim §6's exception for the build toolchain. That exception covers what normally ships with the operating system the executable runs on, and the compilers Bun pins don't. The project doesn't ship the compilers and build tools (Rust, clang, CMake and the others Bun's scripts pin). It reads §6's "utility programs needed for reproducing the executable" as Bun's build scripts, which are in the Bun tag, not general-purpose compilers that anyone can get. If that reading is wrong, version pins and download links don't meet the duty, and the owner accepts that gap. `docs/lgpl-relinking.md` lists the pinned versions with official download links.
- **App dependencies.** Relinking runs `bun install --frozen-lockfile`, which fetches the app's npm dependencies from the registry at lockfile versions. `THIRD-PARTY-NOTICES.txt` lists them, because `scripts/notices.ts` walks the production dependency closure of `server/` and `viewer/` (spec §13.5), and the allowlist check holds them to the permissive tier (amendment 027, built by ticket 040). They are not mirrored, and that is an accepted risk.
- **Shared fate.** The executables and their source archives sit on the same GitHub release, so they share its fate. That risk is accepted.

- **Same place.** The source archives are assets on the same release as the executables, and that is the basis of the §6(d) claim. Links to upstream are extra access.

## 5. Notices

- **Manifest fields.** Each LGPL component's manifest entry gains `displayName` (for example `JavaScriptCore (WebKit)`), `copyright` (for example "Copyright the WebKit contributors", "Copyright Fabrice Bellard and the tinycc contributors") and `upstream: { repo, commit }`.
- **Notices file.** `THIRD-PARTY-NOTICES.txt` opens with an LGPL section. For each LGPL component it gives the display name, the copyright line, a statement that the component is statically linked into the executable and covered by the LGPL, pointers to the LGPL texts later in the file, the upstream commit URL, and a statement that the same source is attached to every release. Those texts include LGPL-2.0 (WebKit's `COPYING.LIB` and `LICENSE-LGPL-2.txt`) as well as LGPL-2.1, and the section says some WebKit files are under LGPL-2.0-or-later. It also points to `docs/lgpl-relinking.md` at the release tag. The file is already in every per-OS archive (§13.4), so it gives the notice "with each copy" and the copy of the License.
- **About page.** The About page shows one visible line built from the manifest entries, such as "This program includes JavaScriptCore (WebKit) and tinycc, used under the GNU LGPL. See third-party notices for the licenses, source and relinking steps.", with the copyright lines and a link to `/about/third-party-notices.txt`. This is the run-time copyright display §6 asks for.
- **README and release body.** Each carries one line that links to the relink steps and the upstream commits. The release body also gives the `git fetch --depth 1` lines for the pinned commits, alongside the source assets.
- **Downstream.** People who pass the executable on hold the archive with its notices and the app's GPL-3.0-or-later terms. The project doesn't take on their §6 duties.

## 6. Relinking

- **Where.** `docs/lgpl-relinking.md` in the app repo, so each tag carries the steps that match it. A released tag's copy can't be corrected afterwards, so fixes land in later tags.
- **Steps.**
  1. Unpack the three source archives from the release, or fetch the Bun tag and the pinned WebKit and tinycc commits from upstream.
  2. To change WebKit, edit it at `vendor/WebKit` (or `$BUN_WEBKIT_PATH`). To change tinycc, edit the pin in Bun's `scripts/build/deps/tinycc.ts` to point at the modified source. That edits Bun's own build script (Bun's license per ticket 045) and is not a supported override.
  3. Build bun in a release profile. Add `--webkit=local` when WebKit changed.
  4. Clone the app tag and run `bun install --frozen-lockfile`.
  5. Run the app's compile command with `--compile-executable-path <modified bun>`. The flag is mandatory. Without it Bun uses its own executable for the host target and downloads `@oven/bun-<os>-<arch>` from npm for the others.
  6. On macOS, re-sign with `codesign --force --sign - <exe>`. Windows releases are unsigned, so nothing is needed there.
- **Scope.** The doc names the toolchain versions Bun's scripts pin. Each target's bun has to be built on that target's OS (a Windows local WebKit build needs a Windows host), so the doc says to relink on the target OS. The project tests relinking only on linux-x64. macOS and Windows relinks are untested, and that limit is recorded.
- **Verification.** The release profile with `--webkit=local` and the tinycc pin edit come from Bun's build scripts at `bun-v1.4.2` and haven't been run yet. The end-to-end verification (§7) runs them before beta.1. The doc keeps a "last verified <date> for bun-v<version> on linux-x64" line. If a run fails, the doc records the failure and the working fix, or the release stays blocked. Steps known to be broken never ship.
- **Payload transplant.** The app payload sits in a `.bun` or `__BUN` section, and Bun has no official tool to move it onto another bun. Relinking therefore means recompiling the app from source, not transplanting the payload.
- **`--bytecode`.** The build doesn't use `--bytecode`, so the payload has no JSC bytecode tied to one JSC build. Turning on `--bytecode` requires revisiting this amendment first.
- **Bun upgrades.** A short "Bun upgrade" section in `RELEASING.md` says each upgrade changes the manifest pins, which `release.yml` picks up on its own, and reruns the end-to-end verification.

## 7. Enforcement

- **Offline check** (the shared check script, in PR CI). Every LGPL component has `displayName`, `copyright` and `upstream`. The notices LGPL section names every one. `docs/lgpl-relinking.md` exists, and its version and commit names match the manifest.
- **Online check.** Each pinned commit and the Bun tag must resolve on upstream (the GitHub commits API for the commits, `git ls-remote` for the tag). The release must carry every source asset (for WebKit, the part count must match), each listed in `SHA256SUMS`, and the release body must contain the upstream links. It runs in `release.yml` before the release is published (on the draft), so a failure blocks publishing. It also runs on any PR that changes `scripts/notices/bun-runtime.json` or the Bun pin, so a Bun bump to a commit that doesn't resolve fails before release day. Unit tests stub the network.
- **App-side re-host job** (PR CI). It compiles the app with `--compile-executable-path` pointing at a separately located copy of the official bun and runs `scripts/smoke.ts` on the result. It proves that re-hosting the app onto a given bun works. It does not prove that relinking works, and the doc and checks name it that way.
- **End-to-end verification** (HITL, owner, linux-x64). This is two runs. In the first, rebuild bun with a changed tinycc against the prebuilt WebKit. In the second, rebuild bun with a local WebKit. Then compile the app onto each result and run `scripts/smoke.ts`. The doc records the date. This gates `v2.0.0-beta.1` and every later release. It runs again whenever the Bun, WebKit or tinycc pin changes or the app's compile command changes. A release with the same pins and command doesn't need a rerun.

## 8. Known limits

- WebKit's per-file license census is a sample of about 12 files ([027 research](./027-bun-runtime-licenses.md), "Open gaps"). A WebKit file that is LGPL-2.0-only can't be ruled out. A missed LGPL file inside WebKit is still covered, because the source archive and the relink steps cover the whole WebKit tree. The WebKit manifest entry already ships `COPYING.LIB` (LGPL-2.0) and `LICENSE-LGPL-2.txt` alongside the LGPL-2.1 text, so the notices file carries the 2.0 license copy too. The notices LGPL section says some WebKit files are under LGPL-2.0-or-later and points to that text. Naming individual 2.0-only files would need the full census, which stays out of scope.
- The contents of the prebuilt WebKit archives were read from Bun's build source, not from an unpacked archive.
- A one-commit WebKit archive's size was not measured. The release workflow splits it when it is 2 GiB or more (§4), and the first release records the size.
- Relinks are tested only on linux-x64. macOS, Windows and linux-arm64 relinks are untested. §6 asks the project to supply the materials and steps, which are the same for every target.
- Fetching a pinned commit by SHA assumes GitHub serves it. The first release run confirms that, and the online check repeats it.

## 9. Follow-up tasks

1. ~~**Mirror Bun's LGPL sources**~~ (dropped 2026-11-17). No forks, tags or wizard. Upstream is the source and `release.yml` fetches it.
2. **LGPL notices section, About line and relinking doc** (task). Covers the manifest fields, the notices LGPL section (with the LGPL-2.0 text and the LGPL-2.0-or-later line from §5), the About line, `docs/lgpl-relinking.md`, the README and release-body lines, and the `RELEASING.md` lines (no added terms, the Bun upgrade steps). Blocked by Third-party notices script and CI check.
3. **LGPL release check and source assets** (task). Covers `scripts/lgpl-sources.ts` and the source assets in `release.yml` (§4), the offline and online checks and the app-side re-host job from §7. Blocked by task 2.
4. **Verify the LGPL relink steps end to end** (task, HITL). Covers the two linux-x64 runs from §7, and records the date in the doc. Blocked by task 2.

`v2.0.0-beta.1` waits on tasks 2 to 4 and on [ticket 045](../tickets/045-bun-license-text.md), because the §6 modification and reverse-engineering condition (§2) depends on Bun's license text.

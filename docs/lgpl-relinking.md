# Relinking Pokemon Memory Reader with a modified JavaScriptCore or tinycc

The compiled program is a copy of Bun with the app's JavaScript attached. Bun statically links two libraries under the GNU Lesser General Public License (LGPL): JavaScriptCore, which is part of WebKit, and tinycc. This page gives the source and the steps to change either library and build a working program from your change. The steps here are for Bun 1.4.2. Every release tag carries the copy of this page that matches it.

This is an engineering reading of LGPL-2.1 section 6, not legal advice. LGPL-2.1 section 6 requires the program's terms to let you modify it for your own use and reverse engineer it to debug your modifications. Its GPL-3.0-or-later terms allow modification and put no limit on reverse engineering, and no text in this repository adds one.

Last verified: 2026-11-18 for Bun 1.4.2 on linux-x64 (Arch Linux, clang 21.1.8). Two runs: Bun rebuilt with a changed tinycc against the prebuilt WebKit (318 seconds on 20 cores), and Bun rebuilt with a changed local WebKit (about 33 minutes of compiling in all: one build was cut off after about 19 minutes and the finished work was reused by a second build that took 14). Each result has the change in it. The sources came from the upstream fetches in step 1, not from the release archives, which are not built yet. The program compiled onto each result and passed `scripts/smoke.ts`. Rerun this when the Bun, WebKit or tinycc pin or the compile command changes.

## Where the source is

Each release carries these as assets, listed in `SHA256SUMS`. The release workflow builds them from the upstream sources below:

| Material                 | Release asset                                                | Upstream source                                                       |
| ------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Bun 1.4.2                | `bun-1.4.2-source.tar.gz`                                    | `oven-sh/bun` at tag `bun-v1.4.2`                                     |
| WebKit at `2e2aa2290fac` | `webkit-2e2aa2290fac-source.tar.xz`, or numbered parts of it | `oven-sh/WebKit` at commit `2e2aa2290fac856d6f451ceacb58f7f5b44dd057` |
| tinycc at `05f0fafaa3be` | `tinycc-05f0fafaa3be-source.tar.gz`                          | `oven-sh/tinycc` at commit `05f0fafaa3be31e31d7b4b5c17dc60f62c991171` |
| This program             | the tag's own source                                         | this repository at the release tag                                    |

The release assets are the copy to use. Use the upstream sources only if an asset is missing.

If the WebKit archive was split into parts, join and unpack them with `cat webkit-2e2aa2290fac-source.tar.xz.* | tar -xJ`.

Bun fetches its other dependencies, such as boringssl, zstd and libarchive, from pinned upstream URLs while it builds. `THIRD-PARTY-NOTICES.txt` lists them. They are not mirrored.

## What you need

Build each target's Bun on that target's operating system. A Windows build with a local WebKit needs a Windows host. Only linux-x64 has been tested. The macOS, Windows and linux-arm64 steps are the same but untested.

The versions below are the ones Bun's scripts pin at `bun-v1.4.2`. Check `scripts/build/tools.ts` and `rust-toolchain.toml` in the Bun tag if a build complains.

| Tool               | Version                                               | Where it comes from                                      |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------------- |
| LLVM and clang     | 21.1.8 (any 21.1.x)                                   | <https://github.com/llvm/llvm-project/releases>          |
| Rust               | `nightly-2026-07-20`, set in `rust-toolchain.toml`    | <https://rustup.rs>                                      |
| Node.js            | 25 or later, or run Bun's build with Bun              | <https://nodejs.org/en/download>                         |
| Bun                | 1.4.2, to run Bun's build scripts and this repository | <https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2> |
| CMake, Ninja, nasm | as your distribution ships them                       | your package manager                                     |
| Ruby with `erb`    | 2.5 or later, as your distribution ships it           | your package manager                                     |
| make, libtool, gcc | as your distribution ships them                       | your package manager                                     |

Ruby is only needed for a local WebKit build, where WebKit's generator scripts use it. Some distributions ship `erb` as a separate package (`ruby-erb` on Arch). The Bun tag's `scripts/bootstrap.sh` installs the full set on Linux.

Bun's build looks for LLVM 21.1.x and reports `Could not find ld.lld (version >=21.1.0 <21.1.99)` otherwise. If you use the prebuilt LLVM tarball, put its `bin` first on `PATH`. That tarball's `ld.lld` needs `libxml2.so.2`. A distribution with a newer libxml2 must supply the old one (`libxml2-legacy` on Arch). Without it Bun reports that it can't find `ld.lld` and shows the load error under "Found but rejected".

## Steps

1. Get the sources. Unpack the three source archives, or fetch them from upstream:

   ```sh
   git clone --depth 1 --branch bun-v1.4.2 https://github.com/oven-sh/bun
   git init WebKit && git -C WebKit fetch --depth 1 https://github.com/oven-sh/WebKit 2e2aa2290fac856d6f451ceacb58f7f5b44dd057 && git -C WebKit checkout FETCH_HEAD
   git init tinycc && git -C tinycc fetch --depth 1 https://github.com/oven-sh/tinycc 05f0fafaa3be31e31d7b4b5c17dc60f62c991171 && git -C tinycc checkout FETCH_HEAD
   ```

2. Change the library.
   - To change WebKit, edit your WebKit clone and put it at `vendor/WebKit` inside the Bun clone (a symlink works, and is what the verified run used), or point `BUN_WEBKIT_PATH` at it.
   - To change tinycc, edit your tinycc clone. Bun's build only applies `patches/tinycc/tcc.h.patch` when it downloads the pinned tinycc, so with your own copy apply it first, from the tinycc clone: `git apply /path/to/bun/patches/tinycc/tcc.h.patch`. Then build with `--local-deps=tinycc=/absolute/path/to/your/tinycc` (step 3). Don't edit `scripts/build/deps/tinycc.ts`. Bun's own `TCC_VERSION` define overrides the version string in `tcc.h`, so a change there never reaches the binary.

3. Build Bun in a release profile, from the Bun clone. For a changed tinycc, which uses Bun's prebuilt WebKit:

   ```sh
   bun scripts/build.ts --profile=release --build-dir=build/release-tinycc-local \
     --local-deps=tinycc=/absolute/path/to/your/tinycc
   ```

   For a changed WebKit:

   ```sh
   bun scripts/build.ts --profile=release-local --build-dir=build/release-local
   ```

   `release-local` is Bun's release profile with `webkit: "local"` (`scripts/build/profiles.ts` at the Bun tag), the same as passing `--webkit=local` to the release profile. The package script `bun run build:local` is a debug build, so don't use it. The build prints where it wrote the Bun executable, `<build-dir>/bun`.

   To confirm your change is in the result, put a distinctive string in an error message you changed and check `strings <build-dir>/bun | grep <string>`. The verified runs used an error message in tinycc's `libtcc.c` and one in WebKit's `Source/JavaScriptCore/runtime/ExceptionHelpers.cpp`.

4. Clone this program at the release tag and install its dependencies. The npm registry serves them at the lockfile's versions, and `THIRD-PARTY-NOTICES.txt` lists them. Replace `v2.0.0` with the tag you are relinking:

   ```sh
   git clone --branch v2.0.0 https://github.com/atendev/pokemon-memory-reader
   cd pokemon-memory-reader
   bun install --frozen-lockfile
   ```

5. Compile the program onto your Bun. The flag is mandatory. Without it Bun uses its own executable for the host target and downloads `@oven/bun-<os>-<arch>` from npm for any other target:

   ```sh
   bun scripts/build-exe.ts --compile-executable-path /path/to/your/bun \
     --outfile out/pokemon-memory-reader
   ```

   Use `scripts/build-exe.ts` (the script behind `build:exe`, which the release workflow runs at the release tag) and not `bun build --compile` on the command line. Bun's command line ignores plugins, so it would ship the viewer's stylesheet with its Tailwind directives unprocessed. The script calls `Bun.build` with `bun-plugin-tailwind` and passes the flag on as `compile.executablePath`. The program is recompiled from source because Bun has no tool to move the attached JavaScript onto another Bun.

6. On macOS, sign the result again: `codesign --force --sign - out/pokemon-memory-reader`. Windows releases are unsigned, so nothing is needed there.

7. Check it. Run `bun scripts/smoke.ts out/pokemon-memory-reader <version>` on the result, with the version from `server/package.json`, as the repository's CI does.

The build must not use `--bytecode`, because that ties the attached JavaScript to one JavaScriptCore build. The release workflow doesn't use it.

## Patches Bun's build applies

At `bun-v1.4.2`:

- tinycc: `patches/tinycc/tcc.h.patch`, applied to the pinned tinycc source only when Bun downloads it. With `--local-deps` you apply it yourself (step 2).
- WebKit: none. On Windows, a local WebKit build patches ICU's `.vcxproj` files while it builds ICU. That is ICU, not WebKit.

A Bun upgrade can change both lists, so the owner rechecks them and this page for every new Bun pin.

# 027: Licenses of Bun and the components `bun build --compile` links in

Scope: Bun 1.4.x (latest release checked: bun-v1.4.4, 2026-10-22), `bun build --compile` output = a copy of the `bun` runtime binary plus the embedded app. Targets linux x64/arm64, windows x64/arm64, darwin x64/arm64. Researched 2026-11-16.

GPL-3.0 column uses the FSF license list (https://www.gnu.org/licenses/license-list.html) and the stated "or" choice where a component is dual-licensed. "Yes" = FSF lists it GPL-compatible. SPDX IDs are my mapping from the upstream license text; Bun itself publishes only prose names.

## Answers to the four named questions

| Q | Answer |
|---|---|
| (a) BoringSSL | Bun's pin (`oven-sh/boringssl@41bf9b59`, scripts/build/deps/boringssl.ts at v1.4.4) has a top-level LICENSE of **Apache-2.0** (the Go-authors BSD-3-Clause block covers test-only code "not included in libcrypto and libssl when compiled"). I grepped the pinned tree: 0 files carry an "OpenSSL License", "Original SSLeay License" or "Eric Young" header; 668 crypto/ssl files carry the Apache header; 7 small files (rand/passive.cc, armv8_feature_parsing.h, three fips_known_values.inc, ...) lack it and need a per-file look. `third_party/fiat` (compiled in for curve25519/P-256) is Apache-2.0 (fiat-crypto is MIT OR Apache-2.0 OR BSD-1-Clause upstream). **Not** OpenSSL/SSLeay, so not GPL-incompatible on that account. Bun's own docs still say only "several licenses", which is stale. |
| (b) LGPL variants | **JavaScriptCore/WTF**: COPYING.LIB is LGPL-2.0 (GNU Library GPL v2, June 1991); per-file headers are mostly `LGPL-2.0-or-later` ("Library General Public ... version 2 ... or any later version", e.g. JSObject.cpp, Lexer.cpp, WTFString.cpp, Vector.h) and some `LGPL-2.1-or-later` ("Lesser General Public ... version 2 or later", e.g. RegExp.cpp, ArrayPrototype.cpp). Apple-authored files are `BSD-2-Clause` (JSBase.h, Assertions.h) and JSDateMath.cpp is MPL-1.1 / GPL-2.0 / LGPL-2.1 tri-license; double-conversion files are BSD-3-Clause. Bun says "LGPL-2". **tinycc** (oven-sh/tinycc@05f0fafa): COPYING is LGPL v2.1; file headers read "GNU Lesser General Public License ... version 2 of the License, or (at your option) any later version" so SPDX `LGPL-2.1-or-later` (Bun's doc: "LGPL v2.1"; the header's "version 2" is ambiguous, `LGPL-2.1-only` is the conservative reading). |
| (c) ICU | ICU 78 root LICENSE is **`Unicode-3.0`** ("UNICODE LICENSE V3", SPDX line in the file). Not Unicode-DFS-2016, not `ICU`. The file also bundles third-party notices: BSD-3-Clause (several dictionary/data files), MIT, public-domain tz data, and GPL-2.0+/autoconf-exception text for build m4 scripts (not linked). Bun's docs say "ICU license" loosely. macOS builds use the **system** ICU (webkit.ts comment: "macOS uses system ICU"), so ICU is statically linked on linux and windows only. |
| (d) SQLite | Source header (src/jsc/bindings/sqlite/sqlite3.c, 3.53.4): "The author disclaims copyright... here is a blessing: May you do good and not evil..." SPDX has an ID `blessing` ("SQLite Blessing", not OSI approved) for exactly that text. Bun's docs call it "public domain". It is vendored in the Bun repo and statically built on **linux and windows only**; on macOS `bun:sqlite` dlopens system libsqlite3. |

## Component table (statically linked into the compile output unless noted)

| Component | SPDX expression | GPL-3.0-compatible (FSF) | Platform note | Source |
|---|---|---|---|---|
| Bun itself (Zig + Rust code) | MIT | Yes (Expat) | all | https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.4/LICENSE.md |
| JavaScriptCore + WTF + WebCore bits (oven-sh/webkit) | LGPL-2.0-or-later AND LGPL-2.1-or-later AND BSD-2-Clause (plus MPL-1.1/GPL-2.0/LGPL-2.1 tri-license in JSDateMath.cpp) | LGPL-2.0 not itself on the FSF list; LGPL-2.1 is "compatible with GPLv2 and GPLv3"; "or later" lets you take LGPL-3.0/GPL-3.0. Static link obliges relinkable object form | all | https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/COPYING.LIB |
| BoringSSL (oven-sh fork) | Apache-2.0 (+ BSD-3-Clause in unlinked tests) | Yes, GPLv3 only ("not compatible with GPL version 2") | all | https://github.com/oven-sh/boringssl/blob/41bf9b59c2ebf277a7aa427e1ecad5cc80dd4d4f/LICENSE |
| tinycc (oven-sh fork; enabled by `cfg.tinycc`) | LGPL-2.1-or-later (conservatively LGPL-2.1-only) | Yes (LGPLv2.1 "compatible with GPLv2 and GPLv3") | build-config dependent | https://github.com/oven-sh/tinycc/blob/05f0fafaa3be31e31d7b4b5c17dc60f62c991171/COPYING |
| ICU 78 | Unicode-3.0 (AND BSD-3-Clause AND MIT for bundled bits) | Yes ("Unicode License v3 ... compatible with all versions of the GNU GPL") | linux, windows (macOS: system ICU, not linked) | https://github.com/unicode-org/icu/blob/main/LICENSE |
| SQLite | blessing (public-domain style) | FSF list does not name it; "public domain" is GPL-compatible | linux, windows only | https://spdx.org/licenses/blessing.html |
| libarchive | BSD-2-Clause (base) AND BSD-3-Clause (compress filters) AND LicenseRef-PublicDomain (archive_parse_date.c) AND (CC0-1.0 OR Apache-2.0 OR OpenSSL for blake2 files; choose CC0-1.0 or Apache-2.0) | Yes with those choices | linked in v1.4.4; newer main marks it "not linked" | https://github.com/libarchive/libarchive/blob/master/COPYING |
| zstd | BSD-3-Clause OR GPL-2.0-only | Yes via BSD-3-Clause ("Modified BSD") | all | https://github.com/facebook/zstd/blob/dev/LICENSE |
| zlib-ng | Zlib | Yes ("License of ZLib ... compatible with the GPL") | all | https://github.com/zlib-ng/zlib-ng/blob/develop/LICENSE.md |
| brotli | MIT | Yes | all | https://github.com/google/brotli/blob/master/LICENSE |
| lol-html (c-api) | BSD-3-Clause | Yes | all | https://github.com/cloudflare/lol-html/blob/master/LICENSE |
| ls-hpack, ls-qpack | MIT | Yes | all | Bun LICENSE.md table |
| lsquic | MIT (portions BSD-3-Clause from Chromium proto-quic) | Yes | all | Bun LICENSE.md table |
| mimalloc | MIT | Yes | all | https://github.com/microsoft/mimalloc/blob/main/LICENSE |
| c-ares | MIT | Yes | all | https://github.com/c-ares/c-ares/blob/main/LICENSE.md |
| picohttpparser | MIT OR Artistic-1.0-Perl OR GPL-1.0-or-later (Bun: "Perl License or MIT") | Yes (MIT; Perl license is Artistic OR GPL) | Bun doc marks it "not linked" in newer main (src/http1 derived) | Bun LICENSE.md table |
| simdutf | Apache-2.0 OR MIT | Yes (MIT) | all | https://github.com/simdutf/simdutf (LICENSE-MIT, LICENSE-APACHE) |
| uSockets, uWebSockets fork | Apache-2.0 | Yes, GPLv3 only | all | https://github.com/uNetworking/uSockets/blob/master/LICENSE |
| libuv | MIT (+ BSD-2-Clause / ISC / BSD-3-Clause for externally maintained files per LICENSE-extra) | Yes | windows only | https://github.com/libuv/libuv/blob/v1.x/LICENSE |
| libdeflate | MIT | Yes | all | https://github.com/ebiggers/libdeflate/blob/master/COPYING |
| libbase64 | BSD-2-Clause | Yes (FreeBSD license) | all | https://github.com/aklomp/base64/blob/master/LICENSE |
| libjpeg-turbo | IJG AND BSD-3-Clause AND Zlib | Yes (IJG "compatible with the GNU GPL") | all | https://github.com/libjpeg-turbo/libjpeg-turbo/blob/main/LICENSE.md |
| libwebp | BSD-3-Clause | Yes | all | Bun LICENSE.md table |
| highway | Apache-2.0 OR BSD-3-Clause | Yes via BSD-3-Clause (or Apache-2.0, GPLv3 only) | all | https://github.com/google/highway (README: "dual-licensed as Apache 2 / BSD-3") |
| HdrHistogram_c (port, Rust) | CC0-1.0 OR BSD-2-Clause | Yes | all (bun.com docs list it; not in the v1.4.4 LICENSE.md table) | https://github.com/HdrHistogram/HdrHistogram_c/blob/master/LICENSE.txt |
| rust-argon2 3.0.0 | MIT OR Apache-2.0 | Yes | all | crates.io metadata |
| uucode | MIT | Yes | all | Bun LICENSE.md table |
| libc++abi `__cxa_thread_atexit` fallback | Apache-2.0 WITH LLVM-exception | Yes (Apache-2.0 exception text does not reduce compat) | linux | Bun LICENSE.md table |
| Tigerbeetle IO (parts) | Apache-2.0 | Yes, GPLv3 only | windows | Bun LICENSE.md table |
| Embedded Node polyfills (acorn, assert, buffer, ..., vm-browserify) | MIT (all listed) | Yes | all | Bun LICENSE.md table |
| Embedded type decls: @types/node, undici-types, jest-mock types; expect-type | MIT; Apache-2.0 | Yes | only with `--aot` type checking | Bun LICENSE.md table |
| Rust crates in Cargo.lock (305 entries; not listed by Bun) | see below | see below | all | https://github.com/oven-sh/bun/blob/bun-v1.4.4/Cargo.lock |

Rust crates spot-checked on crates.io (those likely linked, not dev-only): cssparser, cssparser-macros, selectors, dtoa-short = **MPL-2.0** (lol_html's dependencies); servo_arc, hashbrown, blake2, sha3, mime, roxmltree, bstr, half = MIT OR Apache-2.0; encoding_rs = (Apache-2.0 OR MIT) AND BSD-3-Clause; unicode-ident = (MIT OR Apache-2.0) AND Unicode-3.0; foldhash = Zlib; zerocopy = BSD-2-Clause OR Apache-2.0 OR MIT; ciborium = Apache-2.0; lol_html = BSD-3-Clause; the rest MIT. `criterion`/`plotters` are dev-dependencies.

## FSF wording for the licenses asked about (license-list.html, fetched 2026-11-16)

| SPDX | FSF wording | GPL-3.0 compatible? |
|---|---|---|
| OFL-1.1 | Listed only under "Licenses for Fonts": "a free copyleft license for fonts ... Neither we nor SIL recommend the use of this license for anything other than fonts." No GPL-compatibility statement | Not stated; treat as no (fonts only) |
| CC0-1.0 | "Both public domain works and the lax license provided by CC0 are compatible with the GNU GPL." (not recommended for software: no patent grant) | Yes |
| Zlib | "License of ZLib: This is a free software license, and compatible with the GPL." | Yes |
| BSL-1.0 | "Boost Software License: a lax, permissive non-copyleft free software license, compatible with the GNU GPL." | Yes |
| Unicode-3.0 | "Unicode License v3: a lax, permissive, free software license, compatible with all versions of the GNU GPL." | Yes |
| Python-2.0 | "License of Python 2.0.1, 2.1.1, and newer ... a free software license and is compatible with the GNU GPL." Intermediate versions 1.6b1 to 2.1 have a different license (see FSF page) | Yes (for 2.0.1+; FSF flags plain 2.0 as the intermediate one) |
| BlueOak-1.0.0 | **Not on the FSF list** (no entry found) | Unknown; FSF has not assessed it |
| MPL-2.0 | "a free software license. Section 3.3 provides indirect compatibility ... with the GNU GPL version 2.0, the GNU LGPL version 2.1, the GNU AGPL version 3, and all later versions"; MPL files stay MPL when combined | Yes, indirectly (MPL files remain available under MPL) |
| Unlicense | "a public domain dedication ... Both public domain works and the lax license provided by the Unlicense are compatible with the GNU GPL." | Yes |
| CC-BY-4.0 | "a non-copyleft free license ... compatible with all versions of the GNU GPL; however, like all CC licenses, it should not be used on software." | Yes (non-software only) |
| WTFPL | "WTFPL, Version 2: a lax permissive non-copyleft free software license, compatible with the GNU GPL. We do not recommend this license." | Yes |

Other FSF lines used above: Apache-2.0 "compatible with version 3 of the GNU GPL ... not compatible with GPL version 2"; OpenSSL "Recent versions of OpenSSL (from 3.0.0 on) are released under the Apache License 2.0. Only older versions use this license ... incompatible with the GNU GPL"; IJG "a free software license, and compatible with the GNU GPL"; LGPLv2.1 "compatible with GPLv2 and GPLv3"; Modified BSD, FreeBSD, Expat, ISC all "compatible with the GNU GPL".

## Open gaps

- `LGPL-2.0` (Library GPL) is not itself on the FSF list; only LGPL-2.1 and LGPL-3.0 are. For JSC the "or any later version" clause is the path to GPL-3.0 compatibility. A lawyer should confirm the link-combination story; the LGPL static-link duty (provide relinkable object form, as Bun's LICENSE.md describes) applies to any redistributed compiled executable.
- 7 BoringSSL source files lack the Apache header (not checked individually); webkit's full per-file license census was sampled (about 12 files), not exhaustive.
- Rust crates: only about 28 checked on crates.io; the other roughly 270 in Cargo.lock were not enumerated. Run `cargo about` or `cargo deny` on Bun's Cargo.lock to be certain. MPL-2.0 crates (cssparser, selectors, dtoa-short) are the notable non-permissive entries.
- Zig stdlib (MIT) and any other vendored C sources in `src/` or `vendor/` outside scripts/build/deps were not audited.
- Bun's LICENSE.md and docs page differ slightly (docs page adds HdrHistogram and SQLite rows; main marks libarchive/picohttpparser "not linked"); the v1.4.4 tag LICENSE.md was used for the baseline and the live docs page for the extras. No 1.4.x release newer than 1.4.4 was seen.
- Not verified: per-platform enablement flags for lsquic, tinycc and libwebp in each of the six targets.

## Sources

- https://bun.com/docs/project/license (live docs page; the `/licensing` path redirects here)
- https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.4/LICENSE.md and main branch copy
- https://github.com/oven-sh/bun/tree/bun-v1.4.4/scripts/build/deps (pins and platform gating: boringssl.ts, tinycc.ts, webkit.ts, sqlite.ts, hdrhistogram.ts)
- https://github.com/oven-sh/bun/blob/bun-v1.4.4/Cargo.lock ; https://crates.io/api/v1/crates/<name>
- https://github.com/oven-sh/boringssl (pinned commit tarball, grepped locally)
- https://github.com/oven-sh/tinycc (COPYING, tcc.h, libtcc.c)
- https://github.com/WebKit/WebKit/tree/main/Source/JavaScriptCore (COPYING.LIB and sampled headers)
- https://github.com/unicode-org/icu/blob/main/LICENSE (and release-78.1)
- https://github.com/spdx/license-list-data (SPDX IDs; blessing, Unicode-3.0, etc.)
- https://www.gnu.org/licenses/license-list.html
- Upstream LICENSE files: zstd, zlib-ng, brotli, lol-html, mimalloc, c-ares, libarchive, highway, simdutf, uSockets, libdeflate, libbase64, libuv, libjpeg-turbo, HdrHistogram_c

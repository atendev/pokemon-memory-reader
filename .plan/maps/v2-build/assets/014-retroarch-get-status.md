# 014: RetroArch `GET_STATUS` network command

Research date: 2026-11-13. Primary sources: libretro/RetroArch GitHub source.

## Sub-question

What does RetroArch's `GET_STATUS` network command (UDP port 55355) reply with in release 1.22.2, and in current master and any newer release as of November 2026? Covers: reply format (playing, paused, no content), whether `crc32=` is still present (and if removed, commit/PR/reason/first release without it), what the content name field is (extension, directory or archive member names, commas), whether any other network command exposes a content hash or path, and whether RetroArch computes the content CRC32 for gpSP in 1.22.2 even when gpSP loads by path (`need_fullpath`).

## Findings

(appended below as confirmed)

### F1. Latest release is still v1.22.2 (as of 2026-11-13)
- `gh api repos/libretro/RetroArch/releases/latest` returns `v1.22.2`, published 2025-11-20T03:12:17Z (tag commit `69a4f0ea1e`). Earlier: v1.22.1 (2025-11-15), v1.22.0 (2025-11-14), v1.21.0 (2025-05-01). No tag newer than v1.22.2 exists in `repos/libretro/RetroArch/tags`.
- So "newer release" = none. Everything below about "master" is unreleased (nightly/source only).

### F2. v1.22.2 `GET_STATUS` reply (has `crc32=`)
Source: https://github.com/libretro/RetroArch/blob/v1.22.2/command.c#L1034-L1074 (`command_get_status`).
- Content loaded (`CONTENT_ST_FLAG_IS_INITED`), playing: `GET_STATUS PLAYING <system_id>,<basename>,crc32=<hex>\n`
- Content loaded, paused: `GET_STATUS PAUSED <system_id>,<basename>,crc32=<hex>\n`
- No content: `GET_STATUS CONTENTLESS` (no trailing newline).
- `<system_id>` = `core_info->system_id` if core info exists, else `system.info.library_name`.
- `<basename>` = `path_basename(path_get(RARCH_PATH_BASENAME))`.
- `<hex>` = `%lx` of `content_get_crc()`: lowercase hex, no `0x`, no zero padding (so can be fewer than 8 digits).
- The reply length passed to the replier includes the trailing `\n` in the content case (snprintf return counted in `_len`).

### F3. master `GET_STATUS` reply: `crc32=` REMOVED
Source (master at fetch time, 2026-11-13): https://github.com/libretro/RetroArch/blob/master/command.c (`command_get_status`, around line 6020-6095 of the file at fetch time).
- Playing: `GET_STATUS PLAYING <system_id>,<basename>\n`
- Paused: `GET_STATUS PAUSED <system_id>,<basename>\n`
- No content: `GET_STATUS CONTENTLESS` (still no trailing newline).
- New fallbacks on master: `GET_STATUS ERROR` (runloop state null), `UNKNOWN` for a missing system id or missing basename.
- Removal commit: `8b91d207a9732e5994e2b1642f841188e3b4dd5f`, "command: drop the crc32 field from GET_STATUS", author libretroadmin, 2026-07-23T10:48:43Z (committed 11:05:33Z). Direct commit, no PR returned by `commits/<sha>/pulls`. Touches only `command.c` (+1/-2). https://github.com/libretro/RetroArch/commit/8b91d207a9732e5994e2b1642f841188e3b4dd5f
- Stated reason (commit message, verbatim excerpts): "GET_STATUS appended ",crc32=%lx" to its reply, which meant answering a status query could trigger a full hash of the loaded content - for a core using need_fullpath, reading a whole disc image to fill in one field of a diagnostic string." and "Nothing acts on it. It is not a check, and it is not compared against anything". "The reply keeps its trailing newline so the shape is otherwise unchanged: status, system, basename."
- First release without it: **none yet**. v1.22.2 (2025-11-20) predates the commit by 8 months and is the newest release. Any release after v1.22.2 (a future 1.22.3 or 1.23.0) would be the first without `crc32=`. Nightly builds after 2026-07-23 lack it (unverified for buildbot specifics).
- Null-pointer guard commit on `command_get_status`: `68e8274a31` "fix: null pointer on command_get_status fonction (#18585)", 2026-01-06 (likely source of the `UNKNOWN`/`ERROR` fallbacks; unverified).

### F4. How and when RetroArch 1.22.2 computes the content CRC32 (`tasks/task_content.c`)
Source: https://github.com/libretro/RetroArch/blob/v1.22.2/tasks/task_content.c (`content_file_load_into_memory` L659-745, need_fullpath branch L1076-1092, `file_crc32` L2919, `content_get_crc` L2955). `content_get_crc` is declared in `content.h`; it is NOT in a `content.c` (there is no root `content.c` at v1.22.2 or master).
- Eager: content read into a memory buffer (core does not need the full path) AND (content came out of a compressed archive OR a soft patch was applied): `p_content->rom_crc = encoding_crc32(0, buffer, size)` at load time (L718-729).
- Lazy: every other case (plain file, memory-buffer or need_fullpath): the CRC is NOT computed at load. RetroArch stores `pending_rom_crc_path` plus flag `CONTENT_ST_FLAG_PENDING_ROM_CRC`. The first call to `content_get_crc()` reads the file from that path (`file_crc32`: 1 MiB buffer, at most 64 MiB, i.e. the first 64 MiB only), stores `rom_crc`, clears the flag, and logs `[Content] CRC32: 0x%x.` (L2955-2970). Later calls return the cached value.
- Skipped (`rom_crc = 0`): first content file is a media type (`path_is_media_type() != RARCH_CONTENT_NONE`), L696-740 and L1083-1089.
- `need_fullpath` with archive content: unless `block_extract`, the member is extracted to a temp file first (L990-996) and the deferred CRC is computed on that extracted file.
- Consequence for `GET_STATUS` in 1.22.2: it is the call that triggers the lazy hash (this is the reason in the removal commit, see F3). A plain-file ROM gets the CRC of the whole file (up to 64 MiB); an archive-contained ROM (eager case, non-fullpath) gets the CRC of the extracted data.

### F5. gpSP `need_fullpath` (relevant to 1.22.2)
- gpSP is not versioned with RetroArch; cores come from the buildbot. Closest `libretro/libretro.c` commit before the 1.22.2 release (2025-11-20T03:12:17Z) is `5db42ed4c15408d76781bd2f59837c7dae52f0e8` (2025-10-05). In it, `retro_get_system_info` sets `need_fullpath = true`, `block_extract = false`, `valid_extensions = "gba|bin|agb|gbz|u1"`. https://github.com/libretro/gpsp/blob/5db42ed4c15408d76781bd2f59837c7dae52f0e8/libretro/libretro.c#L536-L538
- Same on gpsp master (checked 2026-11-13, latest commit `5819380c2f`, 2026-09-19): https://github.com/libretro/gpsp/blob/master/libretro/libretro.c#L585-L587
- Answer: gpSP loads by path (`need_fullpath = true`). RetroArch 1.22.2 does not read the ROM into memory for it and does NOT hash at load time. The CRC is still produced, but lazily: only when `content_get_crc()` runs (GET_STATUS in 1.22.2, plus any other caller such as history/playlist/netplay/achievements, unverified), by reading the file at the content path. If the ROM sits in a `.zip`/`.7z` and `block_extract` is false, RetroArch extracts the member to a temp file and hashes that.

### F6. Content name (checked by the main thread, 2026-11-14)
- On master, `runloop_path_set_basename` copies the content path. For archive content such as `comp.7z#folder/game.gba`, it rebuilds the path as the archive's directory plus the member's file name. It then cuts the path at the last dot unless that dot is its first character. `GET_STATUS` applies `path_basename`, so the content name is the file name without its extension; for an archive member, it's the member's file name without extension. Source: https://github.com/libretro/RetroArch/blob/master/runloop.c (`runloop_path_set_basename`).
- v1.22.2 has the same `runloop_path_set_basename` logic: the archive rebuild, then a cut at the last dot. Source: https://github.com/libretro/RetroArch/blob/v1.22.2/runloop.c (`runloop_path_set_basename`).
- `GET_STATUS` doesn't escape commas, and file names may contain them. The system id never contains a comma, so it ends at the first comma.
- Not researched, because the subagent stopped at a rate limit: whether another network command exposes a content hash or path. The decision doesn't need it.

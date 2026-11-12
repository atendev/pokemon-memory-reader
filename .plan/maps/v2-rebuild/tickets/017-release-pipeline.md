---
type: grilling
blocked_by: []
assets: []
---

# Release pipeline

## Question

How do the per-OS executables get built, shipped and updated, and how do emulator bridges reach the user?

Decide CI and cross-compile for Windows, Linux and macOS best effort, code signing and Windows SmartScreen, auto-update or not, where releases live, and how the mGBA and BizHawk Lua bridges are delivered and installed (see [Emulator memory access APIs](./001-emulator-memory-access.md)). The one-executable stack is from [Language and HTTP stack](./004-language-and-toolkit.md).

Input from [Decoder test fixtures](./014-decoder-fixtures.md): the v2.0 release checklist must include reviewing the coverage guard's printed list of tier 2 gaps and profiles with no fixture.

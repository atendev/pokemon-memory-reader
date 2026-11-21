### Running this build

- **Windows.** The program is unsigned, so SmartScreen warns on first run. Choose **More info**, then **Run anyway**. The same applies to Windows arm64. [Details](https://github.com/{{repo}}/blob/{{tag}}/README.md#windows-smartscreen).
- **macOS.** The program is ad-hoc signed and not notarized. After unpacking, run `xattr -d com.apple.quarantine <file>` once, then start it. [Details](https://github.com/{{repo}}/blob/{{tag}}/README.md#macos-quarantine).
- **Antivirus.** Some antivirus tools flag executables compiled with Bun. The owner submits a flagged release to Microsoft's false-positive portal.
- **Best effort.** Windows x64 and Linux x64 are the supported targets. Linux arm64, macOS (x64 and arm64) and Windows arm64 are best effort.
- **Rosetta only.** The macOS x64 build was smoke-tested under Rosetta 2 on an Apple silicon runner, not on an Intel Mac.

---
type: grilling
blocked_by: [001]
assets: []
---

# App form factor

## Question

What does the user run to start v2, and where does its interface live?

Candidates include a standalone desktop app with a GUI, a tray or background service, a browser page backed by a local helper, and a CLI. Decide how the app finds or launches the emulator, what the GUI shows (connection status, detected game, adapter choice), and whether the viewer becomes the app's GUI or stays a separate client of the API.

## Answer

v2 is one background program with no native window. It serves the API and the viewer on a local port, and the viewer is the only GUI: connection status, detected game, adapter choice, and settings.

- **Attach, never launch.** The user starts the emulator and enables its bridge or network commands. v2 connects to it. An optional launcher for RetroArch and BizHawk is out of this map.
- **Startup.** A console program that prints the viewer URL and opens the default browser, with a `--no-browser` flag. A tray icon is a later enhancement and nothing in the design depends on it.
- **Adapter discovery.** Probe every adapter's known endpoint in parallel and connect to the first responder in priority order (mGBA, RetroArch, BizHawk). The viewer lists the others so the user can switch. A config setting can pin one adapter and turn off probing.
- **One connection at a time.** Two emulators means two instances on different ports. The adapter interface does not rule out multiple sources later.
- **Lifecycle.** Fully automatic. The adapter retries in the background and the game is re-identified on every ROM change. The API reports a status (disconnected, connected with no game, game detected) instead of erroring.
- **Network.** Bind to localhost by default, with a config setting to bind a LAN address. No authentication, because the API is read-only. Document the LAN risk.

Excluded: a native desktop window, a tray-only app, an emulator launcher, multi-source connections, manual reconnect.

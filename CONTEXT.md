# Pokemon Memory Reader

Reads live game state from Pokemon games running in an emulator and serves it to other tools as an API.

## Language

**Adapter**:
The connection to one emulator that returns raw bytes from emulated memory. It has no knowledge of Pokemon.
_Avoid_: Hook, connector, driver

**Bridge**:
A small script that runs inside an emulator so an adapter can reach its memory. Only some emulators need one.
_Avoid_: Plugin, injected script

**Hello**:
The first message a bridge sends on every connection. It names the bridge, the bridge protocol version and the emulator. A connection that never says hello is an unknown bridge.
_Avoid_: Handshake, greeting

**Memory domain**:
A named area of emulated memory, such as ROM, EWRAM or cartridge RAM, read by offset from its start. Every adapter uses the same domain names, whatever the emulator calls them.
_Avoid_: Region, bank, memory type

**Data folder**:
The per-user folder where the program keeps its files, such as the bridges, user game profiles and manual picks. Its path depends on the OS unless the user moves it.
_Avoid_: App folder, install folder

**Settings**:
The choices a user makes about how the program runs, such as its port or a pinned adapter. They persist between runs. Viewer display preferences that each browser keeps for itself are not settings.
_Avoid_: Preferences, options, config

**Manual pick**:
The game profile a user chose for a ROM that identification couldn't match. It is remembered per ROM.
_Avoid_: Override, forced game

**Game profile**:
Everything known about one ROM revision: how to identify it, its memory addresses, its language, and which data format it uses. Struct layouts belong to the data format, not the profile.
_Avoid_: Game entry, game data, games DB row

**Identification**:
Matching the running ROM to a game profile. A match is exact (ROM hash), header (the ROM header and any signature bytes the profile lists agree, unconfirmed) or manual (picked by the user). A ROM with no match is unidentified.
_Avoid_: Detection, game lookup

**Data format**:
The layout of game structs in memory that a family of games shares, such as Gen 1, Gen 2, Gen 3 or CFRU. Each data format has one decoder.
_Avoid_: Engine, game type

**Expansion hack**:
A Gen 3 ROM hack built on the pokeemerald-expansion project. Its struct layouts usually differ from the official games' and change between expansion versions.
_Avoid_: RHH hack

**Reference data**:
Names and lookup tables that don't change at runtime: species, moves, items and character maps, keyed by generation and language.
_Avoid_: Constants, static data

**Name table**:
A list of names stored in a ROM and indexed by ID, such as a hack's species or move names. A hack's game profile says where each name table is, so its names come from the running game instead of from reference data.
_Avoid_: Name dump, string table

**API package**:
The published library holding the API's schemas, types and client. The program, the viewer and outside overlays all import it, so it is the single definition of the API.
_Avoid_: SDK, shared package, client library

**Viewer**:
The web page the program serves that shows the current game state in a readable form, for people who don't use the API. It also shows connection status and settings.
_Avoid_: GUI, dashboard, frontend

**Icon pack**:
Images a user puts in the data folder to replace or add Pokemon, item and type art in the viewer, including art for ROM-hack species no community source has. A file in the pack wins over any downloaded one.
_Avoid_: Sprite pack, theme, skin

**Art version**:
The game version whose Pokemon sprites the viewer shows on its cards for a game profile, such as Emerald or Crystal. A ROM hack uses its base game's art version.
_Avoid_: Sprite set, art style

**Resource**:
A named piece of game state the API serves as one unit, such as the status, player, party, bag or battle. Clients read a resource whole and receive it whole when it changes.
_Avoid_: Endpoint, topic, feed

**Battler**:
A Pokemon currently on the field in a battle position. It can differ from the party member it came from, for example after Transform.
_Avoid_: Active mon, fighter

**Side**:
The player's or the opponent's half of a battle. Side conditions such as Reflect or Spikes belong to a side, not to one battler.
_Avoid_: Team

**Revealed**:
An opponent party member the player has seen on the field. This program tracks it; the game does not store it.
_Avoid_: Seen, known

**Last battle**:
The frozen snapshot of the most recent battle with its outcome, kept in memory until the game changes or the program restarts.
_Avoid_: Battle history, previous battle

**Decoder**:
Turns raw bytes into domain data, such as a party Pokemon or a bag, for one data format like Gen 3 or CFRU.
_Avoid_: Reader, parser

**Fixture**:
A set of slices captured from one real game state, stored with the decoded result expected from them. The expected result names which values the owner confirmed on the game's own screens. A fixture never holds ROM data.
_Avoid_: Savestate, dump, snapshot

**Slice**:
One memory range inside a fixture, covering only what a decoder reads.
_Avoid_: Chunk, region dump

**Box**:
One PC storage box holding a fixed number of Pokemon slots in game order. Gen 1-2 keep only the current box in live memory and the rest in save RAM.
_Avoid_: Bank, storage page

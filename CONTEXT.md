# Pokemon Memory Reader

Reads live game state from Pokemon games running in an emulator and serves it to other tools as an API.

## Language

**Adapter**:
The connection to one emulator that returns raw bytes from emulated memory. It has no knowledge of Pokemon.
_Avoid_: Hook, connector, driver

**Bridge**:
A small script that runs inside an emulator so an adapter can reach its memory. Only some emulators need one.
_Avoid_: Plugin, injected script

**Game profile**:
Everything known about one ROM revision: how to identify it, its memory addresses, its language, and which data format it uses. Struct layouts belong to the data format, not the profile.
_Avoid_: Game entry, game data, games DB row

**Identification**:
Matching the running ROM to a game profile. A match is exact (ROM hash), header-only (unconfirmed) or manual (picked by the user). A ROM with no match is unidentified.
_Avoid_: Detection, game lookup

**Data format**:
The layout of game structs in memory that a family of games shares, such as Gen 1, Gen 2, Gen 3 or CFRU. Each data format has one decoder.
_Avoid_: Engine, game type

**Reference data**:
Names and lookup tables that don't change at runtime: species, moves, items and character maps, keyed by generation and language.
_Avoid_: Constants, static data

**Viewer**:
The web page the program serves that shows the current game state in a readable form, for people who don't use the API. It also shows connection status and settings.
_Avoid_: GUI, dashboard, frontend

**Resource**:
A named piece of game state the API serves as one unit, such as the status, player, party, bag or battle. Clients read a resource whole and receive it whole when it changes.
_Avoid_: Endpoint, topic, feed

**Decoder**:
Turns raw bytes into domain data, such as a party Pokemon or a bag, for one data format like Gen 3 or CFRU.
_Avoid_: Reader, parser

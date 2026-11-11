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
Everything known about one ROM: how to identify it, its memory addresses, and its struct layouts.
_Avoid_: Game entry, game data, games DB row

**Decoder**:
Turns raw bytes into domain data, such as a party Pokemon or a bag, for one data format like Gen 3 or CFRU.
_Avoid_: Reader, parser

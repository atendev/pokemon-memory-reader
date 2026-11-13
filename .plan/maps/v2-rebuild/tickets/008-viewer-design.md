---
type: prototype
blocked_by: [003, 004, 006]
assets: []
---

# Viewer design

## Question

What screens and states does the new viewer show, which settings does it own, and what is its visual system (layout, components, styling on Tailwind)?

The viewer is the app's only GUI and is built from scratch. It must cover connection status, the detected game, adapter choice, and settings from the app form factor ticket, plus a readable view of the game state the API v2 contract exposes. Prototype the main screens to react to before deciding.

The License ticket rules out bundling Nintendo art, so decide where sprites come from: a user-set URL, a community CDN, or no sprites.

## Answer

The viewer is a sidebar app: a collapsible left rail with four screens (Party, Battle, Trainer & bag, Settings) and a status block at its foot. The prototype is [assets/008-viewer-prototype/index.html](../assets/008-viewer-prototype/index.html), Variant A. Variants B (top tabs) and C (one scrolling page) were not chosen and stay in the file only as history.

- **Shell.** The sidebar shows the connection state and adapter at its foot, with a red dot on Battle while a battle is live. It collapses to an icon rail with a toggle. The not-connected and no-game states replace the screens with an explanatory empty state and an adapter probe list.
- **Party.** Six cards, one per slot, each holding the full detail: sprite, nickname, species, level, gender, shiny, status, types, ball, HP, held item, ability, nature, Hidden Power, stats/IVs/EVs, and moves with type icons and PP. Empty slots show a placeholder. With the sidebar collapsed, the cards switch to a denser 3x2 grid so the whole party fits on one screen. Expanded, it's 2 columns. Fields a generation lacks show `—`, and a note in the status block says which.
- **Battle.** Your active Pokémon's full card, a VS, and the opponent's active Pokémon card (sprite, level, types, status, HP, held item, moves; no stats). Below, a trainer card (class, name, battle kind, turn, prize money, Pokémon left, usable items) and a card with the opponent's whole party as tiles with a highlighted active one. With no battle, an empty state.
- **Trainer & bag.** Player details with an eight-badge row, and the bag by pocket with item icons.
- **Settings.** Adapter pin and list, port, bind address with a LAN warning, open-browser toggle, and icon source. The config file and its full setting list remain a separate open question.
- **Icons.** Types, items, balls and Pokémon use icons with the name beside them. Status conditions are short text badges. Icons load at runtime from a community source (PokeAPI sprites in the prototype). The settings let users pick another source, set a custom Pokémon sprite URL, or turn icons off, and any icon that fails to load falls back to its name. Nothing is bundled, per the License ticket. Whether runtime hotlinking from that source is acceptable is not settled and belongs with the release work.
- **Styling.** Tailwind, dark theme, rounded cards on a dark slate surface, HP bars that turn green, amber, red and grey, and type colours for fallback dots.
- **Battle data needed.** The Battle screen assumes the API can supply: the opponent's full party with level, HP, status, types, held items and moves, plus trainer class, name, prize money and usable items. Which of these are readable, and when, is still the battle tracker decision.

Excluded: a list-and-detail party layout, top-tab and single-scroll navigation, bundled art, and dedicated icon art for status conditions.

Amended by [PC box reading](./013-pc-boxes.md): adds a fifth screen, Boxes.

Amended by [Release pipeline](./017-release-pipeline.md): the connection screen shows the bridge data-folder path with a copy button, a download button per bridge and steps per emulator. The app shows an update banner linking to the release page. Settings or an About page shows the version string and the third-party notices.

Amended by [Config file](./019-config-file.md): Settings reads and writes through the viewer-only `/settings` route. It shows each field's source, disables fields a flag overrides, marks port, host and open-browser as "restart to apply", shows the config file and profiles folder paths, and shows a banner naming the file when saves are refused.

Amended by [Icon loading and fallbacks](./021-icon-loading.md): a Pokémon without an icon shows a tile tinted with its primary type colour, and the Settings icon section (mode, mirror URL, pack folder, cache size and clear button, art credit) replaces the custom `{dex}` sprite URL.

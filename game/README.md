# Astral Fantasy — The Shattered Realms

A browser dungeon crawler built from the repo's Astral Fantasy art pack: a fantasy keep for a
home screen, ornate gold UI, animated Japanese-style hero sprites presented as "astral wanderers",
and procedurally drawn monsters (no monster art exists in the pack).

Open `index.html` from a local web server (e.g. `python3 -m http.server`) — it needs no build step.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | `WASD` / arrows | left stick |
| Attack | `J` / `Space` / left click | red sword button |
| Class skill | `K` / right click | blue bolt button |
| Dash | `Shift` | — |
| Potion | `1` | flask button |
| Pause | `Esc` | top-right pause |

## Structure

- `index.html` — boot, home, hero select, dungeon select, play, and the six panel screens
  (quests, character, inventory, map, shop, ranks, settings). Dialogs (intro, pause, results,
  item detail) reuse the overlay.
- `css/style.css` — all layout, frames, HUD and breakpoints (desktop, tablet, portrait and
  landscape phones).
- `js/data.js` — classes, items, dungeons, shop, palettes.
- `js/core.js` — storage, audio, tiny DOM helpers.
- `js/sprites.js` — hero sprite animation, procedural monsters and bosses, portraits, props.
- `js/state.js` — save state, stats, loot, quests, leaderboard.
- `js/ui.js` — screens, panels, home HUD, dialogs, results.
- `js/combat.js` — real-time dungeon run: rooms, camera, enemies, bosses, loot, floors.
- `js/main.js` — boot sequence, navigation, settings and autosave wiring.

## Progress

Everything is saved to `localStorage` (`astral-fantasy.save.v1`): hero, level, XP, gold, gems,
inventory, equipment, records and the Hall of Deeds. "Reset Progress" in Settings clears it.

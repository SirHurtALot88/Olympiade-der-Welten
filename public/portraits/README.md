# Player portraits (repo-relative)

Drop portrait image files into this folder to make them show up in the game.
No Dropbox paths, no absolute file paths, nothing outside the repo — this
folder is served statically at `/portraits/<filename>` and is checked out
wherever the repo is checked out (your machine, the cloud container, CI).

## How to add a portrait

1. Copy the image file into `public/portraits/`.
2. Name the file using **either** of these conventions (both are checked):
   - **Player ID** (most reliable): the player's full id, e.g.
     `player-0001-umbros.jpg`. You can find a player's id in
     `data/generated/player-portrait-map.json` or in save/export data.
   - **Name slug** (easiest): just the character-name part of the id,
     lowercase, e.g. `umbros.jpg` for `player-0001-umbros`, or
     `lakshmi-ekelemann.jpg` for `player-2969-lakshmi-ekelemann`. This is the
     text after the 4-digit number in the player id, with spaces replaced by
     hyphens.
3. Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.
4. Regenerate the file index so the app knows the file exists:

   ```
   npm run portraits:index
   ```

   This scans this folder and writes `data/generated/portrait-files.json`.
   Restart `npm run dev` (or rebuild) afterwards if it was already running.

That's it — no other files need to change. If no matching file is found for
a player, the app falls back to the legacy portrait map (if present) and
finally to grey initials, so adding zero files never breaks anything.

## Resolution priority (for reference)

For a given player, the app resolves a portrait in this order:

1. An explicit repo-relative `portraitUrl`/`portraitPath` already set on the
   player record (e.g. `/assets/...`).
2. A file in this folder matching the player's id (`<playerId>.<ext>`).
3. A file in this folder matching the player's name slug (`<slug>.<ext>`).
4. The legacy `data/generated/player-portrait-map.json` entry, served
   through `/api/media/player-portrait/<playerId>` (only works if that
   absolute path still exists on the machine running the server).
5. Grey initials fallback.

Steps 2–3 are the ones you control simply by adding files here — no code or
data-map changes required.

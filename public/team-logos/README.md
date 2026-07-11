# Team logos (repo-relative)

Drop team crest image files into this folder to make them show up in the
game. No Dropbox paths, no absolute file paths, nothing outside the repo —
this folder is served statically at `/team-logos/<filename>` and is checked
out wherever the repo is checked out (your machine, the cloud container, CI).

## How to add a team logo

1. Copy the image file into `public/team-logos/`.
2. Name the file after the team's **id**, e.g. `A-A.png` for the team whose
   `teamId` is `A-A`. You can find a team's id in
   `data/generated/team-logo-map.json` (the JSON keys) or in save/export
   data. Matching is case-insensitive, so `a-a.png` works too.
3. Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.
4. Regenerate the file index so the app knows the file exists:

   ```
   npm run team-logos:index
   ```

   This scans this folder and writes `data/generated/team-logo-files.json`.
   Restart `npm run dev` (or rebuild) afterwards if it was already running.

That's it — no other files need to change. If no matching file is found for
a team, the app falls back to the legacy team-logo map (if present) and
finally to a grey initials badge, so adding zero files never breaks
anything.

## Resolution priority (for reference)

For a given team, the app resolves a crest in this order:

1. An explicit repo-relative `logoUrl`/`logoPath` already set on the team
   record (e.g. `/assets/...`).
2. A file in this folder matching the team's id (`<teamId>.<ext>`).
3. The legacy `data/generated/team-logo-map.json` entry, served through
   `/api/media/team-logo/<teamId>` (only works if that absolute path still
   exists on the machine running the server).
4. Grey initials fallback (e.g. "A-A").

Step 2 is the one you control simply by adding files here — no code or
data-map changes required.

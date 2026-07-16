# Next Build Stability Notes

## Grundregel
- Dev und Build nicht parallel laufen lassen.
- Bei kaputten Artefakten zuerst `next:clean`.

## Stabiler Ablauf
1. `npm run next:clean`
2. `npm run build`
3. `npm run build`
4. `npm test`

## Wichtige Eingrenzung
- Der aktuelle Restfehler ist im Projektstand nicht mehr das fruehere fehlende `pages-manifest.json`.
- Der reproduzierte Fehler war stattdessen:
  - `Another next build process is already running`
- Das ist kein kaputter Output in `.next`, sondern ein parallel gestarteter zweiter Build.
- Deshalb gilt das Gate nur als bestanden, wenn die beiden Builds **nacheinander** und nicht ueberlappend laufen.

## Warum das wichtig ist
Fruehere Fehler waren keine Fachfehler, sondern Next-/Artefakt-Probleme in `.next`, `.next-dev` oder `.turbo`.

## Bezug zum Golden-Master-Harness
Der Harness selbst ist read-only. Wenn spaetere Verifikationslaeufe Build-Ausgaben oder lokale App-Outputs erzeugen, sollen diese seriell und nicht parallel zu laufenden Dev-Sessions erzeugt werden.

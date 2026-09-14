# Pro Cycling Manager 2026 — Referenzdaten

Kleine Kennzahlen aus Chris' echter WorldDB 2026 (`OfficialRelease.cdb`, lizenzierte
Mod-Datenbank), die `scripts/pcm/oly-pcm-mapping.mjs` als Zielverteilung fuer die
Level+Profil-Skalierung braucht (s. `scripts/export-pcm-mod.mjs` Kopfkommentar und den
Fable-Plan vom 05.09.2026 fuer die vollstaendige Herleitung).

- `reference-stats.json` — Zeilenzahlen, Level-Quantile, Innerhalb-Fahrer-SD-Median,
  potentiel/tour/classic-Verteilungen der 919 echten WorldTour+ProTeams-Fahrerzeilen, sowie
  die nach Real-Staerke sortierten Team-Markennamen fuer die Slot-Zuordnung.
  Erzeugt via `node scripts/pcm/dump-reference-stats.mjs <pfad-zur-cdb>`.

Die `.cdb` selbst (Chris' lizenzierte Mod-Datenbank, ~1.2 MB) gehoert NICHT ins Repo —
nur diese abgeleiteten Kennzahlen. `scripts/export-pcm-mod.mjs` erwartet den Pfad zur
echten Datei per `--cdb`.

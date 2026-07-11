# Scouting Sterne & Potential

## CAS — Current Ability Stars

- Halbsterne (0.5–5.0) pro Achse POW/SPE/MEN/SOC
- Liga-Percentile statt absoluter Werte
- Disziplin-Spezialisierung: +0.5★ bei ≥2 Top-20-Diszis oder Elite Top-3
- Overall gewichtet nach Klassen-Profil

## PAS — Potential Ability Stars

- Hidden Decke pro Achse in `PlayerPotentialRecord.hiddenPotentialCeilingByAxis`
- Gap = Decke − CAS treibt Training (`organic-season-progression`)
- Scouting enthüllt PAS langsamer als CAS (Band → Range → Achsen)

## Wishlist vs. Beobachten

- Wishlist = Kaufabsicht (kein Slot)
- Beobachten = aktive Pipeline
- Wishlist-Mirror nur ab Scouting Office L1

## Entwicklungs-Tendenz (keine Team-Hardcodes)

- Soft score 0–1 aus Strategy-Profile + Identity (`team-development-tendency.ts`)
- Teacher/Mentor-Archetypen, Value-over-Star-Bias, Mentor-Kultur → höhere Tendenz
- Effekte skaliert, nicht binär: bis −10% Facility-Upgrade, +15% Training-Center, Board-Ziel L1–3
- T-T ist ein gutes Beispiel, weil sein Profil natürlich hoch scored — nicht wegen `shortCode`-Gates

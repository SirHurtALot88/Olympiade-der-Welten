# Sponsor-System V2 — Design-Notiz (geplant)

> Status: **V2.5 implementiert (Sterne-Tiers + Commercial Rating)**  
> Wave 1 MVP ist live; V2.5 ergänzt Prestige-Ranking und 1–5-Sterne-Angebote.

## Commercial Rating & Star Tiers (V2.5)

- **Commercial Rating (0–100):** Historie (45%), Kader nach Transfers (35%), Prestige (20%)
- **3 Angebote** mit unabhängiger Stern-Ziehung (1–5★), max. ein 5★-Angebot
- Höhere Sterne = mehr Cash **und** schärfere Ziele
- Angebote werden **nach Transferfenster** regeneriert (`sponsor_choice` Step)

## Ziel

Pro Saison wählt jedes Team **einen von drei Sponsoren**. Jeder Sponsor bietet ein **eigenes Paket aus vier Cash-Komponenten** — nicht nur einen Pauschalbetrag, sondern ein klares Vertragsprofil mit unterschiedlichen Risiken und Belohnungen.

## Saisonstart: Sponsor-Auswahl

- **3 Angebote** pro Team, z. B. generiert aus Team-Identität, Liga-Stärke, Ambition, Finanzprofil.
- Später: **unique benannte Sponsoren** (Marken/Partner mit Flavor-Text), nicht nur generische Templates.
- Auswahl wird im Save persistiert (`seasonState.sponsorChoiceByTeamId` o. ä.).
- UI: Pre-Season / Board-Schritt „Sponsor wählen“ mit Vergleich der drei Pakete.

## Vier Cash-Komponenten pro Sponsor

| Komponente | Beschreibung | Beispiel |
|---|---|---|
| **Basisbetrag** | Fixe Saisonzahlung unabhängig von Ergebnis | +8 Cash bei Saisonstart |
| **Platzierungsbonus** | Extra-Cash wenn Ziel-Rang erreicht/übertroffen | Top 8 → +4, Top 4 → +8 |
| **Verbesserungsziel** | Bonus für Fortschritt ggü. Vorjahr / Erwartung | +3 wenn ≥2 Plätze besser als Soll-Rang |
| **Sonderziel** | Team-passendes Spezialziel | M-M: „≥2 Disziplin-Top-3“ · C-C: „Transfergewinn ≥10“ |

Sponsor-Typen unterscheiden sich durch **Gewichtung** dieser vier Säulen, nicht nur durch Höhe:

- **Sicherheits-Sponsor:** hoher Basisbetrag, niedrige Boni.
- **Leistungs-Sponsor:** niedriger Basisbetrag, hoher Platzierungs-/Verbesserungsbonus.
- **Identitäts-Sponsor:** moderater Basisbetrag, starkes Sonderziel passend zum Team-Archetyp.

## Auszahlungslogik (Vorschlag)

1. **Basisbetrag:** zu Saisonstart oder in Raten (z. B. 50 % Start, 50 % Halbzeit).
2. **Platzierungsbonus:** Season-End nach finalem Rang.
3. **Verbesserungsbonus:** Season-End nach Vergleich Soll vs. Ist (Vorjahres-Rang, Board-Erwartung).
4. **Sonderziel:** bei Erfüllung während der Saison (Inbox + Cash) oder Season-End.

## Board-Integration

- Sponsor-Ziele erscheinen als eigene Kategorie `sponsor` in `teamSeasonObjectives`.
- Board-Vertrauen reagiert auf erfüllte/fehlgeschlagene Sponsor-Komponenten.
- Warnung `sponsor_objective_source_missing` entfällt, sobald ein Sponsor gewählt ist.

## AI-Teams

- KI wählt Sponsor anhand `TeamStrategyProfile` (Finanzen vs. Ambition vs. Risiko).
- Cash-Druck → Sicherheits-Sponsor; Titelambition → Leistungs-Sponsor; Identitäts-Fit → Sonderziel-Sponsor.

## Offene Design-Fragen

- Ein Sponsor pro Saison oder Vertragslauf über mehrere Saisons?
- Kündigung / Wechsel nur in Pre-Season?
- Interaktion mit Preisgeld und Facility-Einnahmen (Cap / Synergien)?
- Multiplayer: gleichzeitige Auswahl aller Owner vs. async?

## Implementierungs-Reihenfolge (empfohlen)

1. Datenmodell + Persistenz (Sponsor-Template, Team-Auswahl, Auszahlungs-Events)
2. UI Auswahl (3 Karten, Vergleich)
3. Objective-Generator (4 Komponenten → Board-Slate)
4. Season-End Settlement + Inbox
5. Unique Sponsoren-Pool + Flavor
6. KI-Auswahl + Balancing-Audit

## Referenzen im Code (Stand V1)

- `lib/board/team-season-objectives-service.ts` — Board-Ziele ohne Sponsor-Kategorie
- `lib/season/preseason-workflow-service.ts` — `sponsor_source_missing` bei fehlendem Sponsor-Cash
- `lib/foundation/feature-audit-matrix.ts` — Feature `board-sponsor-objectives`

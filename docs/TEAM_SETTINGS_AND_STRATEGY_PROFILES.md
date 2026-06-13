# Team Settings And Strategy Profiles

Stand: 2026-06-06

## Zweck

`Team Settings` ist die user-facing Seite fuer Team-Identitaet, Lore, Strategy Profiles und lokale AI-Freigaben.

`Admin` bleibt der technische Bereich fuer Save-, Import- und Debug-Themen.

Speichern auf `Team Settings` loest keine AI-Aktion aus.

## Source Of Truth

### Defaults

Identity-Rohwerte liegen in:
- `data/source/team-identities.json`

Diese Defaults stammen aus der Season-Management-Tabelle und enthalten fuer alle 32 Teams:
- `playerType`
- `pow`, `spe`, `men`, `soc`
- `ambition`, `finances`, `boardConfidence`, `harmony`, `manners`, `popularity`, `cooperation`
- `playerMin`, `playerOpt`

Strategy-Profile-Defaults liegen in:
- `lib/foundation/team-strategy-profiles.ts`

Dort werden die 32 Lore-/Verhaltensprofile kanonisch geseedet und anschliessend normalisiert.

### Lokale Save-Daten

Lokale Team-Settings werden nur im SQLite-Save gehalten:
- `gameState.seasonState.teamIdentityOverrides`
- `gameState.seasonState.teamControlSettings`
- `gameState.seasonState.teamStrategyProfiles`

`source=prisma` bleibt read-only.

## Team Settings Seite

Die Foundation-Navigation enthaelt:
- `Team Settings`
- `Admin`

`Team Settings` zeigt pro Team:
- Team Selector
- Control Mode / AI-Freigaben
- Identity Ratings
- abgeleitete Axis Weights
- Lore & Strategy
- Preference Tags
- Bias-/Verhaltensfelder
- Local Save Context

Buttons:
- `Team Settings lokal speichern`
- `Aenderungen verwerfen`
- `Export JSON`
- `Identity lokal speichern`
- `Identity auf Default`
- `Strategy Profile lokal speichern`
- `Strategy Draft zuruecksetzen`
- `Reset auf Default`

## Identity Ratings

Identity Ratings sind Rohwerte und keine aktuellen Saisonwerte.

Sie beschreiben Team-Tendenzen:
- Power
- Speed
- Mental
- Social
- Ambition
- Finances
- Board Confidence
- Harmony
- Manners
- Popularity
- Cooperation
- Player Min / Player Opt
- Player Type (`F` oder `C`)

Abgeleitete Axis Weights sind nur ein interner AI-Hinweis und werden getrennt von den Rohwerten gezeigt.

## Strategy Profiles

Strategy Profiles enthalten Lore und Verhalten, zum Beispiel:
- `strategySummary`
- `buyStyle`
- `sellStyle`
- `contractStyle`
- `rosterStyle`
- `fantasyTheme`
- `loreTheme`
- Archetype-/Race-/Class-/Trait-Praeferenzen
- No-Go-Listen
- Bias-Werte

Beispielteams mit bewusst unterschiedlichen Profilen:
- `C-C` Cash Creators: Value/Profit/kurze Vertraege
- `W-W` Wicked Wizards: Mental-Star-/Mage-Fokus
- `D-L` Dire Legion: Human-only Konfliktlogik
- `W-L` Wrecking Legionnaires: Mercenary-Fokus
- `Z-H` Zero Heroes: hohe Ambition / hohes Risiko
- `M-M` Mayhem Mavericks: Star- und Opportunismus-Fokus

## AI-Nutzung

AI-Services lesen die gemergten Teamdaten read-only:
- `lib/ai/ai-legacy-lineup-engine.ts`
- `lib/ai/ai-transfermarkt-preview-service.ts`
- `lib/ai/ai-transfermarkt-sell-preview-service.ts`
- `lib/ai/ai-market-plan-preview-service.ts`
- `lib/ai/ai-market-plan-apply-service.ts`

Wichtig:
- kein Speichern in Prisma
- kein Auto-Buy
- kein Auto-Sell
- kein Auto-Lineup nur durch Profil-Speichern

## Merge-Regel

- Defaults kommen aus den kanonischen Quellen.
- Lokale Save-Werte werden daruebergelegt.
- UI zeigt den wirksamen gemergten Stand.
- `Reset auf Default` entfernt den lokalen Entwurf fuer das Team und zeigt wieder den Default-Kontext.

## Bekannte Grenze

`teamStrategyProfiles` werden aktuell als lokale, normalisierte Save-Map gehalten. Das ist fuer den lokalen Singleplayer-Flow stabil, aber noch kein separates Prisma-/Produktmodell.

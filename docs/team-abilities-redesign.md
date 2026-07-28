# Team-Abilities-Redesign: Eine Signature-Ability pro Team

Entwurf, 2026-07-28. Antwort auf Chris' Frage:

> "macht es sinn eine starke ability pro team zu machen die möglichst unterschiedlich ist und
> jedes team kann was anderes? Das könnte dann auch in Arena und außerhalb bezogen sein.
> C-C kann zb cash generieren oder teams können einen rivalen attacken oder verletzen oder
> fatigue hinzufügen oder sonstwas dass man ne team ability hat die man mal zünden kann"

**Kurzantwort: Ja, aber als Hybrid.** Das bestehende generische Power-Deck behalten (es ist das
verlässliche Grundrauschen) und pro Team genau EINE handkuratierte Signature-Ability
obendrauf setzen — stark, selten, lore-getrieben, teils außerhalb der Arena. Nicht 32
Spezialsysteme bauen, sondern ~9 wiederverwendbare Effekt-Bausteine, die pro Team mit
eigenen Parametern, eigenem Trigger und eigenem Namen instanziiert werden.

---

## 1. Bestandsaufnahme: Was das heutige System kann — und was nicht

### Wo eine Power heute angreift

Der komplette Wirkpfad einer Team-Power läuft über **einen einzigen Kanal: den Seitenscore
eines Spieltags.**

| Stelle | Datei | Was passiert |
| --- | --- | --- |
| Generierung | `lib/lineups/team-powers.ts` | 6 Identity-Powers pro Team aus Doktrin × Achse × Namensliste, kombinatorisch; dazu Facility-Powers. Nur 2 Teams (P-S, T-G) haben handgeschriebene Overrides. |
| Auswahl | `app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx` | Pro Disziplin-Seite (d1/d2) wird eine Power in die Einsatzliste gesteckt (`modifiers.d1/d2.teamPowerId`). Ladungen 4/3/2 pro Saison. |
| Boost-Rechnung | `lib/lineups/team-powers.ts` → `calculateTeamPowerModifierForSide` | Basis (5–8 %) × Kategorie-Fit (×0.6 bei Off-Fit) + Attribut-Fit (−0.8 bis +2 %) + Captain-Anteil. Bei self/support fließt das als `teamPowerModifier` in den Seitenscore (`legacy-lineup-preview-from-context.ts`, `legacy-score-engine.ts`). |
| Debuff-Auflösung | `lib/resolve/legacy-matchday-resolve-engine.ts` → `applyTeamPowerDebuffs` | snipe/field/rivalry-Debuffs ziehen dem Ziel bei der Spieltagsauflösung Prozent vom Score ab (field gestreut ×0.65), proportional bis auf Spieler-Scores runtergebrochen. |
| Passiv | `calculatePassiveTeamPowerBonus` | Slot 0 ist immer aktiv, gedeckelt auf +3 %. |

### Wo eine Power heute NICHT angreift

- **Finanzen** (`team.cash`, Sponsor-/Loan-Logs): kein Berührungspunkt.
- **Fatigue/Verletzung** (`playerAvailabilityState`, `applyFatigueAndInjuryAfterMatchday`,
  `buildMatchdayInjuryRollMap`): kein Berührungspunkt.
- **Moral/Rivalität** (`lib/morale/`, `lib/rivalries/`): Rivalität wird nur GELESEN
  (Targeting `single_rival`), nie geschrieben.
- **Zeit**: Es gibt nur ein Timing-Fenster — "mit der Einsatzliste abgeben". Nichts wirkt
  nach dem Spieltag, nichts über mehrere Spieltage.

### Warum sich die Powers alle gleich anfühlen (die Messung bestätigt es)

Audit auf realem Save: Wirkung 0–8 %, Schnitt 2,76 %, fast jeder AI-Pick ist "6 % Basis
+ Fit-Krümel". Drei strukturelle Gründe:

1. **Ein Wirkkanal, eine Einheit.** Alles ist "±x % auf einen Seitenscore". Ob "Brutal Heavy
   Statement" oder "Distract Calculated Risk" — der Spieler erlebt denselben Effekt mit
   anderem Namen. Die kombinatorischen Namen suggerieren Vielfalt, die mechanisch nicht existiert.
2. **Die Spannbreite ist zu eng.** Zwischen bester und schlechtester Wahl liegen selten mehr
   als 2–3 Prozentpunkte. Das belohnt kein Timing und keine Teamkenntnis.
3. **Der interessanteste Mechanismus liegt brach.** `conditionalTrigger` (Bedingung → Bonus)
   existiert im Datenmodell, in der AI (`powerAllowedForSide`) und im Resolve — wird aber von
   genau EINER Power (P-S "Redline Protocol", +2 %) genutzt. Das Repo wollte offensichtlich
   schon in Richtung team-spezifischer Bedingungen, der Ausbau ist nur nie passiert.

---

## 2. Die eigentliche Frage: Macht "eine starke Ability pro Team" Sinn?

### Dafür

- **Team-Identität wird spielbar.** 32 Teams mit Lore (Lexikon, Identitätswerten, Rivalitäten)
  — aber im Spiel unterscheidet sie nur die Kaderqualität. "Cash Creators generieren Cash" ist
  sofort erzählbar; "Spotlight Clean Lane +6 %" ist es nicht.
- **Ein Zünd-Moment ist ein Entscheidungs-Moment.** 1–2 Ladungen pro Saison zwingen zur Frage
  "jetzt oder später?" — das ist genau die Art Entscheidung, die einem Manager-Spiel Tiefe gibt.
  Die heutigen 4/3/2 Ladungen bei ±2 % Unterschied stellen diese Frage nie ernsthaft.
- **Nicht-Arena-Effekte öffnen neue Verzahnung.** Cash, Fatigue und Verletzungsrisiko sind
  bereits ausgebaute, balancierte Systeme — eine Ability, die dort andockt, bekommt Tiefe
  geschenkt statt sie neu bauen zu müssen.
- **Gegnerlesen im Multiplayer.** Wenn jedes Team EINE bekannte Signature hat, entsteht
  Metagame: "H-R hat seine Brandschatzung noch — rotiere ich meine Stars raus?"

### Dagegen (ehrlich)

- **32 einzigartige Abilities sind nicht balancierbar und nicht wartbar.** "Möglichst
  unterschiedlich" wörtlich genommen heißt 32 Sonderpfade durch Score-Engine, Resolve,
  Persistenz, UI und AI. Das killt die Testbarkeit (der heutige Audit prüft 96 Powers
  uniform) und jede Balance-Iteration wird zur Einzelfallpflege.
- **Die AI muss jede Ability spielen können.** Schon heute zünden 12–13 von 32 Teams gar
  nicht (Audit-Warnings). Jede Ability, für die die AI keine Zündregel hat, ist im 4v4 ein
  reiner Menschen-Vorteil.
- **Das generische System ist nicht wertlos.** Es liefert verlässliche, disziplin-getriebene
  Grundentscheidungen und die Facility-Anbindung. Es wegzuwerfen wäre Verlust ohne Not.

### Empfehlung: Hybrid mit Baustein-Katalog

- **Behalten:** Identity-Powers (evtl. auf 4 Slots eingedampft), Facility-Powers, Passiv-Bonus.
  Das ist das "Brot": planbar, disziplinbezogen, ausbalanciert.
- **Neu:** Genau **eine Signature-Ability pro Team**, handkuratiert, aus einem Katalog von
  **~9 Effekt-Bausteinen** (siehe §4). Einzigartig wird die Ability durch die Kombination aus
  Baustein + Parametern + Bedingung + Lore-Name — nicht durch 32 verschiedene Codepfade.
  Faustregel: 3–5 Teams teilen sich einen Baustein, keine zwei Teams dieselbe Parametrierung.
- **Der Weg dorthin existiert schon:** `TEAM_POWER_SLOT_OVERRIDES` + `conditionalTrigger`
  sind der embryonale Signature-Mechanismus. Das Redesign verallgemeinert, was für P-S schon
  handgebaut wurde.

---

## 3. Machbarkeit der Nicht-Arena-Effekte

Geprüft gegen den realen Code. Sortiert von billig nach teuer:

### Cash — BILLIG ✅

- **Angriffspunkt:** `team.cash`. Exakt die Mechanik von `applySponsorEvents`
  (`lib/sponsor/sponsor-event-service.ts`: `{ ...team, cash: roundCash(team.cash + delta) }`).
- **Aufwand:** Ein Hook in der Post-Matchday-Kaskade + ein Ledger-Record analog
  `SponsorEventRecord`, damit der Geldfluss im Finanz-Log auftaucht. Keine Engine-Änderung.
- **Prototyp:** `applySignatureCashGain` in `lib/lineups/team-signature-abilities.ts`, getestet.
- **Balance-Anker:** Betrag deutlich unter einem kleinen Sponsor-Bonus halten, sonst
  verzerrt es die Sponsor-/Loan-Ökonomie (Kreditlimit hängt an Cash!).

### Fatigue (zufügen UND erholen) — BILLIG BIS MITTEL ✅

- **Angriffspunkt:** `seasonState.playerAvailabilityState[].fatigue` + `players[].fatigue`
  — dieselben zwei Stellen, die `applyFatigueAndInjuryAfterMatchday` schreibt, geclampt 0..100.
- **Aufwand:** Pure Transformation (Prototyp: `applySignatureFatigueDelta`, getestet).
  Der einzige heikle Punkt ist das **Timing**: Anwendung muss nach der Einsatzlisten-Deadline,
  aber VOR `buildMatchdayInjuryRollMap` liegen, weil die deterministischen Injury-Rolls von
  `fatigueBeforeRoll` abhängen — sonst sehen Preview und Resolve verschiedene Rolls.
- **Gratis-Bonus:** Fatigue speist die Injury-Risk-Kurve. Ein Fatigue-Angriff IST damit
  bereits eine indirekte Verletzungsdrohung — ohne das Verletzungssystem anzufassen.

### Verletzung (direkt) — TEUER, UND ICH RATE AB ⚠️

- **Problem 1 (Technik):** Injuries laufen über ein deterministisches, geseedetes
  Roll-System (`buildMatchdayInjuryRollMap`, `rollInjuryRisk`) mit Event-Records,
  Availability-Statusmaschine (healthy/injured/recovering), Replay-Support
  (`isMatchdayReplay`) und Online-Sync. Eine "Verletze Spieler X"-Ability müsste an all dem
  vorbei konsistent bleiben.
- **Problem 2 (Design):** Eine garantierte Fremd-Verletzung ist der frustigste Effekt, den
  man einem menschlichen Gegner antun kann — im 4v4 ein Rage-Quit-Generator.
- **Empfohlener Ersatz:** **Injury-Hex** — erhöht die Risiko-Prozentpunkte beim NÄCHSTEN
  Roll des Zielspielers (`rollInjuryRisk` hat bereits `riskPercentOverride`-Infrastruktur,
  ein additiver `riskPercentBonus` wäre ein kleiner Eingriff). Drohung statt Garantie:
  spannend, kontert sich durch Schonung, bleibt im deterministischen System. Aufwand: MITTEL.

### Moral / Rivalität — MITTEL BIS TEUER ⚠️

- **Moral** ist kein mutierbarer Wert, sondern wird abgeleitet (`assessPlayerMorale` in
  `lib/morale/player-morale-service.ts` rechnet aus Gehalt, Einsatzzeit, Historie …). Eine
  Moral-Ability bräuchte eine neue Event-Quelle, die ins Assessment einfließt — sauber
  machbar, aber ein eigenes Feature. Aufwand: MITTEL.
- **Rivalität**: Beziehungswerte sind statische Records (`getTeamRelationship`) plus
  abgeleitete Events. Dynamisches Schreiben wäre ein tiefer Eingriff in
  `team-relationship-dynamics`. Aufwand: TEUER. Für v1 weglassen; Rivalität bleibt
  Targeting-INPUT (das kann der Code heute schon gut).

### Fazit Machbarkeit

**v1-Umfang:** Cash, Fatigue (beide Richtungen), Injury-Hex, Schild, Ladungs-Refresh,
Info-Reveal + die großen Arena-Bausteine. **Nicht in v1:** direkte Verletzung, Moral-Schaden,
Rivalitäts-Manipulation.

---

## 4. Konkreter Entwurf

### 4.1 Ability-Rahmen

Ein `SignatureAbilityDefinition`-Record pro Team (Prototyp-Typ in
`lib/lineups/team-signature-abilities.ts`):

| Dimension | Ausprägungen | Zweck |
| --- | --- | --- |
| **Timing** | `lineup` (mit Einsatzliste gezündet), `resolve` (wirkt bei Auflösung), `post_matchday` (Verwaltungsphase nach Auflösung) | Wann zündet man? Nicht-Arena-Effekte brauchen die Fenster außerhalb der Einsatzliste. |
| **Effekt-Baustein** | `score_boost`, `score_debuff` (Arena — laufen als große TeamPowerRecord-Overrides durch die BESTEHENDEN Pfade), `cash_gain`, `fatigue_attack`, `fatigue_relief`, `injury_hex`, `shield`, `charge_refresh`, `intel_reveal` | ~9 Bausteine statt 32 Sonderpfade. |
| **Ziel** | self / Rivale / Top-Gegner / Rank-Band / N stärkste Spieler eines Teams | Wiederverwendung der Resolve-Targeting-Logik (`selectDebuffTargets`). |
| **Magnitude + Limit** | z. B. +12 % Score, 800 Cash, +12 Fatigue auf Top-5 | Team-Individualität über Parameter. |
| **Ladungen** | 1–2 pro Saison, getrennt vom Identity-Deck | Selten = bedeutsam. |
| **Bedingung** | verallgemeinerter `conditionalTrigger`: keine / eigener Rang ≥ X / Rivale in Top-N / ab Spieltag N / nach Niederlage | Lore-Gefühl ("Nichts zu verlieren") + Balance-Bremse. |
| **Telegraphierung** | Angriffs-Abilities werden einen Spieltag vorher im Ticker angekündigt | Fairness-Kernstück fürs 4v4, siehe §5. |

Zünd-UX: Arena-Timings (`lineup`/`resolve`) hängen an der bestehenden Power-Auswahl in der
Einsatzliste (ein zusätzlicher, visuell abgesetzter Signature-Slot). `post_matchday`-Timings
bekommen einen eigenen kleinen "Team-Ability"-Kasten in der Spieltags-Abschlussansicht —
NICHT noch mehr Logik in den 7.400-Zeilen-`LegacyLineupLabClient` stopfen.

### 4.2 Zehn Beispiel-Abilities (lore-getrieben, aus 9 Bausteinen)

Identitätswerte aus dem Save (pow/spe/men/soc, ambition, cooperation, …):

| Team | Ability | Baustein + Parameter | Warum es zum Team passt |
| --- | --- | --- | --- |
| **C-C Cash Creators** (soc 7.7, coop 9.2) | **Goldene Quote** | `cash_gain`, post_matchday, 2 Ladungen. Basisbetrag + Aufschlag, wenn der Spieltag Top-8 beendet wurde. | Chris' eigenes Team und sein eigenes Beispiel: die Händler machen aus sportlichem Erfolg sofort Geld. |
| **P-S Project Suicide** (pow 9, torment-Profil) | **Redline Overdrive** | `score_boost` +12 % auf eine Seite, resolve; DANACH +10 Fatigue auf die eigenen eingesetzten Spieler. 2 Ladungen. | Ausbau des existierenden "Redline Protocol": Selbstzerstörung als Preis für Überleistung — der Teamname ist Programm. |
| **T-G The Giants** (pow 13.1) | **Erdbeben** | `score_debuff` −6 % auf ALLE Teams im Rank-Band ±3, OHNE die übliche Feld-Streuung ×0.65. 1 Ladung. | Wenn die Riesen aufstampfen, wackelt das ganze Tableau — Fläche statt Präzision. |
| **Z-H Zero Heroes** (ambition 9.7, harmony 1.5) | **Nichts zu verlieren** | `score_boost` +14 %, Bedingung: eigener Rang ≥ 20. 2 Ladungen. | Die Verzweifelten explodieren genau dann, wenn alle sie abgeschrieben haben. Bedingung = eingebaute Balance-Bremse. |
| **H-R Hell Raisers** (pow/spe hoch, manners 2.2) | **Brandschatzung** | `fatigue_attack` +12 Fatigue auf die Top-5-Spieler eines Rivalen, lineup-Timing, telegraphiert, 1 Ladung. | Der Überfall vor dem Spieltag: brandschatzen, was der Rivale aufgebaut hat. Indirekt auch Verletzungsdrohung (Risk-Kurve). |
| **G-G Golden Gladiators** (coop 9.1, harmony 9.4) | **Ehrenrunde** | `fatigue_relief` −15 Fatigue auf den ganzen eigenen Kader, post_matchday, 2 Ladungen. | Die ehrenhaften Kämpfer pflegen ihre Leute — Regeneration statt Aggression. |
| **W-W Wicked Wizards** (men 14.4!) | **Zeitschleife** | `charge_refresh`: eine verbrauchte Identity-Power-Ladung kehrt zurück, post_matchday, 1 Ladung. | Magier manipulieren die Ressource, an der alle anderen gebunden sind: die Zeit selbst. Meta-Effekt, einzigartig ohne neuen Wirkkanal. |
| **S-C Stronghold Crusaders** (pow 9.1, coop 8.2) | **Schildwall** | `shield`: negiert an einem gewählten Spieltag ALLE gegnerischen Debuffs/Angriffe aufs eigene Team, lineup-Timing, 2 Ladungen. | Die Festungsbauer. Systemisch der wichtigste Baustein: er ist die ANTWORT auf telegraphierte Angriffe und macht das Angriffs-Metagame fair. |
| **U-A Undercover Agents** (Doktrin-Override "tactical") | **Dossier** | `intel_reveal`: deckt vor der Einsatzlisten-Deadline die gewählten Powers + Lineup-Stärke aller Rivalen auf, 2 Ladungen. | Spione handeln mit Information, nicht mit Gewalt. Null Balance-Risiko, hoher Multiplayer-Wert. |
| **R-C Royal Court** (men 7.3, pop 7.1, Intrigen-Lore) | **Hofintrige** | `injury_hex`: +8 Risiko-Prozentpunkte auf den nächsten Injury-Roll eines gegnerischen Top-Spielers, telegraphiert, 1 Ladung. | Der Hof verletzt niemanden selbst — er sorgt nur dafür, dass Unfälle wahrscheinlicher werden. Drohung statt Garantie. |

Dieselbe Schablone deckt die restlichen 22 Teams: z. B. M-S Mortal Sin (soc 16.2) mit einem
großen `score_debuff` als "Massenhysterie", N-N Nunchuck Ninjas mit dem einzigen NICHT
telegraphierten Snipe ("Schattenschlag", dafür kleiner), W-L Wrecking Legionnaires mit einem
Selbst-Schild nach Niederlagen etc.

### 4.3 Umsetzungspfad (inkrementell, jede Stufe einzeln shippbar)

1. **Stufe A — Arena-Signatures (kleinster Schritt, größter Gefühlsgewinn):**
   `TEAM_POWER_SLOT_OVERRIDES` für alle 32 Teams füllen (Slot 1 = Signature-Slot), Modifier
   10–14 %, `conditionalTrigger` um 2–3 Bedingungen erweitern, Ladungen des Slots auf 1–2
   senken. Läuft KOMPLETT durch bestehende Engine, Persistenz, UI und AI. Aufwand: klein.
2. **Stufe B — Nicht-Arena light:** `cash_gain`, `fatigue_relief`, `fatigue_attack` +
   post_matchday-Hook + Ticker-Telegraphierung + Ledger-Records. Prototyp-Funktionen
   existieren. Aufwand: mittel.
3. **Stufe C — Metagame:** `shield`, `injury_hex`, `intel_reveal`, `charge_refresh` + AI-Zündregeln
   pro Baustein. Aufwand: mittel bis groß.

---

## 5. Risiken

1. **Balance (heute max. 8 %).** Ein einmaliger +12–14 %-Boost verschiebt an einem Spieltag
   grob 1–3 Plätze — über 1–2 Ladungen pro Saison gerechnet weniger Gesamtwirkung als die
   heutigen 9 Ladungen à ~6 %. Gefährlich sind nicht die Prozente, sondern **Stacking**
   (Signature + Identity-Power + Captain auf derselben Seite → Cap einziehen, z. B. Summe
   ≤ 16 %) und **Cash** (verzerrt Kreditlimit und Transfermarkt → Betrag klein halten und
   über den bestehenden Audit-Ansatz messen, analog `export-team-power-system-audit`).
2. **AI-Nutzung — das größte Risiko.** Schon heute zünden ~13 Teams ihre Powers nicht
   (Audit-Warnings), und `selectBestTeamPowerForSide` bewertet nur Score-Impact — für
   `cash_gain` oder `shield` hat sie keinerlei Begriff. Ohne eine einfache Zündregel PRO
   BAUSTEIN (z. B. shield: "zünde, wenn telegraphierter Angriff auf mich vorliegt";
   cash_gain: "zünde bei erwarteter Top-8-Platzierung") sind Signatures im 4v4 ein
   systematischer Menschen-Vorteil. Diese AI-Arbeit gehört in JEDE Stufe, nicht ans Ende.
3. **Multiplayer-Fairness (4v4).** Gezielte Angriffe auf menschliche Teams frusten. Drei
   Regeln: (a) Angriffe werden einen Spieltag vorher telegraphiert, (b) pro Team und
   Spieltag maximal EIN eingehender Signature-Angriff (first come, first serve), (c) es
   gibt Gegenspiel (Schildwall, Rotation, Schonung). Der einzige nicht telegraphierte
   Angriff (N-N) muss dafür deutlich schwächer sein.
4. **UI-Aufwand.** Arena-Signatures: nahezu gratis (bestehende Power-Auswahl). Nicht-Arena:
   neuer Zünd-Ort in der Post-Matchday-Ansicht + Ticker-Einträge + Finanz-Log-Zeile.
   Bewusst NICHT in den LegacyLineupLabClient (7.400 Zeilen) integrieren, sondern als
   eigenes kleines Panel.
5. **Migration bestehender Saves.** Unkritisch, wenn additiv gebaut: Signature-Records
   werden wie heute die Season-Powers idempotent generiert (`ensureLocalTeamPowersForSeason`-
   Muster), alle neuen Felder optional. Alte Saves bekommen Signatures beim nächsten Laden
   der Saison; laufende Saisons starten mit vollen Ladungen. Kein Schema-Bruch, kein Backfill.

---

## 6. Prototyp / Machbarkeitsnachweis

- `lib/lineups/team-signature-abilities.ts` — Ability-Rahmen als Typen +
  `applySignatureCashGain` und `applySignatureFatigueDelta` als pure GameState-
  Transformationen auf den bestehenden Persistenzfeldern. Bewusst NICHT verdrahtet.
- `tests/team-signature-abilities.test.ts` — 4 Tests (Cash nur aufs Zielteam,
  Negativ-Schutz, Fatigue-Angriff auf Top-N mit Clamp + Doppel-Persistenz,
  Kader-weite Erholung). Grün, zusammen mit den bestehenden Team-Power-Tests.

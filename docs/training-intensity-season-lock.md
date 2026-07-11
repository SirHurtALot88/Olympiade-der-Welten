# Trainingsintensitaet: Einmalige Festlegung pro Team+Season

## 1. Das Problem (Exploit)

Die Season-End-Berechnung (`lib/training/organic-season-progression.ts`,
`normalizeTrainingMode(input.player.trainingMode)`) liest beim Abrechnen den
**aktuellen** `trainingMode`-Wert des Spielers — es gibt keine Historie oder
Gewichtung darueber, wie lange welcher Modus in der Season tatsaechlich aktiv
war. Ohne Sperre koennte ein Team die ganze Season "leicht" fahren (niedrige
Fatigue, niedriges Verletzungsrisiko) und kurz vor Saisonende auf "hart"
wechseln, um den vollen XP-Boost in der Abrechnung mitzunehmen, ohne die
Nachteile (Recovery-Verlust, Verletzungsrisiko) je getragen zu haben.

Zwei Schreibpfade konnten `trainingMode` vor dieser Aenderung jederzeit,
beliebig oft aendern:

1. **Service-Pfad** (`lib/training/training-settings-service.ts`,
   `applyTeamTrainingSettings` / `applyPlayerTrainingModes`) — genutzt von
   KI-Managern (`lib/ai/ai-manager-apply-service.ts`) und Sim-/Test-Skripten.
   Hatte bereits ein Preview→Confirm-Token-Modell, aber keine zeitliche
   Sperre.
2. **Direkter UI-Schreibpfad** (`setPlayerTrainingMode` in
   `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx`) — der
   Pfad, den das echte Trainings-Panel (`PlayerTrainingControls`,
   `TrainingPlayerLane`) tatsaechlich benutzt. Dieser Pfad ging **komplett an
   `training-settings-service.ts` vorbei** (mutiert `player.trainingMode`
   direkt und persistiert sofort) — das war die eigentliche Exploit-Flaeche
   fuer menschliche Spieler.

## 2. Design-Entscheidung: Sperr-Zeitpunkt

Der Auftrag liess zwei Optionen offen: Sperren "direkt bei erster
Bestaetigung" oder "beim ersten Spieltag der Season". Entscheidung: **letzteres**,
aus folgenden Gruenden:

- Es existiert bereits eine passgenaue, getestete Phasen-Grenze im Code:
  `isPreseasonManagementOpen` / `isEarlySeasonSetup` in
  `lib/foundation/game-phase-action-policy.ts` (identisches Muster wie das
  Transferfenster in `lib/market/transfer-window-policy.ts`). Die
  `set_training`-Action war dort bereits als Konzept definiert
  (`AiLifecyclePhaseDefinition` fuer `preseason_training_setup`), wurde aber
  bisher **nirgends tatsaechlich ausgewertet** — eine bestehende Luecke, die
  mit dieser Aenderung geschlossen wird.
- KI-Manager rufen `applyTeamTrainingSettings`/`applyPlayerTrainingModes` nur
  aus der Preseason-Automation auf (`app/api/ai/preseason-background/route.ts`,
  Phase `preseason_training_setup`, `resumePossible: true`). Diese Phase kann
  in mehreren Chunks laufen (Performance-Budget-Resume) und der
  Preseason-Plan kann sich dabei verfeinern (`healthStress`-abhaengige
  Fokus-/Intensitaetswahl in `ai-team-management-preview-service.ts`). Eine
  Sperre bereits beim allerersten Preview/Apply-Call haette dieses legitime
  Mehrfach-Verfeinern in der Preseason blockiert.
- "Beim ersten Spieltag" ist der Punkt, an dem der eigentliche Exploit erst
  moeglich wuerde (man braucht laufende Matchdays, um den Modus "waehrend der
  Season" zu wechseln) — Sperren an dieser Grenze schliesst den Exploit
  vollstaendig, ohne die Preseason-Planungsfreiheit (Mensch und KI) 
  einzuschraenken.

**Ergebnis:** `isTrainingIntensityLockedForSeason(gameState)` (in
`lib/foundation/game-phase-action-policy.ts`) ist `false` waehrend der
Preseason-Fenster (`preseason_management`, `transfer_sell_phase`,
`transfer_buy_phase`, `lineup_setup`, `next_season_ready`) sowie vor dem
ersten aufgeloesten Spieltag-Ergebnis der Season, und `true` sobald das erste
Matchday-Ergebnis der Season vorliegt — fuer den Rest der Season, fuer **alle**
Teams gleichzeitig (die Zeitgrenze ist global/saisonweit, da es nur einen
Spielplan gibt), aber ausgewertet **pro Team+Season-Datensatz** (jedes Team
hat seinen eigenen `trainingMode`/`aiManagerTrainingSettings`-Stand, keine
Kreuz-Team-Sperre).

## 3. Wo die Sperre technisch greift

- `lib/training/training-settings-service.ts`: `previewTeamTrainingSettings`
  und `previewPlayerTrainingModes` pruefen
  `isTrainingIntensityLockedForSeason(save.gameState)` und haengen
  `"training_intensity_locked_for_season"` an `blockingReasons` an, falls
  gesperrt. `applyTeamTrainingSettings`/`applyPlayerTrainingModes` erben den
  Block automatisch ueber das bestehende `!preview.ok`-Verhalten.
- `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx`:
  `setPlayerTrainingMode` (der eigentliche menschliche UI-Schreibpfad) prueft
  denselben Gate direkt vor jeder Mutation und bricht mit einer Nutzermeldung
  ab, statt zu persistieren.
- Beide Pfade schreiben bei **erfolgreicher** Aenderung zusaetzlich einen
  Audit-Eintrag nach `gameState.seasonState.trainingIntensityConfirmations[teamId]`
  (`TrainingIntensityConfirmationRecord`, `lib/data/olyDataTypes.ts`) mit
  Zeitstempel und Quelle. Das ist reine Nachvollziehbarkeit fuer die UI/Debug
  — die eigentliche Durchsetzung des Blocks haengt **nicht** von diesem
  Flag ab, sondern wird live aus der Season-Phase berechnet (robust gegen
  Stale-Flags, keine Migration fuer Altspielstaende noetig, da alle neuen
  Felder optional sind).

## 4. UI-Transparenz

- **Vor der Sperre**: Trainingsintensitaet bleibt frei waehlbar
  (`VeloIntensityRail` in `PlayerTrainingControls`/`TrainingPlayerLane`), der
  Forecast (Stat/Training/Performance/Fatigue-Kacheln plus die
  "Wie kommt das zustande?"-Aufschluesselung, siehe
  `docs/training-forecast-breakdown.md`) reagiert live auf die Auswahl, damit
  die Entscheidung informiert getroffen werden kann.
- **Nach der Sperre**:
  - Kader-Ansicht (`TrainingCompactClient`): `managementLocked` +
    `managementLockedReason` (bestehendes Muster, sonst genutzt fuer
    "Team nicht steuerbar") zeigen jetzt zusaetzlich "Trainingsintensitaet
    fuer diese Season festgelegt — Aenderung erst zum naechsten Saisonstart
    moeglich (versiegelt seit dem ersten Spieltag)." und deaktivieren die
    Intensitaets-Regler teamweit.
  - Spieler-Detail (`PlayerTrainingControls`): eigener Hinweistext
    ("Trainingsintensitaet fuer diese Season festgelegt — Aenderung erst zum
    naechsten Saisonstart moeglich.") direkt ueber dem deaktivierten Regler,
    gespeist aus `TrainingPlayerRowView.trainingIntensityLocked` (berechnet
    einmal pro Render in `use-foundation-cross-tab-training.ts`).
  - Neue Season → neuer `currentMatchday`/leere `matchdayResults` → Gate
    oeffnet automatisch wieder, keine manuelle Freischaltung noetig.

## 5. Fatigue-Flexibilitaet: Was bleibt trotz Sperre moeglich

Die Sperre nimmt bewusst die Moeglichkeit, **die Trainingsintensitaet selbst**
waehrend der Season auf akute Erschoepfung/Verletzungsrisiko zu reagieren.
Andere, weiterhin freie Stellschrauben decken diesen Bedarf ab:

- **Rotation/Kaderwechsel**: Spieler koennen jederzeit aus der Aufstellung
  genommen werden (Einsatzliste/Lineup), um sich zu erholen, ohne dass sich
  am season-weiten Trainingsmodus etwas aendert — Recovery und Fatigue
  laufen unabhaengig vom Trainingsmodus weiter zurueck.
- **Erholungs-/Trainings-Facilities**: Facility-Level (Trainingscenter,
  Recovery-Gebaeude) bleiben das ganze Jahr ueber upgradebar
  (`preseason_facilities`-Phase ist nicht an dieselbe Sperre gebunden) und
  wirken kontinuierlich auf Recovery- und Fatigue-Modifikatoren
  (`applyRecoveryFacilityModifiers`, `getFacilityTrainingModifierPct`).
- **Trainingsklasse** (`trainingClass`, POW/SPE/MEN/SOC-Fokus pro Spieler)
  ist von dieser Sperre **nicht** betroffen und bleibt saisonweit frei
  anpassbar — sie steuert die Verteilung des Trainingsbudgets auf Attribute,
  nicht die Fatigue-/Injury-Basis der Intensitaet selbst.
- **KI-Team-Fokus** (`trainingFocus`, z. B. `RECOVERY`) ist ebenfalls durch
  dieselbe Sperre gebunden (Teil desselben `applyTeamTrainingSettings`-Calls)
  — Teams, die frueh in der Preseason auf hohe Belastung planen, sollten
  `RECOVERY`/`light` bereits als bewusste Saisonstrategie waehlen, nicht als
  spaeteren Reflex.

Kurz: Die *Intensitaet* wird fuer die Season fixiert, aber Rotation und
Facility-Investitionen bleiben die primaeren, weiterhin voll verfuegbaren
Hebel gegen Erschoepfung — passend zu einem Modell, in dem die
Season-End-Abrechnung ohnehin nur einen einzigen Intensitaetswert pro Season
kennt.

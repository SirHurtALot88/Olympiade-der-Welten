# Form + Moral in den Punkten — Befund, Konzept, Prototyp (17.11.)

Chris am 17.11.: „können wir für die Spieler sowas wie Form + Moral mit in die Punkte einfließen
lassen? Form hast du ja schon drin, aber ist die auch ins Gameplay implementiert?" — danach: Form
soll PRO SPIELER kommen, die bestehenden Formkarten sollen sie zusätzlich modifizieren, „mach das so",
und das Formkarten-System soll neu ausbalanciert werden (Karte gibt allen einen kleinen Boost plus
den Spielern der Kartenfarbe einen weiteren, dafür Spitze statt +16 nur noch ca. +12).

**Alles hier steht hinter Schaltern, Standard AUS.** Ohne Schalter bleibt jede Wertung, jeder Test
und der Wertungs-Fingerabdruck unverändert. Die Engine (`public/mockups/battle-mode.engine.js`) ist
nicht angefasst.

| Schalter | Wirkung |
|---|---|
| `OLY_FORM_MORAL=1` | Spieler-Form wird beim Spieltagsabschluss fortgeschrieben und gespeichert; Form + Moral skalieren die Arena-Eignung |
| `OLY_FORM_MORAL_DOSIS=1.5` | Prozent Eignung je Form-Stufe (0..4, Standard 1,5) |
| `OLY_FORMKARTEN_FARBREGEL=neu` (oder `schmal`) | Kartenwert je Spieler nach der Farbregel (Abschnitt 6), KI-Kartenplan bewertet danach |

## 1. Befund: was es heute wirklich gibt

### 1.1 Spieler-Form: das Feld existiert, wird aber nie geschrieben

- `Player.form: number` (`lib/data/olyDataTypes.ts`, bei `fatigue: number` im Typ `Player`). Gesetzt wird es nur
  auf `0`: `lib/player-generator/commit-draft-to-free-agent.ts:209`, `lib/player-import/character-import-service.ts:196`.
  `lib/foundation/discipline-stage/discipline-stage-data.ts:15-33` hat das schon festgehalten: in allen
  sieben Live-Ständen steht es bei 2304 von 2304 Kaderspielern auf exakt 0.
- Gelesen wird es an wenigen Stellen und überall mit der Regel „0 = unbeschrieben":
  `lib/training/player-progression-forecast.ts:377,515` (Trainings-Schärfe), `discipline-stage-data.ts`
  (Bühnen-Anzeige), `lib/foundation/team-management-overview.ts:472` (Mittel, daher immer 0),
  `lib/lineups/legacy-lineup-local-service.ts:723` (reicht es durch).
- **Auf die Punkte wirkt es nirgends.** Weder Legacy-Wertung noch Arena lesen eine Spieler-Form.
- „Form" im Spiel heißt sonst **Formkarten**: Team-Ebene, Karte gehört einem Spieler (Farbe =
  Klassenfarbe, `CLASS_COLOR_MAP` in `lib/lineups/legacy-lineup-modifiers.ts:14`), wirkt GLEICH auf alle
  Spieler einer Seite (`calculateFormModifierForSide`, `legacy-lineup-modifiers.ts:812-880`):
  Karten −8..+8, ×2 bei Farbgleichheit mit der Disziplin, bis zwei Karten je Seite.

### 1.2 Moral: vollständig vorhanden, wirkt aber nur im Legacy-Pfad

- Gespeichert: `GameState.playerMoraleState: PlayerMoraleState[]` (`olyDataTypes.ts:244`, Wert 0..100,
  50 neutral), persistiert über `save-repository.ts` (`playerMoraleState` in `GameMetadata`, Laden und Schreiben).
- Fortgeschrieben: bei jedem Spieltagsabschluss `buildCurrentMoraleState()` →
  `assessPlayerMorale()` (`lib/season/matchday-progress-service.ts:103-125`, geschrieben bei Zeile 317; Saisonwechsel:
  `preseason-workflow-service.ts:327,356`; Admin-Simulation: `season-simulation-runner.ts:458-496`).
- Was in die Zahl eingeht (`lib/morale/player-morale-service.ts`, `addReason(...)`): Teamerfolg und Titelkampf
  (Z. 788-806), Rolle passt / versprochener Starter ohne Einsatzzeit (Z. 830-837), eigene Saisonleistung
  und PP-Rang (Z. 843-859), Teamchemie und Teamachse (Z. 868-894), Trainingslast (Z. 901-905), Traits
  (Z. 914-919), Gehalt (Z. 932-936), Teamkultur (Z. 942-957), Kapitän (Z. 978-991), erfüllte/gebrochene
  Forderungen inkl. Training-Wunsch (Z. 525-536, `lib/training/training-mode-demand-service.ts:157-158`
  `moraleReward`/`moralePenalty`). **Alles, was Chris als Moral-Quelle genannt hat, ist schon drin.**
- Wirkung auf Punkte: `calculatePlayerMoralePerformanceSignal()` (`lib/morale/player-morale-performance.ts:20-52`)
  macht daraus +8 % (Moral 100) bis −10 % (Moral 0) auf den Spielerwert; eingehängt in
  `legacy-score-engine.ts:279-284` (nach Erschöpfung und Verletzung), gespeist von
  `legacy-matchday-resolve-engine.ts:462` und `legacy-lineup-preview-from-context.ts:91`.
  Angezeigt als Spalte „Moral" in `app/foundation/legacy-lineup-lab/LineupNewLook.tsx:663`.
- **Die Arena sieht Moral NICHT.** `arena-kader-adapter.ts` (`buildArenaTeam`) gibt dem Motor nur Attribute,
  Eignungen, Traits, Klasse; `arena-aufstellung-adapter.ts` nur Slot, Haltung, Formkarte, Intensität.
  Kein `morale`, `fatigue`, `injury` in `lib/battle/*` oder `lib/foundation/battle-arena/*`. Für die Disziplinen, die
  in einem Battle-Save per Arena gewertet werden (`ARENA_RESOLVED_DISCIPLINE_IDS`), zählt die Legacy-Moral also
  nicht — dort wird ihr Ergebnis durch das Arena-Ergebnis ersetzt.

### 1.3 Erschöpfung, Intensität, Verletzung: ebenfalls nur im Legacy-Pfad

- `Player.fatigue` (0..100), Verfügbarkeit in `seasonState.playerAvailabilityState`
  (`olyDataTypes.ts`, `PlayerAvailabilityStateRecord`). Last je Einsatz `fatigue-injury-service.ts:148`,
  Intensitätsfaktor `:318` (`INTENSITY_FATIGUE_MULT`), Leistungsabzug bis −25 % ab Erschöpfung 80
  (`lib/fatigue/fatigue-calibration.ts:1-2,123`), Verletzung ×-Faktor (`:131`).
  Wirkt in `legacy-score-engine.ts:261-266`.
- Strain je Platz/Rolle: `lib/lineups/matchday-slot-roles.ts:31,785,1076,1111` (Warnung bei schwachem
  Strain-Attribut). Nur Hinweis/Risiko, kein Punktabzug.
- **Arena:** Intensität und Formkarte erreichen den Motor nur für die in
  `lib/battle/formkarten-echt-disziplinen.ts` freigeschalteten Disziplinen — heute **nur `time-trial` und
  `spurt`**. In allen anderen 18 zieht der Motor eine Ersatzkarte (`zieheFormkarten`, Engine Z. 9251; 0/2/4/8 aus
  fester Saat) und die feste Stufe „normal" (`breitPunkteVon`, Engine Z. 9306). Was der Manager an Karten spielt,
  zählt dort gar nicht. (Das ist unabhängig von diesem Auftrag der wichtigste Nebenbefund: die Karten-Neuregel
  aus Abschnitt 6 kann in der Arena erst wirken, wenn eine Disziplin die P4-Abnahme besteht.)

### 1.4 Wie die Aufstellung heute in die Arena-Wertung fließt

`buildArenaTeam` (Attribute `a`, Eignungen `d`) und `buildArenaAufstellung(Beide)` (Platz `{d, slot}`, bei P4-
Disziplinen `form`/`intensitaet`) → Motor → Spielwert → Boxscore → Team-Punkte
(`lib/resolve/battle-mode-arena-team-points.ts`). Der Motor rechnet Eignung als gewichtete Summe der
Attribute; Kanäle daneben sind Slot, Trait, Mutator und (je Disziplin) die Karte. **Die einzige Stelle, an der der
Spielstand pro Spieler in die Arena eingeht, ist `buildArenaTeam`** — Vorlauf, Pods, Arena-Anzeige und die
Einsatzliste-Kulisse (`lib/lineups/lineup-kulisse.ts:84`) laufen alle darüber. Dort setzt der Prototyp an.

## 2. Konzept: Spieler-Form (0..100, in Stufen −2..+2 angezeigt)

**Skala.** 0..100, 50 neutral; Anzeige ▼▼ ▼ – ▲ ▲▲ (Stufe = `round((Form − 50) / 15)`, geklemmt −2..+2; +2 = „heiß").
Gespeichert in `GameState.playerFormState` (neu, optional, additiv: `{playerId, teamId, form, lastSeasonId,
lastMatchdayId, appearances}`).

**Fortschreibung** beim Spieltagsabschluss (`matchday-progress-service.ts`, direkt neben der Moral;
`advancePlayerFormState`), deterministisch aus gebuchten Daten:

1. **Leistung gegen Erwartung.** Je Disziplin Perzentil der tatsächlichen Leistung (`finalPlayerScore`) minus
   Perzentil der Erwartung (`baseValue`, die Eignung) aus `seasonState.playerDisciplinePerformances` des Spieltags.
   Besser als nach Eignung erwartet → Form steigt, schlechter → sinkt. Ab drei Teilnehmern je Disziplin.
2. **Gedächtnis ≈ letzte drei Einsätze.** Gleitend: Form nähert sich dem Ziel um 30 % je Einsatz (nach drei Einsätzen
   sind 66 % der alten Form ersetzt). Ziel = 50 + 50·Residuum/0,22 (geklemmt).
3. **Bremsen.** Erschöpfung über 60 drückt das Ziel bis −15; verletzt: −10.
4. **Kein Dauerhoch.** Ohne Einsatz fällt die Form je Spieltag 15 % der Distanz zurück zur Mitte; nach drei Ruhetagen
   fehlt dem ▲▲ mehr als eine halbe Stufe (Test).
5. Idempotent je Spieltag (`lastMatchdayId`).

**Bewertung der PM-Idee (a):** übernommen, mit zwei Änderungen. (i) „Letzte 3 Spieltage" nicht als Fenster, sondern
als gleitendes Mittel — gleiche Wirkung, aber ein Feld statt einer Liste und kein Sprung, wenn ein Spieltag aus dem
Fenster fällt. (ii) Der Zug zur Mitte gilt NUR für Nicht-Einsatz; ein gut spielender Stammspieler darf ▲▲ halten,
solange er über Erwartung bleibt — sonst wäre „heiß" nur ein Zufallsblitz. Gemessene Verteilung der Simulation
(32 Spieltage, Einsatz 55 %, Residuum-sd 0,19 = rho je Spiel ≈ 0,78): Form sd ≈ 12, Stufen 0: 46 %, ±1: je 25 %,
±2: je ≈ 3 %.

**Ehrlicher Hinweis zum Charakter von Form.** Weil die Eignung schon das Fähigkeitsniveau trägt, ist das Residuum
zum großen Teil Spielrauschen; Form ist deshalb im Kern ein kontrolliert geglättetes Zufallsmoment. Das ist als
Spielelement in Ordnung („Hot Hand"), kostet aber genau so viel Rangtreue wie in Abschnitt 7 gemessen — und das ist
der Grund für die kleine Dosis.

## 3. Konzept: Wirkung auf die Eignung (Form + Moral)

`calculateFormMoralSignal` (`lib/morale/form-moral-modifikator.ts`): Prozent auf Eignung UND Attribute (Eignung ist
die gewichtete Summe der Attribute, beide müssen gemeinsam skalieren) des Arena-Spielers.

- **Form:** stetig, `Stufe × Dosis` (Stufe −2..+2 ungerundet; Stufen nur für die Anzeige, damit keine künstlichen
  Rangbindungen entstehen). Dosis = Prozent je Stufe.
- **Moral:** `clamp((Moral − 50) / 20) × 2/3 × Dosis`, d. h. höchstens ±2/3 Dosis. Moral der Spielstände: Mittel
  50, sd ≈ 9 (gemessen am Abbild, sechs Spielstände) — ein einheitlicher Verschiebungsfehler entsteht nicht.
- **Deckel:** bei Dosis 1,5: Form ±3 %, Moral ±1 %, zusammen ±4 %. PM-Vorschlag war „±1,5 % je Stufe, gesamt ±3 % plus
  Moral" — exakt so umgesetzt.
- **Einhängepunkt:** `buildArenaTeam` (`arena-kader-adapter.ts`), also dieselbe Schicht wie Formkarten und Intensität
  und vor dem Motor. `ArenaSpieler.d`/`a` werden skaliert, gedeckelt bei 100. Ohne Schalter bleibt die Referenz
  unverändert (Test). Der Eingabe-Hash der Arena (`arena-eingabe-hash.ts`) schließt den Kader ein, d. h. „gezeigt =
  gebucht" bleibt gewahrt, solange Anzeige und Vorlauf beide den Schalter sehen (server-seitig gesetzt; im Browser
  ohne `process.env` gilt AUS — bei Produktivschaltung als Seed-/Konfig-Feld statt Umgebungsvariable führen).
- **Legacy-Pfad:** hat Moral schon (+8 %/−10 %). Bei Produktivschaltung auf dieselbe Skala ziehen (siehe Empfehlung),
  sonst sieht ein Spieler im Legacy-Pfad ±8 %, in der Arena ±1 %.

## 4. Anzeige, KI, offene Haken

- **Einsatzliste / Spielerkarte:** Stufe ▼▼..▲▲ neben der Moral-Spalte (`LineupNewLook.tsx:663`) und im
  Spielerdrawer; Tooltip „Form ▲ (+1,5 % Eignung), Moral 62 (+0,4 %)". Nicht gebaut (Prototyp), Datenquelle ist
  `playerFormState` + `playerMoraleState`.
- **KI-Rotation:** `lib/ai/ai-lineup-freshness.ts` und die Aufstellungs-KI können Form als Tie-Break nutzen:
  gleiche Eignung → der heißere Spieler; ▼▼ + Erschöpfung > 60 → schonen. Nicht gebaut; erst nach der rho-Freigabe.
- **Nicht verdrahtet im Prototyp:** (a) Legacy-Wertung (`legacy-score-engine.ts`) liest Form nicht; (b) Saisonwechsel
  setzt Form nicht zurück (Vorschlag: halber Rückfall zur Mitte, wie `normalizeCarryOverMorale`); (c) Admin-
  Saisonsimulation schreibt Form nicht fort.

## 5. Formkarten und Form (PM-Idee c, d)

Bewertung:

- **„Karte der Farbe X verstärkt Form der Spieler dieser Farbe": übernommen — aber als Teil der Farbregel
  (Abschnitt 6)**, nicht als zweiter Hebel auf die Eignung. Zwei getrennte Kopplungen (Karte→Form→Eignung und
  Karte→Farbträger) wären doppelt gerechnet und für den Spieler nicht lesbar. Die Verzahnung läuft deshalb nur an
  einer Stelle: Farbträger in Form ▲/▲▲ bekommen den Träger-Zusatz der Pluskarte um 12,5 % je Stufe verstärkt
  (`FORM_TRAEGER_HEBEL`; bei ▲▲ ×1,25). Kalte Spieler und Minuskarten: kein Hebel (Minuskarten würden sonst doppelt
  bestraft und die KI-Saisonplanung, die sie versteckt, entwertet).
- **„Stabilisieren / Wiederaufbau / Feuer": verworfen als eigene Kartentypen, vorerst.** Karten sind reine
  Zahlen (`LegacyFormCardOption {value, color}`), die KI-Planung ordnet sie nach Zahlenwert, die Minuskarten-Pflicht
  (`form-card-penalty-service`) und die Kartenerzeugung (`buildGeneratedFormCardRecordsForTeam`) kennen nur
  Werte. Neue Typen brauchen Spieler-Zielwahl in der Einsatzliste (Karten wirken heute auf die Seite), neue
  Planlogik und neue Persistenz. „Feuer" (Spieler für den Spieltag auf +2 zulasten Erschöpfung) ist zudem die
  Intensität „push", nur personenbezogen — die gibt es schon je Seite. Verbesserungsvorschlag: die Wirkungen als
  **Effekt bestimmter Kartenwerte**, wenn Chris sie will (Kartenwert 2 = „stabilisiert" (die Form der Farbträger
  fällt an diesem Spieltag nicht), 4 = „Wiederaufbau" (negative Form der Farbträger auf 0 gehoben)) — ohne neue
  Typen, eine Zeile je Wert in `advancePlayerFormState`. Nicht gebaut, weil jede dieser Wirkungen eine neue
  Zufalls-/Zustandsgröße im Spieltagsabschluss wäre und die Messung zuerst den Grundeffekt klären soll.
- **Taktische Tiefe (d):** übernommen. Der Hinweistext steht als `formkartenHinweis()` (z. B. „Karte yellow: +8 für
  alle, +4 zusätzlich für 3 Spieler dieser Farbe"); die Einsatzliste kann ihn je Seite aus der gewählten Karte und der
  Aufstellung zeigen. Der heiße-Spieler-Hinweis kommt aus Stufe ▲/▲▲ der Farbträger.

## 6. Formkarten neu ausbalancieren (Farbregel)

Je Karte mit Wert v (1–8, Vorzeichen bleibt):

| | alle Spieler | Farbträger zusätzlich | Spitze |
|---|---:|---:|---:|
| ALT, fremde Disziplinfarbe | v | – | 8 |
| ALT, passende Disziplinfarbe | 2·v | – | 16 |
| NEU (PM), fremde Farbe | 0,5·v | +0,5·v | 8 (Träger), 4 (andere) |
| NEU (PM), passende Farbe | 1,0·v | +0,5·v | **12** (Träger), 8 (andere) |
| NEU (schmal), passende Farbe | 0,75·v | +0,5·v | 10 (Träger), 6 (andere) |

Negativkarten spiegelbildlich (Strafe für alle, Zusatzstrafe für Farbträger — wohin man eine Minuskarte „ablädt"
wird eine Entscheidung: auf die Farbträger vermeiden, in kleine Disziplinen ohne Träger legen). Reine Funktionen:
`lib/lineups/formkarten-farbregel.ts` (`kartenWertFuerSpieler`, `formkartenSummeFuerSpieler`, `formkartenHinweis`).

**Eingehängt** (hinter `OLY_FORMKARTEN_FARBREGEL`):

- Arena: `arena-aufstellung-adapter.ts` schreibt `form` je SPIELER statt je Seite in den `place`-Eintrag (der Motor liest
  `form` ohnehin je Spielername, `formEchtVon` — kein Motoreingriff). Wirkt damit für `time-trial` und `spurt`.
- KI: `ai-form-card-season-plan.ts` bewertet Slots nach `(alle + traeger·Farbanteil) × Kadergröße`, Farbanteil aus den
  Karten des Teams (jede Karte gehört einem Spieler → Farbe der Klassenfarbe); der Aufrufer
  `ai-legacy-lineup-batch-apply-service.ts` reicht die Regel durch. Die Umordnungs-Logik (Minuskarten zuerst ins billigste
  Versteck) bleibt unverändert: die neue Slot-Bewertung ersetzt nur die Zahl, nicht das Verfahren.
- **Nicht verdrahtet:** die Legacy-Wertung `calculateFormModifierForSide` (liefert `formPerPlayer` für alle gleich) und
  die Einsatzliste-Anzeige. Bei Produktivschaltung muss die Wertung dieselbe Funktion rufen (sonst zwei Wahrheiten);
  `formPerPlayer` wird dann zu einer Liste je Spieler.

`@@FARB@@`

## 7. Messung

Methode: `scripts/miss-form-moral-dosis.mts` (Form+Moral) und `scripts/miss-formkarten-farbregel.mts` (Karten) über die
Kader-Familie aus dem Live-Abbild (`data/generated/kaderfamilie-live-save.json`, fünf echte Paarungen), gleiche Saaten in
allen Läufen. rho je Spiel = Median über die Kader-Familie.

**Wichtig zur Zählweise Form + Moral:** rho wird gegen die Eignung OHNE Modifikator gemessen — der Modifikator soll
ABSICHTLICH von der Basis-Eignung abweichen (wie der Mutator), die Abnahme soll das sehen, nicht wegrechnen. Das ist die
strenge Lesart; zeigt die Mechanik die modifizierte Eignung an, liegt das echte rho zwischen dieser Zahl und der
Basis. Form-Verteilung: Monte-Carlo über die echte `advancePlayerForm` (`scripts/simuliere-form-verteilung.ts`); Moral: die
echten Werte des Abbilds (`data/generated/form-moral-verteilung.json`).

`@@DOSIS@@`

## 8. Empfehlung

`@@EMPFEHLUNG@@`

## 9. Dateien

- neu: `lib/morale/form-moral-modifikator.ts`, `lib/lineups/formkarten-farbregel.ts`,
  `scripts/simuliere-form-verteilung.ts`, `scripts/miss-form-moral-dosis.mts`, `scripts/miss-formkarten-farbregel.mts`,
  `scripts/lib/formkarten-farbregel-hook.mjs`, `data/generated/form-moral-verteilung.json`,
  `tests/form-moral-modifikator.test.ts`, `tests/formkarten-farbregel.test.ts`, dieses Dokument.
- geändert (alle additiv, ohne Schalter wirkungslos): `lib/data/olyDataTypes.ts` (`PlayerFormState`, `GameState.playerFormState`),
  `lib/persistence/save-repository.ts` (drei Zeilen), `lib/season/matchday-progress-service.ts`,
  `lib/foundation/battle-arena/arena-kader-adapter.ts`, `lib/foundation/battle-arena/arena-aufstellung-adapter.ts`,
  `lib/ai/ai-form-card-season-plan.ts`, `lib/ai/ai-legacy-lineup-batch-apply-service.ts`.

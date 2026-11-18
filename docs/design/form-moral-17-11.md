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



## 7. Messung

Methode: `scripts/miss-form-moral-dosis.mts` (Form+Moral) und `scripts/miss-formkarten-farbregel.mts` (Karten) über die
Kader-Familie aus dem Live-Abbild (`data/generated/kaderfamilie-live-save.json`, fünf echte Paarungen), gleiche Saaten in
allen Läufen. rho je Spiel = Median über die Kader-Familie.

**Wichtig zur Zählweise Form + Moral:** rho wird gegen die Eignung OHNE Modifikator gemessen — der Modifikator soll
ABSICHTLICH von der Basis-Eignung abweichen (wie der Mutator), die Abnahme soll das sehen, nicht wegrechnen. Das ist die
strenge Lesart; zeigt die Mechanik die modifizierte Eignung an, liegt das echte rho zwischen dieser Zahl und der
Basis. Form-Verteilung: Monte-Carlo über die echte `advancePlayerForm` (`scripts/simuliere-form-verteilung.ts`); Moral: die
echten Werte des Abbilds (`data/generated/form-moral-verteilung.json`).

### 7.1 Form + Moral: Dosis × Disziplin (n=8, Median der Kader-Familie)

Dosis = Prozent je Form-Stufe. 1,5 entspricht Form ±3 % + Moral ±1 % (zusammen ±4 %), 2,5 entspricht ±5 % + ±1,7 % (±6,7 %).
Spalte 0 ist die Basis ohne Modifikator.

| Disziplin | 0 (Basis) | 1,5 | 2,5 | Delta 1,5 | Delta 2,5 |
|---|---:|---:|---:|---:|---:|
| basketball | 0.807 | 0.800 | 0.824 | -0.007 | +0.017 |
| battlefield | 0.552 | 0.608 | 0.541 | +0.056 | -0.011 |
| breaking | 0.872 | 0.868 | 0.840 | -0.003 | -0.032 |
| climbing | 0.817 | 0.792 | 0.795 | -0.025 | -0.022 |
| eiskunstlauf | 0.941 | 0.909 | 0.912 | -0.032 | -0.030 |
| fechten | 0.862 | 0.847 | 0.810 | -0.015 | -0.051 |
| football | 0.856 | 0.849 | 0.859 | -0.007 | +0.002 |
| gewichtheben | 0.879 | 0.890 | 0.909 | +0.011 | +0.030 |
| hockey | 0.682 | 0.632 | 0.761 | -0.050 | +0.080 |
| i-spy | 0.855 | 0.767 | 0.766 | -0.088 | -0.090 |
| mini-dm | 0.179 | 0.271 | 0.310 | +0.092 | +0.131 |
| showcase | 0.831 | 0.792 | 0.780 | -0.039 | -0.052 |
| speed-schach | 0.926 | 0.926 | 0.919 | -0.000 | -0.007 |
| spurt | 0.898 | 0.850 | 0.852 | -0.048 | -0.046 |
| staffel | 0.933 | 0.920 | 0.883 | -0.013 | -0.049 |
| takeshis-castle | 0.866 | 0.825 | 0.835 | -0.041 | -0.031 |
| tdm | 0.903 | 0.905 | 0.893 | +0.002 | -0.010 |
| tennis | 0.879 | 0.877 | 0.858 | -0.002 | -0.020 |
| time-trial | 0.950 | 0.945 | 0.935 | -0.005 | -0.015 |
| wettessen | 0.935 | 0.908 | 0.898 | -0.027 | -0.038 |
| **Mittel ueber 20** | 0.821 | 0.809 | 0.809 | -0.012 | -0.012 |

**Gegenprobe mit 24 statt 8 Spielen je Variante** (die n=8-Tabelle oben rauscht: Hockey, Mini-DM und Battlefield springen
um ±0,05..0,13, weil jeder Eingriff den Zufallsstrom der Engine neu würfelt; die Mini-DM-/Battlefield-/Hockey-Zeilen
sind außerdem schon BEI DOSIS 0 unter der Schranke, weil diese Sonde ihre Pod-/Torwart-Mechanik nicht so misst wie
`disziplin-abnahme.json` — sie taugen nur als Rauschpegel, nicht als Abnahme). Rho je Spiel gegen die Basis-Eignung:

| Disziplin (n=24) | 0 | 1,0 | 1,5 | 2,5 |
|---|---:|---:|---:|---:|
| i-spy | 0,853 | 0,857 | 0,774 | 0,787 |
| spurt | 0,903 | 0,871 | 0,851 | 0,858 |
| showcase | 0,771 | 0,760 | 0,758 | 0,748 |
| takeshis-castle | 0,838 | 0,851 | 0,822 | 0,854 |
| fechten | 0,876 | 0,862 | 0,857 | 0,830 |
| climbing | 0,797 | 0,765 | 0,754 | 0,774 |
| eiskunstlauf | 0,927 | 0,915 | 0,915 | 0,902 |
| wettessen | 0,905 | 0,889 | 0,894 | 0,893 |

**Lesart.** Über die 17 stabil messbaren Disziplinen kostet Dosis 1,5 im Mittel −0,020 rho je Spiel, Dosis 2,5 −0,026
(Streuung der Einzeldeltas ±0,04, also Rauschen und Wirkung nicht sauber trennbar). Die ehrliche Zahl kommt aus n=24:
Dosis 1,0 kostet 0,00..−0,03 (i-spy 0,857 unverändert, spurt −0,03, climbing −0,03), Dosis 1,5 bis −0,08 (i-spy), Dosis 2,5
hält die Kosten ungefähr bei den 1,5-Werten, weil die Moral die Form teilweise ausgleicht. Schwach getroffen werden
Disziplinen, deren Wert wenige, grobe Ereignisse hat und die ohnehin am unteren Rand stehen (i-spy, climbing, showcase).
**Form + Moral wirken auf Eignung UND Attribute gleichmäßig; die Pp-Abweichung ändert sich dadurch nicht** (alle Attribute
skalieren mit demselben Faktor, die Anteile an der Gesamtwirkung bleiben gleich).

### 7.2 Formkarten-Farbregel: alt gegen neu (n=8, Median der Kader-Familie, gleicher Kartenzug je Spiel)

| Disziplin | alt | PM | schmal | PM+Form | Delta PM | Delta schmal |
|---|---:|---:|---:|---:|---:|---:|
| basketball | 0.807 | 0.814 | 0.798 | 0.808 | +0.007 | -0.009 |
| battlefield | 0.643 | 0.591 | 0.633 | 0.585 | -0.053 | -0.010 |
| breaking | 0.846 | 0.851 | 0.862 | 0.851 | +0.005 | +0.016 |
| climbing | 0.840 | 0.795 | 0.756 | 0.795 | -0.045 | -0.084 |
| eiskunstlauf | 0.925 | 0.923 | 0.927 | 0.918 | -0.002 | +0.002 |
| fechten | 0.880 | 0.877 | 0.871 | 0.876 | -0.003 | -0.010 |
| football | 0.824 | 0.841 | 0.804 | 0.841 | +0.016 | -0.020 |
| gewichtheben | 0.887 | 0.906 | 0.904 | 0.906 | +0.019 | +0.018 |
| hockey | 0.652 | 0.601 | 0.559 | 0.594 | -0.052 | -0.094 |
| i-spy | 0.872 | 0.810 | 0.819 | 0.809 | -0.062 | -0.054 |
| mini-dm | 0.286 | 0.125 | 0.164 | 0.140 | -0.161 | -0.122 |
| showcase | 0.817 | 0.817 | 0.824 | 0.817 | +0.001 | +0.008 |
| speed-schach | 0.934 | 0.933 | 0.928 | 0.933 | -0.002 | -0.006 |
| spurt | 0.920 | 0.883 | 0.891 | 0.877 | -0.037 | -0.029 |
| staffel | 0.932 | 0.930 | 0.939 | 0.929 | -0.002 | +0.008 |
| takeshis-castle | 0.854 | 0.852 | 0.850 | 0.870 | -0.002 | -0.004 |
| tdm | 0.914 | 0.908 | 0.910 | 0.908 | -0.006 | -0.004 |
| tennis | 0.877 | 0.891 | 0.891 | 0.891 | +0.013 | +0.014 |
| time-trial | 0.949 | 0.937 | 0.942 | 0.937 | -0.012 | -0.007 |
| wettessen | 0.934 | 0.930 | 0.933 | 0.932 | -0.004 | -0.001 |
| **Mittel ueber 20** | 0.830 | 0.811 | 0.810 | 0.811 | -0.019 | -0.019 |


**Pp-Abweichung (Budget-Methode, `einflussVon`, 16 Läufe, EIN Saatstrom — verkürzt, weil die Messmaschine ausgelastet war; Pflicht ≤ 25 in zwei Strömen steht für die Produktivschaltung noch aus; nur Regeln alt und PM), nur die beiden Disziplinen, in denen Karten in der Arena heute überhaupt wirken:**

| Disziplin | alt | PM | schmal | PM+Form |
|---|---|---|---|---|
| spurt | 9.1 | 15.7 | - | - |
| time-trial | nicht fertig (Messung abgebrochen) | - | - | - |

spurt: Pp 9,1 → 15,7 (beide unter der Pflichtgrenze 25, die neue Regel liegt knapp über dem angestrebten Optimum < 15). time-trial: Pp-Messung nicht abgeschlossen, vor Produktivschaltung nachholen (`OLY_PP=1 npx tsx scripts/miss-formkarten-farbregel.mts 12 <aus.json> time-trial`).

**Lesart.** Über die 17 stabilen Disziplinen: PM −0,007, schmal −0,010, PM+Form −0,007 rho je Spiel — innerhalb des
Rauschens. Spürbare Einzelfälle: climbing (PM −0,045, schmal −0,084), i-spy (−0,06), spurt (PM −0,037), hockey (−0,05..−0,09,
Rauschpegel der Disziplin). time-trial −0,012 (0,937, weit über Ziel). **Die schmale Variante (Spitze 10) ist NICHT besser
als die PM-Faktoren (Spitze 12)** — sie bewegt die Rangfolge innerhalb des Teams eher stärker, weil der Träger-Zusatz
gegenüber dem Allgemeinanteil relativ größer wird. Die Form-Verzahnung (▲/▲▲-Träger +12,5 % je Stufe) ändert rho gegenüber
PM nicht messbar (±0,01).


## 8. Empfehlung

**Form + Moral (Dosis):** Standard **1,0 % je Form-Stufe** (Form ±2 %, Moral ±0,7 %, zusammen ±2,7 %) als Einstiegsdosis.
Begründung: bei n=24 bleibt jede Disziplin, die vorher ≥ 0,80 war, bei ≥ 0,80 außer climbing (0,797 → 0,765, vorher schon knapp
unter Ziel) und showcase (0,771, vorher schon unter Ziel); keine fällt unter 0,75. Dosis 1,5 (PM-Vorschlag) kostet im Mittel
−0,02 und schiebt i-spy auf 0,774 und climbing auf 0,754 — gerade noch über der Schranke 0,75, aber ohne Reserve; 2,5 bringt
keinen zusätzlichen Spieleffekt je Rangtreue-Euro. Wer „spürbar" will, geht erst auf 1,5, wenn i-spy/climbing/showcase ihre
eigene Basis angehoben haben. Wirkung in Zahlen bei 1,0: ein ▲▲-Spieler hat +2 % Eignung, ein Spieler mit Moral 70 weitere +0,7 %.

**Form-Verteilung:** nur ca. 3 % der Spieler sind je ▲▲/▼▼, ca. 25 % je ▲/▼ — „heiß" ist selten, aber sichtbar.

**Formkarten-Farbregel:** PM-Faktoren übernehmen (0,5 / 1,0 / +0,5; Spitze 12 statt 16), die schmale Variante verwerfen. Rangtreue-
Kosten im Mittel −0,007 (Rauschniveau), time-trial 0,937, spurt 0,883 (Alt 0,920). Vorbehalt: **in der Arena wirkt die Regel erst,
wenn eine Disziplin in `FORMKARTEN_ECHT_DISCIPLINE_IDS` steht** (heute nur time-trial, spurt) — für die übrigen 18 zieht der
Motor eine Ersatzkarte, die weder alte noch neue Regel kennt. Vor der Produktivschaltung der Farbregel: (1) Legacy-Wertung und
Einsatzliste auf dieselbe Funktion ziehen (sonst zwei Wahrheiten), (2) Pp-Tabelle oben prüfen, (3) die übrigen Disziplinen
einzeln über die P4-Abnahme in die Menge aufnehmen.

**Reihenfolge der Freischaltung:** erst Form + Moral bei 1,0 (Schalter `OLY_FORM_MORAL=1`), eine Saison beobachten (Form-
Verteilung, Rotation der KI), dann die Farbregel. Beide Schalter sind unabhängig.

**Gegenstand für Chris:** (1) Dosis 1,0 statt 1,5 akzeptabel? (2) Stabilisieren/Wiederaufbau/Feuer als Effekt bestimmter
Kartenwerte statt eigener Kartentypen (Abschnitt 5) — gewünscht? (3) Legacy-Moral (+8 %/−10 %) auf die Arena-Skala absenken,
damit ein Spieler in beiden Pfaden dieselbe Moralwirkung hat?

## 9. Dateien

- neu: `lib/morale/form-moral-modifikator.ts`, `lib/lineups/formkarten-farbregel.ts`,
  `scripts/simuliere-form-verteilung.ts`, `scripts/miss-form-moral-dosis.mts`, `scripts/miss-formkarten-farbregel.mts`,
  `scripts/lib/formkarten-farbregel-hook.mjs`, `data/generated/form-moral-verteilung.json`,
  `tests/form-moral-modifikator.test.ts`, `tests/formkarten-farbregel.test.ts`, dieses Dokument.
- geändert (alle additiv, ohne Schalter wirkungslos): `lib/data/olyDataTypes.ts` (`PlayerFormState`, `GameState.playerFormState`),
  `lib/persistence/save-repository.ts` (drei Zeilen), `lib/season/matchday-progress-service.ts`,
  `lib/foundation/battle-arena/arena-kader-adapter.ts`, `lib/foundation/battle-arena/arena-aufstellung-adapter.ts`,
  `lib/ai/ai-form-card-season-plan.ts`, `lib/ai/ai-legacy-lineup-batch-apply-service.ts`.

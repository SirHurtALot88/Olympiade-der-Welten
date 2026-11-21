# Belastung und Resistenz: Bau (21.11.)

Grundlage: `docs/design/belastung-resistenz-v2-21-11.md` (Härtetest, Fable), Mockup
`public/mockups/belastung-resistenz-v2-21-11.html`, Antworten Chris in `docs/design/belastung-resistenz-21-11.md`.
Chris' Entscheidungen vom 21.11. sind umgesetzt wie unten beschrieben.

## Regel „v2“ (Variante „mild“)

| Stufe des Platzes (`fatigueProfile`) | Schwelle | Grundlast |
|---|---:|---:|
| niedrig | 45 | 12,5 |
| mittel | 60 | 15,0 |
| hoch | 75 | 17,5 |

- Resistenz = Wert des Spielers im Belastungs-Attribut des Platzes (`strainAttribute`).
- Unter der Schwelle +0,15 je fehlendem Punkt, höchstens +4; darüber −0,05 je Punkt, höchstens −2.
- Last = (Grundlast + Zusatz) × Trait × Einsatz (Schonen 0,75 / Normal 1 / Vollgas 1,4). Spannweite bei „Normal“: 10,5 bis 21,5.
- Steht ein Spieler auf beiden Seiten, gilt die härtere Last (wie bisher bei der Intensität).
- Resistenz wirkt nur auf die Erschöpfung. Das Verletzungsrisiko folgt unverändert aus der Erschöpfung (`fatigue-calibration.ts`).
- Aktive Erholung 4,5 → **4,0** (nur in v2-Saisons; die Bank-Erholung bleibt 28 + Reha × Trainingsmodus).
- **Pause nach Spieltag 10**: jeder Kaderspieler bekommt einmal die Erholung eines spielfreien Spieltags
  (`calculatePlayerRecovery`: (28 + Reha-Zentrum) × Trainingsmodus; Verletzte `injuryRecovery`, Faktor 1,0).
  Gebucht wird sie mit dem Abschluss von Spieltag 10 (D2-Commit), nicht beim D1-Teilcommit. Sie zählt nicht als Spieltag:
  Sperren hängen an Spieltags-Indizes (verletzt an Spieltag 10 → fehlt an 11, ist an 12 zurück), die Trainingsschicht
  wird nicht fortgeschrieben (sie bleibt stehen, wie im Mockup). Je Spieler stehen Vorher/Erholung/Nachher in
  `seasonState.belastungsPause`; ein zweiter Abschluss von Spieltag 10 (forceReplace) nimmt die Pause exakt zurück und
  bucht sie neu (idempotent, getestet).

## Gilt ab der folgenden Saison: Saison-Stempel, kein Umgebungs-Schalter

`seasonState.belastungsRegel = { seasonId, version: "v2" }` (Muster wie `wertungsSkalen`, `lib/fatigue/belastung-regel-stempel.ts`):

- gesetzt beim **Anlegen** eines Spiels (`new-game-setup-service.ts`) und beim **Saisonwechsel** (`preseason-workflow-service.ts`),
  nie mitten in der Saison;
- nur für **Battle-Spielstände mit 20 Spieltagen** (die Saisonform des Härtetests, aktive Erholung an). Manager-Saves und
  Battle-Saisons mit 10 Spieltagen bekommen keinen Stempel; beim Lesen prüft `belastungsRegelFuer` zusätzlich, dass die
  Saison wirklich die doppelte Länge trägt;
- ohne gültigen Stempel (laufende Saison jedes bestehenden Spielstands, auch Chris' Save an Spieltag 12) gilt die alte
  Regel **bit-identisch**.

Nachweis bit-identisch:
1. `tests/belastung-alt-bit-identisch.test.ts`: eine ganze 20-Spieltage-Battle-Saison ohne Stempel (Attribute, echte Slot-Rollen,
   gemischte Einsätze, Traits, Trainingsmodi und -schicht, D1-Teilcommit + D2-Replay, doppelter D2-Abschluss) ergibt exakt den
   Hash, den derselbe Test auf dem Basis-Commit `08d707c96` ergab (`7ff0ddccea18f5db`).
2. `scripts/pruefe-erholung-gate-am-save-abbild.ts` auf dem `live-save`-Abbild (6 Saves, darunter Chris' Save
   `new-game-1795114260527-nzr0z9`, Spieltag 12), Basis gegen Branch: Spielplan, Kontexte (ohne die neuen Felder
   `belastungsRegel`/`belastungsPause`/`belastungsBasis`), Wurf, Buchung, KI-Training, Statistik identisch; die Resolve-Vorschau
   unterscheidet sich nur in den Zeitstempeln `zeitpunkt` (JSON-Diff geprüft).

## KI

Die KI wählt WER spielt unverändert. Unter v2 verteilt sie die Gewählten einer Seite so auf die Plätze, dass
Σ (Rollen-Aufschlag − 0,25 × Last) maximal wird (`lib/ai/ai-belastung-platzwahl.ts`, eingebunden in
`buildAiLegacyLineupSuggestion`). Rollen-Aufschlag = derselbe Platzwert-Modifikator wie in der Wertung, Last = dieselbe Formel wie
die Buchung. Ein Punkt Platzwert wiegt vier Punkte Last: die Resistenz entscheidet nur, wo der Platzwert fast gleich ist. Bisher
setzte die KI schlicht in Auswahl-Reihenfolge auf die Plätze 0..n; die Platzwert-Verteilung kommt mit v2 neu hinzu (der Härtetest
hatte sie vorausgesetzt). Test: die KI holt weniger als die Hälfte der möglichen Lastersparnis und verliert dafür kaum Platzwert.

## Korridor-Messung

Werkzeug: `scripts/messe-belastung-resistenz.ts` (neu) über `lib/fatigue/erholungskorridor-simulation.ts`, jetzt mit Attributen
(Verteilung wie im Bestand: 41 % unter 45, 60 % unter 60, 82 % unter 75) und den echten Disziplinen des Spielplans. Basisfall-Liga:
32 Kader 8–14, keine Gebäude, Einsatz „Normal“, Rotation „niedrigste Erschöpfung zuerst“, 20 Spieltage, echte Buchung inkl. Pause
und aktiver Erholung über den Stempel. Je 16 Spielpläne, zwei Saatstämme.

Verletzungen je Saison:

| Variante | Stamm A | Stamm B | mit Trainingsschicht A / B |
|---|---:|---:|---:|
| heute (alte Regel) | 224,9 | 232,1 | 281,9 / 292,6 |
| v2, Plätze wie gewählt | 165,6 | 166,1 | 217,3 / 220,7 |
| v2, nach Platzwert (KI ohne Resistenz) | 189,6 | 189,5 | 245,9 / 246,4 |
| **v2, KI (Platzwert − 0,25 · Last)** | **180,3** | **181,2** | **236,0 / 235,0** |
| v2, alle rein nach Last | 98,0 | 93,4 | 134,3 / 134,8 |

- Die gebaute Regel senkt die Basisfall-Liga um rund 20 % (Fable am echten Spielstand: 191 → 168, −12 %) und liegt im Korridor
  150–200; die alte Regel liegt in dieser Liga (16 Spielpläne) bereits darüber — das ist der Stand vor diesem Bau.
- Würden alle Teams rein nach Last setzen, fiele die Liga auf rund 95 (Fable: 114) — deshalb bleibt das KI-Gewicht klein.
- Wächter: `tests/belastung-resistenz.test.ts` (6 Saaten: heute 208,8, v2-KI 173,3, nach Last 93,8; Korridor 140–200, v2 unter heute,
  Pause senkt die Erschöpfung zur Saisonmitte um mehr als 10). Die bestehenden Korridor-Tests
  (`injury-korridor-20-spieltage`, `injury-basisfall-korridor`, `fatigue-last-drei-stufen`, `fatigue-aktive-erholung`) laufen ohne
  Stempel und bleiben unverändert grün — sie bewachen die alte Regel, die für laufende Saisons weiter gilt.

Grenzen: synthetische Attribute (unabhängig je Attribut, keine Klassenprofile), Auswahl im Basisfall nach Frische statt mit der
echten KI-Auswahl; Platzwahl aber über dieselbe Funktion wie die KI.

## Einsatzliste

`app/foundation/legacy-lineup-lab/EinsatzlisteModern.tsx` (moderne Ansicht), dazu `LineupNewLook.tsx` (klassisch: Risiko/Erschöpfung
je Platz). Alle Zahlen über `lib/lineups/einsatzliste-belastung.ts` → `berechneEinsatzLast` / `projiziereEinsatzErschoepfung`, also
dieselbe Rechnung wie die Buchung (Test „die Einsatzlisten-Vorschau im Browser zeigt dieselbe Zahl, die gebucht wird“: Erschöpfung beim
Wurf und Risiko für jeden Einsatz einer Liga identisch). Der Server liefert je Spieler `belastungsBasis` (Trait, Einsatz-Multiplikatoren,
aktive Erholung) und je Kontext `belastungsRegel` und `belastungsPause`.

- **Ziehen oder Überfahren eines Spielers** (Kader oder Platz): über jedem Platz ein Etikett „Stärke · Last · ±Zusatz“, oben im Feld eine
  Leiste mit allen Plätzen beider Disziplinen (Stärke und Last, Farbton: grün ab der Schwelle, gelb knapp darunter, rot nahe am Deckel).
- **Platzkarte**: die Last des Besetzers als farbige Zahl; Risiko je Platz.
- **Kader**: Spalten „Res.“ (Resistenz auf dem gewählten Platz, darunter Abstand zur Schwelle) und „Last“ (Last hier), beide sortierbar;
  die bisherige Spalte Erschöpfung heißt jetzt „Ersch.“.
- **Rollenkarte**: Stufe, Belastungs-Attribut, Schwelle und Rechenweg (Grundlast, Resistenz-Zusatz, Einsatz/Trait, Last, aktive Erholung,
  Erschöpfung vorher → nachher, Risiko).
- **Pause-Band** mit Spieltagsleiste und P-Marke: bis Spieltag 10 als Ankündigung, an Spieltag 11 und 12 als Rückblick (Ø Erholung im Kader).

Bilder (Kopie von Chris' Save, Stempel und eine Pause zur Anzeige künstlich gesetzt, Dev-Server mit `OLY_AUTO_EXPORT_SAVES=0`):
`01-einsatzliste-pause-1920.png`, `02-hover-vorschau-1920.png`, `03-drag-slot-vorschau-1920.png` (Spieler gezogen, Maus über einem Platz),
`04-kader-last-hier-rechenweg-1920.png`, `05-rollenkarte-rechenweg-1920.png`.

## Arena-Fingerabdruck und Matrix

`node scripts/pruefe-wertung-fingerabdruck.mjs --node`: vorher und nachher **GESAMT eaafed96150e (75 Einträge)** — unverändert
(die Erschöpfung wirkt über den Leistungsabzug außerhalb des Motors). Eignungsmatrix nicht angefasst.

## Code-Stellen

- `lib/fatigue/belastung-regel.ts` — Formel, Konstanten, Projektion (rein, auch im Browser).
- `lib/fatigue/belastung-regel-stempel.ts` — Saison-Stempel.
- `lib/fatigue/fatigue-injury-service.ts` — `collectMatchdayUses` (Plätze je Einsatz), `getPlayerMatchdayFatigueLoadForUse`,
  `getPlayerMatchdayFatigueDelta` (Roll-Map, Apply, Replay-Rücknahme sehen dieselbe Zahl), `getMatchdayActiveRecoveryValue`,
  Pause (`bucheBelastungsPause`, `undoBelastungsPause`, `buildBelastungsPauseRef`), `projectMatchdayInjuryRisk` mit Platz.
- `lib/ai/ai-belastung-platzwahl.ts`, `lib/ai/ai-legacy-lineup-engine.ts` — KI.
- `lib/lineups/legacy-lineup-local-service.ts`, `lib/lineups/legacy-lineup-types.ts` — Kontextfelder.
- `lib/lineups/einsatzliste-belastung.ts`, `EinsatzlisteModern.tsx`, `LineupNewLook.tsx`, `einsatzliste-modern.css` — Anzeige.
- `lib/fatigue/erholungskorridor-simulation.ts`, `scripts/messe-belastung-resistenz.ts` — Messung.

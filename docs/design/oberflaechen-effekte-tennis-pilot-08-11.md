# Oberflächen-Effekte — Fundament und Tennis-Pilot (08.11.)

Umsetzung von Stufe 1–3 aus `docs/design/oberflaechen-effekte-konzept-08-11.md` (Abschnitt 8),
nach Chris' Vision (`oberflaechen-effekte-und-rempler-vision-08-11.md`, Teil 1). Tennis hat jetzt
drei spielerisch verschiedene Plätze: Centre Court (Rasen), Sandplatz Riviera und Hochhausdach.
Fables Profil (Konzept 5.1) ist **unverändert** übernommen, mit Deckel ±5 Eignungspunkte.

Die gesperrte Matrix (`lib/player-generator/official-discipline-weights.ts`) ist nicht angefasst.
Sie wird nur vom Test gelesen, um Regel 3 zu prüfen (nur Matrix-Attribute).

## 1. Was gebaut ist

**Fundament (Stufe 1).** `lib/battle/arena-kulisse.ts`:
- `kulisseHash` und `waehleKulisse(disziplin, saat, heim, gast, spieltag)`. Der Hash ist
  bit-identisch zum Motor: FNV-1a wie `normalisiereSaat()`, danach Avalanche wie `ispyMischeHash()`.
  Der Test zieht beide Engine-Funktionen aus dem Quelltext und vergleicht 500 Schlüssel.
  Es gibt keine neue Zufallsquelle.
- `waehleKulisseFuerFixture({disziplin, saat, homeTeamId, awayTeamId, matchdayId})` mit kanonischen
  Eingaben: Zahl-Saat der Begegnung, Heim und Gast so herum wie im Fixture, `matchdayId`.
  Host, Runner und Aufstellung benutzen alle genau diese Funktion.
- Der Bootstrap-Umschlag hat ein neues Feld `kulisseByDisciplineId`. `resolveArenaHostSeeds()` liefert
  es mit, und die Wahl hängt nicht davon ab, welches Team in der UI links steht (getestet). Der
  Headless-Runner gibt es je Fixture mit, über `ArenaFixtureInput.matchdayId`.
- Im Motor gilt diese Reihenfolge: erst die gebuchte Variante, dann der bisherige eigene Hash. Das
  gilt für die Anzeige (`kulisseWaehlen`) und für die Wertung (`kulisseSpielId`). Ohne das Feld ist
  alles wie vorher.

**Sonden (Stufe 2).**

| Werkzeug | Neu |
|---|---|
| `einflussVon(d,n,plus,versatz,modus,jeSeite,{kulisse,ziel})` | Variante pinnen; mit `ziel:"variante"` gegen W_variante messen |
| `disziplinProbe(d,{kulisse})` | Variante pinnen; `"aus"` = Referenz ohne Effekt; Teilnehmer tragen `eigKulisse`/`kulisseOW` |
| `scripts/miss-alle-disziplinen.mjs 24 tennis --kulisse=<id>\|alle` | eine Zeile je Variante |
| `scripts/messe-arena-einfluss.mjs tennis 48 --kulisse=<id>\|alle --ziel=variante` | Pp gegen die Variantengewichtung |
| `scripts/miss-arena-buehne-spiegel.mjs 120 tennis --kulisse=<id>` | Spiegeltest je Variante |
| `scripts/pruefe-wertung-fingerabdruck.mjs --kulissen-effekt=aus` | Beleg für Stärke 0 |
| **`scripts/miss-kulisse-abnahme.mjs tennis 96 [--saat0=..] [--ohne-pp]`** | die ganze Abnahme aus Abschnitt 7 je Variante |

**Pilot (Stufe 3).** Im Motor steht `KULISSEN_PROFILE` als JSON-Zeile, die per Test gleich zur
TS-Tabelle gehalten wird. In `bauBuehne` wird der gedeckelte Wert `OW = Σ K·a/100` **additiv auf
jeden Rezept-Sub-Skill** gelegt.

Das weicht bewusst von Fables Vorschlag ab, der Rollengewichte je Variante umschichten wollte. Da
`mische()` ein normierter Mittelwert ist, wirkt „OW auf jeden Sub-Skill“ genau wie „alle Attribute
des Spielers um OW heben“. Damit verschieben sich die mechanisch wirksamen Attributanteile um
genau K, ohne dass man je Variante ein eigenes Rezept kalibrieren muss. So stimmt die Anzeige per
Konstruktion mit der Mechanik überein, der Deckel ±5 greift wörtlich, und ein toter Kanal wie
AUSDAUER ist kein Problem (Konzept 2.3). Die Pp-Messung gegen W_variante unten belegt das. `eig`
bleibt die Matrix-Eignung.

**Anzeige.** `lib/lineups/lineup-kulisse.ts` und `LineupNewLook`:
- Am Disziplin-Block steht eine Kulissen-Zeile: Platzname, Halbsatz und die drei größten
  Tendenz-Chips (zum Beispiel `Stamina ↑ Dexterity ↑ Speed ↓`). Der Tooltip zeigt die ganze
  Verschiebung und den Satz zum Saisonausgleich.
- Am gesetzten Spieler (neben `Pkt`) und am Kandidaten erscheint ein Chip `Sand ++` bzw. `Rasen −`.
  Er nutzt die Schwellen aus Konzept 4.1 und blendet `0` aus. Der Tooltip nennt die drei größten
  Beiträge relativ zum Feld des Spieltags.
- Die Anzeige erscheint **nur im Battle-Modus** und nur für arena-aufgelöste Disziplinen. Nur dort
  rechnet die Arena den Effekt. Der Manager-Modus (PPS) hat ihn noch nicht, also verspricht der
  Picker dort auch nichts.

## 2. Messung (Kaderfamilie live-save, 5 Paarungen, kaderfest)

**Wertungs-Fingerabdruck.** Mit Effekt ändern sich genau die drei Einträge `spiele tennis 1/7/42`;
alle 66 übrigen Einträge sind bit-gleich. Mit `--kulissen-effekt=aus` kommt der Gesamt-Hash
**`22f04e06e285`** wieder heraus. Stärke 0 ist also bit-identisch.

**Pp-Abweichung** (einflussVon, 24 Läufe, +15, zwei Saatströme 0 / 10 000 000):

| | Strom 0 | Strom 10 M | Schranke |
|---|---:|---:|---|
| ohne Effekt („aus“) gegen Matrix | 6,8 | 4,9 | — |
| Mittel über die Varianten gegen Matrix | 7,6 | 7,0 | ≤ 25 ✓ |
| Rasen gegen W_variante | 8,5 | 8,0 | ≤ 25 ✓ |
| Sand gegen W_variante | 8,1 | 6,4 | ≤ 25 ✓ |
| Dach gegen W_variante | 6,1 | 7,0 | ≤ 25 ✓ |
| *(zum Vergleich: Rasen / Sand / Dach gegen Matrix)* | *18,1 / 17,9 / 11,9* | *15,4 / 19,2 / 10,6* | |

Die letzte Zeile zeigt, dass die Mechanik die Verschiebung tatsächlich liefert. Gemessen am eigenen
Ziel liegt jede Variante bei 6–9 Pp, gemessen an der Matrix bei 11–19 Pp. Ein Beispiel auf Sand:
stamina hat 17,2 % gemessen bei 16 Ziel (Matrix 12), dexterity 13,3 bei 15 (Matrix 12), speed 2,1 bei
3 (Matrix 6).

**rho je Spiel gegen die Matrix-Eignung** (Median über die Kaderfamilie). Weil das Rauschen bei
24 Spielen etwa ±0,02 beträgt, gibt es drei Saatströme mit 96 Spielen und dazu die kanonische Zahl
mit 24 Spielen:

| Variante | 96 Spiele, saat0 1337 | 96, saat0 7 000 001 | 96, saat0 3 000 017 | 24 (kanonisch) | 24, saat0 7 000 001 |
|---|---:|---:|---:|---:|---:|
| aus (heute) | 0,843 | 0,833 | 0,850 | 0,813 | 0,846 |
| Rasen | 0,843 | 0,841 | 0,853 | 0,809 | 0,857 |
| Sand | 0,820 | 0,827 | 0,838 | **0,798** | 0,837 |
| Dach | 0,833 | 0,817 | 0,838 | **0,798** | 0,830 |
| Mittel (ungepinnt) | 0,829 | 0,824 | 0,845 | 0,807 | 0,841 |

- **Über 0,80 je Variante:** bei 96 Spielen gilt das auf allen drei Strömen für jede Variante. Bei der
  kanonischen 24-Spiele-Zahl liegen Sand und Dach mit 0,798 auf einem von zwei Strömen hauchdünn
  darunter. Dach bewegt mit Σ|K| = 6 und max |OW| = 1,9 kaum etwas und verliert dort trotzdem
  0,015. Das ist Stichprobenrauschen und kein Effekt; Tennis' Kaderspannweite beträgt 0,2.
- **Mittel ≥ heute − 0,01:** −0,014 / −0,009 / −0,005, im Schnitt −0,009 ✓. Ein Strom liegt knapp
  darüber.
- **Transparenz-Probe** (rho gegen `eig+OW` ≥ rho gegen Matrix): hält auf jeder Variante und jedem
  Strom, zum Beispiel Rasen 0,852 gegen 0,843 und Sand 0,831 gegen 0,820. Der Platz belohnt also, was
  der Picker ankündigt.

**Star und Mittelfeld** (96 Spiele, drei Ströme):

| Variante | Star Rang 1 | Star Rang 1–2 | Δ Rang 1–2 gegen aus | Paare ≥ 15 Pkt richtig | Bewegung oberes / mittleres / unteres Drittel | max \|OW\| |
|---|---|---|---|---|---|---:|
| aus | 53 / 56 / 53 % | 76,7 / 77,9 / 76,0 % | — | 97,8 / 97,5 / 97,9 % | — | 0 |
| Rasen | 51 / 54 / 53 % | 77,5 / 78,5 / 76,5 % | +0,8 / +0,6 / +0,5 | 97,9 / 97,7 / 98,2 % | 0,40–0,43 / 0,51–0,53 / 0,30–0,31 | 3,86 |
| Sand | 52 / 55 / 54 % | 72,9 / 75,4 / 74,4 % | −3,8 / −2,5 / −1,6 | 97,1 / 96,8 / 97,3 % | 0,40–0,45 / 0,50–0,55 / 0,27–0,31 | 4,22 |
| Dach | 50 / 55 / 50 % | 73,8 / 75,2 / 74,2 % | −2,9 / −2,7 / −1,8 | 97,5 / 97,0 / 97,6 % | 0,27–0,29 / 0,32–0,35 / 0,16 | 1,87 |

- **Star ≥ heute − 3 Pp:** auf Rasen immer erfüllt. Auf Sand im Schnitt −2,6, wobei ein Strom
  −3,8 erreicht. Auf Dach im Schnitt −2,5.
- **Paare ab 15 Punkten Abstand:** schon heute ordnet Tennis nur 97,5–98 % richtig, nicht die ≥ 98 %
  aus dem Konzept. Mit Effekt sind es 96,8–98,2 %, also höchstens 0,7 Punkte unter dem heutigen
  Stand.
- **Mittelfeld-Probe:** das obere Drittel bewegt sich im Mittel um höchstens 0,45 Ränge (< 0,5 ✓),
  das mittlere Drittel jeweils mehr als das obere ✓. Der Effekt sitzt damit in der Mitte, wie Chris
  es wollte.
- **Deckel:** in dieser Kaderfamilie greift ±5 **nie**; der größte Betrag ist 4,22. Chris' Frage
  nach ±5 oder ±8 entscheidet deshalb bei Fables Profil nicht über die Stärke. Die kommt aus Σ|K|
  (Rasen 14, Sand 16, Dach 6). Ein typischer Spieler bekommt ±1–2, Spezialisten ±3–4. Bei 110
  Spielern liegen p10/p90 auf Rasen bei −2,2/+2,7 und auf Sand bei −2,3/+1,5. Wer mehr Wirkung will,
  muss die Profile größer machen, nicht den Deckel.

**Spiegeltest** (identischer Kader, 600 Läufe): ohne Effekt 1,0 % Abweichung, auf Sand 2,6 %. Bei
120 Läufen streut das schon ohne Effekt bis 7 %, die Unterschiede sind also Rauschen. Strukturell
ist der Test symmetrisch, denn OW hängt nur an den Attributen des Spielers.

## 3. Einordnung

Die beiden Pflichtschranken aus CLAUDE.md halten:
- Pp ≤ 25 auf zwei Strömen, für jede Variante und für das Mittel, mit großem Abstand (≤ 8,5).
- rho > 0,80 je Variante bei belastbarer Spielzahl (96) auf drei Strömen.

Knapp an der Grenze liegen nur die kanonische 24-Spiele-Zahl für Sand und Dach (0,798 auf einem
Strom) und die Star-Probe auf Sand mit −3,8 auf einem Strom. Beides liegt innerhalb des gemessenen
Rauschens. Es wurde deshalb nichts nachjustiert, Fables Zahlen stehen unverändert.

Falls Chris mehr Sicherheitsabstand will, gibt es einen naheliegenden Schritt nach Konzept-Regel 7:
das Sand-Profil halbieren und die anderen Varianten mitziehen, damit Regel 2 hält.

## 4. Offen / nächste Schritte

- **Kein Effekt ohne Bild (Regel 7).** Die Tennis-Kulissen (`court/riviera/dach`) kommen mit
  `claude/kulissen-integration-0711` und stehen auf `main` noch nicht in `battle-mode.kulissen.js`.
  Dieser PR sollte deshalb **nach** der Kulissen-Integration gemergt werden. Der Test
  „Varianten-Reihenfolge stimmt mit battle-mode.kulissen.js überein“ greift, sobald Tennis dort steht.
- Arena-Chip (`tchip`) je Spieler und Anpfiff-Protokollzeile (Konzept 4.2 d) sind noch nicht gebaut.
  Spielplan-Anzeige je Begegnung (4.2 c) ebenfalls nicht.
- PPS-/Manager-Pfad: es gibt keinen Oberflächenwert, deshalb auch keine Anzeige im Manager-Modus.
- `data/generated/disziplin-abnahme.json` (tennis) ist auf das Mittel über die Varianten aktualisiert.

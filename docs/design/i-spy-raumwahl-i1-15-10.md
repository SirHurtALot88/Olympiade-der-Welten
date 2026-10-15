# I-Spy: Raumwahl (I-1) — gebaut, Standard bleibt Werkstatt (15.10.)

Chris' Freigabe: Sammel-Antwort auf eine Liste offener Punkte, "ja überall D, bau weiter" —
I-1 ("Jede Seite wählt ihren Raum") war einer davon. Quelle der Spezifikation:
`docs/design/fable-ideen-arena-ispy-30-09.md` Abschnitt 6/I-1 (die ausführlichste Fassung) und
`docs/design/i-spy-fable-empfehlung-02-10.md` Abschnitt 8 (Chris' spätere Entscheidung, I-1
separat von PR 0 zu behandeln).

## Was gebaut wurde

Drei benannte Räume — **Archiv**, **Werkstatt**, **Salon** — als Varianten derselben
Fundort-Punktmasse-Verteilung. Alle drei haben exakt dieselben zwölf Fundort-Positionen
(x/y), dieselbe Stufenmultimenge (vier Stufe-1, sechs Stufe-2, zwei Stufe-3) und dieselben
beiden Mehrwege-Tresore unverändert (die `neben`-Paarung ist positionsgebunden, I-1 rührt sie
nicht an) — nur **welche Rätselart an einer Position liegt**, wandert zwischen den Räumen.
Kein neues Attribut, kein neues Rezept: exakt der Spezifikationssatz "Die Raumwahl verschiebt
die Verteilung der bestehenden Sub-Skills, nicht ihre Formeln."

Konstruktion (`public/mockups/battle-mode.engine.js`, Kopfkommentar "I-SPY: DREI RAEUME" vor
`BUEHNE_ART`): Archiv und Salon entstehen aus Werkstatt (= die unveränderte, bisherige
Fundort-Liste) durch Verschieben der beiden STUFE-1-BLÖCKE (je ein Spiegelpaar à 10+10
Punkte) — nie der größeren Stufe-2/3-Blöcke. Logik und Mechanik haben je einen solchen
kleinen, verschiebbaren Block; Verhör hält nur einen größeren Stufe-2-Block (50 Punkte) und
wäre damit allein zu grob verschoben worden. Ergebnis (volles Feld, zwölf aktive Fundorte):

| Raum | Logik | Verhör | Mechanik |
|---|---:|---:|---:|
| Archiv | 48,4 % | 35,5 % | 16,1 % |
| Werkstatt (unverändert) | 41,9 % | 35,5 % | 22,6 % |
| Salon | 35,5 % | 48,4 % | 16,1 % |

(Matrix-Zielanteil `ISPY_ZIEL_ANTEIL`: Logik 37,6 % / Verhör 36,5 % / Mechanik 25,9 % — jeder
Raum bleibt in der Nähe, verschiebt sich aber klar relativ zu den beiden anderen. Mechanik ist
in keinem Raum die größte Art für sich, aber in Werkstatt klar am höchsten VERGLICHEN MIT den
beiden anderen Räumen, 22,6 % gegen 16,1 % dort — die Vergleichsgröße, die die KI-Wahl
auswertet.)

Auswahl-Mechanik (`ispyWaehleRaum()`): jede Seite wählt unabhängig von der anderen — spiegelfrei,
weil beide Seiten ohnehin vollständig unabhängige Raumkopien bekommen (Architekturentscheidung
seit PR 1). Eine "intelligente" KI-Regel (`ispyWaehleRaumKI()`) ist vollständig gebaut: Argmax
über das Team-Mittel der drei Knack-Sub-Skills (LOGIK/MENSCHENKENNTNIS/FINGERFERTIGKEIT).
Manuelle Übersteuerung je Seite über `window.__arena.ispyRaumWahl({0:"archiv",1:"auto"})` —
dasselbe Muster wie `buehneHaltungTest` (null/weggelassen = Standard, ein Raumname = genau
dieser Raum, `"auto"` = die intelligente Wahl). Eine reine Lese-Sonde
`window.__arena.ispyRaumSonde()` gibt zurück, welchen Raum jede Seite im zuletzt gebauten Spiel
bekommen hat.

## Die Abweichung vom Spezifikations-Plan — gemessen, nicht nur behauptet

Die Spezifikation nahm an, die KI-Regel ("Argmax über das Team-Mittel") sei **per Konstruktion**
rho-neutral, genau wie die Bahn mit ihrer Standardaufstellung. Nachgemessen
(`node scripts/miss-alle-disziplinen.mjs 24 i-spy`, kaderfeste live-save-Familie) stimmt das
**nicht ohne Weiteres**: mit dem reinen Argmax als Standard für beide Seiten fiel rho/Spiel von
0,750 (Ist-Stand) auf 0,700 — ein einzelner, reproduzierbarer Effekt, kein Rauschen (zweimal
identisch gemessen). Kontrollmessung (beide Seiten per Testvorgabe fest auf Werkstatt): exakt
0,750/0,177/0,881/0,210, bit-identisch zum Ist-Stand — die Engine-Verdrahtung selbst ist korrekt,
der Effekt kommt ausschließlich aus der tatsächlichen Raum-Differenzierung.

Ursache, aufgeschlüsselt per Variante (`scripts/lib/rangtreue-messung.mjs`s `disziplinMessen()`
direkt aufgerufen, je Paarung einzeln): der Rückgang ist NICHT eine gleichmäßige Verschiebung
über alle fünf Kader-Paarungen, sondern wird von EINER einzigen Paarung getragen
(coldsteel-direlegion, Gast-Team: Team-Mittel Verhör 14,9 Punkte über dem nächsten, wechselt in
den Salon — ihr eigenes rho/Spiel fällt dort von 0,750 auf 0,649, während drei der übrigen vier
Paarungen flach oder sogar leicht besser liegen). Ein Halbieren der Verschiebungs-Magnitude
(nur ein Block statt zwei bewegt) änderte an diesem Bild fast nichts (0,701 statt 0,700) — der
Effekt hängt an der WAHL selbst, nicht an ihrer Stärke. Mechanismus: die Raumwahl ist eine
TEAM-Mittel-Entscheidung, die Wertung bleibt aber individuell — ein Raum, der die Punktmasse klar
zu einer Art verschiebt, kann einzelne Spezialisten eines Teams gegenüber ihren Mitspielern
überproportional begünstigen, selbst wenn das Team im Schnitt von der Wahl profitiert (derselbe
Interessenkonflikt, den die Pp-Abnahme auf Attributebene misst, hier auf Rangtreue-Ebene).

Der Effekt (0,05) bleibt kleiner als die kaderfeste Spannweite dieser Disziplin (0,177-0,224) und
ist damit im Rahmen des projekteigenen Kaderrauschen-Maßstabs ("kleiner als die Spannweite ist
von Null nicht unterscheidbar", CLAUDE.md) — aber die Spezifikation verlangt ausdrücklich
Nachmessen statt Behaupten, und ein gemessener, reproduzierbarer Rückgang auf eine einzelne
Zahl zu stützen widerspricht dem Geist dieser Pflicht.

## Die Entscheidung: Werkstatt ist der echte Standard, die intelligente Wahl ein expliziter Modus

Statt den Argmax unconditional zum stillen Standard zu machen (und damit die gemessene
0,750-Baseline unbemerkt zu bewegen), ist der **echte** Standard ohne jede Vorgabe jetzt
"Werkstatt für beide Seiten" — bit-identisch zum Ist-Stand, wie die Kontrollmessung oben zeigt.
Die intelligente Wahl bleibt vollständig gebaut und sofort verfügbar, aber nur als explizite
vierte Option (`"auto"`), die ein Manager (Chris oder künftig eine ausgefeiltere Gegner-KI) sich
bewusst aussuchen muss — dieselbe Unterscheidung, die `buehneHaltungTest` schon kennt (eine
Vorgabe ändert etwas, keine Vorgabe läuft über den gemessen sicheren Pfad), nur mit einer
zusätzlichen Stufe, weil der automatische Pfad selbst erst gemessen werden musste.

**Ergebnis, Standardpfad (keine Vorgabe, Werkstatt für beide Seiten):**

| Kennzahl | Wert |
|---|---:|
| rho je Spiel (Median, kaderfest) | 0,750 (bit-identisch zum Ist-Stand) |
| Spannweite | 0,177 |
| rho Saison (Median) | 0,881 |
| Spannweite | 0,210 |
| Pp-Abweichung, Strom 1 (1337/7919) | 15,3 |
| Pp-Abweichung, Strom 2 (10000000-Versatz) | 11,1 |

Beide Pp-Werte sind identisch zum Ist-Stand (das Rezept selbst ist unverändert) und liegen weit
unter der 25-Pp-Schranke.

**Pp je tatsächlich gewähltem Raum** (beide Seiten fest auf denselben Raum, n=24, zur
Risiko-Einschätzung für den Fall, dass die "auto"-Option oder eine künftige Lineup-UI einen
Raum wirklich einsetzt):

| Raum | Pp |
|---|---:|
| Archiv | 19,8 |
| Werkstatt | 15,3 |
| Salon | 14,5 |
| "auto" (intelligente Wahl) | 17,7 |

Alle vier liegen komfortabel unter 25 — das Risiko aus der Spezifikation ("±8 Pp Art-Verschiebung
bedeutet grob ±3 Pp auf Attributebene, bleibt weit unter 25") bestätigt sich auf der
Pp-Abweichungs-Seite vollständig. Das offene Risiko war ausschließlich die rho-Seite, oben
behandelt.

## UI/Anzeige

I-Spy ist **nicht arena-aufgelöst** (`lib/battle/arena-resolved-disciplines.ts` enthält keinen
Eintrag für `"i-spy"`) — die Disziplin hat deshalb noch keinen Produktionspfad im echten
Spielstand und folglich auch keine bestehende Lineup-/Taktik-Auswahl-Oberfläche, an die sich eine
Raumwahl anhängen ließe. Die allgemeine Matchday-Lineup-UI (`app/foundation/legacy-lineup-lab/`,
`lib/lineups/legacy-lineup-types.ts`) kennt nur disziplinübergreifende Team-Entscheidungen
(Intensität, Mutator-Trait-Wahl) über den LEGACY-PPS-Pfad, der mit I-Spys eigenem
Arena-Mockup-Chassis gar nicht verbunden ist — dort eine Raum-Option einzubauen würde eine
Wirkung vorspiegeln, die es nicht gibt, bevor I-Spy überhaupt arena-aufgelöst ist.

Gebaut wurde deshalb der Teil, der schon jetzt sinnvoll ist: die Auswahl-Mechanik selbst
(KI-Standard + manuelle Übersteuerung + "auto"-Option, alle über `window.__arena.ispyRaumWahl()`
testbar) und eine In-Game-Ansage im Ticker (`feedEreignis`), sobald zwei Seiten tatsächlich in
verschiedenen Räumen spielen — reine Anzeige, kein Einfluss auf Wertung/RNG. Eine echte
Vorspiel-Auswahloberfläche (nach dem Muster der Bahn-Aufstellung, `echterKader.aufstellung` →
`lib/foundation/battle-arena/arena-aufstellung-adapter.ts`) ist der naheliegende nächste Schritt,
sobald I-Spy selbst arena-aufgelöst wird — bis dahin bliebe jede UI dafür Attrappe.

## Geprüft, nicht gebaut: der naive KI-Standard

Zur Erinnerung für künftige Agenten, die an dieser Stelle weiterarbeiten: der reine
Team-Mittel-Argmax als STANDARD (ohne die "nur bei expliziter Vorgabe"-Einschränkung) ist fertig
programmiert (`ispyWaehleRaumKI()`), aber **nicht** als automatischer Standardpfad verdrahtet,
weil er rho um 0,05 bewegt (s.o.). Ein denkbarer nächster Schritt (nicht in dieser Runde
verfolgt): eine Mindest-Marginschwelle zwischen dem besten und dem zweitbesten Team-Mittel, unter
der die KI bei Werkstatt bleibt — ein erster Test mit Schwelle 8-13 Punkten senkte den Effekt
nicht spürbar (0,700 → 0,703-0,704), weil der Rückgang an EINER einzelnen, klar über jeder
plausiblen Schwelle liegenden Paarung hängt (Marge 14,9); erst eine Schwelle über 15 (= "praktisch
nie auslösen") brachte rho wieder in die Nähe der Baseline. Eine robustere Lösung bräuchte entweder
ein individuelleres Auswahlkriterium (z.B. die Spannweite der drei Team-Mittel statt nur ihres
Maximums berücksichtigen) oder eine größere Kaderfamilie, um die Schwelle nicht an einer
Fünf-Paarungen-Stichprobe zu überanpassen. Beides war aus dem Scope dieser Runde.

## Dateien

- `public/mockups/battle-mode.engine.js`: `ISPY_FUNDORTE_WERKSTATT`/`ISPY_FUNDORTE_ARCHIV`/
  `ISPY_FUNDORTE_SALON`/`ISPY_RAEUME`/`ISPY_RAUM_NAMEN` (Raumdaten), `ispyWaehleRaumKI()`/
  `ispyWaehleRaum()`/`ISPY_RAUM_MANUELL` (Auswahl-Mechanik), `baueSchatzsuche()` (Verdrahtung je
  Seite + Ticker-Ansage), Furniture-Render-Block in `bodenSchatzsuche()` (zeichnet je Seite ihren
  eigenen Raum), `window.__arena.ispyRaumWahl()`/`ispyRaumSonde()` (Test-/QA-Schnittstelle).

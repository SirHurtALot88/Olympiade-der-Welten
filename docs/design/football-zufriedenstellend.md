# Football: Sicht-Abnahme nach der Rezept-Kalibrierung

Stand 04.09.2026, Branch `claude/football-zufriedenstellend` (abgezweigt von `origin/main`
3aaf943c, enthält bereits `claude/football-live-migration` und
`claude/football-rezept-kalibrierung`). Auftragsgrundlage: Chris' Sammelauftrag „Hockey und
Football und Gewichtheben soweit fertig machen dass man damit zufrieden sein kann", für
Football konkret die Auflage aus `football-live-migration.md` Abschnitt 9.5/9.4 (visuelle
Politur der Formationen, Helm-Overlay) — die letzte Sichtprüfung im echten UI lag VOR der
heutigen Rezept-/Korridor-Kalibrierung, war also gegen den aktuellen Stand unverifiziert.
**Kein weiterer Rezept-Grinding-Auftrag** — dieser Bericht ist eine reine Sicht-/
Vollständigkeits-Abnahme, keine dritte Kalibrierungsrunde.

`engine.js` meint `public/mockups/battle-mode.engine.js`. Football bleibt Mockup — reine
Motor-Arbeit, `lib/`/`app/` nicht angetastet (bis auf die reine Lesekontrolle unten).

---

## 0. Ergebnis vorab

**Ein echter, kontenierter Sicht-Bug gefunden und behoben**, keine Formations-Änderung nötig
(die im Migrationsbericht als „nächste Fein-Politur" benannte Formations-Enge ist bei
Nachmessung kein Blocker mehr, s. Abschnitt 2), kein Helm-Overlay gebaut (Abschnitt 4, echter
Mehraufwand statt der erhofften kleinen Ergänzung), keine weitere Kalibrierung versucht (die
Baseline-Messung bestätigt: weiteres Rezept-Grinding hat sinkenden Grenzertrag, s. Abschnitt 1).

## 1. Baseline: lohnt noch eine dritte Kalibrierungsrunde?

`node scripts/miss-alle-disziplinen.mjs 24 football basketball` auf dem unveränderten,
frisch geklonten `origin/main`-Stand (vor jeder Änderung dieser Runde):

| Disziplin | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| basketball | 0,757 | 0,102 | 0,923 | 0,231 |
| football | 0,460 | 0,258 | 0,692 | 0,196 |

Bit-identisch zum Endstand aus `football-rezept-kalibrierung.md` — die heutige Kalibrierung
ist stabil reproduzierbar, kein Drift. Damit bestätigt: die Annahme aus dem Auftrag
(„weiteres Rezept-Grinding hat abnehmenden Grenzertrag") hält. Zwei Kalibrierungsrunden am
selben Tag haben das Rezept, den Korridor UND die Receiver-Rolle bereits durchprobiert
(`football-rezept-kalibrierung.md` Abschnitt 4.4-4.6) — ohne einen neuen, noch nicht
versuchten Hebel zu finden, wäre eine dritte Runde dasselbe Grinding, vor dem der Auftrag
ausdrücklich warnt. Der Fokus dieser Runde liegt deshalb komplett auf Sicht/Vollständigkeit,
wie beauftragt.

## 2. Formations-Politur: nachgemessen, kein Blocker mehr

`football-live-migration.md` Abschnitt 7 (Nachtrag) hatte die Formationen nach dem ersten
Fix als „sichtbar zweigeteilt... aber enger/überlappender als ein sauberes
Formations-Diagramm" eingeordnet — explizit als „nächste Fein-Politur-Arbeit, kein Blocker".
Diese Runde hat das mit `window.__arena.diagAbstaende(1337, 90, "football")` nachgemessen
statt nur angeschaut (dieselbe Anti-Stacking-Sonde, die schon die ursprüngliche Enge
aufgedeckt hatte):

| Kennzahl | Wert |
|---|---:|
| Mittlerer nächster Nachbarabstand (gezeichnet) | 32,6 px |
| Anteil Frames mit einem Paar unter 30 px | 22,2 % |
| Anteil Frames mit einem Paar unter 24 px | 0,5 % |
| Anteil Frames mit einem Paar unter 18 px | 0,1 % |
| Anteil Frames mit einem Paar unter 12 px | 0,0 % |

Zum Vergleich: der ursprüngliche, klar zu enge Stand (vor dem Migrations-Fix) zeigte
Nachbar-Abstände von 10-16 px zwischen der nächsten Offense-/Defense-Figur — genau der
Bereich, der hier in praktisch keinem Frame mehr vorkommt (0,0-0,5 % unter 12-24 px). Echte
Überlappungen (Figuren, die sich sichtbar durchdringen) sind ein Randfall, kein
Dauerzustand — sie treten fast ausschließlich in Tackle-/Sack-Momenten auf, wo zwei Figuren
am selben Punkt ohnehin real zusammenstoßen sollen.

Visuell nachgeprüft über drei unabhängige Spiele (`node --check`-freier Playwright-Lauf, HTTP-
Server auf `public/`, Screenshots bei 5/20/45/70/100 Sekunden je Spiel, neun der fünfzehn
Aufnahmen zeigen unterschiedliche Formationen/Feldstände): die zwei Formationen sind in JEDEM
Screenshot klar als zwei Gruppen erkennbar — eine Gruppe kompakt nahe der Line of Scrimmage
(Linemen/Center/RB), zwei bis drei Figuren deutlich seitlich versetzt (Wide Receiver/
Defensive Backs), getrennt durch eine sichtbare Lücke zur gegnerischen Gruppe. Das ist
„enger als ein Lehrbuch-Diagramm" (die inneren Linemen stehen mit ~30-50 px Abstand
spürbar dichter als auf einem echten Playbook), aber KEIN Klumpen und keine zwei Teams, die
sich nicht mehr unterscheiden lassen — der Bug-B-Fix aus der Migrationsrunde hat sein Ziel
erreicht. **Kein weiterer Eingriff diese Runde**: eine engere Anlehnung an ein Lehrbuch-Diagramm
würde entweder die Feldbreite (Canvas-Höhe 470 px für zwölf ~32 px breite Figuren plus
Referee) vergrößern oder die Formationstabellen komplett neu ziehen — beides ein größerer
Eingriff als die hier gemessene Verbesserung rechtfertigt, und beides würde die bereits
gemessene Rangtreue (Abschnitt 1) erneut ins Risiko bringen, ohne dass Chris' eigentliche
Beschwerde („Klumpen statt Spielzüge") noch vorliegt.

## 3. Fünf Spielzug-Typen: visuell bestätigt unterschiedlich

Alle sieben `spielTyp`-Werte (`lauf`, `screen`, `kurz`, `mittel`, `tief`, `fg`, `punt`) über
`window.__arena.fsPhase().snap.spielTyp` gezielt abgepasst und je einmal fotografiert
(Formationsphase) sowie für `lauf`/`screen`/`kurz`/`mittel`/`tief` zusätzlich über mehrere
Zwischenbilder während der Flugphase verfolgt:

- **`lauf`**: Ball bleibt tief (Feldmitte), leichter seitlicher Schlenker (Sinus-Term),
  bewegt sich mit dem Läufer zum Zielpunkt — sichtbar bodennah statt eines Wurfs.
- **`screen`**: sehr flacher, kurzer Bogen, startet leicht HINTER der Line (der Ball geht
  optisch erst zurück zum Receiver, bevor er nach vorn fließt) — klar von jedem anderen
  Passtyp unterscheidbar.
- **`kurz`/`mittel`/`tief`**: ansteigend hohe Parabelbögen (Amplitude 16/30/46/70 px im
  Motor), bei `tief` über die volle 1,6-Sekunden-Flugdauer auch der mit Abstand größte
  Bildschirmweg — im direkten Bildvergleich klar als „höher/weiter" erkennbar.
- **`fg`/`punt`**: eigener hoher Kick-Bogen (46/60 px Amplitude) zu einem Kick-Ziel statt zu
  einem Receiver, kein Spieler trägt den Ball während des Flugs.

Damit ist Chris' „verschiedene Zug-Typen mit unterschiedlichen Bewegungsmustern"-Auflage in
der Praxis bestätigt, nicht nur im Code plausibel.

## 4. Ein echter Bug gefunden — und behoben: eingefrorene Wurfweite bei Unvollständig/Interception

**Fund.** Beim Verfolgen der `tief`-Flugbahn über mehrere Zwischenbilder fiel auf: der Ball
bewegte sich bei einem bestimmten `tief`-Zug über die gesamte Flugdauer nur ~14 px horizontal
(bei einer erwarteten Reichweite von grob 90-180 px für einen echten Tiefpass) — obwohl die
vertikale Bogenhöhe (70 px Amplitude) korrekt anstieg und wieder abfiel. Zwei weitere,
gezielt auf einen unvollständigen bzw. abgefangenen Wurf abgepasste Screenshots bestätigten:
**bei JEDEM unvollständigen oder abgefangenen Pass flog der Ball unabhängig von der
angesagten Tiefe nur bis zur Line of Scrimmage und zurück**, statt sichtbar in Richtung des
Ziels zu fliegen. Ein als „tief" angesagter, dann unvollständiger Pass sah damit optisch
nicht anders aus als gar kein Wurf — genau der Fall, den Chris' Auftrag ausschließen wollte.

**Ursache (Code, `animiereFootballZug()`).** Die Zielposition für die Flugbahn wurde immer
aus `fb.spot - (erg.yards||0)` berechnet. `erg.yards` ist bei `erg.typ==="incomplete"` und
`erg.typ==="interception"` in `resolvePass()` schlicht nicht gesetzt (kein realer
Raumgewinn) — der `||0`-Fallback ließ den Ball dadurch praktisch am Ausgangspunkt kleben.
Nachgeprüft (`grep -n "erg\.yards"`): jede ANDERE Stelle im Motor, die `erg.yards` liest
(`fg`/`punt`/`sack`/`fumble`/`komplett`/`lauf` in `vollziehFootballErgebnis()`), tut das nur
in Zweigen, wo `erg.yards` immer gesetzt ist — die animierte Flugbahn war die EINZIGE Stelle
mit dem Problem.

**Fix.** Ein Sichtweiten-Fallback auf die Tier-Mitte aus `FK_TIER_YARDS` (z. B. `fern` →
(9+20)/2 = 14,5 Yards), nur für die Animation:

```js
// vorher
const zielSpot=Math.max(0,Math.min(100,fb.spot-(erg.yards||0)));
// nachher
const sichtYards=erg.yards!=null?erg.yards
  :(erg.tier&&FK_TIER_YARDS[erg.tier]?(FK_TIER_YARDS[erg.tier][0]+FK_TIER_YARDS[erg.tier][1])/2:0);
const zielSpot=Math.max(0,Math.min(100,fb.spot-sichtYards));
```

`vollziehFootballErgebnis()` liest bei `incomplete`/`interception` an KEINER Stelle
`erg.yards` (beide Zweige rechnen ihren Feldstand-Übergang ohne Yards-Feld) — der Fix wirkt
also ausschließlich auf die Animation, nicht auf Down/Distance, Punktestand oder Rangtreue.
Bestätigt: `node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey` liefert
nach dem Fix exakt dieselben Zahlen wie vorher (Abschnitt 6).

**Nachgewiesen.** Vorher/Nachher-Screenshots eines `tief`-Zugs (identischer Spielzustand,
derselbe Spielername, derselbe Downfield-Ballträger): vor dem Fix stand der Ball über die
gesamte Flugdauer sichtbar neben dem Werfer; nach dem Fix liegt der Ball am Ende der
Flugbahn klar sichtbar ~125 px stromabwärts der Line of Scrimmage, deutlich getrennt von der
Formation um den Werfer. Zusätzlich in einem unabhängigen, nicht gezielt herbeigeführten
Spielverlauf (`sweep-g1-100s`) beobachtet: ein Ball mitten im Flug, klar abgesetzt von beiden
Formationsgruppen — derselbe Effekt, den der Fix beheben sollte, jetzt im normalen
Spielverlauf sichtbar statt nur im gezielt konstruierten Testfall.

## 5. Helm-Overlay: geprüft, diese Runde NICHT gebaut

`football-live-migration.md` Abschnitt 9.4 nannte das Helm-Overlay als mögliche kleine
Ergänzung, analog zu `zeichneHockeyschlaeger()`. Geprüft, ob das zutrifft:

- `zeichneHockeyschlaeger()` braucht einen Ankerpunkt (Handposition). Für die generisch
  gezeichnete „Reihermech"-Kreaturenklasse existiert ein solcher Punkt bereits
  (`kopfX`/`kopfY`, von `zeichneReiherMech()` zurückgegeben) — für diese Klasse wäre ein
  Helm-Overlay tatsächlich eine kleine Ergänzung.
- Für die **Vollbild**-Kreaturen (Golems, Roboter, viele der Fantasy-Charaktere, die einen
  typischen Football-Kader füllen — im Test-Kader dieser Runde z. B. Lava Golem, Greenkraut,
  Seraph-11, Krag'Zul) gibt es **keinen** generischen Kopfpunkt. Der bestehende
  `zeichneHockeyschlaeger()`-Aufruf für Vollbild-Kreaturen (engine.js ~2070) braucht dafür
  eine **eigene, pro Sprite gemessene** Tabelle (`VOLLBILD_SCHLAEGER`) — genau der Aufwand,
  den `docs/design/sprite-handpunkte.md` für die Hockeyschläger-Hand einmal komplett
  durchgemessen hat. Ein Helm-Overlay bräuchte dieselbe Arbeit noch einmal, für eine ANDERE
  Ankerstelle (Kopf statt Hand), über denselben Kreis an Sprites.
- Die dritte Sprite-Klasse (normale LPC-Körper-Sprites wie King Arlen M./Cassandra) hat
  überhaupt keinen im Code berechneten Kopfpunkt — sie werden als fertiges Bild gezeichnet,
  nicht prozedural, ein Helm-Ankerpunkt müsste hier ebenfalls erst am Sprite-Blatt vermessen
  werden.
- Nebenbefund: `docs/design/football-assets-check.png` zeigt, dass die drei
  `helmet_white*.png`-Sprites reine weiße Ringe ohne Detail sind — selbst mit einem
  Ankerpunkt wäre der visuelle Gewinn klein.

Ein Football-Kader besteht aus rein zufällig gezogenen Fantasy-Charakteren, keiner
kuratierten Menschen-Riege — die Mehrheit jeder Aufstellung fällt auf die Vollbild- oder
LPC-Klasse, nicht auf Reihermech. Ein Helm-Overlay, das nur für einen kleinen Teil der
möglichen Kader etwas zeichnet, wäre inkonsistent; eins, das für alle drei Klassen
funktioniert, ist ein eigenes Mess-Vorhaben von der Größenordnung von
`sprite-handpunkte.md`, keine kleine Ergänzung. **Entscheidung: diese Runde nicht gebaut**,
wie der Auftrag es für den Fall vorsah, dass sich der Aufwand als größer herausstellt als
erhofft. Bleibt offene Zukunftsarbeit.

## 6. Regressionskontrolle

`node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey` (kaderfest, frisch von
`origin/main` 3aaf943c gezogen, nach dem Rebase dieser Runde):

| Disziplin | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite | Abnahme |
|---|---:|---:|---:|---:|---|
| basketball | 0,757 | 0,102 | 0,923 | 0,231 | knapp |
| hockey | 0,589 | 0,292 | 0,748 | 0,105 | durchgefallen |
| football | 0,460 | 0,258 | 0,692 | 0,196 | durchgefallen |

Alle drei Zeilen **bit-identisch** zur Baseline-Messung ganz zu Beginn dieser Runde
(Abschnitt 1) bzw. zur zuletzt bekannten Hockey-Zahl aus `football-live-migration.md`
(0,589/0,292/0,748/0,105) — erwartbar, weil der einzige Codeeingriff dieser Runde
(Abschnitt 4) ausschließlich in `animiereFootballZug()` liegt, einer Funktion, die nur im
Football-Zweig aufgerufen wird, an keiner Stelle einen Zufallszug (`rr()`) auslöst und von
`vollziehFootballErgebnis()` nie gelesen wird — Hockey/Basketball sind durch reine
Code-Trennung betroffen, nicht nur laut Messung. `git diff --stat` zwischen dem
Branch-Ausgangspunkt und dem frisch gezogenen `origin/main` zeigte zusätzlich, dass seit dem
Abzweigen dieser Runde nur eine Doku-Datei (`docs/design/hockey-zoneneintritt-umsetzung.md`)
dazukam, kein Motor-Code — die Hockey-Zahl hier ist deshalb zugleich der aktuelle
`origin/main`-Stand.

**Randnotiz zur Messumgebung:** dieselbe Messung brauchte über weite Strecken dieser Runde
70-90 Minuten statt der üblichen unter einer Minute — mehrere parallele Agenten-Sitzungen
(Hockey, Gewichtheben) liefen zeitgleich im selben Container und haben die CPU zeitweise
vollständig ausgelastet. Nach Abklingen der Fremdlast (Load Average zurück auf <0,1) lief
dieselbe Messung in 35 Sekunden mit identischem Ergebnis — kein Hinweis auf einen echten
Hänger im Motor, nur auf geteilte Rechenzeit.

`node --check public/mockups/battle-mode.engine.js`: **bestanden**, vor und nach dem Fix.

`npm test`: die volle Suite (1024 Dateien) ließ sich in derselben überlasteten Umgebung nicht
sauber durchbekommen — ein erster Versuch im (damals noch geteilten) Hauptarbeitsverzeichnis
lief 58 Minuten und endete mit einem einzelnen Determinismus-Fehltreffer plus einem
Worker-Absturz, beides mit Timeout-Signatur; ein zweiter Versuch in dieser Runde eigenem,
isolierten Git-Worktree (Abschnitt 9) lief 38 Minuten und endete mit 1019 von 1025
Testdateien fehlgeschlagen — ebenfalls mit Worker-Emitted-Error/Timeout-Signaturen, nicht mit
inhaltlichen Assertion-Fehlern, ein eindeutiges Bild einer überlasteten, nicht einer kaputten
Umgebung (dieselbe Suite lief in ruhigeren Momenten dieses Projekts routinemäßig grün).
Deshalb stattdessen gezielt die neun Testdateien laufen lassen, die tatsächlich
`battle-mode.engine`/`mockups/battle-mode` referenzieren oder den Arena-Anschluss prüfen
(`arena-headless-runner`, `battle-mode-arena-resolve-engine`,
`battle-mode-arena-team-points`, `battle-mode-arena-matchday-resolve-e2e`,
`battle-zielansage-kontrakt`, `battle-arena-heal-attribution`,
`battle-arena-endscreen-tooltip-wurzel`, `battle-arena-ein-modell-ueberall`,
`battle-arena-rennplan-ansage`), mit `--no-file-parallelism` gegen genau denselben
Worker-Kontentions-Fehler: **9 Dateien, 66 Tests, alle bestanden**, in 189 Sekunden ohne
jeden Timeout/Worker-Fehler — der Kontrast zur Vollsuite bestätigt, dass die Vollsuite an der
Umgebung scheiterte, nicht am Code. Da Football laut `ARENA_RESOLVED_DISCIPLINE_IDS`
(Abschnitt 0/6, geprüft: weiterhin nur `["basketball"]`) nicht produktiv verdrahtet ist und
der Fix ausschließlich eine Mockup-interne Zeichenfunktion ändert, deckt diese gezielte
Teilmenge jeden Testpfad ab, den die Änderung überhaupt erreichen könnte.

## 7. Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — ein Fallback in `animiereFootballZug()` (Abschnitt
  4), sonst unverändert. Kein anderer Motor-Code berührt.

## 8. Ehrliches Fazit

**Football ist nach dieser Runde ein gutes erstes Bild, kein „fertiges Spiel"** — beides war
schon vor dieser Runde bekannt (Abschnitt 1) und bleibt so: rho je Spiel liegt mit 0,460
weiterhin klar unter der projektweiten 0,80-Schranke, „durchgefallen" nach der eigenen
Nomenklatur des Projekts. Diese Runde hatte explizit NICHT den Auftrag, das zu ändern — sie
sollte prüfen, ob Football zum jetzigen Rezept-Stand visuell das zeigt, was Chris am
02./03.09. verlangt hat (echte Spielzüge statt Klumpen, sichtbar unterschiedliche
Zugtypen), und genau das bestätigt sich: die zwei Formationen sind klar getrennt und über
die Feldbreite gefächert (Abschnitt 2), alle sieben Spielzug-Typen sind im Bild
unterscheidbar (Abschnitt 3), und der einzige während dieser Prüfung gefundene echte
Sichtfehler — eingefrorene Wurfweite bei unvollständigen/abgefangenen Pässen, der genau
Chris' Anspruch untergrub — ist behoben und ohne Nebenwirkung auf Rangtreue oder andere
Disziplinen verifiziert (Abschnitt 6). Das Helm-Overlay bleibt bewusst offen (Abschnitt 5) —
kein Rückschritt, sondern eine ehrliche Neueinschätzung: es ist mehr Arbeit, als der letzte
Bericht vermutet hatte, und lohnt eine eigene Runde mit eigenem Sprite-Vermessungs-Auftrag,
keine Nebenbei-Ergänzung.

Für „ein reasonabler Mensch schaut sich das an und ist für einen ersten Wurf zufrieden" (die
Formulierung aus Chris' Auftrag) reicht das: das Spielfeld zeigt erkennbare Formationen, echte
Downs, unterschiedliche Spielzüge mit unterschiedlichen Ball-Bahnen, und keinen der
UI-Fehler, die Chris' ursprünglicher Auftrag am 03.09. ausdrücklich ausschließen wollte
(Klumpen, eingefrorene Spieler). Was fehlt, ist an keiner Stelle dieser Runde ein Geheimnis:
die Rangtreue-Schranke (Abschnitt 1, unverändert offen), das Helm-Overlay (Abschnitt 5) und
die zwei in `football-rezept-kalibrierung.md` Abschnitt 6 benannten Mechanik-Hebel
(PASSSCHUTZ/ABWEHR_LAUF an die Auswahl koppeln, eine eigene Receiving-Rolle statt
TEAMGEIST-Zweckentfremdung).

## 9. Arbeitsumgebung dieser Runde — ein geteiltes Arbeitsverzeichnis

Bei Rundenbeginn lief in `/home/user/Olympiade-der-Welten` bereits ein anderer Agent
(Hockey, Branch `claude/hockey-zufriedenstellend`) — derselbe Auftrag von Chris lässt laut
Aufgabenstellung Hockey/Football/Gewichtheben parallel laufen, aber alle drei teilten sich
zeitweise dasselbe Arbeitsverzeichnis. Der erste `git checkout -b
claude/football-zufriedenstellend` gelang, wurde aber von der Hockey-Sitzung kurz darauf
wieder auf ihren eigenen Branch umgeschaltet — der zu dem Zeitpunkt unfertige Codeänderung
dieser Runde (Abschnitt 4) landete dadurch als nicht zugeordneter Uncommitted-Diff im
Arbeitsbaum. Die Hockey-Sitzung hat ihn korrekt erkannt, NICHT gelöscht, sondern mit einer
klaren Notiz weggesichert (`git stash`: „FREMD (nicht meins, nicht loeschen): unklarer
Football-Agent-Hunk"). Diese Runde hat den Stash in einem eigenen, isolierten
`git worktree` (`scratchpad/fb-work`, Vorbild: der bereits von der Gewichtheben-Sitzung
genutzte `scratchpad/gwh-work`) wiederhergestellt, dort committed und gepusht, und den
Stash danach aus dem gemeinsamen Repository entfernt, ohne den Branch/Arbeitsstand der
Hockey-Sitzung anzufassen. Der Rest dieser Runde (Rebase, Messung, Tests) lief vollständig in
diesem isolierten Worktree. Festgehalten, falls eine künftige Dreifach-Parallel-Runde
denselben Konflikt vermeiden will: von Anfang an einen eigenen `git worktree` statt des
gemeinsamen Arbeitsverzeichnisses nehmen.

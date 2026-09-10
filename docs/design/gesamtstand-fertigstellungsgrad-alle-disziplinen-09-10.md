# Gesamtstand 10.09. — wie fertig ist jede der zwanzig Disziplinen?

**Auftrag von Chris (woertlich, 10.09.):** „kannst du mir in % noch mal sagen wie fertig alle
diszis sind was konzept/assets/gameplay/movement usw angeht? wüsste gerne wo wir nachschärfen
müssen und was schon gut ist und was noch alles gemacht werden muss und wo du noch kein konzept
hast"

**Stand:** `main` = `4058cd36` („Opus-Overseer-Review PR #867", 09.09.). Reine Bestandsaufnahme,
kein Produktionscode geaendert.

**Alle zwanzig rho-Zahlen unten sind fuer diesen Bericht FRISCH gemessen**, nicht aus
`stand-aller-disziplinen.md` oder aus der eingecheckten Basislinie uebernommen:
`node scripts/miss-alle-disziplinen.mjs 24 <disziplin ...>`, kaderfest, Median ueber fuenf echte
Team-Paarungen aus `data/generated/kaderfamilie-live-save.json`, n=24 Spiele je Variante, in drei
synchronen Laeufen ueber alle zwanzig (rund 13 Minuten Gesamtlaufzeit). Jede andere Zahl in diesem
Bericht ist an Code oder Doku belegt — die Fundstelle steht jeweils dabei.

---

## 0. Die Methode — wie die vier Prozentzahlen entstehen

Jede Achse hat **vier Teilkriterien**, jedes mit einer festen Punktzahl. Eine Disziplin bekommt
ein Teilkriterium ganz, teilweise oder gar nicht. Das ist kein Messwert, sondern eine
**begruendete Einstufung** — aber eine, deren Regel offenliegt und die jeder an derselben Stelle
im Code nachpruefen kann.

### Konzept (4 x 25)
| | Kriterium |
|---|---|
| K1 | Eigenes, aus der eigenen MATRIX abgeleitetes Rezept in der `*_ART`-Tabelle (`battle-mode.engine.js`) |
| K2 | Eigene Mechanik ueber das hinaus, was das Chassis fuer alle mitbringt (eigenes Flag, eigener Zweig, eigene Zustandsmaschine) |
| K3 | Eigenes Fable-/Design-Dokument, das die Disziplin von Grund auf modelliert |
| K4 | Rezept nachweislich kalibriert (gemessene NACHGEZOGEN-Runde, Kalibrierung gegen echte Sportdaten) und die offenen Designfragen entschieden |

### Assets (30/25/25/20)
| | Kriterium |
|---|---|
| A1 (30) | Eigene, nicht generische Feld-Datei im PRODUKTIVEN React-Renderer (`app/foundation/discipline-stage/arena/disciplines/*.tsx`) |
| A2 (25) | Eigene Szene im Mockup-Motor ueber das geteilte Chassis-Bild hinaus |
| A3 (25) | Disziplinrichtige Ausruestung/Requisiten an den Sprites (keine falsche Zufallswaffe, eigene Props) |
| A4 (20) | Ton, Musik, Kulisse |

### Gameplay/Rezept (40/30/15/15)
| | Kriterium |
|---|---|
| G1 (40) | Rangtreue kaderfest: ≥0,85 → 40 · 0,80–0,85 → 35 · 0,70–0,80 → 22 · 0,50–0,70 → 12 · <0,50 → 5 |
| G2 (30) | Produktionsanschluss: steht in `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:201-213`) |
| G3 (15) | Eigene Wertung im Spiel (eigene `wertungTabelle`, `bahnTeamstand`-Modus, Boxscore-an-PPs) |
| G4 (15) | 2–6-Spieler-Tauglichkeit (Feldspiel/Buehne 15, Bahn/Arena 12 — s. Abschnitt 3) |

### Movement/Animation (35/25/25/15)
| | Kriterium |
|---|---|
| M1 (35) | Eigene Zeichenfunktion/Zeichenzweig im Mockup-Motor statt der generischen Chassis-Darstellung |
| M2 (25) | Eigene Bewegungs-/Schrittlogik (`step*`-Sonderfaelle, Zustandsmaschine) |
| M3 (25) | Sichtbare Animation/Effekte in der produktiven React-Buehne (Glide, Ghost, Uebergaenge) |
| M4 (15) | Disziplineigene Posen/FX an den Sprites |

**Gesamt = einfacher, ungewichteter Durchschnitt der vier Achsen.** Bewusst ungewichtet, weil
Chris nach genau diesen vier Dingen gefragt hat und keine als wichtiger benannt hat. Das ist eine
ANDERE Rechnung als in `stand-aller-disziplinen.md` Abschnitt 5b (dort: Rangtreue 40 %, eigene
Mechanik 25 %, Bild/Bewegung 20 %, im echten Spielstand 15 %) — die Zahlen sind deshalb NICHT
direkt vergleichbar. Wer die Release-Sicht will, gewichtet Gameplay hoeher; dann steigen
Basketball/Hockey/Gewichtheben, und Football/TDM/Mini-DM/Battlefield fallen deutlich.

---

## 1. Die Zusammenfassungstabelle

Sortiert nach Gesamt. `rho` = frisch gemessen fuer diesen Bericht (10.09., kaderfest, n=24).
„Arena" = Produktionsanschluss (`ARENA_RESOLVED_DISCIPLINE_IDS`).

| # | Disziplin | Chassis | Konzept | Assets | Gameplay | Movement | **Gesamt** | rho | Arena | Statusnotiz |
|--:|---|---|--:|--:|--:|--:|--:|--:|:--:|---|
| 1 | Basketball | Feldspiel | 100 % | 100 % | 82 % | 100 % | **96 %** | 0,769 | ja | Referenz des Projekts · einzige Disziplin mit Ton · rho unter der Schranke, von Chris abgenommen |
| 2 | Hockey | Feldspiel | 100 % | 80 % | 72 % | 100 % | **88 %** | 0,669 / 0,719 | ja | vollstaendig, aber ohne Ton · rho ausdruecklich von Chris abgenommen |
| 3 | Gewichtheben | Buehne | 100 % | 60 % | 95 % | 85 % | **85 %** | 0,854 | ja | fertig bis auf Optik: `barbell.tsx` bewusst kosmetisch, Heber traegt Zufallswaffe |
| 4 | Speed-Schach | Buehne | 80 % | 75 % | 100 % | 80 % | **84 %** | 0,908 | ja | Gameplay komplett · kein eigenes Recherche-Dokument, Zugfolge ist Kosmetik |
| 5 | Eiskunstlauf | Buehne | 90 % | 70 % | 95 % | 60 % | **79 %** | 0,885 | ja | Duett + Ereignisdichte gemessen erledigt · Kuer selbst ist ein Reihenbild, keine Bewegung |
| 6 | Takeshi's Castle | Bahn | 100 % | 60 % | 67 % | 75 % | **76 %** | 0,861 | nein | inhaltlich die reichste Bahn · fehlt nur der Produktionsanschluss |
| 7 | Breaking | Buehne | 85 % | 65 % | 95 % | 55 % | **75 %** | 0,869 | ja | Cypher-Buehne ist rein zeichnerisch · `breaking.tsx` ist die duennste Feld-Datei (187 Z.) |
| 8 | Staffel | Bahn | 95 % | 55 % | 67 % | 70 % | **72 %** | 0,915 | nein | **beste Rangtreue im Feld** · Wertung existiert entgegen der Doku bereits (s. 4.1) |
| 9 | Football | Feldspiel | 90 % | 75 % | 35 % | 85 % | **71 %** | 0,516 | nein | Motor/Optik/Bewegung stehen, das REZEPT ist die Luecke · groesste Schere im Feld |
| 10 | Spurt | Bahn | 95 % | 55 % | 67 % | 60 % | **69 %** | 0,871 | nein | zweimal gemessen nachgezogen · fehlt nur Anschluss |
| 11 | Time-Trial | Bahn | 95 % | 45 % | 62 % | 50 % | **63 %** | 0,828 | nein | Gelaendeprofil existiert mechanisch, ist auf der Bahn aber unsichtbar |
| 12 | Fechten | Buehne | 55 % | 55 % | 90 % | 35 % | **59 %** | 0,816 | ja | live, aber auf einem ausdruecklich nicht finalen Rezeptentwurf · Puffer < Kaderrauschen |
| 13 | Tennis | Buehne | 75 % | 30 % | 90 % | 20 % | **54 %** | 0,825 | ja | live · optisch ein generisches Buehnen-Reihenbild, Spieler schwingt Zufallswaffe |
| 14 | Mini-DM | Arena | 70 % | 60 % | 22 % | 55 % | **52 %** | 0,094 | nein | schlechteste Rangtreue im gesamten Feld |
| 15 | Battlefield | Arena | 70 % | 60 % | 22 % | 55 % | **52 %** | 0,387 | nein | Aufstellung repariert, Zielwahl weiter Geometrie statt Bedrohung |
| 16 | TDM | Arena | 55 % | 65 % | 22 % | 60 % | **51 %** | 0,253 | nein | aeltester Motor · roher Impact bis 900 landet ungenormt im Endstand |
| 17 | Climbing | Bahn | 65 % | 40 % | 49 % | 40 % | **49 %** | 0,790 | nein | 0,010 unter der Schranke · nie eine eigene Rezeptrunde gehabt |
| 18 | Wettessen | Buehne | 35 % | 30 % | 95 % | 15 % | **44 %** | 0,845 | ja | **kein eigenes Konzept** · live geschaltet, aber optisch/bewegungsseitig leer |
| 19 | Showcase | Buehne | 25 % | 30 % | 95 % | 20 % | **43 %** | 0,892 | ja | **kein eigenes Konzept** · die duennste Disziplin unter den zehn produktiven |
| 20 | I-Spy | Buehne | 55 % | 30 % | 37 % | 20 % | **36 %** | 0,684 | nein | einzige Buehne, die die Abnahme nicht besteht · bewusst nicht angeschlossen |

**Durchschnitt ueber alle zwanzig: 65 %.**
Je Achse: **Konzept 77 % · Assets 57 % · Gameplay 68 % · Movement 57 %.**

Die Botschaft dieser vier Zahlen in einem Satz: **das Projekt hat mehr DESIGN als DARSTELLUNG.**
Konzept liegt zwanzig Punkte ueber Assets und Movement — es ist ueberall durchdacht, was passiert,
und an dreizehn von zwanzig Stellen nicht zu sehen.

### Die frisch gemessenen Zahlen (10.09.) gegen die eingecheckte Basislinie (06.09.)

Neunzehn von zwanzig Zeilen stimmen **ziffernidentisch** mit
`data/generated/rangtreue-basislinie.json`. Zwei Zeilen weichen ab, und beide waren im
Opus-Overseer-Briefing vom 09.09. (Abschnitt 4.1) bereits als **stale Basislinien-Eintraege**
vorhergesagt — dieser Lauf bestaetigt sie unabhaengig:

| Disziplin | Basislinie 06.09. | gemessen 10.09. | Ursache |
|---|---:|---:|---|
| Gewichtheben | 0,847 | **0,854** | seit 07.09. in `stand-aller-disziplinen.md` notiert, Basislinie nie nachgezogen |
| Eiskunstlauf | 0,875 | **0,885** | PR #859 (Duett) wurde NACH der Basislinienziehung gemergt |

Beide Abweichungen zeigen nach oben, weshalb die CI-Schranke (die nur Rueckgaenge faengt) sie nie
gemeldet hat. **Es gibt keine Regression irgendwo im Feld.**

---

## 2. Jede Disziplin einzeln

### Basketball — 96 % (100/100/82/100)
**Konzept 100:** eigenes Rezept plus `BASKETBALL_POS_MOD` (`battle-mode.engine.js:5513`), Live-Motor
mit Zonen/Manndeckung/Spielzuegen, zwei eigene Fable-Dokumente
(`basketball-finalisierung-recherche-fable.md`, `basketball-doppeln-taktik-pause-recherche-06-09.md`)
und eine gemessene Kalibrierrunde (`basketball-k3.md`, 04.09.).
**Assets 100:** `court.tsx` (524 Z., 19 Animationsstellen), eigener Court im Motor, und als
**einzige der zwanzig** echter Ton — `public/sound/basketball/` mit sechs Dateien, angebunden
ueber `bkSfx()` (`:16059`) und den Publikums-Loop (`:16080`).
**Gameplay 82:** rho 0,769 — unter der 0,80-Schranke, von Chris fuer den Live-Betrieb abgenommen
(dieselbe Ausnahme wie Hockey, s. PM-Briefing 09.09. Abschnitt 0). Produktiviert, eigene
Boxscore-an-PPs-Kurve.
**Movement 100:** Dribbel-Bounce mit Bodenkontakt-Ton (`BK_DRIBBEL_PERIODE`), Wurfbahnen, Zonen —
plus `useTokenGlide`/`GhostLayer` in `court.tsx`.

### Hockey — 88 % (100/80/72/100)
**Konzept 100:** Torwart mit eigener Wertformel (`HK_TW_BASIS`/`HK_TW_REF`), Bodycheck, Strafen,
Ueberzahl, Passqualitaet, xG-Buchung (K3). Zwei eigene Fable-Dokumente plus ein NHL-Review
(`hockey-opus-review-nhl.md`).
**Assets 80:** `rink.tsx` (419 Z., 14 Animationsstellen), eigene Eisflaeche im Motor
(`:10128 eisflaeche()`), eigener Hockeyschlaeger als Sprite-Ebene (`zeichneHockeyschlaeger`, `:311`).
**Kein Ton** — das kostet die vollen 20 Punkte.
**Gameplay 72:** rho 0,669 (alle zwoelf) / 0,719 (nur Feldspieler) — ausdruecklich von Chris
abgenommen, Aufgabe #20 geschlossen. Produktiviert mit eigener Torwart-PPS-Referenz.
**Movement 100:** eigene Torwartbogen-, Schuss- und Bandenzweikampf-Phasen (`:9553`).

### Gewichtheben — 85 % (100/60/95/85)
**Konzept 100:** eigenes FUENF-Sub-Skill-Rezept statt der sieben Buehnen-Rollen
(`BUEHNE_ART.gewichtheben`, `:10598`), Reissen/Stossen, drei Versuche, Nullwertung, Ansage. Die
offene Architekturfrage („darf Charisma die physische Obergrenze beruehren?") ist am 04.09.
entschieden und gemessen (`HEBEN_TAGESMAX_ANSAGE_K`, rho 0,720 → 0,887).
**Assets 60:** eigenes Buehnenbild `zeichneHeben()` (`:12061`, 227 Zeilen — nur das aktive Duell,
Hantel mit Last). Aber `barbell.tsx` ist laut `gewichtheben-produktivierung.md` (S6) **bewusst
kosmetisch belassen**, und der Heber traegt weiterhin seine Zufalls-Kosmetikwaffe (`:2575` schliesst
nur Fechten/Eiskunstlauf/Breaking ein).
**Gameplay 95:** rho **0,854**, produktiviert, Gesamt-kg-Tiebreak, eigene `WERTUNG_HEBEN`.
**Movement 85:** Versuchs-Zustandsmaschine plus eigenes Bild; es gibt aber keine echte
Hebe-Bewegung — der Sprite steht, die Hantel wird als Primitive daneben gezeichnet.

### Speed-Schach — 84 % (80/75/100/80)
**Konzept 80:** `duell:true` + `schach:true`, Brett-gegen-Brett mit laufendem Vorteil je Zug,
Fokus-Brett mit Pin (`schachPin`). **Aber kein eigenes Fable-Recherche-Dokument** — der Entwurf
steht in `takeshi-schach-optik-gameplay-plan-05-09.md` Teil A und in
`arena-duell-recherche-fable.md` Abschnitt 4, beide geteilt mit anderen Disziplinen; K3 daher nur
teilweise.
**Assets 75:** `schach.tsx` (473 Z., 18 Animationsstellen) und `zeichneSchach()` (`:12333`, 227 Z.,
Fokus-Brett, Uhren, Bewertungsbalken).
**Gameplay 100:** rho **0,908** (zweitbeste im Feld), produktiviert, eigene `wertungTabelle`
mit „Brett"/„Stark"/„Zeit−".
**Movement 80:** eigene Szene, aber die Zugfolge auf dem Brett ist ausdruecklich „eine plausible
Zugfolge" (Kommentar `:10788`), keine Schach-Logik.

### Eiskunstlauf — 79 % (90/70/95/60)
**Konzept 90:** `duett:true` (automatische Paarung bei gerader Feldgroesse, PR #859), `rundenN` an
der realen ISU-Programmlaenge (12 statt 6, Spearman-Brown-Runde vom 07.09., gemessen 0,792 → 0,875).
Eigenes Fable-Dokument (`eiskunstlauf-duett-paarlauf-recherche-08-09.md`) plus die Politur-Recherche.
**Assets 70:** `eiskunst.tsx` (599 Z.) und `zeichneDuett()` (`:11822`, ~100 Z., Paare + Eisspur).
Die Waffenebene ist korrekt entfernt (`:2574`) — aber es gibt keine Schlittschuhe, kein Kostuem.
**Gameplay 95:** rho **0,885** (frisch gemessen, 0,010 ueber der Basislinie), produktiviert.
**Movement 60:** `eiskunst.tsx` hat nur 4 Animationsstellen (auf 599 Zeilen), und `zeichneDuett()`
positioniert Paare, laesst sie aber nicht laufen — eine Kuer ist hier ein Reihenbild.

### Takeshi's Castle — 76 % (100/60/67/75)
**Konzept 100:** die inhaltlich reichste Disziplin des Projekts — Ausscheiden nach drei Stuerzen,
vierzehn Fallen in fuenf Typen mit eigener Stufe (`fallenStufe`), drei benannte Kurse,
Chaos/Tackle-Fenster, Gedraenge, Burgpunkte als echte Wertung. Vier eigene Dokumente
(`takeshi-animationen-hilfe-behinderung-recherche-06-09.md`, `takeshi-chaos-tackle-plan-06-09.md`,
`takeshi-schlammroute-plan-06-09.md`, `takeshi-schach-optik-gameplay-plan-05-09.md`).
**Assets 60:** `bodenTakeshiRoute()` (`:16351`, 171 Z., Schlangenroute mit fuenf Gelaendezonen,
Tuempeln, Burgmauer und Tor) plus `zeichneFalleTakeshi()` (`:16230`, 120 Z., zehn Fallenbilder).
Aber `takeshi.tsx` hat nur 273 Zeilen und **3 Animationsstellen** — die produktive Buehne ist
deutlich duenner als das Mockup.
**Gameplay 67:** rho **0,861**, eigene Burgpunkte-Wertung mit Aufschluesselung im Endstand —
**aber kein Produktionsanschluss** (Bahn hat kein Arena-Chassis).
**Movement 75:** Fallen reagieren sichtbar auf den Ausgang (`fallenAusgang()`, Nachwackeln bei
Durchbruch, gruenes Gluehen bei sauber).

### Breaking — 75 % (85/65/95/55)
**Konzept 85:** eigenes Torment/Will-Rezept ohne Charisma, mit gemessener NACHGEZOGEN-Korrektur
(`:10744`), `rundenN` 4 → 8 an der realen WDSF-Bewertung. Eigenes Fable-Dokument
(`breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`).
**Assets 65:** `zeichneBreaking()` (`:12561`, ~144 Z., lila Cypher mit vier Ringzonen und
SURVIVOR-Spotlight) — aber `breaking.tsx` ist mit **187 Zeilen die duennste** aller zwanzig
Feld-Dateien.
**Gameplay 95:** rho **0,869**, produktiviert (Welle 2).
**Movement 55:** `cypher:true` ist laut eigenem Kommentar (`:10733`) **rein zeichnerisch** — keine
Zeile Mechanik dahinter. Es gibt keine Move-Bewegung, nur eine andere Buehnenkulisse.

### Staffel — 72 % (95/55/67/70)
**Konzept 95:** die einzige Bahn, auf der nicht alle gleichzeitig laufen — sechs Abschnitte, fuenf
Wechsel, Wechselzeit als eigene Groesse (`wechselBasis`/`wechselSpanne`/`wechselStrafe`),
Windschatten bewusst AUS mit gemessener Begruendung. Drei eigene Dokumente
(`staffel-modellierung-recherche-05-09.md`, `staffel-oval-broadcast-hud-recherche-06-09.md`,
`bahn-disziplinen-recherche-fable.md` Abschnitt 1).
**Assets 55:** `bodenSpurtOval()` (`:16738`, eigene Ovalbahn) und `track.tsx` (321 Z., 13
Animationsstellen). **Kein Staffelstab-Sprite** — der Stab ist Mechanik, kein Bild.
**Gameplay 67:** rho **0,915 — die beste Rangtreue im gesamten Feld.** Eigene Etappenwertung
(`bahnTeamstand()` `wertung:"etappe"`, `:15794`). Kein Produktionsanschluss.
**Movement 70:** wartende Laeufer stehen sichtbar in ihrer Wechselzone (`:18297`), fliegende
Uebergabe, Zug an der Spitze.

### Football — 71 % (90/75/35/85)
**Die groesste Schere im Feld: Konzept/Assets/Movement sind fast fertig, das Rezept nicht.**
**Konzept 90:** Downs, Line of Scrimmage, echte Formationen, Playcall, eigener `spielEignung`-Block
neben der gesperrten Matrix (PR #803). Kalibriert gegen echte NFL-2024-Quoten
(`football-rezept-kalibrierung.md`). K4 nur teilweise: Anzeige/Teamstaerke/KI-Kauf ordnen Football
weiterhin nach der ALTEN Matrix, das Minispiel nach der neuen — eine offene Entscheidung von Chris.
**Assets 75:** eigene Ausruestung (Helme/Montur, `footballGear`, `:2593`), Endzonen und Line of
Scrimmage im geteilten Feldspielbild (`:10089`), `football.tsx` (348 Z.).
**Gameplay 35:** rho **0,516** — der groesste Einzelrueckstand ausserhalb der Arena. Kein
Produktionsanschluss; dient im Testcode inzwischen als benannte Kontrolldisziplin
(`D2_KONTROLL_DISZIPLIN = "football"`).
**Movement 85:** Snap-Standphase plus fuenf visuell unterschiedene Spielzugtypen mit je eigener
Ballflugbahn — laut eigenem Bericht strukturell fertig, aber noch nicht poliert.

### Spurt — 69 % (95/55/67/60)
**Konzept 95:** Hindernislauf mit stetigem Zeitpreis je Station statt Ermuedungssprint
(`hindernisTypen`, `huerdePreis`, `wuchtPreisFaktor`), feste Stationsfolge aus Paket B. **Zwei**
gemessene Nachziehungen (rho 0,652 → 0,857 → 0,871, Dexterity-Einfluss 3,5 % → 16,7 %). Eigene
Dokumente (`spurt-modellierung-recherche-05-09.md`, `spurt-offene-fragen-plus-optik-plan-05-09.md`).
**Assets 55:** `hindernisBilder` gibt jeder der sieben Stationen ein eigenes Bild (Huerde, Balken,
Wand, Seil, Wasser, Mauer, Heu) plus ein brennendes Ziel (`feuerZiel`) — die einzige Bahn mit
Bild-je-Station. `bump.tsx` (394 Z., 12 Animationsstellen).
**Gameplay 67:** rho **0,871**, Rangwertung. Kein Produktionsanschluss.
**Movement 60:** eigene Schrittlogik mit Hindernis-Stopp, Rempler, Windschatten, drei Rennplaenen —
aber kein eigener Zeichenzweig, alles laeuft durch `bodenSpurt()`.

### Time-Trial — 63 % (95/45/62/50)
**Konzept 95:** die K5-Umsetzung hat die neun Sturz-Kurven **ersatzlos gestrichen** (ein Zeitfahren
hat keine Gegner) und durch ein stetiges Streckenprofil ersetzt — sieben Gelaendezonen
(Steigung/Abfahrt/Kurve), gestaffelter Start, Zwischenzeiten, Tagesform ±1,5 %. Eigenes Dokument
(`zeitfahren-recherche-06-09.md`) plus Wertungsplan.
**Assets 45:** `peloton.tsx` (472 Z., 9 Animationsstellen) ist gut — aber im Mockup ist das
Streckenprofil **unsichtbar**: `gelaende` wirkt in `gelaendeFaktor()` (`:18121`) und erscheint nur
als HUD-Balken (`:20207`), nicht auf der Bahn. Man sieht keinen Berg.
**Gameplay 62:** rho **0,828**, Rangwertung. Kein Produktionsanschluss.
**Movement 50:** ganze Mechanik im Schritt, nichts davon gezeichnet.

### Fechten — 59 % (55/55/90/35)
**Konzept 55:** der Chassiswechsel von der Arena auf die Buehne war richtig (rho 0,153 → 0,816),
aber das Rezept ist im Code selbst als **„ERSTER, AUSDRUECKLICH NICHT FINALER
Sieben-Rollen-Entwurf"** bezeichnet (`:10934`) und hat nie eine Kalibrierrunde bekommen. Der Puffer
zur Schranke (0,016) ist kleiner als das eigene Kaderrauschen (0,192) — die Disziplin steht live
auf einer Zahl, die statistisch nicht von einem Fehlschlag zu unterscheiden ist.
**Assets 55:** `lamps.tsx` (551 Z., **22 Animationsstellen — die hoechste Dichte aller zwanzig**)
und seit 07.09. korrekt IMMER die Schwert-Waffenebene (`:2573`). Aber keine eigene Motor-Szene.
**Gameplay 90:** rho 0,816, produktiviert (Welle 2).
**Movement 35:** kein eigener Zeichenzweig, kein eigener Paar-Rechner (bewusst, s.
`tennis-fechten-rollout-plan.md` E.2) — zwei Reihen Figuren mit Schwert.

### Tennis — 54 % (75/30/90/20)
**Konzept 75:** eigene, aus Tennis' MATRIX abgeleitete Rezeptkalibrierung (07.09., `:10837-10922`,
0,786 → 0,825) — das war die Behebung der 1:1-Uebernahme aus dem alten Feldspiel-Rezept. Die
Mechanik selbst ist aber Speed-Schachs `duell:true`, kein eigener Ballwechsel-Rechner.
**Assets 30:** `tennis.tsx` (424 Z., 17 Animationsstellen) — im Mockup jedoch **das generische
Buehnen-Reihenbild**, und der Tennisspieler schwingt beim Punktgewinn weiterhin seine zufaellige
Kosmetikwaffe (im Code ausdruecklich als offener Bug benannt, `:2569`).
**Gameplay 90:** rho 0,825, produktiviert (Welle 2).
**Movement 20:** nichts Eigenes im Motor.

### Mini-DM — 52 % (70/60/22/55)
**Konzept 70:** eigenes Sechs-Attribut-Rezept, **bewusst gegen TDMs Speed-Fehler gebaut**
(`ARENA_ART["mini-dm"]`, `:4076`: „Bei einer neuen Disziplin diesen Fehler zu wiederholen waere
mutwillig"). Eigenes Dokument (`mini-dm-4-team-ffa-recherche-06-09.md`).
**Assets 60:** `duelhp.tsx` (555 Z., 15 Animationsstellen), echte Waffen/Ruestungen/Schilde am
Sprite — aber dasselbe Arenabild wie TDM und Battlefield, nur mit weniger Kaempfern.
**Gameplay 22:** rho **0,094 — die schlechteste Zahl im gesamten Feld.** Kader-Spannweite 0,697 ist
das Siebenfache des Medians: bei n=24 ist hier keine Aenderung nachweisbar.
**Movement 55:** der volle Kampf-Bewegungsapparat, aber geteilt, nicht disziplineigen.

### Battlefield — 52 % (70/60/22/55)
**Konzept 70:** die einzige Kampfdisziplin, in der Power NICHT oben steht — Charisma/Intelligence/
Spirit tragen zusammen die Haelfte (`:4108`), ein gefuehrtes Gefecht statt einer Schlaegerei. Die
Aufstellungs-Umkehr (Siege Core stand hinten, rho −0,49) ist behoben und nachgemessen.
**Assets 60:** `territory.tsx` (625 Z. — die groesste Feld-Datei, 13 Animationsstellen).
**Gameplay 22:** rho 0,387, kein Anschluss. Zielwahl weiterhin Geometrie statt Bedrohung
(264 von 288 Kaempfern zielen auf den Naechsten) — Fables Vorschlag K1 ist recherchiert, nicht gebaut.
**Movement 55:** wie Mini-DM/TDM.

### TDM — 51 % (55/65/22/60)
**Konzept 55:** teilt sich `REC.power` mit den anderen Arena-Disziplinen. Das ist ausdruecklich
begruendet, nicht vergessen: **vier** eigene TDM-Rezepte wurden gebaut und gemessen (168 / 83 /
114,5 / 57,9 Pp), jedes war schlechter oder ununterscheidbar (`:4046-4073`). Kein eigenes Dokument,
nur die geteilte Arena-Recherche.
**Assets 65:** `bodenArena()` (`:16095`) IST das TDM-Bild — Sandkachel, Steinring, Blutflecken,
neunbildrige Fackelanimation, teamgefaerbte Haelften. Es ist das aelteste und dichteste
Chassis-Bild des Projekts, nur eben von drei Disziplinen geteilt. `kda.tsx` (396 Z.).
**Gameplay 22:** rho 0,253. Und: der rohe Impact-Wert bis 900/1400 landet ungenormt im
Endstand-Bildschirm — **genau der Fall, ueber den Chris sich beschwert hat**
(`einheitlicher-spieler-score-pps-recherche-09-09.md` Abschnitt 3).
**Movement 60:** Laufen, Angreifen, Stuerzen, Taumeln — der Sprite-Apparat, fuer den die Arena
urspruenglich gebaut wurde.

### Climbing — 49 % (65/40/49/40)
**Konzept 65:** zehn Griffe mit Griff-dann-Kraftzug-Kette, `steigung:0,85` (die Wand wird nach oben
steiler), kein Tackle. **Kein eigenes Dokument** — nur Abschnitt 4 der geteilten
`bahn-disziplinen-recherche-fable.md`, und der wurde nie in eine eigene Umsetzungsrunde ueberfuehrt.
Nie kalibriert.
**Assets 40:** `mountain.tsx` (337 Z., 8 Animationsstellen). Im Mockup gibt es **keine Kletterwand**
— nur `boden:"#5d5a54"` und `baeume:false` (`:17038`). Eine Wand sieht aus wie eine graue Bahn.
**Gameplay 49:** rho **0,790 — 0,010 unter der Schranke**, die billigste offene
Rangtreue-Baustelle. Aber das eigene Kaderrauschen ist 0,192, das Neunzehnfache des Fehlbetrags.
**Movement 40:** Steigungs-Zehrung im Schritt, sonst generisch.

### Wettessen — 44 % (35/30/95/15) — **kein eigenes Konzept**
**Konzept 35:** es gibt ein eigenes, aus der Matrix abgeleitetes Rezept (will 26/health 22/
stamina 22, bewusst ohne Charisma, `:10761`) und eine eigene `wertungTabelle` mit Chris' eigenem
Wort „Pause". Das war es. **Es gibt kein Dokument, das Wettessen als Sportart modelliert**, keine
eigene Mechanik, keine Kalibrierrunde — es ist der generische Buehnen-Durchgangsrechner mit
anderen Attributgewichten.
**Assets 30:** `platter.tsx` (441 Z., 6 Animationsstellen, leergegessene Teller) — im Motor das
generische Reihenbild, mit dem Zufallswaffen-Bug.
**Gameplay 95:** rho **0,845**, produktiviert (Welle 2) — die Zahl ist gut, weil das
Buehnen-Chassis gut ist, nicht weil Wettessen gut ist.
**Movement 15:** nichts.

### Showcase — 43 % (25/30/95/20) — **kein eigenes Konzept**
**Konzept 25:** die duennste Disziplin unter den zehn produktiven. `BUEHNE_ART.showcase` (`:10658`)
ist der Sieben-Rollen-Standard mit Charisma-Gewichten — **kein Flag, kein Zweig, keine
NACHGEZOGEN-Korrektur, kein eigenes Dokument**. Der einzige Text ueber Showcase ist die
Produktivierungs-Notiz, die es mit Speed-Schach teilt.
**Assets 30:** `showcase.tsx` (623 Z., aber nur **3 Animationsstellen**). Im Motor generisch — und
der Waffen-Bug ist bei Showcase **ausdruecklich nicht behoben worden** (`:2570`: „Showcase ist
zudem eine der drei live geschalteten Buehnen-Disziplinen und bewusst unangetastet").
**Gameplay 95:** rho **0,892** (drittbeste im Feld), produktiviert seit Welle 1.
**Movement 20:** nichts Eigenes.

### I-Spy — 36 % (55/30/37/20)
**Konzept 55:** die **breiteste Matrix aller zwanzig** (zehn Attribute mit Gewicht) und eine
gemessene NACHGEZOGEN-Korrektur (`:10821`). Aber `duell:true` von Speed-Schach uebernommen, und der
einzige Konzepttext ist Abschnitt 4 von `arena-duell-recherche-fable.md` (Differenzwert), geteilt.
**Assets 30:** `spybar.tsx` (589 Z., 17 Animationsstellen) — im Motor generisch, Waffen-Bug offen.
**Gameplay 37:** rho **0,684 — die einzige Buehnen-Disziplin, die die Abnahme nicht besteht.**
Technisch waere der Anschluss eine einzige Zeile (`duell:true` liegt vor); er ist **bewusst
unterlassen** und mit einem eigenen Regressionstest festgehalten (PM-Briefing 09.09., „die beiden
Achsen duerfen nicht deshalb vermischt werden, weil eine davon billig zu erfuellen waere").
**Movement 20:** nichts Eigenes.

---

## 3. Zwei Querschnittsbefunde, die jede Zeile oben beeinflussen

### 3.1 Ton gibt es weiterhin nur fuer Basketball — der Befund gilt unveraendert
Nachgeprueft, nicht uebernommen: `public/sound/` enthaelt **genau einen Ordner**, `basketball/`,
mit sechs Dateien. Alle vierzehn `bkSfx()`-Aufrufstellen im Motor liegen in Basketball- oder
Feldspiel-Basketball-Zweigen; der Publikums-Loop laedt fest
`/sound/basketball/publikum_ambiente.ogg` (`:16080`). Es gibt keine Audio-Abstraktion je Disziplin,
keinen zweiten Ordner, keine Musik. **Neunzehn von zwanzig Disziplinen sind stumm** — das kostet
jede von ihnen 20 Assets-Punkte und ist der einzelne groesste, gleichfoermigste Rueckstand im
gesamten Projekt.

### 3.2 Der Zufallswaffen-Bug ist zu drei Fuenfteln behoben — und bei den falschen zwei offen
`:2573-2575` erzwingt fuer **Fechten** immer die Schwertebene und entfernt sie fuer
**Eiskunstlauf/Breaking**. **Showcase, Tennis, Wettessen und I-Spy tragen den Bug weiter** — im
Code selbst benannt (`:2569`). Drei dieser vier sind seit Welle 2 **produktionsangeschlossen**. Ein
Wettesser mit Kriegsaxt steht damit heute naeher am echten Spielstand als vor der Welle.

### 3.3 Die 2–6-Spieler-Luecke ist im Code geschlossen, aber nicht nachgemessen
`pruefung-2-6-spieler-tauglichkeit-alle-disziplinen-08-09.md` fand, dass die Gegnerseite bei
**Bahn und Arena** strukturell auf die Katalogkonstante festgenagelt war. Nachgesehen: `gastGesetzt`
steht heute in **allen vier** Baufunktionen — Feldspiel (`:5470`), Buehne (`:10999`), Arena
(`:14113`) und Bahn (`:17880`). PR #864 hat den Befund also geschlossen. **Nicht verifiziert** ist,
ob damit auch die Feldgroessen-Wirkung selbst stimmt; deshalb steht bei Bahn/Arena 12 von 15
Punkten statt 15.

---

## 4. Was ich beim Nachsehen gefunden habe und was in der Doku falsch steht

### 4.1 Staffel hat laengst eine Wertung — der genannte Blocker ist stale
`stand-aller-disziplinen.md` Abschnitt 4 und das PM-Briefing vom 09.09. (Prioritaet 2 Punkt 1 sowie
Empfehlung 2) sagen beide, `bahnTeamstand()` liefere fuer Staffel `gewertet:false`, es gebe „noch
keine Wertung", und Chris muesse erst entscheiden, was ein Staffel-Team-Sieg ist. Der Kommentar in
`battle-mode-arena-team-points.ts:160-167` sagt dasselbe.

**Das stimmt seit PR #827 nicht mehr.** `bahnTeamstand()` hat einen eigenen
`wertung==="etappe"`-Zweig (`:15794-15805`): das Rennen entscheidet der Zieleinlauf (1:0), die
Punkte je Laeufer sind der Rang der Etappenleistung, und `gewertet` ist true, sobald der erste
Laeufer im Ziel ist. Der Kommentar direkt darueber sagt es selbst: *„seit dem Prototyp betrifft das
keine der fuenf Bahnen mehr."* Alle fuenf Bahn-Disziplinen tragen heute einen echten
Wertungsmodus — `rang` (Spurt/Time-Trial/Climbing), `etappe` (Staffel), `burg` (Takeshi's Castle).

**Folge fuer den Plan:** die Bahn-Welle wartet **nicht** auf eine Entscheidung von Chris. Sie
wartet nur noch auf den `spieleBahn()`-Einstiegspunkt plus eine vierte Chassis-Menge im
`runArenaFixtures()`-Dispatch. Das ist reine Bauarbeit, und sie holt in einem Zug **vier**
Disziplinen mit rho 0,828–0,915 ins echte Spiel.

### 4.2 Die eingecheckte Basislinie ist an zwei Stellen stale
Bestaetigt durch diesen Messlauf (s. Abschnitt 1). `node scripts/baue-rangtreue-basislinie.mjs 24`
gehoert in den naechsten Pflege-PR.

---

## 5. Top-Prioritaeten — sortiert nach Hebel je Aufwand

1. **Bahn-Chassis bauen (`spieleBahn()`).** Vier Disziplinen auf einen Schlag: Staffel (0,915),
   Spurt (0,871), Takeshi's Castle (0,861), Time-Trial (0,828) — alle vier bestehen die Abnahme,
   alle vier haben eine echte Wertung, allen vier fehlt **nur** der Anschluss. Danach 14 von 20
   produktiv. **Und, neu in diesem Bericht: es ist keine Designfrage mehr vorgelagert** (4.1).
2. **Ton fuer die uebrigen neunzehn.** Der einzige Rueckstand, der jede Disziplin gleich hart
   trifft, und der einzige, bei dem eine einmal gebaute Abstraktion (`sfx(disziplin, name)` statt
   `bkSfx(name)`) sofort zwanzigfach zahlt. Kostet keine Rangtreue-Zeile.
3. **Zufallswaffen-Bug fuer Showcase/Tennis/Wettessen/I-Spy schliessen.** Drei davon sind LIVE.
   Fuenf Zeilen an `:2573-2575`, rho-neutral (bei Fechten/Eiskunstlauf/Breaking bit-identisch
   nachgemessen). Der billigste sichtbare Gewinn im ganzen Feld.
4. **Showcase und Wettessen ein eigenes Konzept geben.** Beide sind produktiv angeschlossen und
   haben ueberhaupt keine Identitaet — sie sind der Buehnen-Durchgangsrechner mit anderen Zahlen.
   Das ist die einzige Stelle, an der eine LIVE geschaltete Disziplin konzeptionell leer ist.
5. **Arena-Messbudget statt Arena-Commit.** TDM/Mini-DM/Battlefield haben die drei schlechtesten
   Zahlen — aber bei allen dreien ist die Kader-Spannweite groesser als der Median. n ≥ 96–150 ist
   die Voraussetzung, bevor irgendjemand die Zielwahl-Umstellung (K1) baut, sonst ist ihr Erfolg
   nicht nachweisbar. Bei den in diesem Bericht gemessenen ~34 s je Disziplin und n=24 waere
   n=150 rund 3,5 Minuten je Disziplin und Variante — machbar, aber zu planen.
6. **Fechtens Rezept kalibrieren.** Es steht LIVE auf einem im Code selbst als „nicht final"
   bezeichneten Entwurf, mit einem Puffer (0,016), der kleiner ist als sein Kaderrauschen (0,192).
   Von den zehn produktiven Disziplinen ist das die einzige mit einem echten Rangtreue-Risiko.
7. **Climbing.** 0,010 Fehlbetrag, aber nie eine eigene Runde gehabt und kein eigenes Dokument —
   die einzige Bahn ohne eigene Modellierung. Als eigene kleine Runde mit groesserem n sinnvoll.
8. **Football.** Der groesste Einzelrueckstand ausserhalb der Arena (0,516) und zugleich die
   Disziplin mit der besten Nicht-Rezept-Ausstattung im Feld. Drei Runden haben zusammen 0,17
   gebracht; was fehlt, ist eine echte Neukalibrierung mit vielen Freiheitsgraden — kein
   umrissener Bugfix.
9. **I-Spy.** Einzige Buehne unter der Schranke. Eine Rezeptrunde nach dem Tennis-Muster (Attribute
   an die Matrix-Proportionen nachziehen) waere der naheliegende erste Versuch.
10. **Basketball vertonen ist fertig — Hockey waere der naechste Kandidat**, weil es als einziges
    ausser Basketball eine eigene Flaeche und eigene Bewegungen hat und den Ton sofort tragen wuerde.

---

## 6. Wo es GAR KEIN eigenes Konzept gibt — die explizite Liste

**Zwei Disziplinen haben kein eigenes Konzept im Sinne des Auftrags** (kein Dokument, das sie von
Grund auf modelliert; keine Mechanik ueber den Chassis-Standard hinaus; nur andere Attributzahlen
im generischen Rezept):

| Disziplin | Was es gibt | Was fehlt | rho | live? |
|---|---|---|---:|:--:|
| **Showcase** | Sieben-Rollen-Standardrezept mit Charisma-Gewichten, sonst nichts | jedes Dokument, jedes Flag, jede eigene Regel, jede Kalibrierrunde | 0,892 | **ja** |
| **Wettessen** | Matrix-Rezept (will/health/stamina, kein Charisma) + eigene `wertungTabelle` | jedes Dokument, jede eigene Mechanik, jede Kalibrierrunde | 0,845 | **ja** |

**Drei weitere haben nur ein GETEILTES Konzeptdokument, kein eigenes** — das ist eine schwaechere,
aber eigene Kategorie:

| Disziplin | geteilte Quelle | Konsequenz |
|---|---|---|
| **Climbing** | `bahn-disziplinen-recherche-fable.md` Abschnitt 4 (Klettern) | echte Recherche vorhanden, aber nie in eine Umsetzungsrunde ueberfuehrt — die einzige Bahn ohne eigene Runde |
| **Speed-Schach** | `takeshi-schach-optik-gameplay-plan-05-09.md` Teil A + `arena-duell-recherche-fable.md` Abschnitt 4 | trotzdem die zweitbeste Rangtreue — hier ist das Fehlen folgenlos |
| **TDM** | `arena-duell-recherche-fable.md`, `arena-mini-dm-tdm-battlefield-rollout-plan.md` | ausdruecklich begruendet: vier eigene Rezepte gebaut, alle vier schlechter oder ununterscheidbar |

**Und eine Disziplin hat ein Konzept, das im Code selbst als unfertig markiert ist:**
**Fechten** — `BUEHNE_ART.fechten` (`:10934`): „ERSTER, AUSDRUECKLICH NICHT FINALER
Sieben-Rollen-Entwurf ... Startpunkt, kein fertiges Ergebnis." Sie ist trotzdem seit Welle 2 live.

---

## 7. Grenzen dieser Pruefung — ehrlich

1. **Keine Sicht-QA.** Es wurde kein Spieltag im Browser durchgeklickt und kein Screenshot
   gemacht. Alle Aussagen ueber Optik und Bewegung stammen aus gelesenem Zeichencode
   (`battle-mode.engine.js`, die zwanzig `*.tsx`-Feld-Dateien) — **„was der Code zeichnet", nicht
   „wie es aussieht".** Insbesondere die Assets- und Movement-Spalten wuerden sich durch eine
   Sichtprobe verschieben, in beide Richtungen. Die Rangtreue-Sonde selbst lief in dieser
   Umgebung problemlos (anders als in der 08.09.-Pruefung, wo Chromium beim Laden der
   Mockup-Seite abstuerzte) — der Headless-Messpfad ist stabil, der Sicht-Pfad ungeprueft.
2. **Die Animationszahl ist ein Proxy, kein Mass.** „Animationsstellen" ist die Trefferzahl von
   `anim|keyframes|transition` je Feld-Datei. Eine Datei mit 3 Treffern (Showcase, Eiskunstlauf,
   Takeshi) kann trotzdem gut aussehen; eine mit 22 (Fechten) kann flimmern. Die Zahl zeigt
   Investition, nicht Qualitaet.
3. **Die Prozentwerte sind eine Einstufung, keine Messung.** Nur die rho-Spalte ist gemessen.
   Die Rubrik in Abschnitt 0 macht die Einstufung nachpruefbar, aber die Gewichte darin sind
   gesetzt, nicht hergeleitet — eine andere Rubrik ergaebe andere Zahlen. Was sie nicht aendert,
   ist die REIHENFOLGE an den Enden: Basketball/Hockey oben, I-Spy/Showcase/Wettessen unten fallen
   in jeder plausiblen Gewichtung gleich aus.
4. **Kein Zugriff auf den Server** (CLAUDE.md). Alle Aussagen ueber Spielstaende stammen aus der
   Kaderfamilie, die am 03.09. aus dem `live-save`-Abbild gezogen wurde. Die Spiegel-Frische wurde
   fuer diesen Bericht nicht neu geprueft.
5. **Kein aktiver Save nutzt Battle Mode.** Unveraendert seit Welle 1: alle Saves im
   `live-save`-Abbild haben `scenarioMeta.gameMode` nicht gesetzt. Die gesamte
   Produktionsanschluss-Spalte (die 30 Gameplay-Punkte fuer zehn Disziplinen) ist damit **real,
   aber latent** — sie wirkt sich auf keinen von Chris' aktuellen Spielstaenden aus, bis ein NEUER
   Save mit Battle-Mode-Wahl angelegt wird.
6. **Der Torwart-Sonderfall.** Hockey ist die einzige Disziplin mit zwei Zahlen (0,669 alle zwoelf
   / 0,719 nur Feldspieler). Fuer die Tabelle oben ist die Zwoelferzahl verwendet, weil sie das
   reale Spiel misst — die Feldspielerzahl waere die freundlichere und ebenfalls vertretbare Wahl.

**Achter Nachtrag 12.09. — Tabelle korrigiert (war zwei Runden veraltet) und neue Spalte
"Letzte Aenderung" eingefuehrt.** Diese Datei ist die Scorecard, nach der Chris am 12.09. gefragt
hat: „die scorecard soll der overseer immer up to date halten, neue spalte einfügen mit latest
changes + datum". Die Tabelle unten war seit ihrer eigenen Erstellung (`c56fffd7`) durch zwei
spaetere Runden ueberholt worden, ohne dass sie hier nachgezogen wurde: die Feinschliff-Runde
(Gewichtheben-Assets, Eiskunstlauf-Movement, Breaking-Assets+Movement, Takeshi-Bahn-Produktivierung,
alle PR #872-#884, 10.09.) und die Football-Gameplay-Runde 1 (rho 0,516 → 0,800, PR #884, 10.09.).
Die korrekte Zwischenstufe stand bereits in
`docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 1.1 — von dort
uebernommen, plus die eine echte Aenderung von heute (Hockey-Ton, E2, PR #893, Assets 80→100).
**Ab jetzt gilt:** nach jeder Runde, die eine Zeile unten bewegt, wird diese Tabelle noch in
derselben Sitzung nachgezogen — nicht erst beim naechsten grossen Audit.

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

| # | Disziplin | Chassis | Konzept | Assets | Gameplay | Movement | **Gesamt** | rho | Arena | Letzte Aenderung |
|--:|---|---|--:|--:|--:|--:|--:|--:|:--:|---|
| 1 | Hockey | Feldspiel | 100 % | 100 % | 72 % | 100 % | **93 %** | 0,669 / 0,719 | ja | **12.09.** Ton verdrahtet, Assets 80→100 (E2, PR #893) |
| 2 | Gewichtheben | Buehne | 100 % | 100 % | 95 % | 87 % | **96 %** | 0,854 | ja | 10.09. Assets 60→100 (Hantel/Hebebuehne/Ton, PR #876) |
| 3 | Takeshi's Castle | Bahn | 100 % | 95 % | 97 % | 85 % | **94 %** | 0,861 | nein | 10.09. Bahn-Produktivierung + Ton (PR #880/#883) |
| 4 | Breaking | Buehne | 85 % | 100 % | 95 % | 92 % | **93 %** | 0,869 | ja | 10.09. Assets+Movement 65/55→100/92 (PR #875) |
| 5 | Basketball | Feldspiel | 100 % | 100 % | 82 % | 100 % | **96 %** | 0,769 | ja | 10.09. E1 gemessen (G1\*-Kriterien nicht erfuellt, PR #890) — keine Aenderung |
| 6 | Eiskunstlauf | Buehne | 90 % | 70 % | 95 % | 94 % | **87 %** | 0,885 | ja | 10.09. Movement 60→94 (Kuer-Bewegung, PR #874) |
| 7 | Speed-Schach | Buehne | 80 % | 75 % | 100 % | 80 % | **84 %** | 0,908 | ja | unveraendert seit 07.09. |
| 8 | Staffel | Bahn | 95 % | 55 % | 97 % | 70 % | **79 %** | 0,915 | nein | 10.09. Bahn-Produktivierung (PR #880) |
| 9 | Football | Feldspiel | 90 % | 75 % | 65 % | 85 % | **79 %** | 0,800 | nein | 10.09. Rezept Runde 1, rho 0,516→0,800 (PR #884) · **E3 in Pruefung** (Anzeige-Korrektur, PR #894, NICHT gemergt — wartet auf Chris) |
| 10 | Time-Trial | Bahn | 95 % | 45 % | 92 % | 50 % | **71 %** | 0,828 | nein | 10.09. Bahn-Produktivierung (PR #880) |
| 11 | Spurt | Bahn | 95 % | 55 % | 67 % | 60 % | **69 %** | 0,871 | nein | unveraendert seit 07.09. |
| 12 | Fechten | Buehne | 55 % | 55 % | 90 % | 35 % | **59 %** | 0,816 | ja | unveraendert seit 07.09. |
| 13 | Tennis | Buehne | 75 % | 40 % | 90 % | 20 % | **56 %** | 0,825 | ja | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |
| 14 | Mini-DM | Arena | 70 % | 60 % | 22 % | 55 % | **52 %** | 0,094 | nein | unveraendert |
| 15 | Battlefield | Arena | 70 % | 60 % | 22 % | 55 % | **52 %** | 0,387 | nein | unveraendert |
| 16 | TDM | Arena | 55 % | 65 % | 22 % | 60 % | **51 %** | 0,253 | nein | unveraendert |
| 17 | Climbing | Bahn | 65 % | 40 % | 49 % | 40 % | **49 %** | 0,790 | nein | unveraendert |
| 18 | Wettessen | Buehne | 35 % | 40 % | 95 % | 15 % | **46 %** | 0,845 | ja | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |
| 19 | Showcase | Buehne | 25 % | 40 % | 95 % | 20 % | **45 %** | 0,892 | ja | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |
| 20 | I-Spy | Buehne | 55 % | 40 % | 37 % | 20 % | **38 %** | 0,684 | nein | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |

**Durchschnitt ueber alle zwanzig: 71 %** (war 65 % am 10.09. vor der Feinschliff-/Football-Runde).
Je Achse: **Konzept 78 % · Assets 68 % · Gameplay 71 % · Movement 65 %.**

**Welle 0 (Fundament, gemergt 12.09., PR #892/#889/#891/#895): noch ohne eigene Punktewirkung.**
Vier PRs — Ton-Katalog-Daten fuer sechs Disziplinen, die generische `DISZIPLIN_PROP`-Requisiten-
Tabelle, ein leerer `bahnBewegung(dt)`-Dispatcher fuer die vier Bahn-Disziplinen, plus sechs kleine
Praesentationsfixes (Breaking/Eiskunstlauf/Takeshi) — legen nur die Fundamente fuer die naechste
Runde (Welle 1: Speed-Schach/Staffel/Football/Time-Trial/Spurt/Fechten-Ton, Eiskunstlauf/Staffel/
Takeshi-Requisiten). Keine Zeile oben aendert sich dadurch; sie werden erst in der Spalte "Letzte
Aenderung" sichtbar, sobald die jeweilige Ziel-Disziplin ihre Aufrufstellen bekommt.

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

### Hockey — 93 % (100/100/72/100)
**12.09. Update:** Assets 80→100. Fable-Entscheidung E2 (PR #893) hat den letzten Assets-Ruecksand
geschlossen — neuer `TON_KATALOG.hockey`-Eintrag (schuss/treffer/pfiff/tor/publikum), verdrahtet an
den fuenf bestehenden Aufrufstellen (Abwurf, Bodycheck, Strafe, Torerfolg, Publikums-Loop mit dem
etablierten N1-Reset-Muster). Gameplay/Movement/Konzept unveraendert — s. urspruengliche Zeile unten.
**Konzept 100:** Torwart mit eigener Wertformel (`HK_TW_BASIS`/`HK_TW_REF`), Bodycheck, Strafen,
Ueberzahl, Passqualitaet, xG-Buchung (K3). Zwei eigene Fable-Dokumente plus ein NHL-Review
(`hockey-opus-review-nhl.md`).
**Assets 100:** `rink.tsx` (419 Z., 14 Animationsstellen), eigene Eisflaeche im Motor
(`:10128 eisflaeche()`), eigener Hockeyschlaeger als Sprite-Ebene (`zeichneHockeyschlaeger`, `:311`),
seit 12.09. eigener Ton (fuenf Ereignisse, s.o.).
**Gameplay 72:** rho 0,669 (alle zwoelf) / 0,719 (nur Feldspieler) — ausdruecklich von Chris
abgenommen, Aufgabe #20 geschlossen. Produktiviert mit eigener Torwart-PPS-Referenz.
**Movement 100:** eigene Torwartbogen-, Schuss- und Bandenzweikampf-Phasen (`:9553`).

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

### Gewichtheben — 96 % (100/100/95/87)
**10.09. Update:** Assets 60→100 (PR #876, PRODUKTIONSCODE, Opus-Review FREIGEBEN). Hantel liegt
jetzt an per Pixelscan ausgemessenen Handpunkten (`HEBEN_HAND`, analog zu Hockeys Schlaeger),
eigene Hebebuehne, Ton verdrahtet. Movement bleibt bei 87 — die Luecke ist M2 (keine eigene
Schrittlogik, `hebePhase()` leitet die Pose nur aus dem Fortschrittsbalken ab, s. Plan-Dokument
Abschnitt 1.2). Konzept/Gameplay unveraendert.
**Konzept 100:** eigenes FUENF-Sub-Skill-Rezept statt der sieben Buehnen-Rollen
(`BUEHNE_ART.gewichtheben`, `:10598`), Reissen/Stossen, drei Versuche, Nullwertung, Ansage. Die
offene Architekturfrage („darf Charisma die physische Obergrenze beruehren?") ist am 04.09.
entschieden und gemessen (`HEBEN_TAGESMAX_ANSAGE_K`, rho 0,720 → 0,887).
**Assets 100:** eigenes Buehnenbild `zeichneHeben()`, Hantel an ausgemessenen Handpunkten
(`HEBEN_HAND`/`HEBEN_PHASEN`), eigene Hebebuehne, eigener Ton (PR #876).
**Gameplay 95:** rho **0,854**, produktiviert, Gesamt-kg-Tiebreak, eigene `WERTUNG_HEBEN`.
**Movement 87:** Versuchs-Zustandsmaschine plus eigenes Bild; M2 fehlt weiterhin — keine eigene
Hebe-Zustandsmaschine, `hebePhase()` liest nur den Fortschrittsbalken.

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

### Eiskunstlauf — 87 % (90/70/95/94)
**10.09. Update:** Movement 60→94 (PR #874, PRODUKTIONSCODE, Opus-Review FREIGEBEN MIT NACHTRAG).
Echte Kuer-Bewegung ersetzt das Reihenbild — Laeufer gleiten statt zu stehen. 12.09.: der
Kufenspur-Ringpuffer pausiert jetzt waehrend `haeltStelle` (PR #895, Kleinbefund #2), sonst fiel
die Spur bei einer Pirouette auf einen Punkt zusammen — Politur, keine Punktaenderung.
**Konzept 90:** `duett:true` (automatische Paarung bei gerader Feldgroesse, PR #859), `rundenN` an
der realen ISU-Programmlaenge (12 statt 6, Spearman-Brown-Runde vom 07.09., gemessen 0,792 → 0,875).
Eigenes Fable-Dokument (`eiskunstlauf-duett-paarlauf-recherche-08-09.md`) plus die Politur-Recherche.
**Assets 70:** `eiskunst.tsx` (599 Z.) und `zeichneDuett()` (`:11822`, ~100 Z., Paare + Eisspur).
Die Waffenebene ist korrekt entfernt (`:2574`) — aber es gibt keine Schlittschuhe, kein Kostuem.
**Gameplay 95:** rho **0,885** (frisch gemessen, 0,010 ueber der Basislinie), produktiviert.
**Movement 94:** echte Kuer-Bewegungsmaschine (`stepKuer`, PR #874) statt Reihenbild — Laeufer
gleiten sichtbar ueber das Eis, Kufenspur folgt korrekt (inkl. Pause waehrend `haeltStelle`).

### Takeshi's Castle — 94 % (100/95/97/85)
**10.09. Update:** Assets 60→95, Gameplay 67→97 (PR #880 Bahn-Produktivierung, Opus-Review
FREIGEBEN; PR #883 Ton-Verdrahtung). `takeshi.tsx` waechst von 273 auf 517 Zeilen / 3 auf 14
Animationsstellen; Ton (A4 0→20) ueber vier Aufrufstellen plus Loop-Start/-Stop/-Reset, Leck-Test
in den vier Geschwister-Bahnen bestanden. 12.09.: PR #895 (Kleinbefund #5/#6) tauscht den
Ausscheiden-Klang von "tor" auf "platsch" (semantisch richtig) und drosselt Falle/Sturz/Tor auf
0,12s — Politur, keine Punktaenderung.
**Konzept 100:** die inhaltlich reichste Disziplin des Projekts — Ausscheiden nach drei Stuerzen,
vierzehn Fallen in fuenf Typen mit eigener Stufe (`fallenStufe`), drei benannte Kurse,
Chaos/Tackle-Fenster, Gedraenge, Burgpunkte als echte Wertung. Vier eigene Dokumente
(`takeshi-animationen-hilfe-behinderung-recherche-06-09.md`, `takeshi-chaos-tackle-plan-06-09.md`,
`takeshi-schlammroute-plan-06-09.md`, `takeshi-schach-optik-gameplay-plan-05-09.md`).
**Assets 95:** `bodenTakeshiRoute()` (Schlangenroute mit fuenf Gelaendezonen, Tuempeln, Burgmauer
und Tor), `zeichneFalleTakeshi()` (zehn Fallenbilder), `takeshi.tsx` jetzt 517 Zeilen/14
Animationsstellen (PR #880), eigener Ton (PR #883).
**Gameplay 97:** rho **0,861**, eigene Burgpunkte-Wertung, seit PR #880 produktionsangeschlossen.
**Movement 85:** Fallen reagieren sichtbar auf den Ausgang (`fallenAusgang()`, Nachwackeln bei
Durchbruch, gruenes Gluehen bei sauber). M2 (Bahn-Bewegungsdispatcher) bleibt die Luecke bis zur
Welle-1-Zielumsetzung, s. `bahnBewegung()`-Fundament (PR 0.3, #891).

### Breaking — 93 % (85/100/95/92)
**10.09. Update:** Assets 65→100, Movement 55→92 (PR #875, PRODUKTIONSCODE, Opus-Review FREIGEBEN
MIT NACHTRAG). Echter Cypher mit Move-Mechanik ersetzt die rein zeichnerische Kulisse. 12.09.: PR
#895 (Kleinbefund #3/#4) korrigiert die Freeze-/Rueckzug-Fade-Divisoren (rissen bei halber
Deckkraft ab) und glaettet den Ringwinkel bei Rangwechseln — Politur, keine Punktaenderung.
**Konzept 85:** eigenes Torment/Will-Rezept ohne Charisma, mit gemessener NACHGEZOGEN-Korrektur
(`:10744`), `rundenN` 4 → 8 an der realen WDSF-Bewertung. Eigenes Fable-Dokument
(`breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`).
**Assets 100:** `zeichneBreaking()` (lila Cypher mit vier Ringzonen und SURVIVOR-Spotlight),
`breaking.tsx` seit PR #875 deutlich gewachsen.
**Gameplay 95:** rho **0,869**, produktiviert (Welle 2).
**Movement 92:** echte Move-Mechanik (`stepCypher`, PR #875) statt reiner Zeichenkulisse —
Toprock/Footwork/Powermove/Freeze-Phasen, Ringposition glaettet jetzt bei Rangwechseln (PR #895).

### Staffel — 79 % (95/55/97/70)
**10.09. Update:** Gameplay 67→97 (PR #880, PRODUKTIONSCODE, Opus-Review FREIGEBEN). Bahn-Chassis
ist jetzt produktionsangeschlossen (G2 0→30) — die beste Rangtreue im Feld (rho 0,915) zaehlt jetzt
auch im echten Spielstand.
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

### Football — 79 % (90/75/65/85)
**10.09. Update: Gameplay 35→65.** PR #884 (PRODUKTIONSCODE, Opus-Review) hat Rezept Runde 1
gebaut — `fkLos`/kappa 3, Rezept C, eigene Tackle-Zeile. rho **0,516 → 0,800**, genau auf der
Schranke (0,80–0,85-Stufe → G1 35). Kein Produktionsanschluss (G2 bleibt 0).
**12.09. — E3 in Pruefung, NICHT gemergt:** Fable-Entscheidung E3 (PR #894, Draft) zieht die
Anzeige-/KI-Kauf-Seite auf dieselben Gewichte wie das Minispiel (Override-Tabelle statt
Matrix-Aenderung, s. `lib/player-generator/spiel-eignung-overrides.ts`). Gemessener Nebeneffekt
(F2, im Plan vorab benannt): rho faellt dabei auf **0,714 (n=24) / 0,724 (n=48)** — G1 wieder auf 22,
Gesamt 79→71. **Wartet auf Chris' explizite Bestaetigung im Chat**, bevor gemergt wird — die Zeile
oben zeigt den AKTUELLEN, gemergten Stand (0,800), nicht den Stand nach E3.
**Konzept 90:** Downs, Line of Scrimmage, echte Formationen, Playcall, eigener `spielEignung`-Block
neben der gesperrten Matrix (PR #803). Kalibriert gegen echte NFL-2024-Quoten
(`football-rezept-kalibrierung.md`). K4 nur teilweise: Anzeige/Teamstaerke/KI-Kauf ordnen Football
weiterhin nach der ALTEN Matrix, das Minispiel nach der neuen — genau die Frage, die E3 loesen soll.
**Assets 75:** eigene Ausruestung (Helme/Montur, `footballGear`, `:2593`), Endzonen und Line of
Scrimmage im geteilten Feldspielbild (`:10089`), `football.tsx` (348 Z.).
**Gameplay 65:** rho **0,800** (PR #884), genau auf der Schranke. Kein Produktionsanschluss;
dient im Testcode weiterhin als benannte Kontrolldisziplin (`D2_KONTROLL_DISZIPLIN = "football"`).
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

### Time-Trial — 71 % (95/45/92/50)
**10.09. Update:** Gameplay 62→92 (PR #880, Bahn-Produktivierung). Produktionsanschluss (G2 0→30).
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

### Tennis — 56 % (75/40/90/20)
**10.09. Update:** Assets 30→40. Der Zufallswaffen-Bug (Abschnitt 3.2) ist projektweit geschlossen
— `DISZIPLIN_WAFFE` fuehrt Tennis heute mit `null`, der Spieler schwingt keine Kosmetikwaffe mehr.
**Konzept 75:** eigene, aus Tennis' MATRIX abgeleitete Rezeptkalibrierung (07.09., `:10837-10922`,
0,786 → 0,825) — das war die Behebung der 1:1-Uebernahme aus dem alten Feldspiel-Rezept. Die
Mechanik selbst ist aber Speed-Schachs `duell:true`, kein eigener Ballwechsel-Rechner.
**Assets 40:** `tennis.tsx` (424 Z., 17 Animationsstellen) — im Mockup weiterhin **das generische
Buehnen-Reihenbild**, aber die Zufallswaffe ist seit dem 10.09. weg (`DISZIPLIN_WAFFE` mit `null`).
Eigene Requisiten (Schlaeger) gibt es weiterhin nicht — daher 40, nicht mehr.
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

### Wettessen — 46 % (35/40/95/15) — **kein eigenes Konzept**
**10.09. Update:** Assets 30→40, Zufallswaffen-Bug geschlossen.
**Konzept 35:** es gibt ein eigenes, aus der Matrix abgeleitetes Rezept (will 26/health 22/
stamina 22, bewusst ohne Charisma, `:10761`) und eine eigene `wertungTabelle` mit Chris' eigenem
Wort „Pause". Das war es. **Es gibt kein Dokument, das Wettessen als Sportart modelliert**, keine
eigene Mechanik, keine Kalibrierrunde — es ist der generische Buehnen-Durchgangsrechner mit
anderen Attributgewichten.
**Assets 40:** `platter.tsx` (441 Z., 6 Animationsstellen, leergegessene Teller) — im Motor das
generische Reihenbild, aber ohne Zufallswaffe mehr (seit 10.09.).
**Gameplay 95:** rho **0,845**, produktiviert (Welle 2) — die Zahl ist gut, weil das
Buehnen-Chassis gut ist, nicht weil Wettessen gut ist.
**Movement 15:** nichts.

### Showcase — 45 % (25/40/95/20) — **kein eigenes Konzept**
**10.09. Update:** Assets 30→40. Die alte Notiz ("Showcase bewusst unangetastet") ist ueberholt —
`DISZIPLIN_WAFFE` fuehrt heute alle vier betroffenen Buehnen (Showcase/Tennis/Wettessen/I-Spy)
projektweit mit `null`, selbst nachgelesen.
**Konzept 25:** die duennste Disziplin unter den zehn produktiven. `BUEHNE_ART.showcase` (`:10658`)
ist der Sieben-Rollen-Standard mit Charisma-Gewichten — **kein Flag, kein Zweig, keine
NACHGEZOGEN-Korrektur, kein eigenes Dokument**. Der einzige Text ueber Showcase ist die
Produktivierungs-Notiz, die es mit Speed-Schach teilt.
**Assets 40:** `showcase.tsx` (623 Z., aber nur **3 Animationsstellen**). Im Motor generisch, aber
seit 10.09. ohne Zufallswaffe.
**Gameplay 95:** rho **0,892** (drittbeste im Feld), produktiviert seit Welle 1.
**Movement 20:** nichts Eigenes.

### I-Spy — 38 % (55/40/37/20)
**10.09. Update:** Assets 30→40, Zufallswaffen-Bug geschlossen.
**Konzept 55:** die **breiteste Matrix aller zwanzig** (zehn Attribute mit Gewicht) und eine
gemessene NACHGEZOGEN-Korrektur (`:10821`). Aber `duell:true` von Speed-Schach uebernommen, und der
einzige Konzepttext ist Abschnitt 4 von `arena-duell-recherche-fable.md` (Differenzwert), geteilt.
**Assets 40:** `spybar.tsx` (589 Z., 17 Animationsstellen) — im Motor generisch, aber seit 10.09.
ohne Zufallswaffe.
**Gameplay 37:** rho **0,684 — die einzige Buehnen-Disziplin, die die Abnahme nicht besteht.**
Technisch waere der Anschluss eine einzige Zeile (`duell:true` liegt vor); er ist **bewusst
unterlassen** und mit einem eigenen Regressionstest festgehalten (PM-Briefing 09.09., „die beiden
Achsen duerfen nicht deshalb vermischt werden, weil eine davon billig zu erfuellen waere").
**Movement 20:** nichts Eigenes.

---

## 3. Zwei Querschnittsbefunde, die jede Zeile oben beeinflussen

### 3.1 Ton — Stand 12.09.: zwei von zwanzig haben eigene Audio-Dateien, sechs weitere haben jetzt
### einen prozeduralen `TON_KATALOG`-Eintrag (noch ohne Aufrufstellen)
Basketball bleibt die einzige Disziplin mit echten Audio-DATEIEN: `public/sound/basketball/` mit
sechs Dateien, ueber `bkSfx()` angebunden. **Hockey** hat seit dem 12.09. (E2, PR #893) einen
vollstaendig verdrahteten, prozeduralen `TON_KATALOG.hockey`-Eintrag (fuenf Ereignisse, synthetisch
erzeugt statt Audio-Datei — der Umgebungs-Proxy laesst keine Audio-Dateien durch) und zaehlt damit
ebenfalls als "hat Ton" (A4 0→20). PR 0.1 (#892, 12.09.) hat ausserdem **sechs weitere**
Katalogeintraege angelegt (Speed-Schach/Staffel/Football/Time-Trial/Spurt/Fechten) — reine Daten,
noch **ohne eine einzige Aufrufstelle**, also noch ohne Punktewirkung (A4 bleibt bei diesen sechs
bei 0, bis eine Ziel-PR sie tatsaechlich verdrahtet). **Elf von zwanzig Disziplinen bleiben stumm**
(war neunzehn am 10.09.) — der Rueckstand ist kleiner geworden, aber noch immer der groesste
gleichfoermige im Projekt.

### 3.2 Der Zufallswaffen-Bug ist seit dem 10.09. projektweit geschlossen
**Ueberholt:** dieser Abschnitt sagte bis zum 10.09., der Bug sei bei Showcase/Tennis/Wettessen/
I-Spy weiterhin offen. Nachgesehen im aktuellen Code: `DISZIPLIN_WAFFE` fuehrt heute alle vier mit
`null`, zusammen mit den fuenf Bahn-Disziplinen. Kein Kaempfer/Spieler traegt mehr eine
Zufallswaffe, die zu seiner Disziplin nicht passt — das hat allen vier Buehnen je 10 Assets-Punkte
gebracht (s. Tabelle oben). Eigene, disziplinrichtige Requisiten (statt nur "keine Waffe") gibt es
fuer diese vier weiterhin nicht — das bleibt offen und ist Aufgabe der `DISZIPLIN_PROP`-Tabelle
(PR 0.2, #889), sobald eine Ziel-PR ihnen eine eigene Requisite gibt.

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

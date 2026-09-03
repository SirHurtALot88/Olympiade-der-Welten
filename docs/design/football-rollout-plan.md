# Recherche: Football vorbereiten — Mechanik, Migrationsplan, Assets, Balancing (Fable)

Stand: Branch `claude/football-recherche`, abgezweigt von `origin/claude/sonde-alle-disziplinen`
`2664a93c` (03.09.2026). Alle Datei-/Zeilenangaben unten sind gegen genau diesen Stand geprüft.
`engine.js` meint `public/mockups/battle-mode.engine.js`.

Chris' Auftrag wörtlich: *„football könntest du genauso vorbereiten und schon assets suchen
balancing usw wie bei basketball. Informationen suchen, lass das wieder fable machen mit code von
NFL oder github etc."* — reine Recherche, kein Commit an der Engine, kein Rezept scharf geschaltet.

**Jede Zahl unten ist entweder selbst gemessen (mit Befehl), aus dem Code zitiert
(Datei:Zeile) oder eine reale Quelle (mit URL).** Was ich nicht prüfen konnte, steht als
„nicht geprüft" da. Netzzugang lief über den Umgebungs-Proxy; `teamrankings.com` und
`pro-football-reference.com` haben jeden Abruf mit 403 abgewiesen (eigene Bot-Sperre der
Seiten, nicht die Proxy-Allowlist — andere Domains liefen unauffällig) und stehen deshalb
nirgends als Quelle; wo eine Zahl von dort nur in einer Zweitquelle (StatMuse, Suchtreffer)
auftaucht, ist das vermerkt.

Stil/Struktur an `docs/design/hockey-rollout-plan.md` und
`docs/design/basketball-finalisierung-recherche-fable.md` angelehnt.

---

## 0. Die wichtigsten Funde vorab

1. **Football ist heute die schwächste Disziplin im ganzen Projekt, gemessen.** Frisch
   gemessen auf diesem Stand (`node scripts/miss-alle-disziplinen.mjs 24 football basketball
   hockey`): **Football rho 0,307 je Spiel / 0,776 Saison** — weit unter der 0,80-Schwelle
   (CLAUDE.md) und die schlechteste Einzelspielzahl aller zwanzig Disziplinen
   (`docs/design/stand-aller-disziplinen.md` führt es ebenso als Schlusslicht). Zum
   Vergleich im selben Lauf: Basketball 0,820/0,881, Hockey 0,647/0,860 (Hockey liegt hier
   niedriger als in älteren Berichten, weil zwischen der Kurve-Migration und diesem Lauf am
   Hockey-Rezept nachgezogen wurde — der Football-Befund selbst ist davon unberührt).
2. **Football hat KEINEN Live-Motor — und die Engine sagt das selbst am deutlichsten.** Der
   Motorkommentar direkt am Rezept (`engine.js:3759-3764`) lautet wörtlich: *„DAS IST NICHT
   DIE LOESUNG, NUR DIE HAELFTE DAVON [...] Football gehoert wie Hockey auf den Live-Motor
   (FELDSPIEL_ART[...].live) — ein Rezept, das gegen die Vorab-Mechanik eingemessen wird,
   ist nach der Migration wertlos."* Football rechnet 48 Züge (`zuegeJeSeite:24`,
   `engine.js:3765`, macht `art.zuegeJeSeite*2` = 48 Gesamtzüge, `engine.js:4753`) in der
   `for`-Schleife von `bauFeldspiel` vorab durch (`engine.js:4644 ff.`) und deckt sie danach
   im Takt von `zugDauer:1.25` (60 s Spielzeit) auf — **keine Downs, keine Line of
   Scrimmage, kein Formationswechsel, keine Manndeckung**, genau wie Hockey vor seiner
   eigenen Migration.
3. **Die Infrastruktur für die Migration steht bereits — für Basketball UND Hockey gebaut,
   nicht football-spezifisch, also fertig zum Erben.** `if(art.live){ initFeldspielLive(art);
   return; }` (`engine.js:4767`) ist die EINE Weiche, generisch über `FELDSPIEL_ART[d].live`
   — keine harte `"basketball"`-Prüfung mehr wie zur Zeit des Hockey-Plans
   (`hockey-rollout-plan.md` §0.1 beschreibt genau diesen jetzt behobenen Zustand).
   `initFeldspielLive`/`stepFeldspielLive`/`zuordneSlots`/`bewegeSpielerLive` sind bereits
   disziplinübergreifend (`engine.js:5582/7739/5037/7318`), und ein Kommentar an genau der
   Formations-Stelle sagt es wörtlich: *„Football (Snap-Formation), Hockey (Bully) und
   Tennis (Aufschlag) brauchen exakt dieselbe Struktur"* (`engine.js:5606-5613`). Football
   müsste also keine neue Live-Architektur erfinden, sondern eine dritte Instanz der
   bestehenden füllen.
4. **Die eigene Erfolgskurve ist eine gelöste Aufgabe, keine offene Frage.** Seit
   `docs/design/hockey-eigene-erfolgskurve.md` trägt `FELDSPIEL_ART[d].kurve` alle Parameter
   einer Distanz/Skill-Erfolgsformel als Daten; ohne eigenen Block fällt eine Disziplin auf
   `KURVE_BASKETBALL` zurück (`engine.js:4385`, Fallback-Logik `engine.js:4397/4406/4410`).
   Football braucht **von Anfang an einen eigenen `kurve:`-Block** — genau der Fehler, den
   Hockey vorher gemacht hatte (TEAMGEIST-Erbstück, s. dort), soll sich hier nicht
   wiederholen.
5. **Der Vorab-Pfad produziert nachweisbar unrealistische Werte, nicht nur eine schlechte
   Rangtreue.** Frisch gemessen (`node scripts/miss-feldspiel-rangtreue.mjs football 24 6`):
   **153,3 Punkte je Spiel BEIDE SEITEN ZUSAMMEN**, das sind ~76,6 je Team und Partie —
   das 3,3-fache des realen NFL-Mittels von 22,9 Punkten je Team (Abschnitt A.1). Im
   Beispielspiel (Saat 1337) erzielt „Ralazar the Balanced" (Eignung 49,4, zweitniedrigste
   im Feld) 34 Punkte — mehr als jeder andere Spieler dieser Partie —, während „Seraph-11"
   (Eignung 47,2) auf 0 Punkte kommt. Das deckt sich mit dem Motorkommentar zur alten
   8-Zug-Fassung (*„der Spieler mit der NIEDRIGSTEN Eignung erzielte die meisten Punkte"*,
   `engine.js:3750-3751`) — die Ereignisdichte wurde seither verdreifacht, das strukturelle
   Problem (kein Down-System, keine Verteidigung, die eine Serie beenden kann) blieb.
6. **Ein Feld für Football existiert bereits — gezeichnet, nicht als Sprite.**
   `bodenFeldspiel()` hat einen eigenen Football-Zweig (`engine.js:8368-8384`): zwei
   Endzonen, zehn Yard-Linien im 10-%-Raster, betonte Mittellinie, Spielrichtung
   links↔rechts entlang der langen Achse. Für die Live-Migration ist das kein Fehlteil,
   sondern ein Vorteil: die zehn bereits gezeichneten Yard-Segmente sind eine natürliche
   Vorlage für ein Down/Distance-Zonenmodell (Abschnitt B.3).
7. **Ein Football-Ball-Sprite UND ein Helm-Sprite liegen bereits lizenzgeklärt vor — im
   selben Paket, das schon den Basketball-Korb liefert.** `kenney_sportsPack.zip` (Kenney,
   CC0, dieselbe Quelle wie `public/sprites/basketball/quellen.json` für `korb_topdown.png`
   u. a.) enthält `PNG/Equipment/ball_football.png` (14×16 px, brauner Football mit weißen
   Schnürsenkeln) und `PNG/Equipment/helmet_white{1,2,3}.png` (19×19 bis 26×22 px, drei
   Blickwinkel eines weißen Football-Helms mit blauem Gesichtsschutz-Streifen) — beide noch
   NICHT im Repo (`public/sprites/football/` existiert nicht). Details und Bildnachweis in
   Abschnitt C.
8. **Zwei brauchbare Open-Source-Football-Engines wurden gesucht, eine gefunden.**
   `zengm-games/zengm` (das Basketball-GM-Projekt, aus dem die Basketball-Recherche schon
   `GameSim.basketball` zitiert) enthält im selben Repo ein vollständiges
   `GameSim.football` — 2 979 Zeilen `index.ts` plus `Play.ts`, `formations.ts`,
   `penalties.ts`, mit Downs, Line of Scrimmage, 21 realen Ratings und zitierbaren
   Wahrscheinlichkeitsformeln (Abschnitt A.4/A.5). Die zwei anderen gefundenen
   GitHub-Projekte (`GridironApps/javascript-football-simulation`,
   `willlstone/NFL-Game-Simulator`) sind Stubs ohne dokumentierte Formeln — geprüft, nicht
   verwendbar.

---

## Teil A — Mechanik-Recherche: reale NFL-Referenzen und offener Code

### A.1 Wie ein echtes NFL-Spiel sich verteilt (selbst nachgerechnet, mit Quellen)

Alle Zahlen unten sind **eigene Berechnungen aus abgerufenen Rohdaten**, nicht wörtlich von
einer Seite übernommen, außer wo als Zitat markiert — StatMuse liefert Summen/Spielzahlen,
die Division ist meine eigene:

| Kennzahl | Wert je Team und Spiel | Herleitung/Quelle |
|---|---:|---|
| Offensive Plays (Pass+Lauf+Sack) | **~62,1** | StatMuse: 62,06 Plays/Spiel, 2024-Saison, direkt genannt |
| Passversuche | **~29,9** | eigene Rechnung: 16 249 Pass-Attempts Saison 2024 ÷ 544 Team-Spiele = 29,87 |
| Laufversuche | **27,0** | StatMuse direkt: 14 687 Läufe ÷ 544 Spiele = 27,0 |
| Sacks | **2,42** | StatMuse direkt: 1 314 Sacks ÷ 544 Spiele, Trend 2020–2024: 2,22/2,29/2,39/2,59/2,42 |
| Turnover (Interception + Fumble verloren) | **1,21** | eigene Rechnung: 658 Turnover ÷ 544 Spiele |
| Field Goals gemacht / versucht | **~1,72 / ~2,16** | aus TeamRankings-Suchtreffer abgeleitet (TeamRankings selbst 403, nur Auszug erreichbar — als Näherung markiert) |
| Punkte | **22,9** | StatMuse direkt, „Average"-Zeile der Tabelle, Saison 2024 |
| Completion-Quote | **65,3 %** | StatMuse direkt, Saison 2024 |
| Yards je Passversuch | **7,1** | StatMuse direkt, Saison 2024 |
| 3.-Versuch-Konversionsquote | **39,7 %** | StatMuse direkt: 2 728 von 6 874, macht **12,6 Angriffe auf 3. Versuch je Team/Spiel** |
| Touchdowns | 5,75 (2020) → **4,69** (2023, bis Woche 10) | NBC News, zitiert AP-Auswertung, wörtlich „5.75 per contest in 2020" / „An average of 4.69 touchdowns have been scored per game through the first 10 weeks" |
| Field-Goal-Anteil an der Punktzahl | 19,2 % (2020) → **25,9 %** (2023) | dieselbe NBC-News-Quelle |
| TD-Typ-Verteilung | ~65 % Pass / ~30 % Lauf / ~5 % sonstiges | StreakEdge, bezogen auf ~2015 — **älter, als Trend zitiert, nicht als aktuelle Zahl** |
| Ball tatsächlich im Spiel | **~11 Minuten** | Wall-Street-Journal-Studie 2010 (Auszug via mehrere Zweitquellen, WSJ selbst nicht direkt abgerufen — Studie vierfach unabhängig bestätigt: FoxSports, LeanBlog, jvlone.com-PDF, Quartz) |

**Kontrollrechnung, die auf den ersten Blick nicht ganz aufgeht — und warum das ehrlich ist:**
29,9 (Pass) + 27,0 (Lauf) + 2,4 (Sack) = 59,3, gegen die separat berichteten 62,1
Gesamt-Plays — eine Lücke von 2,8, plausibel durch Scrambles/Kniedowns/No-Plays, die je
nach Quelle unterschiedlich gezählt werden. Ich zeige beide Zahlen, statt eine zu glätten.

**Die „~130 echte Spielzüge"-Behauptung im Motorkommentar (`engine.js:3752`): in der
richtigen Größenordnung, aber nicht exakt.** Reine Scrimmage-Plays beider Teams zusammen:
2 × 62,1 ≈ **124**. Zählt man Sonderteams dazu (Kickoff+Return, Punt+Return,
FG/XP-Versuch — grob 4 Punts, 4–5 Kickoffs, 2 FG/XP je Team), landet man bei **~145–150**
insgesamt. 130 liegt zwischen beiden Zähldefinitionen — plausibel, aber nicht als
Einzelquelle verifizierbar; ich würde für eine künftige Kalibrierung eher **„120 bis 150,
je nachdem was man mitzählt"** schreiben als eine einzelne Zahl.

### A.2 Was einen „Spielzug" im Football-Sinn mechanisch ausmacht

Ein NFL-Spielzug ist nicht „ein Zufallsereignis", sondern **die Auflösung eines
Zustands**: Down (1.–4.), Distanz zum ersten Down (`toGo`), Position auf dem Feld
(`scrimmage`), Formation (Personnel-Gruppe: wie viele WR/RB/TE/OL stehen im Feld) und die
Entscheidung Pass/Lauf/Kick, bevor überhaupt gewürfelt wird. Das reale, quelloffene
Referenzmodell dafür — mit exakt dieser Zustandsmaschine — ist zengms `GameSim.football`
(Abschnitt A.5 zur Herkunft/Lizenz):

```ts
// GameSim.football/index.ts:44 und 117-119 (zengm-games/zengm)
const NUM_DOWNS = 4; // Not used everywhere!
down = 1;
toGo = 10;
```

Nach jedem Spielzug wird der Zustand fortgeschrieben (`down`/`toGo` erhöht oder auf 1/10
zurückgesetzt bei First Down, `scrimmage` um die gelaufenen Yards verschoben) — GENAU DAS
fehlt unserem Vorab-Pfad komplett: `bauFeldspiel` kennt für Football keinen Feldstand,
keine Downs, keine Serie, die enden kann, sondern reiht 48 unabhängige Zwei-Personen-Duelle
aneinander (Anspieler gegen Verteidiger, analog zu Basketballs Vorab-Fassung vor der
Live-Migration).

**Zwei Ereignisklassen, die unser Modell heute NICHT kennt, real aber ergebnisentscheidend
sind:**

- **Sack** (`probSack`, zengm `index.ts:2131-2139`): kein Passversuch, sondern ein
  vorzeitiger Abbruch mit Raumverlust — bei uns gibt es zwar `wortBlock:"Sack"`
  (`engine.js:3767`), aber im Vorab-Rezept keine eigene Sack-Wahrscheinlichkeit, die den
  Zug VOR dem Passerfolg beendet.
- **Fumble** (`probFumble`, zengm `index.ts:1872-1895`): eine zweite, vom Passerfolg
  unabhängige Verlust-Chance, abhängig von `ballSecurity` des Ballträgers UND der
  `tackling`-Stärke der Verteidigung im Verhältnis zum Liga-Mittel — bei uns firmiert
  „Fumble-Recovery" nur als Name für das Rebound-Analogon (`wortRebound:"Fumble-Recovery"`,
  `engine.js:3767`), nicht als eigenständiges Turnover-Risiko.

### A.3 Reale Formeln aus einem offenen Football-Motor (zengm `GameSim.football`)

**Herkunft und Lizenzhinweis zuerst:** `github.com/zengm-games/zengm`, Commit-Stand vom
Klon dieser Recherche, sparse gecloned nach `/tmp/zengm`, Datei
`src/worker/core/GameSim.football/index.ts` (2 979 Zeilen, vollständig durchsucht) und
`Play.ts` (1 420 Zeilen). **Das Projekt ist NICHT klassisch open source** —
`LICENSE.md` im Repo-Root sagt wörtlich: *„This project is not open source! [...] you must
not [...] distribute playable forked versions of the game that compete with
basketball-gm.com, football-gm.com [...]"* — Lesen und Zitieren von Formeln als Referenz
ist damit gedeckt (wie schon in der Basketball-Recherche geschehen), eine Codeübernahme
oder ein Fork wäre es nicht. Unten stehen deshalb Formeln als **Zitat mit Zeilenangabe**,
kein Code wurde in dieses Repo kopiert.

**Passerfolg** (`index.ts:2154-2175`):

```ts
probComplete(qb, target, defender) {
  const factor =
    (0.2 * (target.catching + target.gettingOpen + qb.passingAccuracy +
            qb.passingDeep + qb.passingVision)) /
    (0.5 * (defender.passCoverage + team[d].passCoverage)) *
    Math.sqrt(team[o].passBlocking / team[d].passRushing);
  const p = (0.19 + 0.4 * factor ** 1.25) * g.get("completionFactor");
  return bound(p, 0, 0.95);
}
```

Fünf Offensiv-Ratings gegen zwei Defensiv-Ratings, dazu ein Blockverhältnis als
Wurzel-Multiplikator — eine ähnliche Struktur wie unser `steilerMake` (Skill-Anteil gegen
einen Mittelwert, mit Exponent gedämpft), nur mit klar getrennten Rollen (Werfer, Ziel,
Verteidiger, zwei Team-Aggregate).

**Sack-Wahrscheinlichkeit** (`index.ts:2131-2139`):

```ts
probSack(qb) {
  return (0.06 * team[d].passRushing) /
    (0.5 * (qb.avoidingSacks + team[o].passBlocking)) * g.get("sackFactor");
}
```

**Interception-Wahrscheinlichkeit** (`index.ts:2141-2152`) — zwei verschiedene
Coverage-Ratings (Team UND Einzelspieler, je unterschiedlich gewichtet 0,004 gegen 0,022),
geteilt durch die QB-Werte `passingVision`+`passingAccuracy`, multipliziert mit dem
Pass-Rush/Pass-Block-Verhältnis: ein guter Werfer UND eine gute O-Line drücken die
Interception-Quote gleichzeitig, nicht nur die Completion-Quote.

**Laufweite** (`index.ts:2534-2544`) — eine gestutzte Normalverteilung, nicht ein
Erfolg/Misserfolg-Wurf:

```ts
const meanYds = bound(
  (scrambleModifier * 3.5 * 0.5 * (p.rushing + team[o].runBlocking)) /
    team[d].runStopping, -5, 15);
let ydsRaw = Math.round(truncGauss(meanYds, 6, -5, 15));
```

Das ist ein grundsätzlich anderes Erfolgsmodell als unser Basketball-Erbe
(„trifft/trifft nicht" mit Punktwert): Laufyards sind eine KONTINUIERLICHE Zufallsgröße um
einen ratingabhängigen Mittelwert, keine Binärentscheidung. Für Football wäre eine
Yards-Verteilung (statt eines reinen Erfolgs-Booleans wie bei Basketball/Hockey) das
mechanisch ehrlichere Modell — Abschnitt B.4 greift das auf.

**Field-Goal-Wahrscheinlichkeit nach Distanz** (`index.ts:1648-1719`, gekürzt) — eine
echte, aus NFL-Kicking-Daten abgeleitete Stufentabelle, kein Formelfit:

```ts
if (distance < 20) baseProb = 0.99;
else if (distance < 30) baseProb = 0.98;
else if (distance < 40) baseProb = 0.91;   // Stufen dazwischen im Original in 1-Yard-Schritten
else if (distance < 50) baseProb = 0.71;
else if (distance < 55) baseProb = 0.55;
else if (distance < 60) baseProb = 0.35;
// ... weiter fallend bis über 60 Yards
```

Das ist unmittelbar mit unserem `HOCKEY_SCHUSS`/`kurve.korrektur`-Muster vergleichbar: eine
distanzabhängige Basisquote, auf die Rating-Boni/-Mali erst obendrauf kommen
(`distance += -(kicker.kickingPower - 0.75) * 20`, also ±20 Yards Distanzverschiebung je
nach Beinstärke).

**Formationen** (`formations.ts:1-104`) — echte 11-gegen-11-Personnel-Gruppen (z. B.
`{QB:1,RB:1,WR:3,TE:1,OL:5}` offensiv gegen `{DL:4,LB:2,CB:3,S:2}` defensiv, plus eigene
Formationen für Field Goal, Kickoff, Punt). **Unser Feldspiel-Chassis deckelt `jeSeite:6`**
(`engine.js:3765`, wie Basketball und Hockey) — jede Football-Migration muss elf reale
Positionen auf sechs Slots abbilden, genauso wie es Basketball (5 Positionen + Rotation)
und Hockey (5 Feldspieler + Torwart) schon tun.

### A.4 Reale Sub-Skill-/Rating-Kataloge — als Diskussionsgrundlage für Teil D

**zengm — 21 reale Rating-Keys, davon 2 bis 4 je Position aktiv**
(`src/common/types.football.ts:221-242`, `src/common/posRatings.football.ts`):

| Kürzel | Bedeutung | Positionen, die es lesen |
|---|---|---|
| `thv`/`thp`/`tha` | Wurf-Übersicht/-Kraft/-Genauigkeit | QB |
| `bsc` | Ballsicherheit | QB, RB, WR |
| `elu`/`rtr`/`hnd` | Elusiveness/Route-Running/Hands | RB, WR, TE |
| `rbk`/`pbk` | Run-/Pass-Blocking | OL, TE |
| `pcv`/`tck`/`prs`/`rns` | Pass-Coverage/Tackling/Pass-Rush/Run-Stop | DL, LB, CB, S |
| `kpw`/`kac` | Kick-Power/-Accuracy | K |
| `ppw`/`pac` | Punt-Power/-Accuracy | P |

**EA Sports College Football 25 — 54 Stats, deutlich granularer**
(TheGamer-Statguide, eigene Zusammenfassung nach Positionsgruppe): allgemein `SPD/STR/AGI/
ACC/AWR/STA/TGH`; QB zusätzlich `THP/SAC/MAC/DAC/RUN/TUP/BSK/PAC`; Skill-Positionen
`BTK/TRK/COD/BCV/SFA/SPM/JKM/CAR/CTH/SRR/MRR/DRR/CIT/SPC/RLS/JMP/RET`; Defense
`TAK/POW/PMV/FMV/BSH/PUR/PRC/MCV/ZCV/PRS`; O-Line `PBK/PBP/PBF/RBK/RBP/RBF/LBK/IBL`;
Kicker/Punter `KPW/KAC`.

**Eine reale, reverse-engineerte Overall-Formel als Muster** (Randal S. Olson,
randalolson.com, lineare Regression gegen tatsächliche Madden-Ratings trainiert): für
Punter die einzige vollständig im Artikel ausgeschriebene Formel — *„Punter OVR = 1.64 +
0.39 × Awareness + 0.32 × Kick Power + 0.27 × Kick Accuracy"* — drei Attribute, additiv
gewichtet, Gewichtssumme ≈ 0,98. Für QB liefert der Artikel nur ein selbst erklärtes
HYPOTHETISCHES Beispiel (*„Obviously the above equation was made up"*) — nicht als reale
Zahl zitierfähig, nur als Strukturbeispiel brauchbar.

**Einordnung für uns:** unser Sub-Skill-Modell mit sieben Rollen (AUFBAU/ABSCHLUSS/
TECHNIK/ZWEITCHANCE/ABWEHR/TEAMGEIST/AUSDAUER, `engine.js:3768-3780`) liegt zwischen zengms
21 Keys (2–4 je Position) und EA CFB 25s 54 Stats — näher an zengm. Das ist der richtige
Anspruch: unsere Disziplinen sind Abstraktionen mit 6 Slots, nicht 22-Mann-Rosters mit
Positionsdetail.

### A.5 Gefundene GitHub-Football-Simulatoren — was trägt, was nicht

| Projekt | Befund | Verwendbar? |
|---|---|---|
| `zengm-games/zengm`, `GameSim.football` | 2 979 Zeilen, vollständige Downs/Formationen/Ratings-Engine, seit Jahren produktiv (football-gm.com) | **Ja, als Formel-Referenz** (Abschnitt A.3/A.4), nicht als Code-Quelle (Lizenz, s. o.) |
| `GridironApps/javascript-football-simulation` | README-Abschnitt „General Play Formatting" ist ein TODO-Platzhalter, 1 Star/3 Watcher/1 Fork | Geprüft, **keine dokumentierten Formeln vorhanden** |
| `willlstone/NFL-Game-Simulator` | Python, lädt Team/Spieler-JSON, aber nur 4 Commits, keine sichtbare Formel-Dokumentation im README | Geprüft, **nicht auswertbar ohne vollen Quellcode-Import** |

Die Suche nach einem echten Football-Pendant zu `archibalduk`/zengm (wie für Basketball
zitiert) führt also zu genau EINEM brauchbaren Treffer — demselben Studio, nicht einem
zweiten unabhängigen Projekt. Das ist ehrlich zu berichten, nicht zu beschönigen.

---

## Teil B — Migrationsplan Vorab → Live-Motor

### B.1 Was die Engine für Football bereits GENERISCH mitbringt (kein football-eigener Bau nötig)

| Baustein | Fundstelle | Zustand |
|---|---|---|
| Live/Vorab-Weiche | `if(art.live){ initFeldspielLive(art); return; }`, `engine.js:4767` | generisch über `FELDSPIEL_ART[d].live`, kein harter Disziplin-Name mehr |
| Live-Aufbau | `initFeldspielLive(art)`, `engine.js:5582` | disziplinübergreifend, ruft `zuordneSlots` für beide Seiten |
| Live-Schritt | `stepFeldspielLive(dt)`, `engine.js:7739` | disziplinübergreifend |
| Slot-Zuordnung | `zuordneSlots(seite,offensivDruck)`, `engine.js:5037` | disziplinübergreifend |
| Bewegung | `bewegeSpielerLive(dt)`, `engine.js:7318` | disziplinübergreifend |
| Standphasen-Naht | `fsLive.phase`, Kommentar `engine.js:5606-5613` | **explizit für Football vorgesehen** („Snap-Formation"), nur noch nicht bedient |
| Erfolgskurve als Daten | `FELDSPIEL_ART[d].kurve`, Fallback `KURVE_BASKETBALL` `engine.js:4385` | Struktur fertig, Football-Block fehlt |
| Feldgeometrie (gezeichnet) | `bodenFeldspiel()`, Football-Zweig `engine.js:8368-8384` | Endzonen + 10 Yard-Linien bereits da |

Das ist der zentrale Unterschied zur Ausgangslage von Hockeys Migration: Hockey musste
`initFeldspielLive`/`stepFeldspielLive`/`zuordneSlots`/`bewegeSpielerLive` selbst
generisch machen (das war ein Großteil der Arbeit in `hockey-mechanik-angleichen.md`).
**Football erbt diese Generalisierung kostenlos** — die Migrationsarbeit ist football-
eigene Logik innerhalb der bestehenden Naht, nicht die Naht selbst.

### B.2 Was football-spezifisch NEU gebaut werden müsste

1. **Feldstand als Zustand** (Analog zu `RINK()` für Hockey, `engine.js:8258`): eine
   `FIELD()`-Funktion, die Line of Scrimmage, Angriffsrichtung je Seite und die zehn
   Yard-Segmente aus `bodenFeldspiel()` (`engine.js:8368 ff.`, bereits als `W*0.13 +
   W*0.74*(i/10)`-Raster gezeichnet) als NUMERISCHE Zonen zurückgibt — nicht nur als
   Zeichen-Koordinaten wie heute.
2. **Down/Distance/Possession-State**, analog zu zengms `down`/`toGo`/`scrimmage`
   (Abschnitt A.2): eine Serie muss enden können (Punt bei 4. Versuch weit vom Ziel,
   Turnover on Downs sonst), sonst bleibt das strukturelle Problem aus Abschnitt 0.5
   (153,3 Punkte/Spiel) bestehen — kein Rezept kann das reparieren, weil das Problem nicht
   im Rezept sitzt.
3. **Formation/Snap als Standphase**, über die bereits vorbereitete `fsLive.phase`-Naht
   (`engine.js:5606-5613`): analog zu Basketballs Freiwurf-Standphase
   (`FW_FORMATION/FW_ANLAUF/FW_FLUG/FW_NACH`, `engine.js` nahe `stepFreiwurfPhase`) und
   Hockeys Bully — eine feste Aufstellung vor jedem Snap, keine freie Bewegung.
4. **Sack- und Fumble-Ereignis als eigene Wahrscheinlichkeitszweige** VOR dem
   Completion-Wurf (Abschnitt A.2/A.3) — heute gibt es nur „Erfolg/Misserfolg" der
   Erfolgskurve, keinen vorgelagerten Abbruch.
5. **Eine eigene Erfolgskurve (`kurve:`-Block)** — Abschnitt B.4, nicht optional.

### B.3 Zonenmodell — ein natürlicher Vorschlag aus dem bereits gezeichneten Feld

`bodenFeldspiel()` teilt das Spielfeld schon heute in zehn gleich breite Segmente
(`for(let i=1;i<10;i++){ const x=W*0.13+W*0.74*(i/10); ...}`, `engine.js:8368 ff.`) plus
zwei Endzonen (`W*0.04` bis `W*0.13` und `W*0.87` bis `W*0.96`). Das deckt sich fast 1:1
mit einer Yard-Line-zu-Zone-Abbildung (10 Zonen × 10 Yards = 100 Yards Spielfeld) — die
Geometrie für ein Down/Distance-Modell muss also nicht neu entworfen werden, sie steht
schon als Zeichnung da und müsste nur zur mechanischen Wahrheit erhoben werden (dieselbe
`korbXVon()`-Lehre wie bei Basketball: EINE Referenz für Zeichnung UND Mechanik,
`engine.js:8426-8429` kommentiert das für Basketball explizit als Vermeidung von zwei
auseinanderlaufenden Wahrheiten).

### B.4 Eigene Erfolgskurve statt `KURVE_BASKETBALL`-Erbe — aus dem Hockey-Fehler gelernt

`docs/design/hockey-eigene-erfolgskurve.md` beschreibt den Fehler, den Football nicht
wiederholen soll: Hockey teilte sich anfangs `technikMake`/`steilerMake` 1:1 mit
Basketball, kalibriert AUSSCHLIESSLICH gegen 1074 echte NBA-Feldwürfe. Das funktionierte
nur, weil Hockeys Torschuss strukturell ähnlich genug ist (eine Distanzstufe, ein
Skill-Term). Football ist strukturell ANDERS als beides:

- Basketball/Hockey: EIN Erfolgs-Wurf pro Aktion (Treffer/kein Treffer, mit Punktwert).
- Football (nach zengm-Vorbild, Abschnitt A.3): ein Lauf ist eine KONTINUIERLICHE
  Yards-Verteilung um einen Rating-abhängigen Mittelwert (`truncGauss`), kein
  Treffer/Fehltreffer. Ein Pass ist ZWEISTUFIG (Sack-Chance, dann Completion-Chance, dann
  bei Erfolg eine eigene Yards-Zahl) statt einstufig.

**Football braucht deshalb nicht nur einen eigenen `kurve:`-Block mit eigenen Zahlen,
sondern möglicherweise eine andere STRUKTUR** als der bestehende
`base/geoBonus/radien/skillMittel/steil/korrektur/skillTerme`-Rahmen, der für
„ein Distanz-Tier, eine Erfolgswahrscheinlichkeit" gebaut ist. Das ist eine Entwurfsfrage
für die eigentliche Bau-Runde, keine, die diese Recherche vorwegnehmen sollte — aber die
Warnung aus Teil 0.4 gehört hier verankert: **ein `kurve:`-Block, der nur Basketballs Form
kopiert und mit Football-Zahlen füllt, wäre derselbe Fehler wie Hockeys erste Fassung,
nur eine Ebene tiefer.**

---

## Teil C — Assets

### C.1 Football-Ball: bereits lizenzgeklärt vorhanden, noch nicht im Repo

`PNG/Equipment/ball_football.png` aus `kenney_sportsPack.zip`
(`https://opengameart.org/content/sports-pack-350`, Kenney Vleugels, **CC0** — dieselbe
Quelle, aus der `public/sprites/basketball/quellen.json` bereits `korb_topdown.png` u. a.
bezieht, s. `korb_topdown.png`-Eintrag dort: *„paket: Sports pack (350+), urheber: Kenney,
lizenz: CC0"*). Herunter geladen und selbst geprüft (Base64-Vergrößerung, visuell
kontrolliert): 14×16 px, brauner Football mit zwei weißen Schnürsenkel-Streifen, korrekt
oval geformt — kein Soccer-Ball unter falschem Namen. Zum Vergleich: die einzige andere
gefundene OpenGameArt-Ressource mit „Football" im Titel
(`opengameart.org/content/football-sprite-based-on-lpc-set`) ist tatsächlich ein
Soccer-Spieler-Sprite (britischer Sprachgebrauch, „football"=Fußball) — geprüft und
verworfen, nicht verwendbar.

Die Datei liegt bei 14×16 px deutlich kleiner als Basketballs `ball.png` (32×32,
`public/sprites/basketball/quellen.json`) oder der `korb_topdown.png` (64×64) — eine
verlustfreie Vergrößerung auf 32×32 oder 64×64 (Nearest-Neighbor, wie bei den
Baukasten-Sprites üblich) ist nötig, kein neuer Download.

### C.2 Football-Helm: drei Blickwinkel, ebenfalls CC0, im selben Paket

`PNG/Equipment/helmet_white1.png` (19×19), `helmet_white2.png` (21×19), `helmet_white3.png`
(26×22) — dieselbe Quelle, dieselbe Lizenz. Visuell geprüft: weißer Football-Helm mit
blauem Gesichtsschutz-/Seitenstreifen, drei vermutlich unterschiedliche Blickwinkel
(die Namen selbst tragen keine Blickwinkel-Angabe; das müsste beim Einbau durch
Sichtprüfung den drei `blickAus()`-Richtungen zugeordnet werden, analog zur bestehenden
Praxis bei anderen Baukasten-Layern).

**Belegt, keine Vermutung:** `unzip` von `kenney_sportsPack.zip`,
`Spritesheet/sheet_equipment.xml` listet exakt 39 benannte Equipment-Sprites
(`ball_basket1-4`, `ball_bowling1-3`, **`ball_football`**, `ball_generic1-2`, `ball_golf`,
`ball_puck`, `ball_soccer1-4`, `ball_tennis1-2`, `ball_volley1-2`, `bat_handle/metal/wood`,
`boxing_glove`, `card_red/white/yellow`, `flag_black/checkered/green/white`, `golf_club`,
**`helmet_white1-3`**, `racket_handle/metal/wood`) — Football ist mit Ball UND Helm
vertreten, **kein Yard-Marker, kein Torpfosten** ist im Paket enthalten (vollständige
Namensliste geprüft, nichts mit „goal"/„post"/„yard"/„field" im gesamten Paket).

### C.3 Football-Feld: braucht KEIN neues Asset

Wie in Abschnitt 0.6/B.3 beschrieben, zeichnet `bodenFeldspiel()` bereits ein vollständiges
Football-Feld vektoriell (Endzonen, Yard-Linien, Mittellinie) — genau wie Basketballs Court
größtenteils vektoriell ist (nur Parkett-Textur und Korb sind Sprites,
`public/sprites/basketball/quellen.json`). Für Football fehlt also nicht die Feld-Grafik,
sondern die mechanische Wahrheit dahinter (Teil B). Torpfosten fehlen im gezeichneten Feld
UND im Sportpaket — laut Kommentar (`engine.js:8371-8373`) bewusst weggelassen, weil sie
„am Canvas-Rand kaum lesbar" wären; das bleibt eine vertretbare Entscheidung, keine Lücke,
die durch das neu gefundene Sportpaket zu schließen wäre (das Paket hat ohnehin keine
Torpfosten).

### C.4 LPC-Baukasten-Layer für ein Football-Trikot — geprüft, nur bedingt tauglich

`public/sprites/baukasten/quellen.json:77` führt `"schulter": "shoulders/pauldrons/male/
slash.png"` — ein LPC-Rüstungslayer, bereits im Repo (`public/sprites/baukasten/
schulter*.png`, inklusive `schulter_walk.png` etc., die aber NICHT in `quellen.json`
dokumentiert sind — dieselbe Dokumentationslücke, die schon für andere Layer im Baukasten
nachgetragen wurde). Selbst geöffnet und vergrößert (384×256 = 6×4 Zellen à 64 px, Slash-
Standardraster): die Schulterstücke sind kleine, GERUNDETE Kappen an der Schulter, keine
spitzen Fantasy-Pauldrons — visuell näher an einem Football-Schulterpolster als erwartet,
aber erkennbar als mittelalterliches Rüstungsteil gestaltet (dünne Metallkante), nicht als
gepolstertes Sport-Trikot. **Einschätzung: als grobe Notlösung für einen ersten
Sichtprüf-Durchlauf brauchbar (ähnliche Silhouette, sofort verfügbar, keine neue Lizenz
nötig), aber KEIN football-spezifisches Asset — für ein überzeugendes Trikot-/
Schulterpolster-Layer wäre eine eigene Suche (z. B. „american football pads sprite
LPC-kompatibel") nötig, die im Rahmen dieser Recherche nichts Passendes ergeben hat
(die einzigen Football-Treffer auf OpenGameArt waren Ball und Helm aus dem Kenney-Paket,
kein Körper-/Rüstungslayer).**

Ein Helm ließe sich nach demselben Muster wie `zeichneHockeyschlaeger()`
(`engine.js:311-347`, eine PROZEDURAL gezeichnete Ausrüstung über dem LPC-Körper statt
eines eigenen Sprite-Layers) als Overlay über den Kopf zeichnen, mit den `helmet_white*`-
Sprites als Vorlage/Textur — dieselbe Technik, mit der Hockey seinen Schläger löst, ohne
einen neuen LPC-Layer zu brauchen.

### C.5 Aufwandseinschätzung Assets (vorgezogen aus Teil E, hier im Kontext)

| Bedarf | Aufwand | Warum |
|---|---|---|
| Ball-Sprite | **sehr gering** | liegt vor (CC0, im bereits genutzten Paket), nur Hochskalieren + `quellen.json`-Eintrag |
| Helm (3 Blickwinkel) | **gering** | liegt vor, muss den `blickAus()`-Richtungen zugeordnet und ggf. als Overlay-Zeichenfunktion verdrahtet werden |
| Feld/Endzonen | **keiner** | bereits gezeichnet |
| Trikot/Schulterpolster | **mittel bis hoch, falls ein ECHTES Asset gewünscht ist** | `schulter`-Layer ist nur eine Notlösung; eine eigene Suche nach einem football-spezifischen LPC-kompatiblen Rüstungslayer war in dieser Recherche erfolglos — vermutlich muss das Team hier wie beim Basketball-Wurf (`thrust`/`spellcast` zweckentfremdet) mit vorhandenen LPC-Blättern improvisieren statt ein neues zu finden |

---

## Teil D — Balancing-Ausblick (Diskussionsgrundlage, kein fertiges Rezept)

**Ausdrücklich nicht final** — wie von Chris verlangt, nur eine Diskussionsgrundlage nach
demselben Verfahren wie `scripts/baue-feldspiel-rezept.mjs` (MATRIX/ERLAUBT-Tabelle,
Sinkhorn-Ausgleich zwischen Matrixbudget und gemessenem mechanischem Gewicht).

**Bestehende Football-MATRIX** (`engine.js:2955`, unverändert seit Basketball-Ära):
`spirit 25, torment 16, health 14, awareness 11, will 10, determination 8, power 6,
stamina 6, charisma 4`.

**Mögliche Sub-Skill-Liste**, orientiert an zengms 21-Rating-Katalog (Abschnitt A.4)
UND unserer bestehenden 7-Sub-Skill-Konvention (AUFBAU/ABSCHLUSS/TECHNIK/ZWEITCHANCE/
ABWEHR/TEAMGEIST/AUSDAUER, wie bei Basketball/Hockey/Tennis) — als reiner
Diskussionsvorschlag, keine Messung dahinter:

| Sub-Skill (Vorschlag) | reales Vorbild | mögliche erlaubte Attribute |
|---|---|---|
| PASSGENAUIGKEIT | zengm `tha`/`thv`, CFB25 `SAC/MAC/DAC` | awareness, determination, dexterity |
| LAUFKRAFT | zengm `elu`/`bsc`, CFB25 `TRK/BTK/COD` | power, health, spirit |
| PASSSCHUTZ (Sack-Vermeidung) | zengm `avoidingSacks`/`pbk` | health, determination, awareness |
| ABWEHR-PASS | zengm `pcv` | torment, awareness |
| ABWEHR-LAUF | zengm `rns`/`tck` | torment, power, health |
| FIELD-GOAL-GENAUIGKEIT | zengm `kac`/`kpw` | dexterity/determination (falls als eigene Rolle gewünscht — heute nicht vorgesehen, Football hat keinen Kicker-Slot) |
| TURNOVER-ANFÄLLIGKEIT | zengm `bsc` (invers) | health, will |

**Wichtiger Vorbehalt, direkt aus Hockeys eigener Geschichte:** die aktuelle
`ERLAUBT`-Tabelle für Hockey (`scripts/baue-feldspiel-rezept.mjs:39-53`) hat ELF Sub-Skills,
weil Hockey zwei Distanzstufen (`SCHUSS_NAH`/`SCHUSS_FERN`) UND eine Torwart-Rolle
(`PARADE`) zusätzlich zu den sieben Basis-Rollen braucht. Football wird nach der
Live-Migration vermutlich AUCH mehr als sieben brauchen (mindestens getrennte
Pass-/Lauf-Erfolgsrollen, wie zengms Trennung von `probComplete` und `doRun` es real
vorlebt) — **die richtige Sub-Skill-Zahl ist eine Folge der Live-Mechanik, nicht eine
Vorentscheidung dieser Recherche.** Genau deshalb steht hier eine Liste zur Diskussion,
keine MATRIX-Neuverteilung.

---

## Teil E — Prioritäten und Aufwandsschätzung

Analog zu `hockey-rollout-plan.md` Teil H, aber für den Startpunkt, an dem Football heute
steht (VOR jeder Live-Migration, während Hockey sie bereits hinter sich hat):

1. **Günstigster erster Schritt: die Assets einbauen, unabhängig von der Motorfrage.**
   Ball und Helm liegen fertig vor (Teil C.1/C.2), das Feld ist gezeichnet (C.3) — das
   lässt sich committen, OHNE auf die Live-Migration zu warten, und verbessert sofort das
   Erscheinungsbild einer Disziplin, die heute noch gar keinen eigenen Sprite-Ordner hat.
   Aufwand: **gering** (ein `public/sprites/football/`-Ordner mit `quellen.json` nach dem
   Vorbild von `public/sprites/basketball/quellen.json`, plus Verdrahtung analog zu
   `bkBild`/`BK_TEILE`, `engine.js:12491-12495`).
2. **Teuerster, aber unumgänglicher Schritt: die Live-Migration selbst (Teil B).** Anders
   als bei Hockey ist die generische Infrastruktur (B.1) bereits vorhanden — das senkt den
   Aufwand gegenüber Hockeys eigener Migration spürbar. Was bleibt, ist football-eigene
   Logik: Down/Distance-Zustand, Formation/Snap-Standphase, eine eigene Erfolgskurve mit
   eigener Struktur (nicht nur eigenen Zahlen, s. B.4). Aufwand: **hoch**, vermutlich
   vergleichbar mit Hockeys eigener Migration (`hockey-rollout-plan.md`,
   `hockey-mechanik-angleichen.md`), eher am oberen Ende, weil Football strukturell weiter
   von Basketball entfernt ist als Hockey (Downs/Serien statt Ballbesitz-Possessions,
   kontinuierliche Laufyards statt Treffer/Fehltreffer).
3. **Trikot/Schulterpolster ist der einzige echte Assets-Unsicherheitsfaktor.** Ball und
   Helm sind gelöst; ein glaubwürdiges Football-Trikot-Layer ist es nicht (C.4/C.5) — wer
   hier mehr als die `schulter`-Notlösung will, muss eine eigene, in dieser Recherche
   erfolglos geführte Asset-Suche wiederholen oder mit der vorhandenen LPC-Rüstung leben,
   wie es das Projekt bei Basketballs Ballträger-Pose bereits tut (`thrust`/`spellcast`
   zweckentfremdet statt einer neuen Sprite-Runde, s.
   `basketball-finalisierung-recherche-fable.md` Abschnitt 2).
4. **Die Rangtreue-Abnahme selbst kommt NICHT vor der Migration.** Wie der Motorkommentar
   selbst sagt (`engine.js:3759-3764`) und wie Punkt 0.5 frisch belegt (153,3 Punkte/Spiel,
   Eignung-Impact-Umkehrung im Beispielspiel): ein Rezept-Feintuning auf dem Vorab-Pfad ist
   nach der Migration wertlos. Die richtige Reihenfolge ist dieselbe wie beim Hockey-Plan:
   **erst der Live-Motor, dann das Rezept, nie umgekehrt.**

---

## Anhang: Quellenliste

- `github.com/zengm-games/zengm`, `src/worker/core/GameSim.football/{index,Play,formations,penalties,getCompositeFactor}.ts` — sparse geklont, gelesen; `LICENSE.md` geprüft (nicht klassisch open source, Lesen/Zitieren gedeckt).
- `github.com/zengm-games/zengm`, `src/common/{types.football,posRatings.football}.ts` — Rating-Katalog.
- `github.com/GridironApps/javascript-football-simulation` — geprüft, README-TODO, keine Formeln.
- `github.com/willlstone/NFL-Game-Simulator` — geprüft, keine dokumentierten Formeln.
- StatMuse-Abfragen (2024-Saison-Aggregate): Plays/Spiel, Pass-/Lauf-Attempts-Summen, Sacks/Spiel-Trend 2020–2024, Turnover-Summe, Completion-Quote, Yards/Attempt, 3.-Versuch-Konversion, Punkte/Spiel. Jede Zahl mit zugrundeliegender Summe/Spielzahl gegengerechnet (Abschnitt A.1), nicht blind übernommen.
- `nbcnews.com/news/sports/nfl-touchdowns-decline-since-2020-field-goals-defense-rcna124221` — Touchdown-/Field-Goal-Trend 2020 vs. 2023.
- `streakedge.com/nfl-scoring-breakdown/` — TD-Typ-Verteilung (~2015, als Trend markiert).
- WSJ-2010-Studie „11 Minuten Ball im Spiel" — über Zweitquellen `foxsports.com`, `leanblog.org`, `jvlone.com` (PDF), `quartz.com` bestätigt; WSJ-Original selbst nicht direkt abgerufen.
- `opengameart.org/content/sports-pack-350` (Kenney, CC0) — `kenney_sportsPack.zip` heruntergeladen, entpackt, `Spritesheet/sheet_equipment.xml` und `PNG/Equipment/*` selbst geprüft (Ball, Helm, vollständige 39-Sprite-Namensliste).
- `opengameart.org/content/football-sprite-based-on-lpc-set` — geprüft, ist ein Soccer-Sprite, verworfen.
- `randalolson.com/2017/01/10/machine-learning-madden-nfl-how-madden-player-ratings-are-actually-calculated/` — Punter-OVR-Formel als reales Regressionsergebnis zitiert.
- `thegamer.com/ea-sports-college-football-25-every-stat-guide/` — 54-Stat-Katalog EA Sports College Football 25.
- Nicht verwendbar (403 über den Umgebungs-Proxy oder die Zielseite selbst, nicht als Quelle zitiert): `teamrankings.com/nfl/stat/*`, `pro-football-reference.com/years/*`, `footballdb.com/statistics/play-selection.html`.

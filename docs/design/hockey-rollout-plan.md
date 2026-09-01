# Designplan: Hockey als zweite vollständige Disziplin

Recherche-Stand: 2026-09-01, Repo `/home/user/Olympiade-der-Welten`, gemessen gegen
`origin/main` `11c5a4e0` („Rezepte in eine eigene Datei, ein Spiel-Aufruf fuer alle 20
Disziplinen", PR #726). Alle Datei-/Zeilenangaben sind gegen genau diesen Stand geprüft.
Auftrag von Chris: *„Bereite mal die nächste Disziplin, z.B. Hockey, vor anhand ALLER
Mechaniken und Errungenschaften die wir im Basketball haben, natürlich mit passenden Stats
die zum Hockey gehören wie Tore, Tacklings usw. und den eingearbeiteten Stats aus den
Diszi-Verteilungen."*

Stil/Struktur an `docs/design/fatigue-saisonlaenge-plan.md` angelehnt. Vorgänger-Pläne:
`docs/design/battle-arena-multi-disziplin-plan.md` (Welle 1 = Football + Hockey),
`docs/BATTLE_ARENA_UEBERGABE.md` (Chassis-Überblick, „Keine erfundenen Werte"),
`docs/design/battle-mode-nba2k-modell-plan.md` (Rangtreue als zweite Abnahmezahl).

**Jede Zahl in diesem Plan ist entweder selbst gemessen (mit Befehl), aus dem Code zitiert
(mit Datei:Zeile) oder eine reale Sport-Referenz (mit Quelle). Was ich nicht geprüft habe,
steht als „nicht geprüft" da.** Was ich nicht prüfen konnte, steht gesammelt in Teil G.

---

## 0. Wichtige Funde vorab

1. **Hockey ist heute keine „halbfertige Live-Disziplin", sondern eine Vorab-Disziplin —
   und der Unterschied ist größer als der Plan es bisher darstellt.** `bauFeldspiel()`
   verzweigt in genau einer Zeile: `if(feldspielDisc==="basketball"){ initBasketballLive(art);
   return; }` (`public/mockups/battle-mode.engine.js:4072`). Alles darunter — die
   Manndeckung, der Ballträger, die Wurfformel `technikMake`, `GEO_BONUS`, der
   Rebound-Zweikampf, die Freiwurf-Standphase, der Schiedsrichter, das Fokus-Doppeln, die
   Viertel-Struktur — läuft für Hockey **überhaupt nicht**. Hockey rechnet 28 Züge in einer
   `for`-Schleife vorab durch (`engine.js:4077-4160`) und enthüllt sie danach im Takt von
   `zugDauer` (`engine.js:6350 ff.`). Von den in Teil C aufgeführten Basketball-Mechaniken
   ist heute **keine einzige** für Hockey aktiv.
2. **Der Feature-Rückstand aus dem Multi-Diszi-Plan (§3) ist inzwischen abgearbeitet — für
   Basketball.** Freiwurf-Standphase (`starteFreiwuerfe`, `engine.js:5192`), Schiedsrichter
   (`schiriPfeift`, `engine.js:5291`) und Fokus-Doppeln (`FOKUS_*`-Konstanten,
   `engine.js:3851 ff.`) existieren alle drei. Der Kommentar an `fsLive.phase`
   (`engine.js:4356-4364`) sagt selbst, wofür die Naht gebaut wurde: *„Football
   (Snap-Formation), Hockey (Bully) und Tennis (Aufschlag) brauchen exakt dieselbe
   Struktur"*. Der Rückstand ist also **kein Hindernis mehr, sondern ein Vorrat** — er
   wartet auf die erste Disziplin, die ihn erbt.
3. **Das eigentliche Nadelöhr ist die Abnahme, nicht die Mechanik.** Basketballs zweite
   Abnahmezahl (Rangtreue, `scripts/miss-basketball-rangtreue.mjs`) hängt an
   `window.__arena.basketballProbe` (`engine.js:13375`) — und diese Sonde ist hart auf
   `MOTOREN.basketball`/`FELDSPIEL_ART.basketball` verdrahtet und liest ausschließlich
   Felder, die **nur die Live-Engine schreibt**: `fsLive.amBall`, `u.deckt`, `e.tier`,
   `e.deckerAbstandBeiWurf`, `e.offensiv`. Der Vorab-Pfad erzeugt keines davon. Für Hockey
   lässt sich heute also **die halbe Abnahme gar nicht fahren** — unabhängig davon, wie gut
   das Rezept ist. Das ist der Grund, warum PR 0 in Teil E vor allem anderen steht.
4. **Die Pp-Abweichung ist gemessen schlechter, als die Übergabe sie ausweist — und die
   Ursache ist strukturell, nicht Rezeptgeschmack.**
   `docs/BATTLE_ARENA_UEBERGABE.md:1113` nennt 46,4 Pp bei n = 12. Gemessen bei drei
   Stichprobengrößen: **51,0 Pp (n = 24) / 48,1 Pp (n = 48) / 44,5 Pp (n = 96)**. In allen
   drei Läufen lesen **health und stamina gleichgerichtet zu niedrig** (health −10,6/−9,6/−6,9;
   stamina −8,2/−9,0/−9,0) — das ist nach der Regel aus dem Basketball-Rezeptkommentar
   („nur gleichgerichtete Abweichungen behandeln") die einzige echte Struktur im Befund.
   Zusammen tragen die beiden 28 von 100 Matrixpunkten und lesen 9,2-12,1 %.
5. **Ein Sondierungslauf erklärt das vollständig — und macht es reparierbar.** Mit
   orthogonalen Rezepten (jeder Sub-Skill von genau einem Attribut gespeist, so dass der
   gemessene Attributanteil das mechanische Gewicht des Sub-Skills IST) trägt Hockeys
   Vorab-Mechanik:

   | Sub-Skill | mech. Gewicht (n=48) | (n=96) |
   |---|---:|---:|
   | ABWEHR | 36,1 % | 33,5 % |
   | AUFBAU | 24,0 % | 24,6 % |
   | TEAMGEIST | 20,0 % | 21,0 % |
   | ABSCHLUSS | 12,5 % | 12,0 % |
   | TECHNIK | 3,7 % | 4,3 % |
   | AUSDAUER | 2,7 % | 3,2 % |
   | ZWEITCHANCE | 1,0 % | 1,4 % |

   `stamina` sitzt heute ausschließlich in AUSDAUER (50 %) — 0,50 × 3,2 = **1,6 %**
   mechanisch verfügbar bei einer Matrixvorgabe von 10. Das Rezept kann das nicht heilen,
   solange stamina keine zweite Heimat bekommt. Dasselbe für `will` (nur AUSDAUER, 0,6 %
   verfügbar bei Vorgabe 4) und `determination` (nur TECHNIK, 1,1 % bei Vorgabe 4).
6. **Aus diesem Befund ließ sich in EINEM Anlauf ein Rezept bauen, das die Abnahmeschwelle
   unterschreitet: 48,1 → 14,2 Pp (n = 48), 44,5 → 17,2 Pp (n = 96).** Belegt, reproduzierbar,
   Details in A.4. Das ist der Beweis, dass die Sub-Skill-Sondierung als Arbeitsweise trägt —
   und zugleich der Grund, warum sie **jetzt noch nicht angewendet werden soll**: die
   gemessenen Gewichte gelten für die Vorab-Mechanik. Migriert Hockey auf die Live-Engine,
   ändern sich alle sieben Zahlen (Basketballs Live-Sondierung liest ZWEITCHANCE 10,3 /
   ABWEHR 21,8 / SCHUSS_NAH 17,5 / LAUFTEMPO 14,8 — `public/mockups/battle-mode.rezepte.js`,
   Sondierungs-Absatz), und das Rezept ist wertlos. **Reihenfolge schlägt Rezeptqualität.**
7. **Realismus und Matrixtreue sind zwei getrennte Achsen — das Kandidatenrezept beweist
   es.** Es senkt die Pp-Abweichung um zwei Drittel und lässt die Torzahl praktisch
   unverändert (6,63 → 6,76 Tore je Team). Hockey erzielt heute **6,63 Tore je Team und Spiel bei einer
   Trefferquote von 66,6 % auf 10,2 Abschlüsse**; die NHL liegt bei rund 3,05 Toren je Team
   auf ~28 Schüssen, also gut 10 % Schussquote. Das ist **kein Rezeptproblem**, sondern die
   Erfolgsformel `Math.min(0.92, 0.16 + TECHNIK*0.0050 + TEAMGEIST*0.0060)`
   (`engine.js:4136-4138`) — dieselbe Formel, die Basketball 2026-08-26 gegen echte
   FG%-Referenzen ersetzt hat und die im Vorab-Pfad unangetastet stehen blieb.
8. **Hockeys Kadergröße ist nicht 6, und sie ist auch nicht fest.** Der Katalogwert ist
   **5** (`lib/data/dataAdapter.ts:69`, gespiegelt in
   `lib/season/season-discipline-area-groups.ts:62`); die Arena spielt aber 6 gegen 6
   (`FELDSPIEL_ART.hockey.jeSeite:6`, `engine.js:3456`), und **nichts außerhalb des Mockups
   setzt `jeSeite`** (`grep -rn "jeSeite" lib/ app/ scripts/` → kein Treffer). Schlimmer:
   `buildSeasonPlayerCountByDiscipline` würfelt die Kadergröße **je Saison neu** und
   verteilt in einer Kategorie mit genau fünf Disziplinen die Permutation `[2,3,4,5,6]`
   (`lib/season/season-discipline-schedule.ts:89-94`). Hockey liegt in der Kategorie
   `power` mit genau fünf Disziplinen (mini-dm, tdm, gewichtheben, hockey, breaking —
   `lib/data/dataAdapter.ts:56/61/66/69/74`). **Hockey kann also in einer Saison mit zwei
   Spielern je Seite gespielt werden.** Das ist die härteste Randbedingung für die
   Torwart-Frage (Teil B.4).
9. **Der Produktivschalter ist eine Zeile.** `ARENA_RESOLVED_DISCIPLINE_IDS =
   new Set(["basketball"])` (`lib/resolve/battle-mode-arena-team-points.ts:32`) ist die
   einzige Stelle, die entscheidet, welche Disziplin im Battle-Mode-Save über die Arena
   aufgelöst wird. Hockey aufzunehmen ist ein Einzeiler — der aber eine Produktfrage
   mitbringt: die Arena vergibt 2/1/0 (`ARENA_TEAM_POINTS`, ebenda :35-39), und **Hockey
   produziert heute 18,8 % Unentschieden, Basketball 0 %** (gemessen, A.2).

---

## Teil A — Bestandsaufnahme Hockey (gemessen)

### A.1 Wie Hockey heute gebaut und gespielt wird

`FELDSPIEL_ART.hockey` (`engine.js:3453-3472`), vollständig zitiert:

```js
label:"Hockey", jeSeite:6, zuegeJeSeite:14, zugDauer:60/(14*2*2),
punkteNah:1, punkteFern:1, fernAnteil:0,
wortAbwehr:"Check", wortBlock:"Save", wortRebound:"Abpraller",
rezept:{
  AUFBAU:      {awareness:35,speed:35,power:30},
  ABSCHLUSS:   {power:40,torment:30,dexterity:30},
  TECHNIK:     {dexterity:40,awareness:35,determination:25},
  ZWEITCHANCE: {power:40,health:35,torment:25},
  ABWEHR:      {health:40,power:35,speed:25},
  TEAMGEIST:   {spirit:60,torment:40},
  AUSDAUER:    {stamina:50,health:30,will:20}
}
```

Sieben Sub-Skills, keine `spielzuege`-Tabelle (Basketball hat den Alley-Oop, Football zwei
Züge — Hockey und Tennis haben keine). `fernAnteil:0` schaltet die vorhandene
Zwei-Distanz-Struktur vollständig ab: jeder Abschluss ist ein „Nahwurf" zu 1 Punkt.

Der Ablauf je Zug (`engine.js:4077-4160`), verkürzt:

1. Anspieler per `gewichtetesLos(team,"AUFBAU")`, Verteidiger per
   `gewichtetesLos(gegnerTeam,"ABWEHR")` — beide **linear** gewichtet. (Basketballs
   Live-Pfad nutzt seit dem NBA2K-Umbau `losGewicht` mit Nullpunkt 20 und Exponent 3,
   `engine.js:3562`; der Kommentar dort hält ausdrücklich fest, dass
   `gewichtetesLos()` unangetastet bleibt, weil es **nur** Football/Hockey/Tennis
   betrifft.)
2. `ermued = 1 − max(0, 60−AUSDAUER) × 0,003 × (z/(gesamtZuege−1))` — der einzige
   Ermüdungsterm im ganzen Feldspiel-Chassis (`engine.js:4092`). Die Live-Engine hat
   keinen; der Basketball-Rezeptkommentar zu AUSDAUER nennt genau das („mechanisch tot").
3. `aufbauChance = clamp(0,20 … 0,94; 0,50 + (AUFBAU−ABWEHR)×0,0035 + TEAMGEIST×0,0060) × ermued`.
   Misslingt sie: Ballverlust, `wortAbwehr` = „Check".
4. Pass mit `passChance = clamp(0,20 … 0,75; 0,35 + AUFBAU×0,0030)` an
   `gewichtetesLos(mitspieler,"ABSCHLUSS")`.
5. Abschluss: `technik = min(0,92; 0,16 + TECHNIK×0,0050 + TEAMGEIST×0,0060)`
   (`engine.js:4136-4138`). Trifft er: 1 Punkt, Passgeber bekommt die Vorlage.
6. Sonst Zweikampf um den Abpraller:
   `chance = clamp(0,15 … 0,85; 0,45 + (ZWEITCHANCE−ABWEHR)×0,0035)`. Gewonnen →
   „Abpraller", verloren → „Save" für den Verteidiger.

**Spieldauer:** 28 Züge × `60/(14·2·2)` = 1,0714 s = **30 Sekunden**, und `ZEIT_DEHNUNG`
(`engine.js:11514`) führt keinen Hockey-Eintrag, der Faktor ist also 1. Basketball läuft
dagegen 4 × 90 = 360 Simulationssekunden bei Dehnung 2, also **rund 12 Minuten
Zuschauzeit** (`engine.js:3639-3641`). *Diese beiden Zahlen sind aus dem Code gerechnet,
nicht im Browser nachgestoppt.*

### A.2 Was die Simulation ausgibt (gemessen)

```sh
node scripts/miss-hockey-bestand.mjs hockey 48
```
(neues Skript dieser Runde, siehe A.5; Quelle `public/mockups/battle-mode.html` des
Worktrees, Stand `11c5a4e0`)

| | Hockey | Football (Kontrolle) | Basketball (Kontrolle, n=8) |
|---|---:|---:|---:|
| Punkte/Tore je Team und Spiel | **6,63** | 27,06 | 41,13 |
| Spanne | 2-11 | 12-45 | 24-74 |
| Unentschieden-Anteil | **18,8 %** | 14,6 % | **0 %** |
| Züge je Team | 14,00 | 8,00 | — (Live) |
| davon Ballverlust | 3,77 (26,9 %) | 1,04 (13,0 %) | — |
| Abschlüsse je Team | **10,23** | 6,96 | — |
| Treffer | 6,81 | 5,10 | — |
| **Trefferquote** | **66,6 %** | 73,4 % | — |
| abgewehrt („Save") | 1,78 (17,4 %) | 0,97 (13,9 %) | — |
| Abpraller | 1,64 (16,0 %) | 0,89 (12,7 %) | — |

Basketball wurde mit n = 8 gemessen (`--ohne-einfluss`), weil die Live-Engine je Spiel 360
Simulationssekunden rechnet; die Ereignis-Bilanz-Spalten sind für Basketball leer, weil das
Live-Protokoll andere Ereignisarten führt.

**Sub-Skill-Spreizung** einer frisch gebauten Hockey-Aufstellung (Saat 1337, zwölf Spieler,
`window.__arena.feldspielSubskills("hockey")`):

| Sub-Skill | min | max | Spanne | Mittel |
|---|---:|---:|---:|---:|
| AUFBAU | 29 | 84 | 55 | 46,4 |
| ABSCHLUSS | 19 | 84 | 65 | 52,8 |
| TECHNIK | 7 | 76 | 69 | 42,7 |
| ZWEITCHANCE | 26 | 99 | 73 | 68,5 |
| ABWEHR | 37 | 99 | 62 | 66,5 |
| TEAMGEIST | 34 | 91 | 57 | 50,7 |
| AUSDAUER | 34 | 82 | 48 | 56,9 |

Kein Sub-Skill ist degeneriert (alle Spannen > 45) — die Rezepte trennen die Spieler
sauber. Das Problem sitzt **nicht** in der Spreizung, sondern darin, welche dieser Spannen
die Mechanik überhaupt liest (A.3).

### A.3 Pp-Abweichung und die Sondierung

```sh
node scripts/messe-arena-einfluss.mjs hockey 24|48|96 <pfad-zur-battle-mode.html>
```

| Disziplin | n | Abweichung |
|---|---:|---:|
| Hockey | 24 | 51,0 Pp |
| Hockey | 48 | **48,1 Pp** |
| Hockey | 96 | 44,5 Pp |
| Football | 48 | 57,9 Pp |
| Tennis | 48 | 28,6 Pp |
| Basketball | — | *nicht selbst gemessen* — siehe Teil G |

Hockey bei n = 48, vollständig:

| Attribut | Anteil | Matrix | Differenz |
|---|---:|---:|---:|
| power | 21,3 % | 18 | +3,3 |
| spirit | 16,8 % | 12 | +4,8 |
| awareness | 15,2 % | 8 | +7,2 |
| speed | 14,6 % | 12 | +2,6 |
| torment | 14,5 % | 10 | +4,5 |
| **health** | **8,4 %** | **18** | **−9,6** |
| dexterity | 5,6 % | 4 | +1,6 |
| determination | 2,5 % | 4 | −1,5 |
| **stamina** | **1,0 %** | **10** | **−9,0** |
| intelligence | 0 % | 0 | 0,0 |
| charisma | 0 % | 0 | 0,0 |
| will | 0 % | 4 | −4,0 |

Dass intelligence und charisma exakt 0,0 % lesen, ist **richtig** und wichtig: die
Hockey-Matrix gewichtet beide mit null (`lib/player-generator/official-discipline-weights.ts`,
Hockey-Spalte; gespiegelt in `engine.js:2667`). Daraus folgt eine harte Bauregel für Teil B:
**kein Hockey-Sub-Skill darf intelligence oder charisma benutzen.** Basketballs
SCHUSS_FERN (`intelligence:50`) und TEAMGEIST (`charisma:56`) sind damit wörtlich nicht
übertragbar.

**Sondierungslauf** (orthogonale Rezepte, Kopie unter `/tmp/.../scratchpad/sondierung2/`,
nicht im Repo — jeder Sub-Skill von genau einem Attribut zu 100 % gespeist, so dass der
gemessene Attributanteil das mechanische Gewicht des Sub-Skills ist; Zuordnung
AUFBAU→awareness, ABSCHLUSS→dexterity, TECHNIK→determination, ZWEITCHANCE→health,
ABWEHR→torment, TEAMGEIST→spirit, AUSDAUER→stamina). Ergebnis siehe Fund 0.5.

*Zwei ehrliche Vorbehalte zur Sondierung:* (a) Sie misst das Gewicht **an dem
Betriebspunkt, den die orthogonalen Rezepte erzeugen** — `aufbauChance` und `technik` sind
gedeckelt (0,94 bzw. 0,92), ein anderer Wertebereich kann die Gewichte verschieben.
(b) Die Eignung wird von `einflussVon` mitgehoben (`plus × Gewicht/100`), aber der
Vorab-Pfad liest die Eignung nirgends in der Simulation (`u.eig` wird in `bauSpieler`
gesetzt und nur von der Anzeigegröße `leistungVon` gelesen, `engine.js:9780-9782`) — für diesen Pfad ist die Sondierung dadurch sauber. Für die
Live-Engine gilt das nicht automatisch.

**Was die Sondierung vorhersagt.** Multipliziert man die Rezeptanteile mit den mechanischen
Gewichten (n = 96), ergibt sich je Attribut:

| Attribut | Vorhersage | gemessen (n=96) | Matrix |
|---|---:|---:|---:|
| power | 24,5 | 21,9 | 18 |
| health | 14,9 | 11,1 | 18 |
| speed | 17,0 | 15,2 | 12 |
| spirit | 12,6 | 17,5 | 12 |
| stamina | 1,6 | 1,0 | 10 |
| torment | 12,4 | 15,4 | 10 |
| awareness | 10,1 | 11,3 | 8 |
| determination | 1,1 | 1,2 | 4 |
| dexterity | 5,3 | 4,9 | 4 |
| will | 0,6 | 0,4 | 4 |

Summe der Beträge der Vorhersagefehler: **18,6 Pp** über zehn Attribute. Zum Vergleich: für
die Basketball-**Live**-Engine ist genau dieses lineare Modell dokumentiert gescheitert
(~49 Pp Prognosefehler in der Kreuzvalidierung, fünf von fünf daraus abgeleitete Rezepte
schlechter — `public/mockups/battle-mode.rezepte.js`, Punkt 1 des Basketball-Blocks). Der
Unterschied ist plausibel und wichtig: der Vorab-Durchlauf ist eine kurze, weitgehend
lineare Kette ohne Positions-Rangwechsel, die Live-Engine ist es nicht. **Für die
Vorab-Mechanik ist das Modell brauchbar, für die Live-Engine bleibt es widerlegt.**

### A.4 Ein Kandidatenrezept, gemessen — als Beleg, nicht als Vorschlag für jetzt

Nach Chris' Budget-Methode aus den Sondierungsgewichten abgeleitet (jedes Attribut verteilt
sein Matrixgewicht auf Sub-Skills, in denen es logisch etwas zu suchen hat; die auf einen
Sub-Skill entfallende Gesamtmasse muss seinem mechanischen Gewicht entsprechen):

```js
AUFBAU:      {speed:30, power:28, awareness:21, stamina:21}
ABSCHLUSS:   {power:58, torment:16, dexterity:14, awareness:12}
TECHNIK:     {dexterity:55, determination:25, awareness:20}
ZWEITCHANCE: {health:60, power:25, torment:15}
ABWEHR:      {health:48, torment:19, speed:14, power:9, determination:6, awareness:4}
TEAMGEIST:   {spirit:57, will:19, stamina:14, torment:10}
AUSDAUER:    {stamina:60, determination:25, will:15}
```

Gemessen (Kopie unter `/tmp/.../scratchpad/kandidat/`, **nicht im Repo, nicht in
Produktionscode**):

| | vorher | Kandidat |
|---|---:|---:|
| Pp, n = 48 | 48,1 | **14,2** |
| Pp, n = 96 | 44,5 | **17,2** |
| Tore je Team | 6,63 | 6,76 |

Die vorhergesagten 4,0 Pp wurden **nicht** erreicht — der Modellfehler aus A.3 schlägt
erwartungsgemäß durch. Erreicht wurde trotzdem die allgemeine Abnahmeschwelle (≤ 25 Pp,
Multi-Diszi-Plan §4.3) in beiden Stichproben und die Leuchtturm-Schwelle (≤ 15 Pp) in
einer.

**Warum das trotzdem nicht in diese Runde gehört:** die Gewichte, aus denen es abgeleitet
ist, gehören der Vorab-Mechanik. Sobald Hockey live läuft (PR 3), sind sie andere Zahlen,
und die Arbeit ist weg. Der Kandidat steht hier als **Beleg für die Methode und für die
Erreichbarkeit des Ziels**, nicht als Lieferung.

### A.5 Was ich dafür gebaut habe

`scripts/miss-hockey-bestand.mjs` (neu, in diesem Commit). Es misst nichts neu und ändert
nichts — es liest ausschließlich bereits exportierte `window.__arena`-Funktionen
(`boxscoreSerie`, `feldspielSubskills`, `spiele`, `einflussVon`, `matrix`) und fasst sie zu
einem Lauf zusammen. `--ohne-einfluss` lässt den teuren Teil aus (nötig für Basketball).

**Eine Falle, die dabei aufgefallen ist und im Repo bleibt:**
`scripts/messe-arena-einfluss.mjs:44` trägt den Pfad zur Mockup-Datei als absolutes Literal
auf den Haupt-Checkout (`/home/user/Olympiade-der-Welten/public/mockups/battle-mode.html`).
Wer in einem Worktree arbeitet und den vierten Aufrufwert weglässt, misst die Datei des
Haupt-Checkouts statt der eigenen — bei mir war die dort liegende Datei 402 Zeilen
älter (13.208 gegen 13.610 Zeilen). Das neue Skript löst den Pfad relativ zu sich selbst
auf; `messe-arena-einfluss.mjs` ist **nicht** angefasst worden (Fremd-Datei, eigener PR).

---

## Teil B — Die Hockey-Stats und Sub-Skills

### B.1 Die Randbedingungen, aus denen alles folgt

1. **Die Matrix ist die Ansage.** Hockey:
   `power 18 · health 18 · speed 12 · spirit 12 · stamina 10 · torment 10 · awareness 8 ·
   determination 4 · dexterity 4 · will 4` — intelligence und charisma **null**
   (`lib/player-generator/official-discipline-weights.ts`, Hockey-Spalte). Zum Vergleich
   Basketball: `spirit 22 · intelligence 16 · awareness 14 · charisma 11 · speed 10 ·
   dexterity 8 · power 7 · stamina 6 · torment 6` — health, will, determination null. Die
   beiden Disziplinen teilen **kein einziges** führendes Attribut. Ein Hockey-Rezept, das
   Basketballs Rezept nachbaut, ist deshalb von vornherein falsch.
2. **Die Slot-Rollen existieren schon** (`lib/lineups/matchday-slot-roles.ts:169-176`):
   Power Forward (power/health), Defensive Wall (health/spirit), Playmaker
   (awareness/power), Transition Runner (speed/stamina), Slot Finisher (power/torment),
   Captain Line (spirit/awareness). Sechs Rollen, **kein Torwart**. Sie sind aus der Matrix
   erzeugt (`scripts/generiere-arena-daten.ts`) und liegen im Mockup als
   `SLOTS_JE_DISC.hockey` (`engine.js:2746-2753`).
3. **Jeder Sub-Skill braucht eine Boxscore-Zahl**, sonst ist er für Chris unsichtbar, und
   **jeder Sub-Skill braucht mechanisches Gewicht**, sonst ist er für die Messung tot
   (Basketballs AUSDAUER ist das abschreckende Beispiel).

### B.2 Der vorgeschlagene Satz

Elf Sub-Skills für Feldspieler plus PARADE für die Torhüter-Rolle, zusammen zwölf.
Basketball hat zehn; die Aufspaltung von ABWEHR in CHECK und SCHUSSBLOCK ist der wichtigste
Unterschied und der Grund, warum health, determination und will endlich eine Heimat
bekommen.

| Sub-Skill | Real-Vorbild | Attribute (Auswahl) | Sichtbar im Boxscore als |
|---|---|---|---|
| **SPIELAUFBAU** | Breakout aus der eigenen Zone, Puck durch die neutrale Zone | speed, awareness, stamina, power | Zonenaufbau gelungen / Ballbesitz-Anteil |
| **ABSCHLUSSDRANG** | „will den Puck, wenn es eng wird" — Auswahlgröße, keine Erfolgsgröße | power, spirit | Schussanteil (eigene Schüsse / Teamschüsse) |
| **SCHUSS_NAH** (Ablenker) | Tip-in, Backhand, Nachschuss aus dem Slot | dexterity, torment, health | Tore aus dem Slot |
| **SCHUSS_FERN** (Schusshärte) | Slapshot von der blauen Linie, One-Timer | power, awareness, speed | Tore von außen |
| **PUCKFUEHRUNG** | Stickhandling, Schussauswahl, Puck halten | dexterity, awareness, determination | Ballverlustquote (invers) |
| **ABPRALLER** | Loose-Puck-Battle vor dem Tor | torment, health, power | Abpraller-Tore, gewonnene Zweikämpfe |
| **CHECK** | Bodycheck, Stockcheck, Puck erobern | torment, power, health, speed | Checks, eroberte Pucks |
| **SCHUSSBLOCK** | Sich in den Schuss werfen, Passwege zustellen | health, determination, awareness, will | geblockte Schüsse |
| **LINIENSPIEL** | Chemie in der Reihe, Vorlagen | spirit, torment | Vorlagen |
| **SCHICHTKRAFT** | Schichtwechsel, drittes Drittel | stamina, health, will, spirit | Leistungsabfall im 3. Drittel |
| **TEMPO** | Schlittschuhtempo, Rennen um freie Pucks | speed, stamina, dexterity | gewonnene Rennen, Konter |
| **PARADE** (Torwart) | Fangquote, Stellungsspiel, Abpraller-Kontrolle | dexterity, awareness, will, determination, health | Fangquote, Gegentore |

**Die zwei Trennungen, die entscheiden, ob Archetypen sichtbar werden.** Basketballs
Archetypen-Runde hat gezeigt, dass zwei Sub-Skills, die dieselben führenden Attribute
haben, mechanisch nicht trennbar sind (Rezeptkommentar zu ABWEHR: *„Wer ABWEHR über 90
wollte, MUSSTE beide hochziehen — und bekam den Distanzschützen gratis dazu"*). Für Hockey:

- **SCHUSS_NAH führt dexterity, SCHUSS_FERN führt power.** Kein gemeinsames führendes
  Attribut. Der Slot-Finisher (dexterity + torment) und der Schütze von der blauen Linie
  (power + awareness) sind dadurch zwei verschiedene Builds.
- **CHECK führt torment, SCHUSSBLOCK führt health.** Der Bodychecker und der Shotblocker
  sind zwei verschiedene Verteidigertypen — real genau so (der eine spielt Mann, der andere
  Raum).

### B.3 Das Attribut-Budget nach Chris' Methode

Jede Zeile ist das 100-%-Budget eines Attributs, verteilt auf die Sub-Skills, in denen es
logisch etwas zu suchen hat. Die Spaltensumme (Matrixgewicht × Anteil, aufsummiert) ist die
Masse, die auf diesem Sub-Skill landet — und **die muss dem mechanischen Gewicht des
Sub-Skills entsprechen**, sonst geht die Rechnung nicht auf.

| Attribut (Matrix) | AUFB | ADRG | S_NAH | S_FERN | PUCK | ABPR | CHECK | SBLOCK | LINIE | SCHICHT | TEMPO | PARADE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| power 18 | 15 | 20 | – | 30 | – | 10 | 25 | – | – | – | – | – |
| health 18 | – | – | – | – | – | 20 | 25 | 35 | – | 15 | – | 5 |
| speed 12 | 25 | – | – | – | – | – | 20 | – | – | – | 55 | – |
| spirit 12 | – | 15 | – | – | – | – | – | – | 75 | 10 | – | – |
| stamina 10 | 25 | – | – | – | – | – | – | – | – | 45 | 30 | – |
| torment 10 | – | – | 25 | – | – | 25 | 40 | – | 10 | – | – | – |
| awareness 8 | 30 | – | – | 20 | 20 | – | – | 15 | – | – | – | 15 |
| determination 4 | – | – | – | – | 20 | – | – | 40 | – | 10 | – | 30 |
| dexterity 4 | – | – | 35 | – | 30 | – | – | – | – | – | 10 | 25 |
| will 4 | – | – | – | – | – | – | – | 30 | – | 30 | – | 40 |
| **Masse (Soll-Gewicht)** | **10,6** | **5,4** | **3,9** | **7,0** | **3,6** | **7,9** | **15,4** | **10,3** | **10,0** | **10,0** | **10,0** | **5,9** |

(Summe der Massen = 100,0. Nachgerechnet.)

**Das ist die eigentliche Konstruktionsaufgabe an den Motor**, und sie ist streng: die
Mechanik muss diesen zwölf Sub-Skills annähernd diese Gewichte geben. Die heutige
Vorab-Mechanik verteilt 33,5 % auf einen einzigen (ABWEHR) und 1,4 % auf einen anderen
(ZWEITCHANCE) — Basketballs Live-Engine ist mit 21,8 / 17,5 / 14,8 / 11,4 / 10,3 deutlich
flacher, aber immer noch nicht so flach wie diese Tabelle verlangt. **Ob die Live-Engine
eine so flache Verteilung überhaupt hergibt, ist offen und wird erst durch die Sondierung
nach PR 3 beantwortet.** Kommt sie nicht hin, verschieben sich die Prozente in der Tabelle —
nicht die Semantik.

Drei Punkte, die aus der Tabelle direkt Anforderungen an den Motor machen:

1. **SCHICHTKRAFT braucht 10 % mechanisches Gewicht.** Heute trägt der Vorab-Ermüdungsterm
   3,2 % (gemessen) und die Live-Engine **null** — sie liest `u.AUSDAUER` an keiner Stelle
   (Basketball-Rezeptkommentar, AUSDAUER-Absatz). Ohne einen echten Ermüdungs-/Schichtterm
   in der Live-Engine sind stamina (10) und will (4) in Hockey nicht einlösbar.
2. **SCHUSSBLOCK braucht 10 % und ist heute überhaupt nicht vorhanden.** Ein geblockter
   Schuss existiert im Chassis nur als `wortBlock` — die Beschriftung des verlorenen
   Abpraller-Zweikampfs, nicht als eigenes Ereignis.
3. **CHECK (15,4 %) ist der größte Einzelposten** und damit der Ort, an dem torment, power
   und health zusammenkommen. Das ist inhaltlich richtig für Eishockey und deckt sich mit
   der Matrix (power 18 + health 18 + torment 10 = 46 der 100 Punkte).

### B.4 Der Torwart — die offene Strukturfrage

**Was der Motor heute hergibt (geprüft, nicht vermutet).**
`bauSpieler` (`engine.js:4034-4060`) baut **alle** `art.jeSeite` Spieler durch exakt
dieselbe Funktion, aus demselben Rezept, mit denselben sieben Sub-Skills. Es gibt keinen
Spielertyp, keine Rollenkennung, kein Feld, an dem sich „dieser ist anders" festmachen
ließe. Die einzigen zwei Differenzierungskanäle sind:

- der **Slot** (`slotFuer`, `engine.js:4020`) → `slotAufschlag` (±8,5 auf den
  Disziplinwert, `SLOT_PROFILE_MODIFIER_SCALE` aus dem Spiel), und
- **`BASKETBALL_POS_MOD`** (`engine.js:4003-4010`, angewandt in `:4043`): ±1 bis ±4 auf
  einzelne Sub-Skills je Slot — ausdrücklich nur für Basketball gegatet.

Ein Torwart als *Sonderrolle* bräuchte darüber hinaus: Ausschluss aus den Angriffs-Losen
(`spielmacherLos` `engine.js:4531`, `offensterMitspieler`, `gewichtetesLos(team,"ABSCHLUSS")`),
eine feste Position am eigenen Tor in `zuordneSlots`/`bewegeSpielerLive`, eine eigene
Erfolgsformel als Gegenstück zum Schuss, eine eigene Boxscore-Spalte — und auf der
Produktionsseite eine siebte Slot-Rolle in `lib/lineups/matchday-slot-roles.ts`, die im
Aufstellungsbildschirm sichtbar wird.

**Die harte Randbedingung.** Hockeys Kadergröße wird je Saison neu gewürfelt und kann
**2** sein (Fund 0.8). Ein struktureller Pflicht-Torwart heißt dann: ein Torwart, ein
Feldspieler. Das ist kein Randfall, den man später repariert — es ist jede fünfte Saison.

**Vier Optionen, ehrlich bewertet.**

| | Was es ist | Kosten | Was man bekommt | Bei 2 Spielern |
|---|---|---|---|---|
| **A** Kein Torwart | „Save" bleibt die Abwehr eines Feldspielers, wie heute | null | nichts Neues | unauffällig |
| **B** PARADE als Sub-Skill, Torwart = bester PARADE-Wert im Team | Ein zwölfter Sub-Skill + ein Term `paradeChance(schütze, torhüterVon(seite))` in der Erfolgsformel. **Kein** neuer Spielertyp, **keine** Produktionsdatenänderung | klein | Ein Spieler ist erkennbar der Torhüter, Fangquote wird eine Boxscore-Zahl, determination/will/dexterity bekommen Masse | funktioniert (der bessere der zwei hält) |
| **C** B + wählbare Slot-Rolle `goaltender` | zusätzlich eine siebte Hockey-Slot-Rolle in `matchday-slot-roles.ts` und ein `HOCKEY_POS_MOD` | mittel; **berührt Produktionsdaten** (Aufstellungsbildschirm, `generiere-arena-daten.ts` neu fahren) | Der Manager *entscheidet*, wer im Tor steht — die interessanteste Hockey-Aufstellungsfrage | Slot bleibt eventuell unbesetzt, Rückfall auf B nötig |
| **D** Echte Sonderrolle im Motor | eigener Spielertyp, aus allen Angriffslosen ausgeschlossen, feste Position, eigenes Sub-Skill-Set | hoch; berührt 6+ Motorfunktionen, die Wertungstabelle, die Boxscore-Spalten und die Produktions-Slots | ein optisch echter Torwart im Tor | strukturell kaputt (1 Feldspieler) |

**Empfehlung: B jetzt, C als eigene, von Chris zu entscheidende Erweiterung, D nicht.**

Gründe:

- B löst das *messbare* Problem (eine Fangquote, die von einem Spieler abhängt) mit einem
  Term und ohne eine einzige Produktionsdatei. Es degradiert sauber auf jede Kadergröße.
- B gibt determination (4), will (4) und dexterity (4) — heute zusammen 12 Matrixpunkte,
  die 1,6 % lesen — eine ordentliche Heimat, ohne dass man sie in Rollen pressen muss, wo
  sie inhaltlich nichts verloren haben.
- C ist die Version, die Chris als Manager wahrscheinlich will („wen stelle ich ins Tor?"),
  aber sie kostet eine Änderung an Produktionsdaten, die ein laufender Spielstand sofort
  sieht. Das ist eine Produktentscheidung, keine Technikentscheidung — deshalb Teil F.
- D ist die einzige Variante, die im Bild einen Torwart im Tor zeigt, und sie ist die
  einzige, die bei Kadergröße 2 strukturell zerbricht. Wenn Chris den sichtbaren Torwart
  will, gehört D **nach** der Live-Engine (PR 3) und **nach** einer Entscheidung über die
  Kadergröße (Frage F.5) — nicht in diese Runde.

**Ein Punkt, der bei B/C ehrlich benannt gehört:** die Fangquote hängt dann am *Team*, nicht
an einer Person, die auf dem Feld erkennbar anders ist. Ein Zuschauer sieht die Parade als
„Save"-Ereignis im Feed und als Zahl im Boxscore, aber nicht als Figur im Tor. Das ist
weniger als Chris' Wort „Torwartspiel" verspricht, und es ist der ehrliche Preis dafür,
dass die Kadergröße schwankt.

### B.5 Chris' Kandidatenliste, Punkt für Punkt geprüft

| Chris' Vorschlag | Verdikt | Begründung |
|---|---|---|
| Torabschluss / Schusshärte | **übernommen**, aufgeteilt | SCHUSS_NAH (dexterity-geführt) und SCHUSS_FERN (power-geführt) — die Trennung ist nötig, damit zwei Schützentypen unterscheidbar bleiben (B.2) |
| Passspiel / Vorlagen | **übernommen** | LINIENSPIEL (spirit 12 ist der zweithöchste zusammenhängende Matrixposten und hat sonst keine Heimat) + SPIELAUFBAU |
| Puckführung / Technik | **übernommen** | PUCKFUEHRUNG. Achtung: Basketballs TECHNIK liest fast null, weil `technikGate` bei Normalwerten immer über der Schwelle liegt — der Sub-Skill muss in Hockey an einen echten Kanal (Ballverlustrisiko), nicht an ein Gate |
| Bodycheck / Tackling | **übernommen**, größter Posten | CHECK, 15,4 % Soll-Masse |
| Defensivarbeit / Shotblocking | **übernommen**, neu gebaut | SCHUSSBLOCK. Existiert heute nicht — `wortBlock:"Save"` ist nur die Beschriftung eines verlorenen Zweikampfs |
| Bully / Faceoff | **NICHT als eigener Sub-Skill** | In der NHL gibt es rund 55 Bullys je Spiel (Referenz in D.3) — jedes einzelne ist also wenig wert; ein eigener Sub-Skill bekäme mechanisch fast nichts (vgl. ZWEITCHANCE 1,4 % heute) und zöge jedem Attribut Budget ab. Empfehlung: das Bully läuft als PUCKFUEHRUNG gegen PUCKFUEHRUNG. **Als Standphase (Inszenierung) ist es trotzdem wertvoll** — siehe PR 6 |
| Torwartspiel | **übernommen als Sonderfall** | PARADE, Option B — siehe B.4 |
| Ausdauer / Schichtwechsel | **übernommen, mit Auflage** | SCHICHTKRAFT braucht 10 % mechanisches Gewicht; ohne einen echten Ermüdungsterm in der Live-Engine ist es tot wie Basketballs AUSDAUER |
| Disziplin / Strafminuten | **NICHT als eigener Sub-Skill** | Ein „Disziplin"-Wert wäre ein NEGATIVER Sub-Skill neben CHECK, das torment schon trägt — zwei Zahlen, die sich widersprechen. Die richtige Bauform ist eine Strafwahrscheinlichkeit **als Funktion von CHECK**: wer härter checkt, erobert öfter den Puck *und* kassiert öfter. Ein Zielkonflikt aus einer Zahl. Gehört zum Überzahlspiel (PR 8) |

---

## Teil C — Basketballs Mechaniken: was passt, was muss angepasst werden, was nicht

Alle Aussagen unten beziehen sich auf den **Live**-Pfad; für Hockey ist heute nichts davon
aktiv (Fund 0.1).

### C.1 Ohne Änderung übertragbar (nur umbenennen/konfigurieren)

| Mechanik | Code | Warum sie passt |
|---|---|---|
| **Manndeckung** | `zuordneDeckung`, `engine.js:4384` | Gieriges Nächster-Abstand-Matching mit Drossel (`reevDeckung`) und Mismatch-Abständen. Eishockey ist ebenfalls überwiegend Mann-/Raumdeckung. Einzige Anpassung: ein Torwart (Option D) müsste ausgenommen werden |
| **Slot-Zuordnung nach Eignung** | `zuordneSlots`, `engine.js:4315` | Sortiert heute nach SCHUSS_NAH und stellt den Besten auf den korbnächsten Slot. Für Hockey identisch, nur mit dem Hockey-Nahabschluss als Sortierschlüssel. **Achtung, teure Lektion:** der Kanal ist ein RANGWECHSEL, kein Zahlenwert — nach einer *Differenz* zweier Werte zu sortieren hat in Basketball die Abweichung von 37,2 auf 78,0 Pp gerissen (`zuordneSlots`-Kommentar) |
| **Zwischenrunden-Slot-Rotation** | `starteViertelpause`, `engine.js:4492` | Die zurückliegende Seite ordnet ihre Slots offensiver. Für Hockey identisch (Drittelpause statt Viertelpause) |
| **Fastbreak** | `startFastbreak`/`fsLive.fastbreak` | Wird im Eishockey sogar zentraler als im Basketball (Odd-Man-Rush, 2-auf-1). Übernehmen, Wortwahl „Konter" |
| **Fokus-Doppeln** | `FOKUS_*`, `engine.js:3851 ff.` | Wird zum Forechecking-Ziel. Chris' Zuschauer-Eingriff funktioniert unverändert |
| **Schiedsrichter** | `fsSchiri`/`schiriPfeift`, `engine.js:5291` | Bewusst kein 13. Spieler, eigenes Objekt mit x/y und Pfiff-Timer. 1:1, und für das Überzahlspiel ohnehin Voraussetzung |
| **Standphasen-Naht** | `fsLive.phase`, `engine.js:4356` | Der Kommentar dort nennt Hockeys Bully wörtlich als Zielfall |
| **Rebound-Zweikampf-Form** | `reboundKampf`, `engine.js:6151 ff.` | Freier Puck, quadratisches Los, Boxout-Achse (`REB_BOXOUT`, `engine.js:3576`). Die Form passt; die Zahlen nicht — siehe C.2 |

### C.2 Übertragbar, aber neu zu kalibrieren oder umzubauen

1. **Viertel → Drittel.** `VIERTEL_ANZAHL_BASKETBALL=4`, `VIERTEL_DAUER_BASKETBALL=90`,
   `SPIELDAUER_BASKETBALL = 4×90 = 360` (`engine.js:3639-3641`). Die Grenzprüfung sitzt in
   `naechsterAngriff` (`engine.js:4477 ff.`) und liest die Konstanten direkt. Für Hockey:
   3 Perioden. Das ist eine reine Konfigurationsfrage — aber die Konstanten heißen heute
   `*_BASKETBALL` und es gibt **14 `feldspielDisc==="basketball"`-Weichen und 8
   basketball-benannte Konstanten** im Motor (gezählt per `grep`). Das ist der Umfang von
   PR 2.
2. **Abpraller-Grundverteilung.** Basketballs Rebound-Achse ist gegen das NBA-Ligamittel
   von ~26 % Offensiv-Rebounds kalibriert (`REB_BOXOUT=4.0`, mit der Messreihe
   2,85→31,7 % / 4,0→25,2 % im Kommentar). Eishockey hat dafür **kein Äquivalent**:
   Abpraller sind seltener und die Zweitchance kürzer. Der Zielwert ist neu zu bestimmen —
   und ich habe **keine belastbare NHL-Referenzzahl für „Anteil der Fehlschüsse, die zu
   einem eigenen Nachschuss führen" gefunden** (siehe Teil G).
3. **GEO_BONUS / Distanzstufen → Winkel und Zone.** `GEO_BONUS={dunk:0.70, nah:0.20,
   mit:0.09, fern:0.075}` (`engine.js:3717`) ist gegen echte NBA-FG%-Referenzen kalibriert.
   Die **Struktur** (vier Zonen mit eigenen Erfolgsbeiträgen) passt für Hockey; die
   **Zahlen** sind komplett neu, und die Kurve muss anders aussehen (siehe C.3). Zusätzlich:
   im Eishockey zählt der **Winkel** (Slot vs. Bande) mindestens so viel wie die Distanz —
   Basketballs `klassifiziereWurfdistanz` kennt nur den Radius.
4. **Freiwurf-Standphase → zwei verschiedene Hockey-Phasen.** Die generische Phase (Uhr
   steht, Spieler bekommen Formationsplätze, vier Stufen `formation`/`anlauf`/`flug`/`nach`,
   `engine.js:5192-5279`) trägt beides:
   - **Bully** — neu, mechanisch ein 1-gegen-1-Los an definierter Position um den
     Ballbesitz. Häufig (rund 55 je Spiel, s. D.3).
   - **Penalty** — strukturell **exakt** der Freiwurf: ein Schütze, ein Torwart, Uhr steht.
     Selten.
5. **Punktwerte.** `punkteNah:1, punkteFern:1, fernAnteil:0` (`engine.js:3457`). Hockey hat
   nur einen Punktwert — die vorhandene Zwei-Distanz-Struktur ist damit heute komplett
   ungenutzt. Sie darf trotzdem nicht wegfallen: sie ist der Kanal, über den sich „Schuss
   aus dem Slot" von „Schuss von der blauen Linie" unterscheidet. Nur die *Punktzahl* ist
   gleich, nicht die *Trefferchance*.

### C.3 Passt NICHT — bewusst nicht übertragen

1. **Der Freiwurf als Foul-Folge.** Im Eishockey führt ein Foul zur **Strafzeit**, nicht zu
   einem Freiversuch. Der Penalty ist die seltene Ausnahme. Wer Basketballs Foul→Freiwurf
   1:1 überträgt, baut eine Sportart, die es nicht gibt.
2. **Die Dunk-Stufe.** `GEO_BONUS.dunk = 0,70` ist mit Abstand der größte Term der
   Wurfformel und bildet ab, dass ein Korbleger aus 20 px real fast automatisch fällt.
   Eishockey hat das nicht: **direkt vor dem Tor ist der Torwart am wirksamsten.** Die
   Erfolgskurve über die Distanz ist im Eishockey nicht monoton fallend wie im Basketball,
   sondern hat ihr Maximum im Slot und fällt **zu beiden Seiten** ab (ganz nah: kein Winkel;
   weit: keine Gefahr). Das ist eine echte Formänderung, keine Umparametrisierung.
3. **Die Schussuhr.** `SCHUSSUHR_BASKETBALL=8` (`engine.js:3649`) erzwingt einen Abschluss.
   Eishockey kennt keine Angriffsuhr — ein Ballbesitz endet durch Schuss, Check, Icing oder
   Abseits. Der Zwangsabschluss ist die falsche Abbruchbedingung; für Hockey muss der
   Ballbesitz an einem *Ereignis* enden, nicht an einer Uhr. (Der Basketball-Kommentar zu
   Eingriff (d) hält ohnehin fest, dass die Uhr bei ~3,75 s mittlerer Possession praktisch
   nie bindet.)
4. **Die Usage-Zielrichtung.** Basketballs Abnahme misst „Feldwurfanteil des
   eignungsstärksten Spielers seiner Seite" gegen die Gleichverteilung von 16,7 %
   (`miss-basketball-rangtreue.mjs:241-250`) und wertet **hohe** Konzentration als richtig
   (NBA-Stars nehmen 30 %+ der Würfe). Eishockey ist das Gegenteil: die Eiszeit verteilt
   sich auf vier Linien. Die **Kennzahl bleibt, das Ziel kehrt sich um** — das ist eine
   Zeile in der Abnahme, aber wer sie übersieht, kalibriert Hockey zu einem
   Ein-Mann-Basketball.
5. **`spielzuege` (Alley-Oop-Muster).** Basketball und Football haben je eine
   Spielzug-Tabelle. Für Hockey ist der naheliegende Kandidat der One-Timer — aber er ist
   im Eishockey kein *seltener Höhepunkt*, sondern Standard. Ihn als „besonderer Zug" mit
   eigenem Jubel zu inszenieren, verzerrt das Bild. Empfehlung: **keine
   `spielzuege`-Tabelle für Hockey**, dafür einen sichtbaren Torjubel je Tor (im Eishockey
   ist jedes Tor ein Höhepunkt — bei 3 Toren je Spiel trägt das, bei 41 Basketballpunkten
   nicht).

### C.4 Überzahlspiel (Powerplay) — der interessanteste Neubau, und warum er warten muss

**Was es ist.** Strafe → 2 Minuten → 5 gegen 4. Real: 3,48 Strafen je Team und Spiel,
2,71 Überzahlgelegenheiten, 21,6 % Verwertung (NHL 2024-25, Quellen in D.3).

**Was der Motor dafür hat und was nicht.** Er hat den Schiedsrichter, die Standphase, das
Foul-Ereignis und den Feed. Er hat **kein** Konzept von „ein Spieler ist für N Sekunden
nicht auf dem Feld". Das wäre: ein Feld `strafeBis` je Spieler, Ausschluss aus
`zuordneDeckung` und `zuordneSlots` für die Dauer, eine Strafbank-Position, und ein
Wiedereintritt. Alles davon liegt **im Live-Pfad**.

**Die ehrliche Bewertung.** Im Vorab-Modell wäre ein Überzahlspiel ein Multiplikator auf
`aufbauChance`/`technik` für K Züge — rechnerisch korrekt und **für den Zuschauer
unsichtbar**. Der ganze Reiz der Mechanik ist, dass man sieht, dass eine Seite einen Mann
weniger hat. **Powerplay ohne Live-Engine ist verschenkt.**

**Empfehlung: eigene Runde, nach der Live-Migration (PR 8).** Danach ist es billig, weil
Schiedsrichter, Standphase und Slot-Zuordnung schon stehen. Der Nebengewinn ist groß: die
Strafwahrscheinlichkeit als Funktion von CHECK macht aus torment einen echten Zielkonflikt
(härter checken = mehr Pucks, mehr Strafen), und das ist die Sorte Entscheidung, die einen
Manager-Modus interessant macht.

---

## Teil D — Das Abnahme-Kriterium: wann ist Hockey fertig?

Basketball hat zwei Abnahmezahlen und drei Rollenproben. Hockey braucht dieselbe Struktur
plus einen Realismus-Korridor, weil die Torzahl heute um den Faktor 2 danebenliegt.

### D.1 Achse 1 — Matrixtreue (Pp)

```sh
node scripts/messe-arena-einfluss.mjs hockey 48 <pfad>
node scripts/messe-arena-einfluss.mjs hockey 96 <pfad>
```

**Ziel: ≤ 25 Pp in beiden Stichproben, ≤ 15 Pp in mindestens einer.** Begründung: der
Multi-Diszi-Plan (§4.3) empfiehlt ≤ 25 allgemein und ≤ 15 für Leuchtturm-Disziplinen; die
Basketball-Messhistorie zeigt, dass unterhalb ~17 Pp die Saatstamm-Streuung dominiert.
Hockey ist die zweite Leuchtturm-Disziplin, also die strengere Schwelle — aber nur als
„in einer Stichprobe", weil zwei unabhängige Läufe hier 14,2 und 17,2 lesen können (A.4).

**Zwei Stichproben sind Pflicht, nicht Kür.** Die Saaten in `einflussVon` sind fest
verdrahtet (`engine.js:12973-12974`); eine Messung ist reproduzierbar, aber sie ist EINE
Stichprobe. Zwei verschiedene `n` sind der billigste Weg zu einem zweiten Stamm.

### D.2 Achse 2 — Rangtreue (rho) und die Rollenproben

**Voraussetzung: die Sonde muss erst gebaut werden** (Fund 0.3, PR 0). Danach:

```sh
node scripts/miss-feldspiel-rangtreue.mjs hockey 24 6
```

| Probe | Was sie misst | Ziel |
|---|---|---|
| **rho** | Spearman(Impact-Rang im EINEN Spiel, Eignungs-Rang), je Seite gemittelt | ≥ 0,74 — dieselbe Schwelle wie Basketball (`starteViertelpause`-Kommentar nennt „Ziel 0,740") |
| **V — Verteidiger** | Angreifer gegen einen STARKEN Decker minus dieselben Angreifer gegen einen SCHWACHEN, gepaart je Spieler | −6 bis −10 Pp Schussquote, −20 bis −35 % Tore (Basketball: −8 Pp / −25 %) |
| **T — Torwart** *(neu)* | Fangquote des besten gegen die des schlechtesten Torhüters im Feld | **3-6 Pp Unterschied.** Begründung: reale NHL-Torhüter liegen in einer Saison etwa zwischen .880 und .920 — die Spanne zwischen gut und schlecht ist klein, und ein Modell, das 20 Pp Unterschied erzeugt, ist unrealistisch, nicht „gut differenziert" |
| **S — Schütze** | offene gegen bedrängte Abschlüsse, **zonen-isoliert** | positiv. Die Isolierung ist Pflicht: roh gemischt misst die Zahl die Schussdistanz, nicht die Deckung (Basketballs Erfahrung, `miss-basketball-rangtreue.mjs:148-154`) |
| **Vier Archetypen** | Sniper / Playmaker / Two-Way-Verteidiger / Torwart, je 300+ Spiele gegen sonst neutrale Spieler | **jeder führt in seiner eigenen Kategorie** — Sniper bei Toren, Playmaker bei Vorlagen, Verteidiger bei Checks+Blocks+Abprallern, Torwart bei der Fangquote. Basketballs Runde erreichte +16 % bis +173 % gegenüber dem jeweils nächstbesten Build |

**Wie sich ein starker Verteidiger in den Zahlen zeigen muss** (Chris' Frage, konkret):
sein Gegenspieler bekommt weniger Abschlüsse (Probe V, Schussanzahl), trifft seltener
(Probe V, Schussquote), und er selbst führt die Spalten Checks, geblockte Schüsse und
gewonnene Abpraller-Zweikämpfe an. Genau **nicht** darf er die Torschützenliste anführen —
das war Basketballs teuerster Fehler (der „Verteidiger" war der beste Scorer, weil ABWEHR
und SCHUSS_FERN dieselben Attribute führten). Die Trennung CHECK/torment gegen
SCHUSS_FERN/power (B.2) ist genau die Vorsorge dagegen.

### D.3 Achse 3 — Realismus gegen echte NHL-Werte

Basketball wurde 2026-08-26 gegen reale FG%-Referenzen kalibriert (der ganze
`GEO_BONUS`-Kommentar handelt davon: „NBA-Referenz: Career-Bestwerte 3P ~42-45 %,
2P-Finisher ~65-76 %"). Hockey braucht dasselbe.

**Referenzwerte, recherchiert (NHL 2024-25, sofern nicht anders angegeben):**

| Kennzahl | NHL-Referenz | Quelle |
|---|---|---|
| Tore je **Spiel** (beide Teams) | **6,1 oder höher**, drittes Jahr in Folge → ~3,05 je Team | NHL.com, „Numbers at quarter mark of 2024-25 NHL season" |
| Fangquote (SV%) | **.900** über die Saison; **.902 oder niedriger** zum Viertelpunkt — erstmals seit 30 Jahren unter .900 | NHL.com (ebd.), NHL.com „Unmasked: '.900 is the new .915'" |
| Schüsse aufs Tor je Team und Spiel | **24,4 (CHI) bis 32,0 (EDM)**, Mitte der ausgewiesenen Teams ~28 | StatMuse, NHL team stats shots per game 2024-25 |
| Schussquote (abgeleitet) | ~3,05/28 ≈ **10,9 %** | Rechnung aus den beiden Zeilen darüber |
| Strafen je Team und Spiel | **3,48** (niedrigster Wert einer 82-Spiele-Saison seit 20 Jahren), **8,15** Strafminuten | ESPN, „Six theories on why penalties are dramatically down" |
| Überzahlgelegenheiten je Team und Spiel | **2,71** (niedrigster seit Beginn der Erfassung 1977-78) | ESPN (ebd.) |
| Überzahlquote | **21,6 %** (beste seit 1985-86) | ESPN (ebd.) |
| Vorlagen je Tor | **1,6-1,7** | HFBoards/StatMuse-Auswertungen zum Assist-to-Goal-Ratio |
| Bullys je Team und Spiel | **~55,7** (Montreal 2024-25 als Einzelwert) | StatMuse |
| Geblockte Schüsse je Team | **16,79** als Ligaspitze (Montreal) — Ligamittel liegt darunter, **nicht ermittelt** | StatMuse |
| Spielstruktur | **3 × 20 Minuten**, danach 5 Min 3-gegen-3-Overtime, danach Penaltyschießen | ESPN/Yahoo/SI, NHL-Overtime-Regeln |

**Der entscheidende methodische Punkt: die Arena spielt kein 60-Minuten-Spiel.** Basketball
läuft 360 Simulationssekunden und kommt auf 41,1 Punkte je Team (gemessen, A.2); ein
NBA-Team liegt in derselben Kategorie bei gut hundert Punkten je Spiel (*Größenordnung, für
diesen Plan nicht eigens recherchiert*). Das Verhältnis ist weder 1:1 noch proportional zur
Spielzeit — 360 von 2880 Sekunden sind 12,5 %, die Punkte liegen bei rund einem Drittel.
Basketball
ist deshalb **auf Quoten kalibriert, nicht auf Summen** (FG% gegen reale FG%). Hockey muss
denselben Weg gehen:

| Kennzahl | heute (gemessen) | Zielkorridor | Art des Ziels |
|---|---:|---|---|
| **Schussquote** | **66,6 %** | **8-13 %** | harte Quote, direkt gegen NHL |
| **Fangquote** (1 − Schussquote) | **33,4 %** | **.870-.920** | harte Quote, direkt gegen NHL |
| **Vorlagen je Tor** | nicht gemessen | **1,4-1,8** | harte Quote |
| **Ballverluste je Ballbesitz** | 26,9 % | offen — keine saubere NHL-Entsprechung gefunden | siehe Teil G |
| Tore je Team und Spiel | 6,63 | **2,5-3,5** *bei einer Spieldauer, die Chris festlegt* | folgt aus Quote × Gelegenheiten |
| Schüsse je Team und Spiel | 10,23 | **≥ 20** bei derselben Spieldauer | folgt aus der Spieldauer |
| Unentschieden | 18,8 % | Produktentscheidung, siehe F.3 | — |
| Strafen je Team | 0 | 2-4 | erst mit PR 8 |
| Überzahlquote | — | 15-25 % | erst mit PR 8 |

Die beiden fett gesetzten Quoten sind die eigentliche Abnahme. Die Absolutzahlen folgen
daraus und aus der Spieldauer — sie sind **Ergebnis** einer Erlebnisentscheidung (F.4),
kein eigenes Ziel.

### D.4 Zusammengefasst: „Hockey ist fertig", wenn

1. Pp ≤ 25 in zwei Stichproben, ≤ 15 in einer.
2. rho ≥ 0,74 je Seite.
3. Rollenproben V, T, S in ihren Korridoren; alle vier Archetypen führen in ihrer Kategorie.
4. Schussquote 8-13 %, Fangquote .870-.920, Vorlagen je Tor 1,4-1,8.
5. Ein Spiel läuft im Browser ohne Seitenfehler durch, die Feed-Texte lesen sich wie
   Eishockey („Check", „Abpraller", „Save" existieren schon), und der Boxscore zeigt Tore,
   Vorlagen, Schüsse, Checks, Blocks.
6. Basketball ist **bit-identisch** zu vorher — jede Runde, in jedem PR.

---

## Teil E — PR-Reihenfolge (`main` bleibt jederzeit deploybar)

Vorbild: die PR-Listen in `fatigue-saisonlaenge-plan.md` Teil D und im Multi-Diszi-Plan.
Jeder PR ist für sich abnehmbar; PR 0-2 ändern **kein** Spielverhalten.

**PR 0 — `feldspielProbe(dId, opt)`: die Abnahme-Sonde generisch machen.**
`basketballProbe` (`engine.js:13375`) bekommt einen Disziplin-Parameter und liest
`FELDSPIEL_ART[dId]`/`MOTOREN[dId]` statt der Basketball-Konstanten. Dazu
`scripts/miss-feldspiel-rangtreue.mjs` (= `miss-basketball-rangtreue.mjs` mit
Disziplin-Argument). `basketballProbe` bleibt als Alias.
*Abnahme:* `miss-basketball-rangtreue.mjs 24 6` liefert exakt dieselben Zahlen wie vorher.
*Wert unabhängig von Hockey:* alle vier Feldspiel-Disziplinen bekommen dieselbe Messung.
**Wichtig:** die Sonde wird für eine Vorab-Disziplin die meisten Felder leer liefern
(`e.tier`, `deckerAbstandBeiWurf` gibt es dort nicht) — sie muss das **sagen**, nicht
stillschweigend Nullen ausgeben.

**PR 1 — Hockey-Rezept nach `battle-mode.rezepte.js` umziehen.**
Fortsetzung von #726 (dort ist bisher nur Basketball umgezogen). Zahlen unverändert.
*Abnahme:* `window.__arena.spiele("hockey",1337)`-Protokoll byte-identisch vorher/nachher —
dasselbe Verfahren, mit dem #726 den Basketball-Umzug belegt hat.

**PR 2 — Feldspiel-Chassis-Konfiguration statt Basketball-Konstanten.**
`perioden`, `periodenDauer`, `pausenDauer`, `schussuhr`, `zeitDehnung` wandern aus den acht
`*_BASKETBALL`-Konstanten und den 14 `feldspielDisc==="basketball"`-Weichen in die
`FELDSPIEL_ART`-Zeile. Basketball behält seine Werte exakt (4/90/1,0/8/2); Hockey bekommt
3 Perioden. Solange Hockey den Vorab-Pfad fährt, ändert das an Hockey **nichts** — es ist
reine Vorbereitung.
*Abnahme:* Basketball bit-identisch (`spiele("basketball",1337)`-Protokoll).

**PR 3 — Hockey auf die Live-Engine. Der teuerste PR, und der einzige echte Motorbau.**
`initBasketballLive`/`stepBasketballLive`/`bewegeSpielerLive` werden zu
`initFeldspielLive`/`stepFeldspielLive`; die basketball-spezifischen Teile (Zonentabelle,
Freiwurf-Ausprägung, Punktwerte, `BASKETBALL_POS_MOD`) heben in die Chassis-Konfiguration.
Die Weiche `engine.js:4072` wird zu „Live für basketball **und** hockey".
Hockey fährt danach live — **mit Basketballs Formeln und Basketballs Zahlen**, also bewusst
noch falsch kalibriert.
*Abnahme:* Basketball bit-identisch; Hockey läuft 3 Perioden ohne Seitenfehler durch und
liefert einen Endstand. Direkt danach: **Sondierungslauf für Hockey live**, damit die
mechanischen Sub-Skill-Gewichte für PR 4 bekannt sind.

**PR 4 — Hockey-Sub-Skills und Erfolgsformel.**
Die elf Sub-Skills aus B.2 (plus PARADE nach Option B), das Rezept nach der
Budget-Tabelle B.3 gegen die in PR 3 gemessenen Gewichte, eine eigene Zonentabelle statt
`GEO_BONUS` mit dem Maximum im Slot (C.3.2), und die Erfolgsformel gegen die
NHL-Quotenkorridore aus D.3 kalibriert.
*Abnahme:* Pp-Ziel (D.1) **und** Schussquote/Fangquote/Vorlagen je Tor (D.3).

**PR 5 — Rangtreue und Archetypen.**
`scripts/arena-archetypen/hockey.json` (Sniper/Playmaker/Two-Way/Torwart), Vier-Archetypen-
Demo, Rollenproben V/T/S.
*Abnahme:* D.2 vollständig.

**PR 6 — Bully-Standphase und Drittelpause.**
Nutzt `fsLive.phase` unverändert (`engine.js:4356-4364` nennt Hockeys Bully wörtlich als
Zielfall). Bully als PUCKFUEHRUNG-Duell, keine neue Erfolgsgröße.
*Abnahme:* die Phase hält die Uhr an, der Ballbesitz wechselt korrekt, Basketball
unberührt.

**PR 7 — Die Eisfläche zeichnen.**
`bodenFeldspiel` (`engine.js:6439`) — Hockey fällt heute auf den neutralen Platz zurück
(`:6465`), den auch Tennis benutzt; Football hat einen eigenen Zweig mit Endzonen und
Yard-Linien (`engine.js:6443-6464`), Basketball einen mit Zonen und Dreierbögen. Tore, blaue
Linien, Mittelkreis, fünf Bullypunkte, Torraum. Reine Optik, keine Zeile Simulation.
*Hinweis aus `docs/ARENA_INTERAKTION_KONZEPT.md`:* auf OpenGameArt gibt es kein brauchbares
Eishockey-Tileset — selbst gezeichnetes Canvas-Feld, wie bei Basketball und Football.

**PR 8 — Strafzeit und Überzahlspiel.** Eigene Runde (C.4). `strafeBis` je Spieler,
Ausschluss aus `zuordneDeckung`/`zuordneSlots`, Strafbank-Position, Strafwahrscheinlichkeit
als Funktion von CHECK, Strafminuten im Boxscore.
*Abnahme:* Strafen 2-4 je Team, Überzahlquote 15-25 %, und die Pp-Abnahme hält (die neue
Mechanik verschiebt die Sub-Skill-Gewichte, das Rezept muss nachgezogen werden).

**PR 9 — Produktivierung.** `ARENA_RESOLVED_DISCIPLINE_IDS` um `"hockey"` erweitern
(`lib/resolve/battle-mode-arena-team-points.ts:32`), Unentschieden-Regel klären (F.3),
Boxscore-Spalten der Wertungstabelle je Disziplin konfigurierbar machen.
*Abnahme:* ein Battle-Mode-Save löst einen Hockey-Spieltag über die Arena auf, das Ergebnis
ist als „Arena-Ergebnis" markiert (`resolutionSource: "arena"`, `arenaMatchSeed`).

**Nicht in dieser Liste, aber verwandt:** die Arena spielt immer 6 gegen 6, unabhängig von
der Saison-Kadergröße (Fund 0.8). Das betrifft Basketball genauso wie Hockey und gehört in
einen eigenen, disziplinübergreifenden PR — siehe F.5.

---

## Teil F — Offene Entscheidungen für Chris

Formuliert ohne Architektur-Vorkenntnis; meine Empfehlung steht jeweils dabei.

**F.1 — Soll Hockey einen Torwart haben, und was für einen?**
Heute hat keine Disziplin eine Sonderrolle: alle sechs Spieler sind gleich gebaut, und der
„Save" im Feed ist einfach ein Verteidiger, der den Abschluss verhindert.
Vier Stufen, von billig nach teuer: **(a)** so lassen; **(b)** ein neuer Spielerwert
„Parade" — der Spieler mit dem höchsten Wert im Team ist der Torhüter, seine Zahl
entscheidet über Gegentore, im Boxscore steht eine Fangquote; **(c)** zusätzlich eine
wählbare Aufstellungs-Position „Torwart", so dass **du** entscheidest, wer ins Tor geht
(das ändert den Aufstellungsbildschirm auch für laufende Spielstände); **(d)** ein echter
Torwart, der im Bild im Tor steht und nicht mit angreift.
*Empfehlung:* **(b) jetzt, (c) als eigene Entscheidung danach, (d) nicht.** Grund für das
Nein zu (d): Hockey wird nicht immer mit sechs Spielern gespielt — die Kadergröße wird
jede Saison neu ausgewürfelt und kann **zwei** sein. Ein Pflicht-Torwart hieße dann: ein
Torwart, ein Feldspieler. Das ist kein seltener Randfall.

**F.2 — Überzahlspiel jetzt oder später?**
Eine Strafe nimmt einer Mannschaft zwei Minuten lang einen Spieler weg. Das ist die
markanteste Eishockey-Mechanik, die es im Basketball gar nicht gibt.
*Empfehlung:* **später, als eigene Runde.** Der Grund ist nicht Aufwand, sondern
Sichtbarkeit: Hockey läuft heute nicht „live" wie Basketball, sondern wird vorab
durchgerechnet und dann erzählt. In diesem Modus wäre ein Überzahlspiel eine Zahl, die
niemand sieht — der ganze Reiz ist ja, dass man erkennt, dass eine Seite einen Mann weniger
hat. Sobald Hockey live läuft (der große Umbau in der Mitte des Plans), ist das
Überzahlspiel billig, weil Schiedsrichter und Spielunterbrechung schon gebaut sind.
Nebenbei bekommen wir dann etwas Schönes geschenkt: wer härter checkt, erobert mehr Pucks
**und** kassiert mehr Strafen — eine echte Abwägung statt einer reinen Stärke.

**F.3 — Unentschieden zulassen oder Verlängerung nachbauen?**
Gemessen produziert Hockey heute **18,8 % Unentschieden**, Basketball **0 %**. Die Arena
vergibt 2 Punkte für einen Sieg, 1 für ein Unentschieden, 0 für eine Niederlage — die Regel
existiert also schon.
*Empfehlung:* **Unentschieden zulassen.** Das ist sogar näher am echten Eishockey als
Basketball: das Unentschieden war in der NHL jahrzehntelang ein normales Ergebnis mit genau
diesem 2-1-0-Punktesystem und verschwand erst mit dem Penaltyschießen (*allgemein bekannt,
für diesen Plan nicht eigens belegt*). Ein Penaltyschießen nachzubauen wäre eine zweite
Spielunterbrechung für einen Fall, der in einem von fünf Spielen eintritt. Wenn du Verlängerung willst, ist das ein eigener kleiner Auftrag nach
PR 6 — die Unterbrechungs-Mechanik ist dann schon da.

**F.4 — Wie lange soll ein Hockeyspiel dauern?**
Basketball läuft 4 Viertel zu 1:30, mit der Zeitdehnung also **rund 12 Minuten
Zuschauzeit**. Hockey läuft heute **30 Sekunden** — es ist kein Spiel, das man anschaut,
sondern eine Ergebnismeldung mit Animation.
*Empfehlung:* **3 Drittel zu 1:20, also 4 Minuten Simulationszeit, mit Dehnung rund 8
Minuten.** Etwas kürzer als Basketball, weil im Eishockey weniger passiert (3 Tore statt 40
Punkte) und ein leeres Drittel schnell lang wirkt. Diese Zahl gehört dir, nicht uns — sie
ist die einzige im ganzen Plan, die direkt bestimmt, wie lange du zuschaust.

**F.5 — Soll die Arena die Kadergröße der Saison übernehmen?**
Heute spielt die Arena immer 6 gegen 6, egal was die Saison sagt. Die Saison würfelt die
Kadergröße je Disziplin und Saison neu aus (2 bis 6). Für Hockey steht im Katalog eine 5.
*Empfehlung:* **ja, aber als eigener Auftrag für alle Feldspiel-Disziplinen zusammen** —
Basketball hat dieselbe Lücke, und sie einzeln je Disziplin zu schließen wäre doppelte
Arbeit. Bis dahin ist es kein Fehler, sondern eine bekannte Vereinfachung. Wichtig ist nur:
solange sie besteht, darf keine Mechanik gebaut werden, die eine feste Sechs voraussetzt
(deshalb das Nein zum Pflicht-Torwart in F.1).

**F.6 — Hockey oder Football zuerst?**
Der Multi-Diszi-Plan setzt beide in dieselbe Welle. Gemessen liegt Football mit **57,9 Pp**
schlechter als Hockey mit **44,5-48,1 Pp**.
*Empfehlung:* **Hockey zuerst.** Du hast es selbst genannt; Hockeys Ablauf (durchgehender
Ballwechsel, zwei Tore, Manndeckung) liegt näher an Basketball als Footballs
Versuchs-/Yard-Struktur; und der große Umbau in der Mitte des Plans (Hockey live schalten)
macht die Arbeit für Football hinterher billig.

**F.7 — Wie viel „Erfindung" ist beim Zonen-Modell erlaubt?**
Basketballs Trefferchance ist gegen echte NBA-Wurfquoten kalibriert. Für Eishockey habe ich
Tore, Schüsse, Fangquote, Strafen und Überzahlquote als reale Referenz gefunden — aber
**keine** belastbare öffentliche Zahl dafür, wie oft ein Fehlschuss zu einem eigenen
Nachschuss führt (das Gegenstück zum Offensiv-Rebound). Für diese eine Zahl müssten wir
entweder länger suchen oder sie als bewusst gesetzten Wert markieren.
*Empfehlung:* **als gesetzt markieren und im Code als solchen kennzeichnen** — so wie es
die Übergabe für jeden erfundenen Wert verlangt. Lieber ein sichtbar gesetzter Wert als
eine erfundene Referenz.

---

## Teil G — Was ich NICHT geprüft habe

Ehrlich und vollständig:

1. **Basketballs aktuelle Pp-Abweichung habe ich nicht selbst nachgemessen.** Ein Lauf von
   `messe-arena-einfluss.mjs basketball 48` überschritt das Zeitbudget (12 Attribute × 12
   Spieler × 48 Läufe × 360 Simulationssekunden). Die letzte dokumentierte Zahl —
   **20,4 Pp bei n = 48** — steht in `public/mockups/battle-mode.rezepte.js`
   (Archetypen-Runde), ist also **zitiert, nicht gemessen**, und sie stammt aus der Zeit vor
   der Viertel-Struktur (#719) und vor #726. Sie kann heute anders sein; der Plan stützt
   sich nirgends darauf.
2. **Rangtreue habe ich für keine Disziplin gemessen.** `miss-basketball-rangtreue.mjs`
   wäre gelaufen, aber die Zahl hätte für Hockey nichts ausgesagt, und für Basketball hätte
   sie nur einen bekannten Wert bestätigt.
3. **Die Spieldauer-Rechnung ist Arithmetik aus dem Code, nicht im Browser nachgestoppt.**
   28 Züge × 1,0714 s = 30 s für Hockey; 4 × 90 s × Dehnung 2 ≈ 12 min für Basketball.
4. **Ich habe kein Hockeyspiel im Browser angesehen.** Alle Aussagen zur Optik (neutraler
   Platz statt Eisfläche, keine Tore gezeichnet) stammen aus `bodenFeldspiel`
   (`engine.js:6439/6465`) und aus `docs/ARENA_INTERAKTION_KONZEPT.md`, nicht aus einem
   Screenshot.
5. **Vorlagen je Tor habe ich für Hockey nicht gemessen.** Das Ereignisprotokoll trägt den
   Passgeber (`e.passgeber`), mein Skript zählt ihn nicht aus. Nachrüstbar in einer Zeile.
6. **Für die Abpraller-Grundverteilung fehlt eine NHL-Referenz.** Basketballs Gegenstück
   (26 % Offensiv-Rebounds) ist eine etablierte Ligastatistik; für Eishockey habe ich
   nichts Vergleichbares gefunden. Siehe F.7.
7. **Das Ligamittel für geblockte Schüsse habe ich nicht ermittelt** — die gefundene Zahl
   (16,79) ist der Ligahöchstwert eines Teams, nicht der Durchschnitt.
8. **Die Wechselwirkung mit dem Erschöpfungssystem des Spiels** (`lib/fatigue/`) habe ich
   nicht betrachtet. SCHICHTKRAFT ist ein Arena-interner Sub-Skill; ob und wie er mit der
   Saison-Fatigue zusammenspielen soll, ist eine offene Frage, die dieser Plan nicht stellt.
9. **Ob die Live-Engine die flache Sub-Skill-Gewichtsverteilung aus B.3 überhaupt hergeben
   kann, ist offen.** Weder Basketballs Live-Sondierung noch Hockeys Vorab-Sondierung ist
   annähernd so flach. Die Antwort kommt erst nach PR 3.
10. **Kein einziger Test wurde ausgeführt** (`npm test`, Lint, Typecheck). Diese Runde ändert
    keinen Produktionscode; das neue Mess-Skript ist ein eigenständiges `.mjs` ohne Import
    aus `lib/`.

---

## Kern-Dateien für den Einstieg

- `public/mockups/battle-mode.engine.js` — `FELDSPIEL_ART` (3380), Hockey (3453),
  `bauFeldspiel`/Live-Weiche/Vorab-Durchlauf (4011/4072/4077-4160), `BASKETBALL_POS_MOD` (4003),
  `SLOTS`/`zuordneSlots` (4259/4315), `initBasketballLive` (4337), `zuordneDeckung` (4384),
  `starteViertelpause` (4492), `starteFreiwuerfe`/`stepFreiwurfPhase` (5192/5211),
  `schiriPfeift` (5291), `stepFeldspiel` (6350), `bodenFeldspiel` (6439/6465), `ZEIT_DEHNUNG` (11514),
  `MOTOREN`-Feldspiel (12914/12942), `spieleDisziplin` (13127), `basketballProbe` (13375),
  `window.__arena.spiele` (13537), Viertel-Konstanten (3639-3641), `GEO_BONUS` (3717),
  `REB_BOXOUT` (3576)
- `public/mockups/battle-mode.rezepte.js` — die Daten-Datei aus #726; Hockey zieht mit PR 1 um
- `scripts/miss-hockey-bestand.mjs` — neu, die Bestandsaufnahme aus Teil A
- `scripts/messe-arena-einfluss.mjs` — Pp-Abnahme (Achtung: absoluter Pfad-Literal, s. A.5)
- `scripts/miss-basketball-rangtreue.mjs` — Vorlage für die generische Sonde (PR 0)
- `lib/player-generator/official-discipline-weights.ts` — die Matrix, Hockey-Spalte
- `lib/lineups/matchday-slot-roles.ts:169-176` — Hockeys sechs Slot-Rollen (kein Torwart)
- `lib/data/dataAdapter.ts:69`, `lib/season/season-discipline-area-groups.ts:62`,
  `lib/season/season-discipline-schedule.ts:77-102` — Kadergröße und ihre Neuauslosung
- `lib/resolve/battle-mode-arena-team-points.ts:32` — der Produktivschalter
- `docs/design/battle-arena-multi-disziplin-plan.md`, `docs/BATTLE_ARENA_UEBERGABE.md`,
  `docs/design/battle-mode-nba2k-modell-plan.md`, `docs/ARENA_INTERAKTION_KONZEPT.md`

### Quellen für die NHL-Referenzwerte

- [NHL.com — Numbers at quarter mark of 2024-25 NHL season](https://www.nhl.com/news/numbers-at-quarter-mark-of-2024-25-nhl-season)
- [NHL.com — Unmasked: „.900 is the new .915 or .920" when it comes to save percentage](https://www.nhl.com/news/unmasked-dont-blame-goalies-for-lower-save-percentage)
- [ESPN — Six theories on why penalties (and power plays) are dramatically down this NHL season](https://www.espn.com/nhl/story/_/id/44428407/nhl-2024-25-penalties-decrease-power-plays-players-referees)
- [StatMuse — NHL team stats shots per game 2024-25](https://www.statmuse.com/nhl/ask?q=nhl+team+stats+shots+per+game+2024-2025)
- [StatMuse — NHL average faceoffs per game per team 2024-25](https://www.statmuse.com/nhl/ask/nhl-average-faceoffs-per-game-per-team-2024-2025)
- [StatMuse — Average number of blocked shots per game, team average](https://www.statmuse.com/nhl/ask/average-number-of-blocked-shots-per-game-team-average-nhl-this-season)
- [ESPN — What are NHL overtime rules?](https://www.espn.com/nhl/story/_/id/39345002/what-nhl-rules)
- [Hockey-Reference — NHL League Averages](https://www.hockey-reference.com/leagues/stats.html) (Übersichtsseite; die Detailtabelle war beim Abruf nicht erreichbar, HTTP 403)

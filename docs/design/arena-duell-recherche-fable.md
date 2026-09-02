# Recherche: Kampf- und Duell-Disziplinen — Formeln aus Sport, Spielforschung und offenem Spielcode (Fable)

Stand: `3020270c` (Arbeitsbaum dieser Sitzung; `origin/main` steht auf `ed675c58`). Die
Abnahmezahlen wurden auf `ca03e24f` gemessen, die Sonde auf einem Zwischenstand; zwischen
`ca03e24f` und `3020270c` ändert sich der Motor nur in Feldspiel und Bahn (`git diff --stat`:
Hunks bei 3705, 5146–5211, 12650–13017, 14797 — Hockey-Wertformel, Bahn-Eignung), Arena und
Bühne sind zeichengleich. Gemessen mit `scripts/miss-alle-disziplinen.mjs` und einer
instrumentierten **Kopie** des Motors im Scratchpad (kein Motor im Repo wurde angefasst, s.
Abschnitt 0.2). Alle `engine.js`-Zeilen meinen `public/mockups/battle-mode.engine.js` auf
`3020270c`.

Chris' Auftrag, wörtlich: *„lass für jede disziplin die quasi 'bekannt' ist fable suchen nach
formeln und funktionen die man sich aus bekannten spielen oder indie games ziehen kann,
durchforste github etc"*. Die Abnahmezahl ist rho in EINEM Spiel, Ziel über 0,80 (CLAUDE.md).

---

## Die Antworten, ohne Architekturwissen lesbar

**Der Verdacht („der Starke bekommt nicht mehr Gelegenheiten, wer früh stirbt, bewirkt
nichts") stimmt zur Hälfte — und die falsche Hälfte ist die interessantere.** Die Zielwahl
ist nicht zufällig, sie ist Geometrie: 264 von 288 Kämpfer-Spielen im TDM zielen auf den
**Nächsten** (`chooseTarget`, `engine.js:10740`, `:10824`). Ob jemand gejagt wird, hängt darum an
seiner Reihe, nicht an seiner Eignung (rho Eignung↔„Angreifer je Lebenssekunde" im TDM: −0,02).
Gelegenheiten (Frames mit Ziel in Reichweite) korrelieren mit der Eignung nur zu 0,05 bis 0,25;
**je Gelegenheit** liefert der Stärkere aber sehr wohl mehr (rho Eignung↔Schaden je
Kontaktframe 0,42–0,47). Der Motor kann den Starken also unterscheiden — er lässt ihn nur nicht
ran. Was den frühen Tod angeht: im TDM ist die Lebenszeit für den Spielerwert fast bedeutungslos
(rho Lebenszeit↔Wert 0,14), weil die **Wertformel** (`beitragVon`, `engine.js:11707`) 44 % des
Gesamtbeitrags für *Getroffenwerden* vergibt (`verh` 33 %, `tank` 11 %). Wer verprügelt wird,
sammelt Punkte; der Verlierer-Seite, die in 24 von 24 Spielen komplett fällt, wird derselbe
Anteil gutgeschrieben wie den Siegern (8,2 gegen 8,4). **Der größte Hebel im TDM ist die
Wertformel, nicht der Kampf.**

**Die Arena-Messung hat zwei Fehler, die vor jeder Rezeptarbeit behoben werden müssen.**
Erstens: der Kampf ist deterministisch (die einzigen `rr()`-Aufrufe multiplizieren mit
`streu=0`, `engine.js:10870`, `:11131`), und die Formkarten-Ziehung `zieheFormkarten`
(`engine.js:3322–3328`) nimmt `z%4` von einem LCG mod 2³¹ — dessen untere zwei Bits haben
Periode 4. **In 24 Saaten stecken vier verschiedene Spiele**, in 1000 Saaten auch. Zweitens: der
Mockup-Kader trägt nur `d:{tdm, spurt}` (`engine.js:2609`), und `baueEinheit` liest
`(p.d[d]||0)` (`engine.js:10294`). **Für Fechten, Mini-DM und Battlefield ist die gemessene
„Eignung" nur Slot-Aufschlag + Formkarte + Trait** (Fechten: −8,5 bis +18,5, Johanna kämpft mit
LP 3, Cassandra mit LP 1,5). Die Bühne hat genau diese Lücke schon geschlossen
(`gewichtet(p.a, BASIS_JE_DISC[…])`, `engine.js:8584`); die Arena nicht. Fechtens 0,769 ist
darum keine Fecht-Rangtreue.

**Speed-Schach und I-Spy: der Differenzwert halbiert rho konstruktionsbedingt.** Gemessen an
denselben Spielen: rho(Eignung, Vorteil) 0,541 / 0,548 — rho(Eignung, **eigene Punkte**)
0,948 / 0,782. Die Mechanik selbst ist valide (rho gegen die würfelfreie Erwartung 0,99 / 0,85);
was rho drückt, ist ausschließlich, dass der Gegner am Brett abgezogen wird. Gewichtheben macht
es bereits richtig und begründet es im Code (`engine.js:8744–8748`: „ein Heber, der an einem
starken Slot 380 kg hebt, hat 380 kg gehoben, auch wenn er verliert"). **Spielerwert = eigene
Punkte, Duellstand bleibt Anzeige.** Für I-Spy zusätzlich: sechs Durchgänge bei
Erfolgschance 0,21–0,83 sind Würfelrauschen (Verlässlichkeit 0,85 gegen 0,95 bei Schach).

**Fechten ist real ein Einzelduell mit gut belegten Zahlen**, und keine davon passt zu einem
6-gegen-6-Getümmel: Gefecht auf 15 Treffer in 3 × 3 min, Pool auf 5 in 3 min; im Degen 17,9 s
Arbeitszeit je Aktion, 44,9 % offensive / 33,0 % defensive / 22,1 % gegenoffensive Aktionen,
ein Drittel der Gegenangriffe trifft, ~19–21 s je Treffer, 57–62 % der Treffer in einem Tempo.
Das Bühnen-Duell-Chassis (Brett i gegen Brett i, Durchgänge) bildet das strukturell besser ab
als die Arena (Abschnitt 3.4).

---

## 0. Was ich selbst nachgemessen habe, was ich abgerufen habe, was ich nur gelesen habe

### 0.1 Nachgemessen (Playwright/Chromium `/opt/pw-browsers/chromium-1194`)

| Zahl | Lauf | Ergebnis |
|---|---|---|
| Abnahmezahl der sechs Disziplinen | `miss-alle-disziplinen.mjs 24 tdm fechten mini-dm battlefield speed-schach i-spy` | fechten 0,769 / mini-dm 0,728 / battlefield 0,685 / i-spy 0,548 / speed-schach 0,541 / tdm 0,454 (rho je Spiel); Saison 0,834 / 0,786 / 0,548 / 0,643 / 0,664 / 0,503 — deckungsgleich mit der Aufgabenstellung |
| Verschiedene Spiele in 24 Saaten | eigene Sonde (0.2), Signatur aus (eig, wert) je Teilnehmer | Arena: **4 von 24** in allen vier Disziplinen; Bühne: 24 von 24, aber nur 4 verschiedene Eignungsvektoren |
| Formkarten-LCG | `node -e`, `zieheFormkarten` nachgebaut | 4 verschiedene Ziehungen (40 Karten) über 24 **und** über 1000 Saaten; `saat % 4` läuft 3,0,1,2,3,0,1,2,… |
| Dieselben Größen mit repariertem LCG (`(z>>>16)%n`, nur in der Kopie) | eigene Sonde | tdm 0,475 / fechten 0,742 / mini-dm 0,706 / battlefield 0,623 / speed-schach 0,600 / i-spy 0,535 — die Reihung bleibt |
| Seitensieg | beide Sonden | Seite 0 gewinnt 24/24 in allen vier Arena-Disziplinen (repariert: Battlefield 19/24); Seite 1 fällt zu 100 % |
| Eignung im Mockup je Disziplin | `window.__arena.kader()` | `d` trägt nur `tdm`, `spurt`; Fechten-Eignung im Kampf −8,5 … +18,5 (Mittel 7), LP 1,5 … 53 |
| Duell-Werte | eigene Sonde `duellSonde` | s. Abschnitt 4, Tabelle |

### 0.2 Die Sonde

Kopie von `public/mockups/` im Scratchpad; im Motor-Klon vor dem schließenden `})();` zwei
Exporte angehängt: `kampfSonde(d, n)` (baut über `MOTOREN[d].bau`, tickt selbst mit
`stepSimStumm(1/60)` und zählt je Einheit Lebensframes, Frames mit Ziel in Reichweite
(`dist(u,u.tgt) <= u.reach`), Zahl der Angreifer, die sie gerade als `tgt` führen, Todeszeit,
`st.*`, `beitragVon`) und `duellSonde(d, n)` (wie `disziplinProbe`, aber mit `summe`, `vorteil`,
`brett`, `gegnerN` und den sieben Sub-Skills). Saaten und Formkarten-Saaten exakt wie
`disziplinProbe` (`engine.js:15891 ff.`). Auswertung: Spearman mit Durchschnittsrang, wie im
Messskript. Rohdaten und Skripte liegen im Scratchpad, nicht im Repo.

Eine Unschärfe, die ich nicht aufgelöst habe: Reihe-0-Einheiten melden „Ziel in Reichweite"
schon in Frame 1, obwohl sie 280 px auseinander stehen und `reach` 118 ist. Die
Gelegenheitszahlen der Reihe 0 sind dadurch nach oben verzerrt; die Korrelationen über alle
Reihen tragen trotzdem, weil der Effekt je Reihe konstant ist (s. 2.3).

### 0.3 Abgerufen (Websuche/-fetch, Zahlen wörtlich aus der Quelle)

**Fechten**

| Kennzahl | Wert | Quelle |
|---|---|---|
| Arbeitszeit je Aktion (Allez→Halte) | Degen 17,9 ± 3,1 s · Florett 5,8 ± 2,5 s · Säbel 1,7 ± 0,4 s | PLOS One 2023, „Temporal demands of elite fencing", 96 Fechter, 83 Gefechte WM 2014, 5900 Datensätze |
| Pausen (Halte) | 15,5 ± 5,5 / 15,1 ± 3,7 / 16,0 ± 3,0 s | dieselbe |
| Arbeit:Pause | Degen 1:0,9 · Florett 1:2,6 · Säbel 1:9,2 | dieselbe |
| Effektive Kampfzeit am Gefecht | Degen 53,6–62,5 % · Florett 25,5–31,8 % · Säbel 9,4–11,5 % | dieselbe |
| Degen: Aktionsdauer / Pause | 17,7 ± 3,8 s / 18,0 ± 4,9 s; Arbeitszeit 44,3 % | Tarragó & Iglesias 2016, Apunts 125, 3454 Aktionen, 32 Fechter, zwei WM |
| Degen: Aktionsarten | offensiv 44,9 % · defensiv 33,0 % · gegenoffensiv 22,1 % | dieselbe |
| Degen: Wirksamkeit | „a third of counter-offensive actions adding to the score" — die wirksamste Klasse | dieselbe |
| Degen: Wo und wann | Phrasen vor allem in der 3-m-Zone, Treffer vor allem in der 2-m-Zone; Dichte und Wirksamkeit steigen in den letzten 10 s | dieselbe |
| Degen: Sekunden je Treffer | Männer 19,43 s, Frauen 20,9 s; erster Treffer eines Gefechts ~50 s | thefencingcoach.com 2022, 4634 Treffer, 226 Gefechte, 102 Fechter, Top 64 |
| Degen: Tempo der Treffer | ein Tempo 57 % (M) / 62 % (F), Mehrtempo 34 / 30 %, Remise/unbeabsichtigt 8 / 7 % | dieselbe |
| Degen: Schlussaktion | Ausfall 27 %, Gegenangriff 21 % der Treffer | dieselbe |
| Degen: Mittel je Treffer, Spanne | 17 s; Borel 12,47 s, Yamada 21,24 s | thefencingcoach.com 2024 (LEF), 6944 Treffer 2019–2024 |
| Florett: Weg je Gefecht | Pool 162,6 ± 74,2 m, DE 459,9 ± 117,7 m; 9,6 km/h Mittel, 11,7 km/h Spitze; HF 163 / 170 | PLOS One 2023, „Physiological demands and motion analysis of elite foil fencing" |
| Florett: Arbeit:Pause im Pool | 1:1,4; aktive Zeit ~121 s von 180 s (Pool), ~242 s von ~900 s (DE) | dieselbe |
| Regel: Gefechtslänge | DE 15 Treffer oder 3 × 3 min mit 1 min Pause; Pool 5 Treffer oder 3 min; Säbel: erste Periode endet bei 8 Treffern | FIE Technical Rules (static.fie.org), britishfencing.com, usafencing.org |
| Regel: Doppeltreffer Degen | beide zählen, wenn innerhalb des Sperrfensters (40 ms laut Vereins-Seiten; im FIE-Text nicht selbst nachgelesen) | vivofencingclub.com, fortunefencing.com |
| Anteil Doppeltreffer | „8 % of actions" (Suchzusammenfassung zu „Analysis of patterns in bouts elite epee", n = 356) — **Primärtext nicht abgerufen, nur gelesen** | researchgate (403) |

**Spiele** (Repository, Datei, Funktion, Formel, Lizenz — Abschnitt 1 ausführlich)

| Spiel / Repo | Datei · Funktion | Was drinsteht | Lizenz |
|---|---|---|---|
| Battle for Wesnoth, `wesnoth/wesnoth` | `src/actions/attack.cpp`, `battle_context_unit_stats` | Trefferchance = `modified_chance_to_hit(100 − Geländeverteidigung)`, geklemmt 0…100; Schaden = `round_damage(base, resist × (1 + Tageszeit + Führung))`; `firststrike`; mehrere Schläge je Runde | GPL-2.0+ |
| Wesnoth KI | `src/ai/default/attack.cpp`, `attack_analysis::rating` | `value = chance_to_kill·target_value − avg_losses·(1−aggression)`; `+ ((target_starting_damage/3 + avg_damage_inflicted) − (1−aggression)·avg_damage_taken)/10` | GPL-2.0+ |
| TrinityCore | `src/server/game/Combat/ThreatManager.cpp`, `ReselectVictim`, `AddThreat`, `CalculateModifiedThreat` | Zielwechsel erst, wenn ein anderer **110 %** der Bedrohung des Opfers hat (in Nahkampfreichweite) bzw. **130 %** (außerhalb); Schaden→Bedrohung über Zauber-/Schul-Modifikatoren | GPL-2.0+ |
| WoW-Regel (Referenz) | warcraft.wiki.gg „Threat" | 1 Bedrohung je Schaden, 0,5 je effektiver Heilung (auf Beobachter geteilt), Tank-Haltung ×5, 10 %/30 %-Regel | — |
| Warzone 2100 | `src/ai.cpp`, `targetAttackWeight…` | additive Zielgewichte: `WEIGHT_DIST_TILE 13`, `WEIGHT_HEALTH_DROID = 13·10 · damageRatio/100`, `− 13 · dist/Kachel`, Bonus für Kommandeurs-Ziel `WEIGHT_CMD_SAME_TARGET`, unsichtbar ÷10 | GPL-2.0+ |
| Dungeon Crawl Stone Soup | `crawl-ref/source/attack.cc`, `calc_to_hit`, `test_hit`; `defines.h` | `margin = to_land − ev`, `ev = random2avg(2·ev, 2)` (Dreiecksverteilung), **5 % Automatik-Treffer/-Fehlschlag** (`MIN_HIT_MISS_PERCENTAGE = 5`), `AUTOMATIC_HIT 1500` | GPL-2.0 (+ gemischte Teile) |
| Freeciv | `common/combat.c`, `win_chance`, `get_total_attack_power` | Kampf als Folge von Runden, Siegwahrscheinlichkeit binomial über „Runden bis zum Tod" beider Seiten; Rundenchance A/(A+D) (Struktur im Quelltext bestätigt, die Rundenformel selbst aus dem Gedächtnis) | GPL-2.0+ |
| Civilization IV (dokumentiert, nicht offen) | civfanatics „Combat Explained" | Rundenchance `R/(1+R)`, Schaden je Runde `floor(20·(3R+1)/(3+R))`, 6…60 geklemmt; 1,8:1 → „99+ %" | — |
| Fire Emblem (dokumentiert) | fireemblemwiki „True hit" | 2RN: Mittel zweier 0–99-Würfel gegen Anzeige; Anzeige 1 % → 0,03 % real | — |
| XCOM 2 (Konfiguration) | `DefaultGameCore.ini` via Steam/Fandom | `MissStreakChanceAdjustment` +10/+10/+15 je Fehlschuss (Rookie/Veteran/Commander), nur ab 50 % Trefferchance, Deckel 95 %, auf Legend aus | — |
| Battle Brothers (dokumentiert) | Steam-Thread, Wiki „Hit Chance" | `toHit = skill − defense`; Verteidigung über 50 halb; Klemme 5…95; Kopf 25 % ×1,5 | — |
| Super Auto Pets, `manny405/sapai` | `sapai/battle.py`, `get_attack_idx`, `update_pet_priority` | vorderstes gegen vorderstes, Schaden gleichzeitig, Fähigkeiten in Reihenfolge des Angriffswerts (Gleichstand: Leben, dann Zufall) — sonst kein Zufall | MIT |
| Hearthstone Battlegrounds (dokumentiert) | Fandom-Wiki | linkestes Diener greift zuerst an, Ziel **zufällig** außer Spott | — |
| Teamfight Tactics (dokumentiert) | mobalytics, Patchnotes 15.6 / 18.1 | Ziel = nächster Gegner, Gleichstand zufällig, Neuziel nach Tod des Ziels; seit Set 18 kein Neuziel nach Betäubung | — |
| Tales of Maj'Eyal (Wiki) | te4.org „Speed" | 1000 Energie je Zug, Aktion kostet 1000; +40 % Tempo = 1400 je Zug, Überschuss sammelt sich zu Extra-Zügen | GPL-3.0 (Spiel) |
| `iceie2/autobattler-rpg` (GitHub-Code-Suche) | `scripts/combat/auto_battle_manager.gd`, `find_nearest_enemy` | Godot-Auto-Battler mit „nächster Gegner" als Rückfall, headless Sims gegen Baseline | Lizenz nicht geprüft |
| `Oblivionburn/Dirge-of-Sorrows` | README | 3×3-Formation, Position beeinflusst Zielwahl, Schaden gegeben und erhalten | Lizenz nicht gezeigt |
| Forschung | Ludus (AAAI 2022), „Lineup Mining and Balance Analysis of Auto Battler" (ACM 2020) | Balancing über simulierte Aufstellungen und Metagame-Metriken, kein Zielwahl-Rezept | — |

**Schach / Duellwertung**

| Kennzahl | Wert | Quelle |
|---|---|---|
| Elo-Erwartung | `E = 1 / (1 + 10^((R_b − R_a)/400))`; +100 → 64 %, +200 → 76 % | Wikipedia „Elo rating system" |
| Performance-Rating, linear | `Rp = Ra + 800p − 400`; je Sieg Gegner + 400, je Niederlage Gegner − 400, Remis Gegner | Wikipedia „Performance rating (chess)" |
| Mannschaftskampf | 4 Bretter (+1 Ersatz), seit 2008 Matchpunkte 2/1/0 vor Brettpunkten | Wikipedia „Chess Olympiad" |

### 0.4 Nur gelesen, nicht belegt

Die 40 ms des Degen-Sperrfensters aus dem FIE-Regeltext selbst; Anteil der Doppeltreffer;
Säbel- und Florett-Wirksamkeit je Aktionsart (die arXiv-Arbeit „Visualization of technical and
tactical characteristics in fencing" nennt nur Flussrichtungen, keine Quoten); Ausfall-Distanzen
in Metern (die Biomechanik-Arbeiten geben Geschwindigkeiten, keine Distanzen); die
Freeciv-Rundenformel im Wortlaut; die indonesische Degen-Studie (eudl.eu 2021: Gegenangriff
85,71 %, Direktangriff 62,50 %) — **vier Junior-Athletinnen eines Regionalturniers**, für uns
wertlos, hier nur, damit sie niemand später für eine Elite-Zahl hält. 403/402 kamen von
researchgate.net, wowwiki-archive.fandom.com und battlebrothers.fandom.com; jeweils auf eine
Zweitquelle ausgewichen und oben als solche benannt.

---

## 1. Wie offene Auto-Battler und Taktikspiele das Problem lösen

Die Frage war: *der stärkere Kämpfer soll messbar mehr bewirken, ohne dass das Ergebnis
vorhersehbar wird*. In den gelesenen Systemen zerfällt das in vier Bausteine, die jeweils an
einer anderen Stelle sitzen.

### 1.1 Schadensformel: Stärke multiplikativ, Minderung als Sättigung

Alle gelesenen Systeme rechnen den Schaden als **Basis × Angriffsfaktor × Minderungsfaktor**
mit einer Sättigung auf der Verteidigerseite:

- Wesnoth: `damage = round_damage(base_damage, damage_multiplier, 10000)` mit
  `damage_multiplier = resistance × (1 + tod + leadership)`; die Resistenz ist prozentual
  (`weapon->effective_damage_type()`), Tageszeit ±25 %, Führung +25 % je Stufe. Verlangsamt:
  halber Schaden (`round_damage(…, 20000)`).
- Civ IV / Freeciv: keine Minderung, sondern das Verhältnis im Rundenwurf (1.3).
- Battle Brothers: `max(0, DamageRegular × DamageDirect × DamageReceivedDirectMult − armor ×
  DamageMitigationMult)` — Rüstung subtraktiv, aber mit „Direktschaden" als Anteil, der die
  Rüstung umgeht.
- WoW/TrinityCore, Dota Auto Chess: Rüstung als `DEF/(DEF+k)` — dieselbe Kurve wie unsere
  `100/(100+VER)` in `treffer` (`engine.js:10418`) und das Vorbild („DEF 265 → 35 %",
  `engine.js:10496 ff.`).

Unser `treffer(von,z,roh,sd)` ist damit formal in Ordnung; ANG/50 als Faktor
(`angFaktor`, `engine.js:10567`) entspricht Wesnoths Prozentlogik. **An der Schadensformel
liegt es nicht** — die Sonde bestätigt das: je Kontaktframe liefert der Eignungsstärkere im TDM
mehr Schaden (rho 0,42–0,47, Abschnitt 2.2).

### 1.2 Zielauswahl: Bedrohung mit Hysterese, oder Geometrie mit Position als Spielzug

Zwei Familien:

**(a) Bedrohungslisten (MMO/RPG).** TrinityCore `ThreatManager::ReselectVictim`: das aktuelle
Opfer wird nur gewechselt, wenn ein anderer **110 %** seiner Bedrohung hat und in
Nahkampfreichweite steht, oder **130 %** außerhalb. Bedrohung = 1 je Schaden, 0,5 je Heilung
(geteilt), Tank-Haltung ×5. Das ist ein System, in dem **der, der am meisten bewirkt, gejagt
wird** — und die Hysterese (110/130) verhindert das Flattern, das unser Motor über
`u.reev = 0,35 + (100−opp)/100·2,4` (`engine.js:11368`) und `bindAn` (`:11403`) mit anderen
Mitteln bekämpft. Warzone 2100 (`targetAttackWeight`) addiert statt zu vergleichen:
Distanz −13 je Kachel, Restschaden des Ziels +130·Anteil, Kommandeursziel +Bonus, unsichtbar
÷10 — ein Score, kein Rang.

**(b) Geometrie (Auto-Battler).** TFT: nächster Gegner, Gleichstand zufällig, Neuziel nach Tod.
Super Auto Pets (`sapai/battle.py::get_attack_idx`): „the first animals in each team that have
a health above zero" — vorderstes gegen vorderstes, kein Zufall. Hearthstone Battlegrounds:
Reihenfolge fest (links zuerst), **Ziel zufällig** außer Spott. In dieser Familie ist die
Zielwahl kein Eignungs-Kanal — **die Position ist der Spielzug**, und die Rangtreue kommt aus der
Aufstellung, nicht aus dem Motor. Genau das zeigt Dirge-of-Sorrows im README („position in the
formation effects targeting, damage dealt, and damage received").

Unser Motor sitzt zwischen beiden Stühlen: sechs Persönlichkeiten (`PERS`, `engine.js:2840`)
mit `naechster`/`gefaehrlichster`/`schwaechster`/`hinten` und eine `bedrohungVon`
(`engine.js:10401`: `dmg + heal·0,6 + ko·120`) — aber in der Messung ziehen 264 von 288
Einheiten `naechster`, und die 24 mit `bedrohung` sind die KI-Jäger (`o.jagd`, `:10394`). Die
Bedrohungsliste existiert, sie wird nur nicht benutzt.

### 1.3 Trefferreihenfolge und Varianz: viele kleine Würfe statt eines großen

Das ist der Teil, der unser Problem **nicht** hat — und das zu wissen spart eine Baustelle.

- Civ IV / Freeciv: ein Kampf ist eine Folge von Runden mit `p = R/(1+R)` und festem
  Rundenschaden `floor(20·(3R+1)/(3+R))`. Weil viele Runden fallen, konzentriert sich das
  Ergebnis (Binomialverteilung): 1,8:1 gewinnt „99+ %". **Vorhersehbarkeit entsteht aus der
  Zahl der Würfe, nicht aus der Höhe des Bonus.**
- Wesnoth: mehrere Schläge je Angriff (`num_blows`), jeder ein eigener Wurf gegen die
  Geländeverteidigung (`chance_to_hit = clamp(cth, 0, 100)`), `firststrike` entscheidet die
  Reihenfolge, sonst Angreifer zuerst. Die KI rechnet den Erwartungswert explizit
  (`attack_analysis::rating`) und kauft mit `aggression` Varianz.
- DCSS: `test_hit` würfelt die Ausweichzahl als `random2avg(2·ev, 2)` — Dreiecksverteilung
  statt Gleichverteilung, also weniger Streuung — und hält **5 % Automatik** (Treffer wie
  Fehlschlag), damit nichts je sicher ist.
- Fire Emblem 2RN: Mittel zweier Würfel; angezeigte 1 % werden 0,03 %, angezeigte 90 % werden
  sicherer. XCOM 2: +10/+15 Prozentpunkte je Fehlschuss-Serie, nur ab 50 %, Deckel 95 %, auf
  Legend aus. Battle Brothers: Klemme 5…95.
- Reihenfolge in Zeit: ToME4 gibt 1000 Energie je Zug, eine Aktion kostet 1000; +40 % Tempo =
  1400 → jeder 2,5. Zug ein Extra-Zug. Super Auto Pets: Fähigkeiten in Reihenfolge des
  Angriffswerts. Das ist ATB in Reinform: **Tempo kauft Gelegenheiten**, sonst nichts.

Unser Kampf hat **null Würfel**. Alle Streuung, die die Messung sieht, kommt aus vier
Formkarten-Ziehungen (Abschnitt 2.1). Die Varianz-Werkzeuge oben brauchen wir deshalb nicht
zum Bändigen, sondern — falls überhaupt — zum Einführen: ein deterministischer Kampf zwischen
denselben zwölf Figuren liefert je Spieltag dasselbe Ergebnis, sobald die Formkarten gleich
fallen. Für die Rangtreue ist das gleichgültig, für das Spielgefühl nicht.

### 1.4 Wofür „mehr Gelegenheiten" in den Vorbildern sorgt

In jedem gelesenen System kauft Stärke Gelegenheiten über **einen** von drei Kanälen: Tempo
(ATB/Energie: ToME, Dota Auto Chess `1,7/BAT·(100+AS)`), Bedrohung (WoW: wer viel tut, wird
gejagt und *hält den Kontakt*), oder Position (Auto-Battler: der Starke steht vorn, weil der
Spieler ihn dort hinstellt). Unser Motor hat den Tempo-Kanal bewusst gekappt (`cdKuerzung =
0`, `engine.js:10550`, Chris' Ansage: Tempo beschleunigt den Angriff nicht), den Bedrohungskanal
ungenutzt und den Positionskanal **invertiert**: `slotFuer` vergibt die Slots reihum an die
nach Disziplinwert Sortierten (`engine.js:10346–10348`), und die ersten beiden Slots sind Reihe 0
— im TDM stehen die Eignungsbesten darum vorn (Reihe 0 Mittel 71,3, Reihe 1 58,6, Reihe 2 55,6),
in Battlefield hinten (rho Eignung↔Reihe −0,49). Beides ist ein Nebeneffekt der Slot-Reihenfolge,
kein Entwurf.

---

## 2. Der Verdacht, am Code geprüft

> „In einem Team-Deathmatch bekommt ein starker Kämpfer nicht mehr Gelegenheiten als ein
> schwacher, weil Zielauswahl und Reihenfolge zufällig sind. Wer früh stirbt, kann nichts mehr
> bewirken, unabhängig von seiner Eignung."

### 2.1 Vorab: die Messung misst vier Spiele, und bei drei Disziplinen die falsche Eignung

**Determinismus.** Der Kampf-PRNG `rr` (`engine.js:10181`) wird im Arena-Pfad nur an zwei
Stellen aufgerufen, beide als `(rr()*2−1)*streu` mit `const streu=0` (`engine.js:10870`,
`:11131`). `disziplinProbe` (`engine.js:15891 ff.`) zieht je Spiel neue Formkarten, aber keine
Mutatoren (die zieht nur `serieVon`, `engine.js:14764`). Ein Arena-Spiel ist damit eine
Funktion der Formkarten.

**Formkarten.** `zieheFormkarten` (`engine.js:3322–3328`):
`z=(Math.imul(z,1103515245)+12345)&0x7fffffff; return z%n` mit `n = 4`. Bei einem LCG mit
Modul 2³¹ hat das unterste Bit Periode 2 und die untersten zwei Bits Periode 4 — **die
Kartenfolge hängt nur von `saat mod 4` ab.** Nachgerechnet: 24 Saaten `20260823 + i·104729`
laufen `3,0,1,2,3,0,…`; 1000 Saaten ergeben vier verschiedene Ziehungen. In der Sonde sind die
Spiele 1, 5, 9, … zeichengleich (Überlebende 5:0 6:0 4:0 4:0 5:0 6:0 …). Die Abnahmezahl
„n = 24" ist für alle vier Arena-Disziplinen ein **n = 4**; für die Bühne ist es n = 24 an
Würfeln, aber n = 4 an Eignungsvektoren. Das betrifft nur das Messfenster im Mockup — im Spiel
kommen Formkarten aus `legacy-lineup-modifiers.ts`. Mit `(z>>>16)%n` in der Kopie (obere Bits)
ändern sich die Zahlen wenig (0.1), aber die Aussage „24 Spiele" wird wahr.

**Eignung.** `baueEinheit` (`engine.js:10294`): `eigWert = (p.d[d]||0) + engPunkte + breitPunkte
+ eigHebung`. Der Mockup-Kader (`SQUAD`, `engine.js:2601 ff.`) trägt `d:{tdm:…, spurt:…}` — und
nur das (`window.__arena.kader()`, nachgesehen). Für Fechten, Mini-DM und Battlefield ist
`p.d[d]` also `undefined → 0`, die „Eignung" besteht aus Slot-Aufschlag (±8,5), Formkarte (0–8),
Intensität (−2,5…+4) und Trait-Netto. Gemessen im ersten Fecht-Spiel: Lava 18,5 … Cassandra
−8,5; LP nach `aufEignung` 34 … **1,5**. `aufEignung` skaliert die Kampfkraft proportional zu
dieser Zahl (`ziel = referenz·eig/50`, `engine.js:3354 ff.`), also bekommt Johanna mit „Eignung"
−0,9 drei Lebenspunkte und schlägt mit ANG 2,7. Die gemessene rho 0,769 sagt: *die Mechanik
belohnt die Zahl, auf die sie normiert wurde.* Das ist wahr und wertlos. Die Bühne hat dieselbe
Lücke am 25.08. geschlossen (`gewichtet(p.a, BASIS_JE_DISC[buehneDisc])`, `engine.js:8584`,
mit genau dieser Begründung im Kommentar). Der Produktionsadapter liefert
`d: {...player.disciplineRatings}` (`lib/foundation/battle-arena/arena-kader-adapter.ts:101`),
dort wäre der Wert da — aber die Messung läuft am Mockup-Kader, und der headless Runner kennt
nur `spieleFeldspiel` (`lib/battle/arena-headless-runner.ts:217`), also keinen Arena-Pfad.

Konsequenz für alles Folgende: die TDM-Zahlen sind belastbar (eig = `d.tdm` + Aufschläge, Spanne
39 Punkte), die anderen drei Arena-Zahlen sind es nicht — ich führe sie mit, weil die
*Mechanik*-Befunde (Zielwahl, Reihen, Wertformel) von der Eignungsquelle unabhängig sind.

### 2.2 Gelegenheiten: nicht zufällig, aber eignungsblind

Zielwahl: `chooseTarget` (`engine.js:10737–10824`) ist eine deterministische Kaskade — Rückzug,
Durchbruch, Zielansage, Offensivzwang, Angreifer im Rücken (`lastHit`, `opp ≥ 45`), Befehl
(`decken`/`flanke`), Zielpriorität, Persönlichkeit, Rückfall `nearest(foes)`. Kein `rr()`.
Reihenfolge: jeder Kämpfer handelt in jedem Tick, sobald seine eigene Abklingzeit abgelaufen ist
(`u.cd`, `cds[]`; `stepSim`, `engine.js:11266 ff.`) — es gibt keine Zugreihenfolge, die man
verlosen könnte. **Der Verdacht „zufällig" ist widerlegt.** Was stattdessen gilt, zeigt die
Sonde (TDM, 24 Saaten = 4 Spiele; in Klammern die Zahl mit repariertem LCG = 24 Spiele):

| Größe (rho je Spiel gegen Eignung) | TDM | Fechten* | Mini-DM* | Battlefield* |
|---|---:|---:|---:|---:|
| Wert (`beitragVon`-Anteil) | 0,451 (0,475) | 0,769 (0,742) | 0,732 (0,706) | 0,696 (0,623) |
| Frames mit Ziel in Reichweite — **Gelegenheiten** | 0,045 (0,246) | 0,420 (0,292) | 0,488 (0,507) | 0,113 (0,019) |
| Gelegenheiten je Lebensframe | −0,269 (−0,020) | 0,116 (0,073) | 0,238 (0,195) | −0,156 (−0,331) |
| Angreifer je Lebensframe — **wird gejagt** | −0,024 (−0,033) | 0,395 (0,414) | 0,244 (0,256) | 0,012 (−0,370) |
| Schaden | 0,349 (0,435) | 0,371 (0,425) | 0,315 (0,337) | 0,476 (0,524) |
| Schaden **je Gelegenheit** | 0,469 (0,421) | 0,438 (0,462) | 0,131 (0,239) | 0,452 (0,552) |
| Lebensframes | 0,279 (0,363) | 0,425 (0,329) | 0,442 (0,319) | 0,195 (0,269) |
| KO-Anteil | 0,407 (0,420) | 0,306 (0,299) | 0,294 (0,243) | 0,289 (0,348) |
| `verh` (verhinderter Schaden) | 0,054 (−0,024) | 0,549 (0,586) | 0,708 (0,671) | 0,393 (0,334) |
| `tank` (eingesteckter Rohschaden) | 0,044 (−0,051) | 0,499 (0,521) | 0,399 (0,495) | 0,274 (0,189) |

\* Eignung = Aufschläge, s. 2.1.

Lesart TDM: Der Stärkere bekommt **nicht mehr** Gelegenheiten (0,05 / 0,25), wird **nicht
häufiger** angegriffen (−0,02), verbringt sogar einen kleineren Teil seiner Lebenszeit im
Kontakt (−0,27 / −0,02). Wo er Kontakt hat, liefert er (0,47 / 0,42 je Gelegenheit). Der Kanal
Eignung → Wirkung ist da; der Kanal Eignung → *Zugang zur Wirkung* fehlt. Im Battlefield mit
der Spiegelung der Reihen (2.3) ist es dasselbe Bild mit anderem Vorzeichen: die Starken stehen
hinten und werden am wenigsten gejagt (−0,37).

### 2.3 Reihen: die Geometrie entscheidet, wer dran ist

TDM, alle 288 Kämpfer-Spiele:

| Reihe | Eignung | Gelegenheiten/Lebensframe | Angreifer/Lebensframe | Todesquote | Wert |
|---|---:|---:|---:|---:|---:|
| 0 (vorn) | 71,3 | 0,50 | 1,07 | 50 % | 9,5 |
| 1 | 58,6 | 0,55 | 1,11 | 63 % | 7,5 |
| 2 (hinten) | 55,6 | 0,55 | 0,77 | 69 % | 8,0 |

Reihe 0 wird von 1,07 Gegnern gleichzeitig gejagt, Reihe 2 von 0,77 — weil `nearest` die
Vordersten findet. Dass Reihe 0 im TDM die Eignungsbesten enthält, ist die Slot-Reihenfolge
(`slotsVon("tdm")`: vanguard, holdline = Reihe 0; `slotFuer` reihum nach Disziplinwert). Im
Battlefield ist die Slot-Liste anders und die Starken landen hinten (rho Eignung↔Reihe −0,49;
Reihe 1 Eignung 10,4 gegen Reihe 0 5,8). **Die Rangtreue der Arena hängt heute an der
Reihenfolge einer Slot-Liste**, die für die Aufstellungsanzeige gebaut wurde, nicht für den
Kampf. Ein Auto-Battler nimmt das in Kauf, weil der Spieler die Reihe setzt; bei uns setzt sie
`i % slotListe.length`.

### 2.4 Früher Tod: im TDM bedeutungslos, weil die Wertformel Prügel bezahlt

`beitragVon(u) = dmg + heal + schild + verh + tank·0,15 + koAnteil·140` (`engine.js:11707`);
`wert` = Anteil daran (`MOTOREN[ad].wert`, `engine.js:14942`). Zerlegung des Gesamtbeitrags:

| | dmg | heal | schild | **verh** | **tank·0,15** | ko·140 |
|---|---:|---:|---:|---:|---:|---:|
| TDM | 39 % | 5 % | 3 % | **33 %** | **11 %** | 10 % |
| Fechten | 38 % | 6 % | 8 % | 13 % | 8 % | 27 % |
| Mini-DM | 38 % | 5 % | 6 % | 15 % | 8 % | 29 % |
| Battlefield | 41 % | 2 % | 10 % | 14 % | 8 % | 25 % |

`verh` und `tank` entstehen **beim Getroffenwerden** (`treffer`, `engine.js:10424`:
`z.st.tank += roh·sd; z.st.verh += roh·sd − d`). Im TDM sind das 44 % des Beitrags, und beide
korrelieren mit der Eignung zu 0,05 / 0,04. Die Verliererseite fällt in 24 von 24 Spielen
vollständig (Seite 1 Todesquote 100 %, Seite 0 21 %) — und hat im Mittel denselben Wert wie die
Sieger (8,2 gegen 8,4). Lebenszeit↔Wert: rho 0,14. Der Satz „wer früh stirbt, kann nichts mehr
bewirken" ist im TDM **falsch**: wer früh stirbt, hat bis dahin am meisten eingesteckt und
bekommt das gutgeschrieben. In den drei anderen Disziplinen (verh+tank 21–23 %, KO 25–29 %)
trägt die Lebenszeit dagegen 0,42–0,76 des Werts — dort stimmt der Satz halb, aber aus dem
Grund, dass dort der KO-Anteil dominiert, und KOs machen nur Lebende.

Der Kommentar über `MOTOREN` (`engine.js:14873–14933`) beschreibt, warum `leistungVon`
(Beitrag/Erwartung) wegen `aufEignung` ein Kurzschluss war, und warum der Anteil gegen den
absoluten Beitrag gewann. Was er nicht diskutiert: **welche** Posten in den Beitrag gehören.
`impactVon` (`engine.js:14045 ff.`, die entzifferte Vorbild-Formel) sättigt jede Kategorie
(`1 − e^(−x/ref)`), teilt Frontlinie durch `(1 + 0,75·Tode)` und zahlt 60 fürs Überleben — genau
die Struktur, die verhindert, dass Prügel-Einstecken linear Punkte bringt. Sie wird für die
Wertungstafel benutzt, nicht für `wert()`.

### 2.5 Und die Seiten

Seite 0 (V-W) gewinnt 24/24 in allen vier Disziplinen, mit Ausnahme des reparierten
Battlefield-Laufs (19/24). Im TDM ist die Eignungsdifferenz 7,8 zugunsten von V-W; A-A stellt
zwei Heiler (Greenkraut, Seraph-11), V-W keinen. Eine Rangtreue über zwölf Köpfe, von denen
sechs immer sterben und sechs fast nie, misst zur Hälfte die Seite. `rho(Seite, Eignung)` ist
im TDM 0,34, `rho(Seite, Wert)` −0,01 — die Seite trennt die Eignung, aber nicht den Wert, weil
die Wertformel (2.4) die Verlierer entschädigt. Das ist der Mechanismus, mit dem 0,45 entsteht.

### 2.6 Star und Paare (die ehrlichere Abnahme aus CLAUDE.md)

| | TDM | Fechten* | Mini-DM* | Battlefield* |
|---|---:|---:|---:|---:|
| Star auf Rang 1 | 0 % (17 %) | 25 % (21 %) | 25 % (29 %) | 25 % (50 %) |
| Star in den ersten zwei | 25 % (33 %) | 25 % (42 %) | 25 % (38 %) | 50 % (58 %) |
| Star Letzter | 0 % | 0 % | 0 % | 0 % |
| Paare richtig | 67,0 % | 79,5 % | 79,5 % | 76,8 % |
| Paare ≥ 15 Punkte richtig | 78,6 % (n=840) | 98,0 % (306) | 92,3 % (78) | 100 % (12) |
| Paare < 2 Punkte Abstand | 9 % | 14 % | 16 % | 19 % |

Hockey zum Vergleich (CLAUDE.md): Star Rang 1 79 %, Paare ≥ 15: 99 %. Das TDM ordnet Paare mit
15 Punkten Abstand in einem Fünftel der Fälle falsch — das ist kein Rauschen enger Paare, das
ist ein Kanalfehler (2.2–2.4).

---

## 3. Fechten: die realen Zahlen und was sie für das Chassis heißen

### 3.1 Struktur eines Gefechts

- **Länge.** Direktausscheidung 15 Treffer oder 3 × 3 min (1 min Pause); Pool 5 Treffer oder
  3 min. Säbel: erste Periode endet bei 8 Treffern (FIE Technical Rules).
- **Zeit je Treffer, Degen.** 19,43 s (Männer) / 20,9 s (Frauen) über 4634 Treffer; der erste
  Treffer eines Gefechts dauert ~50 s (thefencingcoach.com 2022). Spanne zwischen Fechtern
  12,47 s (Borel) bis 21,24 s (Yamada) (LEF 2024, 6944 Treffer).
- **Arbeit und Pause.** Degen 17,9 ± 3,1 s Arbeit / 15,5 ± 5,5 s Pause (1:0,9); Florett
  5,8 / 15,1 s (1:2,6); Säbel 1,7 / 16,0 s (1:9,2) (PLOS One 2023, WM 2014). Tarragó & Iglesias
  2016 für den Degen: 17,7 ± 3,8 s / 18,0 ± 4,9 s, Arbeitszeit 44,3 %.
- **Bewegung.** Florett: 162,6 m im Pool, 459,9 m in der DE, 9,6 km/h Mittel, 11,7 km/h Spitze
  (PLOS One 2023). Ausfall-Distanzen in Metern: nicht belegt (die Biomechanik-Arbeiten messen
  Geschwindigkeit und Bodenreaktionskraft).

### 3.2 Was trifft

- Degen: 44,9 % der Aktionen offensiv, 33,0 % defensiv, 22,1 % gegenoffensiv; ein Drittel
  der Gegenangriffe trifft — die wirksamste Klasse (Tarragó & Iglesias 2016). Schlussaktionen
  der Treffer: Ausfall 27 %, Gegenangriff 21 % (thefencingcoach.com 2022).
- Tempo: 57–62 % der Treffer in **einem** Tempo, 30–34 % Mehrtempo, 7–8 % Remise/unbeabsichtigt.
- Ort und Zeit: Phrasen in der 3-m-Zone, Treffer in der 2-m-Zone; Dichte und Wirksamkeit
  steigen in den letzten 10 s (Tarragó & Iglesias 2016).
- Doppeltreffer (nur Degen): beide zählen innerhalb des Sperrfensters; Anteil „8 % of actions"
  nur aus einer Suchzusammenfassung, nicht belegt.

Eine Trefferquote „je Angriff" für Elite-Degen habe ich nicht gefunden. Was sich aus den Zahlen
ableiten lässt: 17,7 s Arbeit je Phrase, ~19,5 s je Treffer, also **rund neun von zehn Phrasen
enden mit einem Treffer** (eine Phrase endet per Definition mit Treffer oder Abbruch, und die
Zeiten sind fast gleich) — bei 44,9 % Angriffen und 22,1 % Gegenangriffen, von denen ein
Drittel trifft. Das ist eine Größenordnung, keine Quote; ich schreibe sie so hin.

### 3.3 Was davon ins Modell gehört

| Real | Heute im Motor | Vorschlag |
|---|---|---|
| 1 gegen 1, 15 Treffer | 6 gegen 6, Leben bis 0 | Bühnen-Duell (Brett i gegen Brett i), Durchgang = Phrase, Sieg bei 5/15 „Treffern" |
| ~18 s je Phrase, ~9 von 10 mit Treffer | 0,3 s Grundschlag, 30 s Kampf | `rundenDauer` ≈ 3 s Anzeige je Phrase, 10–15 Durchgänge je Brett |
| Gegenangriff trifft zu 1/3, Angriff häufiger, aber seltener erfolgreich | keine Aktionsarten | zwei Aktionsarten je Durchgang (Angriff/Gegenangriff) mit Erfolgschancen aus TECHNIK/NERVEN — das existiert im Bühnen-Rundenrechner schon als `erfolg` (`engine.js:8599`) |
| Distanz: Treffer in der 2-m-Zone, Vorbereitung in der 3-m-Zone | keine Distanz | nicht bauen; Distanz ist in einem Durchgangs-Modell die Erfolgschance, kein Ort |
| Ein-Tempo-Treffer 57–62 % | — | Anzeige („trifft direkt" / „nach Finte"), kein eigener Kanal |
| Letzte 10 s dichter | — | `WAGNIS`-Kanal des Bühnen-Rezepts auf die letzten Durchgänge legen |

**Warum die Arena das falsche Chassis ist:** Fechtens Matrix (torment 25, dexterity 20, speed 16,
awareness 15, health 4) sagt „zu spät kommen, nicht umfallen" (Kommentar in `ARENA_ART.fechten`,
`engine.js:3513 ff.`). Im Arena-Motor bezahlt aber jeder Kanal über Lebenspunkte, und Speed ist
absichtlich kein Angriffskanal (`cdKuerzung = 0`). Der Rezept-Kommentar dokumentiert drei
Kalibrierrunden, die genau an dieser Reibung gescheitert sind (TMP/AUS „außerhalb der
Eignungs-Normierung"). Im Bühnen-Duell fließt Speed in `NERVEN`/`WAGNIS`, ohne dass ein
Lebensbalken dazwischenliegt.

### 3.4 Was das Bühnen-Duell für Fechten braucht, was es heute nicht hat

Das Duell-Chassis (`bauBuehne`, `engine.js:8624–8637`) berechnet beide Bretter **unabhängig**
und zieht ab. Ein Gefecht ist aber interaktiv: der Gegner entscheidet, ob mein Angriff trifft.
Nötig ist der Bauplan von `baueHebenDuelle` (`engine.js:8713 ff.`), nicht der von Speed-Schach:
ein Paar-Rechner, der je Durchgang beide Sub-Skills gegeneinander stellt — Angriff (torment,
dexterity) gegen Parade/Gegenangriff (awareness, speed) — mit einer Elo-artigen Erfolgskurve
`p = 1/(1+10^(−Δ/k))` (Abschnitt 4.3). Das ist eine zweite Zeile im Bühnen-Chassis, kein
fünfter Motor.

---

## 4. Speed-Schach und I-Spy: der Differenzwert

### 4.1 Wie der Wert heute entsteht

`bauBuehne` rechnet je Teilnehmer `rundenN` Durchgänge vorab (`engine.js:8596–8611`):
`basis = (20 + GRUNDLAGE·0,7)·ermued`, `erfolg = min(0,94; 0,15 + TECHNIK·0,0055 +
NERVEN·0,0035)`, bei `rr() < erfolg` Erfolg (`basis + SPITZENMOMENT·0,35·(0,4 + WAGNIS·0,006)`),
sonst `basis·failAbzug (0,55)`, plus `PUBLIKUM·0,12`. Dann für Duelle (`:8624–8637`):
`vorteil = Σ(eigene Punkte − Gegnerpunkte)`, und `wert()` liefert `u.vorteil`
(`engine.js:15034`). Brett i ist `mine[i]` gegen `OPP[i]` — `mine` nach Disziplinwert sortiert,
`OPP` in Listenreihenfolge (`:8556–8558`); die Paarung ist damit weder nach Stärke noch
zufällig, sondern Listenzufall (rho Eignung↔Gegner-Eignung: Schach 0,31, I-Spy 0,07).

### 4.2 Gemessen

| rho je Spiel (24 Spiele) | Speed-Schach | I-Spy |
|---|---:|---:|
| Eignung ↔ **Vorteil** (heutiger Wert) | **0,541** (0,600) | **0,548** (0,535) |
| Eignung ↔ **eigene Punkte** (`summe`) | **0,948** (0,950) | **0,782** (0,776) |
| Eignung ↔ erwartete Punkte (Formel ohne Würfel) | 0,991 (0,984) | 0,850 (0,841) |
| eigene Punkte ↔ erwartete Punkte (Verlässlichkeit der Würfel) | 0,954 (0,962) | 0,847 (0,828) |
| (Eignung − Gegner-Eignung) ↔ Vorteil | 0,923 (0,916) | 0,800 (0,809) |
| Eignung ↔ erwarteter Vorteil (ohne Würfel) | 0,565 (0,624) | 0,563 (0,574) |
| Duell gewinnt der Eignungs-Stärkere | 87 % von 144 | 90 % von 144 |

(in Klammern: repariertes Formkarten-LCG, 24 verschiedene Ziehungen)

Die letzte Zeile mit dem „erwarteten Vorteil" ist der Beweis, dass es **konstruktionsbedingt**
ist: selbst ohne einen einzigen Würfel liegt rho(Eignung, Vorteil) bei 0,57 — weil der Vorteil
nun einmal eine Funktion zweier Eignungen ist, und die zweite ist über die Bretter fast
unkorreliert. Gegen die Differenz der Eignungen liest derselbe Vorteil 0,92 / 0,80: **die
Mechanik ist rangtreu, die Kennzahl misst gegen den falschen Prädiktor.** Beispiel aus Spiel 1
(Schach): Ralazar, Eignung 72,4, spielt 812 Punkte — das zweitbeste Ergebnis von zwölf — und
steht mit −17 negativ da, weil King Arlen (54,9) an seinem Brett 829 würfelte.

### 4.3 Was der Spielerwert sein sollte

**Erste Wahl: die eigenen Punkte**, wie beim Gewichtheben (`u.summe = u.zweikampf`,
`engine.js:8744–8748`: „Der Gegnerbezug steckt im Duellstand, nicht im Spielerwert"). Das ist
eine Zeile in `wert()` (`engine.js:15034`: `duell ? vorteil : summe` → immer `summe`) und hebt
Schach von 0,54 auf 0,95, I-Spy von 0,55 auf 0,78 — ohne dass sich im Spiel etwas ändert. Der
Duellstand bleibt Anzeige und Teamergebnis (Matchpunkte wie bei der Olympiade: 2/1/0).

**Zweite Wahl, wenn der Gegner im Wert bleiben soll: Leistung gegen Erwartung.** Schach hat
dafür die Referenzformel — Elo-Erwartung `E = 1/(1+10^((R_gegner − R_eigen)/400))` und die
lineare Performance „Gegnerstärke + 400 je Sieg / − 400 je Niederlage". Übertragen:
`wert = summe − erwartet(gegner)`, also *was ich gespielt habe, bereinigt um die Schwere des
Bretts* — nicht *was ich gespielt habe minus was er gespielt hat*. Das bestraft niemanden für
einen starken Gegner, der gut würfelt. Für die Abnahme ist die erste Wahl die richtige: die
Rangtreue soll die Mechanik prüfen, nicht die Paarung.

**I-Spy zusätzlich:** sechs Durchgänge bei Erfolgschancen zwischen 0,21 und 0,83 sind ein
Binomialwurf mit großer Streuung — Verlässlichkeit 0,85 gegen 0,95 bei zehn Durchgängen im
Schach. Zwei Werkzeuge aus Abschnitt 1.3: mehr, kleinere Würfe (Civ-Prinzip: 10–12 Durchgänge,
`rundenDauer` entsprechend kürzer) oder 2RN-Würfeln (`(rr()+rr())/2 < erfolg` — Mittel zweier
Würfel gegen dieselbe Chance, damit 0,8 wie 0,8 aussieht und 0,3 wie 0,3). Beides ist eine Zeile
in `bauBuehne`; beides gehört **nach** dem Wert-Wechsel gemessen, nicht davor.

---

## 5. Lizenzen und was man mitnehmen darf

Alle in 0.3 genannten Quelltexte sind GPL-2.0-oder-später (Wesnoth, TrinityCore, Warzone 2100,
Freeciv, DCSS — Letzteres mit gemischten Teilen laut `licence.txt`) oder MIT (`sapai`). Für
`iceie2/autobattler-rpg` und `Dirge-of-Sorrows` habe ich keine Lizenzdatei gesehen. **Formeln
sind nicht schutzfähig, Code ist es:** die 110/130-Regel, `random2avg`, die 5-%-Automatik, das
Zielgewicht aus Distanz und Restleben, die Elo-Kurve dürfen nachgebaut werden; eine
Codezeile aus einem GPL-Repo darf es in diesem Repo nicht (die Lizenz ist hier nicht GPL). Alles,
was ich oben vorschlage, ist eine Nachbildung in eigenen Worten, wie beim Hockey-Bericht.

---

## 6. Was ich empfehle, in der Reihenfolge, in der es Zahlen liefert

| Schritt | Was | Ändert Spielverhalten | Erwarteter Effekt |
|---|---|---|---|
| M1 | `zieheFormkarten`: obere Bits nehmen (`(z>>>16)%n`) — nur im Messfenster; im Spiel läuft eine andere Ziehung | nein | n = 24 wird wahr (heute 4) |
| M2 | `baueEinheit`: `p.d[d]` mit Rückfall `gewichtet(p.a, BASIS_JE_DISC[d])` wie in `bauBuehne` | nein (nur Mockup-Kader) | Fechten/Mini-DM/Battlefield werden erstmals gegen ihre Eignung gemessen |
| W1 | `wert()` der Bühne: `summe` statt `vorteil` | nein | Schach 0,54 → 0,95, I-Spy 0,55 → 0,78 (gemessen) |
| W2 | `beitragVon` (oder ein eigenes `wert()`): `verh`/`tank` raus oder gesättigt wie in `impactVon`, Überleben zählt | nein (nur Wertung) | TDM: die 44 % Prügel-Gutschrift fallen weg; Sieger und Verlierer trennen sich |
| K1 | Zielwahl: `bedrohungVon` mit 110/130-Hysterese als Standard statt `naechster`, `bindAn` bleibt | ja | Starke werden gejagt und halten Kontakt; Gelegenheiten↔Eignung steigt von 0,05 |
| K2 | Reihen aus der Eignung statt aus `i % slotListe.length`, oder Reihe als echten Aufstellungs-Spielzug durchreichen (Rohr wie im Hockey-Bericht 1.1) | ja | Position wird Entscheidung statt Nebeneffekt |
| F1 | Fechten als Bühnen-Paar-Duell (3.3/3.4), Arena-Eintrag bleibt bis zur Abnahme | ja | erst dann eine Fecht-Rangtreue, die etwas bedeutet |
| I1 | I-Spy: 10–12 Durchgänge oder 2RN | ja, wenig | Verlässlichkeit 0,85 → ~0,93 (geschätzt aus Schach) |

M1, M2 und W1 sind je eine Zeile und ändern keinen Kampf. Erst danach ist eine Rezeptrunde
für die Arena eine Messung und nicht, wie der `ARENA_ART.tdm`-Kommentar es selbst beschreibt,
„entweder schlechter oder ununterscheidbar vom Nichtstun".

---

## 7. Was ich nicht geprüft habe

- Warum Reihe-0-Einheiten in der Sonde ab Frame 1 „Ziel in Reichweite" melden (0.2); die
  Gelegenheits-Korrelationen sind darum je Reihe verzerrt, über alle Reihen aber konsistent.
- Wie das Spiel Arena-Disziplinen produktiv rechnet — der headless Runner kennt nur
  `spieleFeldspiel`; ob es für TDM einen zweiten Pfad gibt, habe ich nicht gesucht.
- Ob die Produktions-Formkarten (`legacy-lineup-modifiers.ts`) ihre Zufallsquelle sauber nutzen —
  der LCG-Befund gilt nachweislich nur für `zieheFormkarten` im Mockup; dieselbe Bauform steht
  auch in `zieheMutatoren` (`engine.js:3193–3194`, `saat%n`), nicht nachgerechnet.
- Der Wortlaut des FIE-Sperrfensters, der Anteil der Doppeltreffer, Florett-/Säbel-Quoten je
  Aktionsart, Ausfall-Distanzen in Metern.
- Ob K1 (Bedrohung als Standardziel) den 24/24-Seitensieg verschiebt — das ist eine
  Motoränderung und war ausdrücklich nicht Teil des Auftrags.
- Die Primärtexte von Tarragó et al. 2017 (redalyc, 24 Gefechte WM 2014, 1282 Datensätze) habe
  ich nur nach Zahlen abgesucht; die Arbeit ist eine Sequenzanalyse, keine Quotenstudie.

---

## Fünf Sätze — der größte Hebel je Disziplin

**TDM:** Die Wertformel vergibt 44 % der Punkte fürs Getroffenwerden, deshalb hat die in 24 von
24 Spielen komplett gefallene Seite denselben Wert wie die Sieger — `verh`/`tank` raus oder
sättigen (W2), dann erst die Zielwahl auf Bedrohung mit 110/130-Hysterese (K1), damit der Starke
überhaupt Gelegenheiten bekommt (heute rho 0,05).

**Fechten:** Die 0,769 messen eine „Eignung" aus Slot, Formkarte und Trait (LP bis hinunter zu
1,5), weil `p.d.fechten` im Mockup nicht existiert — erst M2, dann das Chassis wechseln: ein
Einzelduell mit ~18 s je Phrase, Angriff gegen Gegenangriff und 15 Treffern gehört auf die
Bühne als Paar-Rechner, nicht in ein 6-gegen-6.

**Mini-DM:** Nach M2 neu messen; mechanisch trägt hier `verh` mit rho 0,71 den Wert, also
dieselbe Wertformel-Reparatur wie im TDM, und bei vier Köpfen je Seite ist die Paartreue mit
Abstand (92 %) die ehrlichere Abnahme als rho.

**Battlefield:** Die Slot-Liste stellt die Eignungsbesten in die hinteren Reihen (rho −0,49), wo
`naechster` sie nie findet (Angreifer je Lebensframe −0,37) — die Reihe muss aus der Eignung
oder aus der Aufstellung kommen (K2), sonst misst man die Slot-Reihenfolge.

**Speed-Schach und I-Spy:** Spielerwert = eigene Punkte statt Differenz zum Gegner (eine Zeile,
W1; gemessen 0,54 → 0,95 und 0,55 → 0,78), der Duellstand bleibt Anzeige; I-Spy braucht danach
mehr oder gezähmtere Würfe (10–12 Durchgänge oder 2RN), weil sechs Durchgänge bei
Erfolgschance 0,21–0,83 nur 0,85 Verlässlichkeit tragen.

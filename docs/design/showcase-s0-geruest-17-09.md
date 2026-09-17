# Showcase S0: Gerüst und Act-Ableitung (17.09.)

Erste von vier sequenziellen PRs aus `docs/design/showcase-talentshow-konzept-17-09.md`,
Abschnitt 5. Baut ausschließlich den dort beschriebenen PR-S0-Umfang: Flag, Act-Tabelle,
deterministische Act-Ableitung, Talentshow-Auftrittsreihenfolge, Feed-Zierde und eine
Diagnose-Sonde. Bühnenbild (PR S1), die sechs Acts selbst (PR S2) und Ton (PR S3) folgen in
späteren PRs.

## Was gebaut wurde

- `BUEHNE_ART.showcase.showcase = true` — dasselbe Flag-Muster wie `heben`/`duell`/`schach`/
  `tennis`/`fechten`. Rezept, `rundenN`, `rundenDauer`, `failAbzug` bleiben unverändert.
- `SHOWCASE_ACTS` (6 Einträge: Kampfkunst, Schützenkunst, Zaubershow, Gesang, Kraftakt,
  Akrobatik) mit `id`/`label`/`text:{erfolg,fail}`. `pose`/`waffe` sind Platzhalter für PR S2,
  werden in dieser PR nirgends ausgewertet.
- `SHOWCASE_ACT_PUNKTE` + `actVon(u)`: reine, deterministische Ableitung nach dem
  `PW`/`leitePers()`-Muster. Quellen und Gewichte:
  - BAU-Bauplan (3 Punkte): Waffe (schwert/axt/zweihänder → Kampfkunst, bogen/pistole/
    schrotflinte/sturmgewehr → Schützenkunst, stab → Zaubershow), Vollbild (golem/
    mech_gross/mech_transformer/roboter/krokodil/drache_hydra/drache_gold/treant/
    schiff_pirat → Kraftakt, taube/singvogel/geist/kraken/froschmensch/werwolf/spinne →
    Akrobatik), `fluegel` → Akrobatik, `effekt` (jeder Typ) → Zaubershow.
  - Klasse (2), Unterklassen (je 2), Rasse (1, nur Construct → Kraftakt), Traits (je 1, nur
    Eloquent/FanFavorite → Gesang) — Tabelle analog `PW`.
  - Attribute-Kipp-Regel (1 Punkt): Maximum aus {charisma, power, intelligence,
    max(dexterity, speed)} gibt einen Punkt an Gesang/Kraftakt/Zaubershow/Akrobatik.
  - Gleichstand: `cypherHash(u.id, 11) % anzahlGleicher` (kein `rr()`, deterministisch).
  - `actVon()` liest nirgends `eig`/`wert()`/`rr()` und fließt nirgends dorthin zurück — rein
    präsentatorisch, wie das Konzept (Abschnitt 4.1) verlangt.
- `u.vizAct` wird einmalig in `stepShowcase()` gesetzt (Präzedenzfall `stepCypher()`s
  `vizPhase`-Init). `setz()` reicht dafür `p.c/p.r/p.sub/p.tp/p.tn/p.a` auf den Teilnehmer
  durch (`if(art.showcase){L.c=p.c;...}`), analog zum `u.treffer`-Muster bei Fechten — kein
  neues Persistenz-Feld, keine Adapter-Änderung.
- `stepShowcase(dt,art)`/`zeichneShowcase(art)`, angeschlossen über
  `if(art.showcase && typeof stepShowcase==="function")` in `buehnenBewegung()` und
  `zeichneBuehne()` (Präzedenzfall Tennis/Fechten). Für PR S0 ist `zeichneShowcase()` 1:1 der
  bisherige generische Zweig (keine sichtbare Änderung); `stepShowcase()` setzt nur `vizAct`.
- `buehneQueue` für Showcase: je Teilnehmer zusammenhängend (alle `rundenN` Enthüllungen am
  Stück), aufsteigend nach `eig` sortiert, Seiten verzahnt — wortgleiches Muster zum
  Eiskunstlauf-Kür-Präzedenzfall, nur ohne Paarbildung. Ändert nur die Reihenfolge, in der
  bereits vorberechnete `runden[]`-Einträge aufgedeckt werden; `u.summe` bleibt eine Summe
  über dieselbe Menge, `rr()` wird nie neu gezogen.
- Feed-Zeile: bei vorhandenem `u.vizAct` erscheint `"<Name> — <Act-Label>: <Act-Text>
  (…Punkte, Durchgang n/N)"` statt des generischen Ereignisworts. `r.ereignis` selbst bleibt
  unverändert `erfolgWort`/`failWort` — `WERTUNG_AUFTRITT` wertet weiterhin darüber aus.
- Sonde `window.__arena.showcaseActProbe(name)` → `{act, punkte, warum}`, rein lesend
  (Präzedenzfall `hoehenKorrProbe`), liest den Kader über `SQUAD.find`/`OPP.find`.

## Act-Verteilung über den vollen Demokader (SQUAD + OPP, 17 Charaktere)

Gemessen mit `window.__arena.showcaseActProbe(name)` über alle 17 Charaktere des
hartkodierten Standalone-Kaders (11 SQUAD + 6 OPP):

| Act | Charaktere | Anzahl | Anteil |
|---|---|---:|---:|
| Kraftakt | Lava Golem, Krolach, Greenkraut, Krag'Zul | 4 | 23,5 % |
| Gesang | King Arlen Morgolor, Xelara, Jorund, Seraph-11 | 4 | 23,5 % |
| Kampfkunst | Draco, Johanna, Gram | 3 | 17,6 % |
| Zaubershow | Inefinna, Lulu, Ralazar the Balanced | 3 | 17,6 % |
| Akrobatik | Rhyx'Tal, Tidesprinter | 2 | 11,8 % |
| Schützenkunst | Cassandra | 1 | 5,9 % |

Abnahme (Konzept Abschnitt 5, PR S0): kein Act über 50 % des Kaders (Maximum 23,5 %), kein
Act bei 0 % (Minimum 5,9 %, Schützenkunst über Cassandras Bogen + Sub Hunter) — erfüllt ohne
Nachjustierung der Punktetabelle. Kein Gleichstand ist in diesem Kader aufgetreten (die
`cypherHash`-Tie-Break-Regel griff bei keinem der 17 Charaktere).

## Verifikation

- `node --check public/mockups/battle-mode.engine.js` — sauber.
- `npx tsc --noEmit` — Diff gegen einen frisch ausgecheckten `origin/main`-Worktree: **0
  Zeilen** (identische Fehlerliste vorher/nachher).
- `npx tsx scripts/pruefe-slot-invariante.ts` — hält (max. Abweichung 0,005 Pp, Schranke
  0,2 Pp).
- `node scripts/miss-alle-disziplinen.mjs 24 showcase` — **bit-identisch** zur Basislinie vom
  17.09.: rho je Spiel 0,892 (Spannweite 0,158), rho Saison 0,937 (Spannweite 0,077),
  bestanden.
- `node scripts/miss-alle-disziplinen.mjs 24` (voller 20-Disziplinen-Lauf, Kader-Familie) —
  bit-identisch zu einem Referenzlauf auf einem frisch ausgecheckten `origin/main`-Worktree,
  alle 20 Zeilen, kein Kollateralschaden.
- `node scripts/pruefe-rangtreue-schranke.mjs` — bestanden.
- `npx vitest run tests/battle-mode-arena-team-points.test.ts tests/arena-headless-runner.test.ts`
  — 86/86 grün.

## Bewusst nicht in dieser PR

- Kein Bühnenbild (roter Vorhang, Rampenlicht, Jury-Buzzer) — PR S1.
- Keine der sechs Act-Zeichenfunktionen, kein `u.vizWaffe`/`u.vizEffekt`/`u.vizPose` — PR S2.
  `zeichneShowcase()` zeichnet in dieser PR nichts anders als der bisherige generische Zweig.
- Kein Ton (`TON_KATALOG.showcase`) — PR S3.
- Keine Rezept-, Formel- oder Rundenzahl-Änderung (Konzept Abschnitt 4.1) — rho bleibt
  bit-identisch, wie oben nachgewiesen.

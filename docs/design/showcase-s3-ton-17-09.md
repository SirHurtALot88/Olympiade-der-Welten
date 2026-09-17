# Showcase S3: Ton (17.09.)

Vierte und letzte der vier sequenziellen PRs aus
`docs/design/showcase-talentshow-konzept-17-09.md`, Abschnitt 5 ("PR S3 — Ton"). Baut
ausschließlich den dort beschriebenen S3-Umfang: `TON_KATALOG.showcase` mit denselben fünf
Synth-Grundbausteinen wie im übrigen Katalog, verdrahtet an Kanten in `stepShowcase()`. Mit
dieser PR ist die Showcase-Talentshow-Reihe (S0–S3) vollständig.

## Was gebaut wurde

- **`TON_KATALOG.showcase`**, acht Einträge, alle aus den fünf bestehenden Grundbausteinen
  (`tonKlick`/`tonSchlag`/`tonMetall`/`tonRauschen`/`tonTon`) zusammengesetzt, kein sechster
  Baustein:
  - `auftritt` — `tonDoppelton(880,1320)`, kurz und hell (Jingle).
  - `applaus` — `tonRauschen`-Burst, 0,6 s.
  - `buzzer` — `tonBuzzer`, 0,35 s.
  - `klinge` (Kampfkunst) — `tonMetall`.
  - `schuss` (Schützenkunst) — `tonKlick` + `tonRauschen`.
  - `zauber` (Zaubershow) — ein gleitender Ton: derselbe manuelle Oszillator-Aufbau
    (`tonKontext()`/`tonHuelle()`), den `tonDoppelton()` für seinen zweiten Ton schon
    vormacht, hier mit `osc.frequency.exponentialRampToValueAtTime()` statt der festen
    Frequenz von `tonTon()` — kein neuer Grundbaustein, nur derselbe Bauplan für einen Fall
    (ein Frequenzgleit), den die fixe Frequenz von `tonTon()` nicht abdeckt.
  - `stampf` (Kraftakt) — `tonSchlag`, tief (180→55 Hz).
  - `publikum` — Loop `tonRauschen`, wortgleiches Muster wie alle anderen Bühnen
    (Gewichtheben/Eiskunstlauf/Speed-Schach/Fechten/…).
- **Verdrahtung ausschließlich in `stepShowcase()`**, mit dem `u.vizTonN`-Einmal-Marker-Muster
  aus `stepZeitfahren()`:
  - `vizAuftrittTon` (Einweg-Merker, initialisiert im bestehenden `u.vizAct==null`-Init-Block):
    feuert `sfx("showcase","auftritt")` an der Kante "wird aktiv" (`istAktiv &&
    !u.vizAuftrittTon`) — genau einmal je Teilnehmer, weil `buehneQueue` seine `rundenN`
    Enthüllungen zusammenhängend gruppiert (PR S0) und jeder Teilnehmer über ein ganzes Spiel
    deshalb nur einmal aktiv wird. Ein Rückfall auf `false` ist nie nötig — dieselbe
    Eigenschaft, die `vizStartTon` bei `stepZeitfahren()` zu einem reinen Einweg-Merker macht.
  - `vizShowcaseTonAktuell` (letzter vertonter Durchgang, ebenfalls im Init-Block auf `-1`
    gesetzt): "frisch enthüllt" erkannt exakt wie `stepFechten()`s `vizFechtAktuell`-Vergleich
    (`u.aktuell!==u.vizShowcaseTonAktuell`). An dieser Kante:
    - **Act-Aktionston, unabhängig vom Ausgang** — wörtlich das Fechten-Vorbild
      (`sfx("fechten","klingen")` feuert bei `stepFechten()` auf beiden Ausgängen, nur der
      zweite Ton trägt den Ausgang). `SHOWCASE_AKTIONSTON` bildet `u.vizAct` auf
      `klinge`/`schuss`/`zauber`/`stampf` ab; Gesang/Akrobatik haben bewusst keinen Eintrag
      (die Konzepttabelle nennt nur die vier waffen-/effektnahen Acts).
    - **`applaus`/`buzzer`**, abhängig von `r.ereignis===art.erfolgWort`/`art.failWort` — exakt
      dieselben zwei Felder, über die auch `WERTUNG_AUFTRITT` auswertet, kein neues Vokabular.
  - Feuert nur für den Teilnehmer, dessen Durchgang gerade enthüllt wurde: `buehneQueue`
    dequeued genau ihn, das ist immer der aktuelle `showcaseAktiver()` — ein zusätzliches
    `istAktiv`-Gate war deshalb nicht nötig.
- **Publikums-Loop schließt sich von selbst**: `bodenShowcase()`/`showcasePublikumAn` (PR S1)
  riefen `tonLoopStart("showcase")` bereits auf; bis zu dieser PR war das ein sicherer No-Op
  (`tonLoopStart()`s `if(!katalog)return`, weil `TON_KATALOG.showcase` fehlte). Mit dem neuen
  Katalogeintrag spielt der Loop, ohne dass an `bodenShowcase()` selbst etwas geändert wurde.

## Rho-Sicherheit

`sfx()`/`tonLoopStart()`/`tonLoopStop()` rufen nie `rr()` auf und schreiben nie auf
`u`/`TEILNEHMER`/`LAEUFER` (Katalog-Kopfkommentar, wörtlich für alle Disziplinen geltend). Die
beiden neuen `u.viz*`-Felder (`vizAuftrittTon`, `vizShowcaseTonAktuell`) sind reine
Ton-Buchführung, genau wie `vizStartTon`/`vizZzTonN` bei `stepZeitfahren()` — sie werden nirgends
gelesen außer von den `sfx()`-Aufrufen selbst. Kein Eingriff in `u.summe`/`u.runden`/
`u.aktuell`/`u.lunge`/`buehneAkt`/`buehneZeiger`/`done`, keine Rezept-, Formel- oder
Rundenzahl-Änderung.

## Verifikation

- `node --check public/mockups/battle-mode.engine.js` — sauber.
- `npx tsc --noEmit` — Diff gegen einen frisch ausgecheckten `origin/main`-Worktree (Commit
  fbd5dba3, `.claude/worktrees/baseline-showcase-s3-tmp`): **0 Zeilen** (906/906 identische
  Fehlerzeilen).
- `npx tsx scripts/pruefe-slot-invariante.ts` — hält, maximale Abweichung 0,005 Pp (mini-dm
  @ n=2, Attribut stamina), Schranke 0,2 Pp — unverändert gegenüber PR S0/S1/S2.
- `node scripts/miss-alle-disziplinen.mjs 24` (voller 20-Disziplinen-Lauf) — **bit-identisch**
  zu einem Referenzlauf auf demselben frisch ausgecheckten `origin/main`-Worktree (`diff` exit
  0, alle 21 Zeilen inkl. Feldspieler-Unterzeile), insbesondere `showcase` selbst unverändert
  bei rho je Spiel 0,892 (Spannweite 0,158), rho Saison 0,937 (Spannweite 0,077), bestanden —
  Ton ist reines Audio-Feedback und bewegt keine Rangtreue.
- `npm run ci:rangtreue-schranke` — alle 20 Disziplinen `±0,000` gegenüber der gespeicherten
  Basislinie, Status `ok`; keine arena-resolved Disziplin unter die absolute 0,80-Schranke
  gefallen.
- `npx vitest run tests/battle-mode-arena-team-points.test.ts tests/arena-headless-runner.test.ts tests/buehne-erfindet-keine-formkrise.test.ts`
  — 92/92 grün (unverändert gegenüber PR S2).

## Bewusst nicht in dieser PR

- Kein Rezept-, Formel- oder Rundenzahl-Eingriff (Konzept Abschnitt 4.1) — rho bleibt
  bit-identisch, wie oben nachgewiesen.
- Kein Scorecard-Nachzug (Konzept PR S4) — eigene, sequenzielle Runde nach Merge, macht die
  Hauptsession separat.
- Keine Änderung an `bodenShowcase()`/`zeichneShowcase()`/den sechs Act-Zeichenfunktionen
  (PR S0/S1/S2) außer den neuen `sfx(...)`-Aufrufen und den beiden neuen `u.viz*`-Ton-Markern.

## Showcase-Talentshow-Reihe abgeschlossen

Mit dieser PR sind alle vier PRs aus `docs/design/showcase-talentshow-konzept-17-09.md`
Abschnitt 5 gemergt: S0 (Gerüst + Act-Ableitung), S1 (Bühnenbild + Rampenlicht), S2 (sechs
Act-Zeichenfunktionen), S3 (Ton). Offen bleibt nur der separate, sequenzielle Scorecard-Nachzug
(PR S4).

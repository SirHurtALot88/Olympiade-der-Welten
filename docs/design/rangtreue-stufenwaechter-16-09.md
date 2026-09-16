# Ein zweiter, absoluter Rho-Wächter (16.09.)

Auftrag B3 aus `docs/pm-briefings/opus-plan-top-zehn-ueber-90-16-09.md` Abschnitt 4. Ändert
**keine** Mess- oder Spielmechanik — nur `scripts/pruefe-rangtreue-schranke.mjs` und den Aufruf
dieses Skripts in `package.json`.

## Der Befund

`scripts/pruefe-rangtreue-schranke.mjs` prüfte bisher nur **relativ**: es lädt
`data/generated/rangtreue-basislinie.json`, misst jede dort geführte Disziplin frisch nach und
macht die CI rot, wenn `spielMedian` um mehr als ihre eigene Schranke gefallen ist — die Schranke
ist `max(0,05; 0,3 × spielSpannweite)`, also **umso großzügiger, je verrauschter die Disziplin
ist** (Datei-Kommentar, `:66-67` alte Zählung).

Das schützt nicht davor, dass eine Disziplin unbemerkt unter die absolute 0,80-Abnahmeschranke
aus CLAUDE.md fällt ("Die Abnahme jeder Disziplin: ein Spiel, nicht eine Saison"). Aus der
Basislinie vom 16.09.:

| Disziplin | Basis | Spannweite | Relative Schranke | darf rechnerisch fallen bis |
|---|--:|--:|--:|--:|
| Fechten | 0,826 | 0,203 | 0,061 | 0,765 |
| Gewichtheben | 0,843 | 0,208 | 0,063 | 0,780 |
| Tennis | 0,825 | 0,210 | 0,063 | 0,762 |
| Climbing | 0,834 | 0,209 | 0,063 | 0,771 |

Alle vier sind arena-resolved (`ARENA_RESOLVED_DISCIPLINE_IDS`,
`lib/resolve/battle-mode-arena-team-points.ts`) und könnten laut dem alten, alleinigen Wächter
unter 0,80 fallen, ohne dass die CI ein Wort sagt.

## Die Ergänzung: ein zweiter, unabhängiger Wächter

Der relative Wächter bleibt **unverändert** bestehen — er fängt schleichende Regression, oft
früher als 0,80. Zusätzlich, im selben Skript, im selben Messdurchlauf (keine zweite
Playwright-Session, keine doppelten Kosten):

**Absoluter Wächter (CI-Abbruch, Exit-Code 1):** für jede Disziplin, die
`ARENA_RESOLVED_DISCIPLINE_IDS` enthält (`lib/resolve/battle-mode-arena-team-points.ts` — Mitglied
dort zu sein heißt per Definition, dass sie die Abnahme bereits bestanden hat) UND deren
**Basislinie** bereits ≥0,80 stand, schlägt die Prüfung fehl, wenn das **jetzt neu gemessene**
`spielMedian` unter 0,80 fällt — unabhängig von der Kaderfest-Spannweite dieser Disziplin. Eigener
Berichtsabschnitt ("Absolute 0,80-Schranke …"), damit ein Treffer nicht in der Rückgangs-Tabelle
untergeht.

**G1-Stufenwarnung (Info, kein CI-Abbruch):** für alle zwanzig Disziplinen, nach den
Stufengrenzen aus `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`
Abschnitt 0 (Zeile "G1 (40)"): ≥0,85 → 40 Punkte, 0,80–0,85 → 35, 0,70–0,80 → 22, 0,50–0,70 → 12,
<0,50 → 5. Rutscht eine Disziplin von einer Stufe in die nächsttiefere — auch innerhalb der
0,80-Schranke, z. B. 0,86 → 0,84 —, meldet das Skript eine Warnzeile. Das senkt die G1-Punktzahl
der Scorecard, ohne die Abnahme zu reißen, und wäre ohne diese Warnung leicht zu übersehen, bis
jemand die Scorecard von Hand nachzieht.

Eingebaut, weil sich beides sauber und ohne Zusatzkosten in den bestehenden Messdurchlauf fügt —
kein Abschnitt musste "nicht gebaut" bleiben.

### CI-Pfad geprüft

`.github/workflows/ci-nightly.yml`, Job `rangtreue-schranke`, ruft ausschließlich
`npm run ci:rangtreue-schranke` auf; kein zweiter, umgehender Aufrufpfad existiert. Dieser
npm-Alias zeigte bisher auf `node scripts/pruefe-rangtreue-schranke.mjs` und musste geändert
werden (s. nächster Abschnitt) — der neue, härtere Check greift damit automatisch bei jedem Push
nach `main` und bei manuellem `workflow_dispatch`, genau wie der alte.

## Technische Nebenwirkung: der Import zwingt zu `tsx`

`ARENA_RESOLVED_DISCIPLINE_IDS` lebt in `lib/resolve/battle-mode-arena-team-points.ts` (TypeScript,
mit `@/`-Pfad-Alias-Importen und JSON-Modul-Importen). Das Skript selbst ist eine `.mjs`-Datei,
die bisher mit purem `node` lief. Ein reiner `node`-Aufruf kann `.ts`-Dateien weder auflösen noch
transpilieren:

```
$ node scripts/pruefe-rangtreue-schranke.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '.../lib/resolve/battle-mode-arena-team-points' imported from
  '.../scripts/pruefe-rangtreue-schranke.mjs'
```

Gelöst über denselben Kniff, den `"project:audit-write-safety": "node --import tsx
scripts/audit-write-safety.ts"` in `package.json` bereits vorführt: `tsx` als ESM-Loader
registrieren, statt das Skript nach `.ts` umzubenennen oder eine zweite, von Hand gepflegte Liste
der arena-resolved IDs im Skript zu duplizieren (das hätte genau die Drift-Gefahr geschaffen, die
dieser Auftrag beheben soll). `package.json`:

```diff
-    "ci:rangtreue-schranke": "node scripts/pruefe-rangtreue-schranke.mjs",
+    "ci:rangtreue-schranke": "node --import tsx scripts/pruefe-rangtreue-schranke.mjs",
```

Manueller Aufruf jetzt: `node --import tsx scripts/pruefe-rangtreue-schranke.mjs` oder einfach
`npm run ci:rangtreue-schranke` — dieselbe Datei, derselbe Dateiname, nur der Startbefehl ändert
sich.

## Beleg: der simulierte Fehlerfall

Getestet mit einem **lokalen, nicht committeten** Test-Hook im Skript (ein
`if (process.env.OLY_TEST_FEHLERFALL) { … }`-Block direkt nach der Messung, der `z.spielMed` für
eine benannte Disziplin überschreibt) plus einer Mini-Basislinie mit nur einem Eintrag
(`climbing`, echte Werte: `spielMedian 0,834`, `spielSpannweite 0,209`, `schranke 0,063`) — beides
ausschließlich für diesen Test, danach vollständig entfernt bzw. verworfen; `git diff` gegen den
committeten Stand zeigt den Hook nicht mehr.

Simulierter Messwert: climbing fällt von 0,834 auf **0,79** (unter die 0,80-Schranke, aber
innerhalb des relativen Spielraums von 0,063):

```
$ OLY_RANGTREUE_BASISLINIE=<mini-basislinie-nur-climbing.json> \
  OLY_TEST_FEHLERFALL=climbing:0.79 \
  node --import tsx scripts/pruefe-rangtreue-schranke.mjs

Disziplin            Basislinie      Jetzt   Aenderung   Schranke   Status
climbing                  0.834      0.790      -0.044      0.063   ok        <- ALTER Check: laesst durch

Absolute 0,80-Schranke (arena-resolved Disziplinen, CLAUDE.md "Die Abnahme jeder
Disziplin") — unabhaengig von der Kaderfest-Spannweite der relativen Pruefung oben:
  GERISSEN: climbing — Basislinie 0.834 (>=0,80, arena-resolved) -> jetzt 0.790 (<0,80)   <- NEUER Check: faengt

G1-Stufenwarnung (Scorecard-Methodik, ...):
  climbing: G1-Stufe "0,80–0,85" (35 Pkt) -> "0,70–0,80" (22 Pkt), rho 0.834 -> 0.790

FEHLGESCHLAGEN: ...
$ echo $?
1
```

**Das ist der Kernbeweis dieser Runde, in einem einzigen Lauf sichtbar:** die relative
Rückgangs-Zeile zeigt `-0,044` gegen eine Schranke von `0,063` und damit Status `ok` — der alte,
alleinige Wächter hätte diesen Fall grün durchgelassen, genau wie der Plan für Fechten,
Gewichtheben, Tennis und Climbing vorgerechnet hat. Der neue, unabhängige Abschnitt darunter
meldet denselben Fall als `GERISSEN` und macht den Exit-Code zu `1`. Die G1-Stufenwarnung meldet
zusätzlich den Stufenabstieg von 35 auf 22 Punkte — reine Information, aber sie wäre schon vor der
0,80-Schranke ein Hinweis gewesen.

## Beleg: der echte Lauf gegen den aktuellen Stand

Voller Lauf, alle zwanzig Disziplinen, echte live-save-Kaderfamilie, gegen die committete
Basislinie vom 16.09. (`gemessenAm: 2026-09-16T15:06:33.031Z`), `main` = `ef80d7aa`:

```
$ node --import tsx scripts/pruefe-rangtreue-schranke.mjs

Disziplin            Basislinie      Jetzt   Aenderung   Schranke   Status
tdm                       0.165      0.165      ±0.000      0.082   ok
mini-dm                   0.256      0.256      ±0.000      0.198   ok
battlefield               0.251      0.251      ±0.000      0.233   ok
spurt                     0.894      0.894      ±0.000      0.050   ok
time-trial                0.825      0.825      ±0.000      0.050   ok
climbing                  0.834      0.834      ±0.000      0.063   ok
staffel                   0.899      0.899      ±0.000      0.050   ok
takeshis-castle           0.879      0.879      ±0.000      0.050   ok
gewichtheben              0.843      0.843      ±0.000      0.063   ok
showcase                  0.892      0.892      ±0.000      0.050   ok
eiskunstlauf              0.885      0.885      ±0.000      0.050   ok
breaking                  0.869      0.869      ±0.000      0.050   ok
wettessen                 0.845      0.845      ±0.000      0.050   ok
speed-schach              0.908      0.908      ±0.000      0.050   ok
i-spy                     0.684      0.684      ±0.000      0.106   ok
tennis                    0.825      0.825      ±0.000      0.063   ok
fechten                   0.826      0.826      ±0.000      0.061   ok
basketball                0.769      0.769      ±0.000      0.050   ok
football                  0.722      0.722      ±0.000      0.050   ok
hockey                    0.669      0.669      ±0.000      0.054   ok

Absolute 0,80-Schranke (arena-resolved Disziplinen, CLAUDE.md "Die Abnahme jeder
Disziplin") — unabhaengig von der Kaderfest-Spannweite der relativen Pruefung oben:
  ok — keine arena-resolved Disziplin, die die 0,80-Schranke in der Basislinie
  erfuellte, ist jetzt darunter gefallen.

Bestanden: keine Disziplin ist um mehr als ihre Schranke gefallen, und keine
arena-resolved Disziplin ist unter die absolute 0,80-Schranke gefallen.
$ echo $?
0
```

Alle zwanzig Messungen sind bit-identisch zur Basislinie (dieselbe live-save-Kaderfamilie,
deterministische Simulation), keine G1-Stufenwarnung ausgelöst — erwartungsgemäß, da sich seit dem
Bau der Basislinie um 15:06 Uhr keine Disziplin verändert hat.

## Verifikationskette

- `node --check scripts/pruefe-rangtreue-schranke.mjs` — Syntax ok.
- `npx eslint scripts/pruefe-rangtreue-schranke.mjs` — keine Findings.
- Simulierter Fehlerfall (siehe oben): alter Check `ok`, neuer Check `GERISSEN`, Exit-Code `1`.
- Echter Lauf gegen den aktuellen `main`-Stand (siehe oben): Exit-Code `0`.
- `.github/workflows/ci-nightly.yml` ruft ausschließlich `npm run ci:rangtreue-schranke` auf —
  ein einziger, nicht umgehbarer Aufrufpfad; der neue Check greift dort ohne weitere Änderung.

## Was nicht gebaut wurde — und warum das keine Lücke ist

Alles aus Auftrag B3 ist umgesetzt: der absolute Wächter, die G1-Stufenwarnung und der Test gegen
echte Daten. Eine denkbare Erweiterung, die bewusst **nicht** gebaut wurde: eine automatische
G1-Stufentabelle, die bei jeder Warnung direkt einen Vorschlag für die neue Scorecard-Zeile in
`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` generiert. Die Warnzeile
nennt die neue Stufe und Punktzahl bereits vollständig; einen Textbaustein für die Markdown-Tabelle
automatisch zu erzeugen und einzufügen hätte den Umfang dieser Runde (ein CI-Skript) auf einen
Dokumenten-Editor ausgeweitet, ohne dass es der Auftrag verlangt hätte — das bleibt manuell, wie
jeder andere Scorecard-Nachtrag auch.

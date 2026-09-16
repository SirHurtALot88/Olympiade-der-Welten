# Fechten: erste eigene Rezeptkalibrierung (16.09.)

Auftrag: Fechten trug seit dem Chassis-Umzug am 03.09. (`docs/design/tennis-fechten-rollout-plan.md`)
ein Sieben-Rollen-Rezept, das der Kopfkommentar direkt darüber selbst als „ERSTER, AUSDRÜCKLICH
NICHT FINALER Sieben-Rollen-Entwurf" bezeichnet — abgeleitet aus Fechtens realer Arena-Matrix
(torment 25, dexterity 20, speed 16, awareness 15, power 10, determination 6, health 4,
intelligence 4), aber ausdrücklich ohne die dort selbst angekündigte „Sinkhorn-Kalibrierrunde"
(Recherche F.2, nie durchgeführt). Kaderfest stand Fechten bei rho 0,809/Spiel — 0,009 über der
0,80-Schranke, bei einem Kaderrauschen (Spannweite) von 0,184, also rund dem Zwanzigfachen des
Puffers. `docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 9.2
nennt Fechten deshalb explizit „von den dreizehn produktiven Disziplinen die einzige mit einem
echten Rangtreue-Risiko".

## Recherche: welche Rolle mechanisch wie stark einfließt

`public/mockups/battle-mode.engine.js`, `BUEHNE_ART.fechten` (`label:"Fechten"`, `:12432 ff.`).
Chassis „Bühne": sieben Rollen (GRUNDLAGE/SPITZENMOMENT/TECHNIK/NERVEN/PUBLIKUM/AUSDAUER/WAGNIS)
über eine gemeinsame Formel:

```
Basis    = (20 + GRUNDLAGE·0,7) · Ermüdung(AUSDAUER)
Erfolg   = min(0,94; 0,15 + TECHNIK·0,0055 + NERVEN·0,0035)
Gelingt  = Basis + SPITZENMOMENT·0,35·(0,4 + WAGNIS·0,006)
Misslingt= Basis·failAbzug (0,55)
Punkte   = Gelingt/Misslingt + PUBLIKUM·0,12
```

**Zwei Werkzeuge, dieselbe Methode wie Climbing/Football:**

1. `scripts/sondiere-feldspiel-subskills.mjs fechten 24` — funktioniert unverändert für ein
   Bühnen-Rezept, trotz des Namens (bestätigt, liest jedes `rezept:{…}` gleich welches Chassis).
   Mechanisches Gewicht der sieben Rollen: **GRUNDLAGE 36,5 % · TECHNIK 21,8 % · NERVEN 13,2 % ·
   PUBLIKUM 10,8 % · SPITZENMOMENT 9,4 % · WAGNIS 6,5 % · AUSDAUER 1,9 %**.
2. `scripts/messe-arena-einfluss.mjs fechten 48` — wie viel jedes Matrix-Attribut tatsächlich
   zum Ergebnis beiträgt, gegen sein Matrixgewicht:

   | Attribut | Anteil | Matrix | Differenz |
   |---|---:|---:|---:|
   | torment | 29,3 % | 25 | +4,3 |
   | dexterity | 26,0 % | 20 | +6,0 |
   | awareness | 20,2 % | 15 | +5,2 |
   | health | 7,4 % | 4 | +3,4 |
   | speed | 7,3 % | 16 | −8,7 |
   | intelligence | 5,4 % | 4 | +1,4 |
   | determination | 2,7 % | 6 | −3,3 |
   | power | 1,6 % | 10 | −8,4 |

   Abweichung zur Matrix insgesamt: **40,7 Pp**.

**Kein dediziertes Sinkhorn-Werkzeug für Bühne.** `scripts/baue-feldspiel-rezept.mjs` ist per
Namen und Code für das Feldspiel-Chassis gebaut (`resolvePass`/`resolveLauf`-Slots); es liest
keine `BUEHNE_ART`-Struktur und lässt sich nicht zweckfrei umbiegen. Wie bei Climbing zuvor: eine
manuelle, gezielte Ein-Hypothese-Kalibrierung statt eines automatisierten Sinkhorn-Laufs.

**Der Befund:** kein Sub-Skill ist mechanisch tot wie Climbings ROBUST (AUSDAUER ist mit 1,9 %
zwar schwach, aber das ist die generische, chassis-weite Ermüdungsformel — kein
Fechten-spezifischer Hebel, s. „Was geprüft und verworfen wurde" unten). Stattdessen: NERVEN
(dritt-schwerste Rolle, 13,2 %) trägt zu 65 % Rollengewicht Attribute mit den niedrigsten
Matrixgewichten (determination 6, health 4) und nur zu 35 % das deutlich schwerere awareness
(15) — ein Missverhältnis derselben Form, die CLAUDE.md und die Climbing-Runde für andere
Disziplinen beschreiben, nur an der dritt- statt der schwersten Rolle.

## Die Hypothese

NERVEN ist mit 13,2 % mechanischem Gewicht die dritt-schwerste Rolle und trägt determination
(Matrixgewicht 6) mit 40 % Rollengewicht sowie health (Matrixgewicht 4) mit 25 % — nur awareness
(Matrixgewicht 15) mit 35 % passt einigermaßen. Ersetzt durch eine awareness-lastige Mischung,
determination bleibt mit reduziertem Gewicht drin statt ganz zu verschwinden, health
unverändert:

```
NERVEN  vorher:  {determination:40, awareness:35, health:25}
NERVEN  nachher: {awareness:55, determination:20, health:25}
```

Eine Grid-Suche um mehrere Mittelpunkte (isoliert an `NERVEN` allein, GRUNDLAGE/TECHNIK noch auf
den alten Werten) fand das Optimum:

| NERVEN-Variante | rho/Spiel kaderfest |
|---|---:|
| vorher (det40/awa35/health25) | 0,809 |
| awa50/det25/health25 | — (nicht separat gemessen) |
| **awa55/det20/health25 (gewählt)** | **0,821** |
| awa60/det20/health20 | 0,813 |
| awa55/det25/health20 | 0,816 |
| awa65/det15/health20 (übersteuert) | 0,808 |
| awa55/det15/health30 | 0,814 |
| awa55/det10/health35 | 0,815 |
| awa55/det20/torment25 (statt health) | 0,812 |
| awa55/det20/dexterity25 (statt health) | 0,815 |

health schlägt sowohl torment als auch dexterity als drittes Attribut — vermutlich, weil
torment/dexterity schon stark in GRUNDLAGE/TECHNIK sitzen und ein weiterer Kanal auf demselben
Attribut eher Kaderrauschen verstärkt als Signal hinzufügt (derselbe Sättigungs-Effekt, den die
Climbing-Kalibrierung für einen übersteuerten Sub-Skill beschreibt).

**Zweiter, kleinerer Nachschlag:** GRUNDLAGE und TECHNIK (die beiden schwersten Rollen, 36,5 %
und 21,8 %) trugen torment/dexterity/awareness bereits nah an, aber nicht exakt auf der
Matrix-Proportion der drei schwersten Attribute (25:20:15 ≈ 42:33:25 statt der vorherigen
45:30:25 bzw. 40:35:25) — auf 42/33/25 nachgezogen, keine Attribute getauscht:

```
GRUNDLAGE  vorher: {torment:45, dexterity:30, awareness:25}  ->  {torment:42, dexterity:33, awareness:25}
TECHNIK    vorher: {torment:40, dexterity:35, awareness:25}  ->  {torment:42, dexterity:33, awareness:25}
```

Gemessen (NERVEN-Fix + GRUNDLAGE/TECHNIK-Proportion zusammen): rho 0,821 -> **0,826**.
Interessant: die Abweichung zur Matrix ging dabei leicht NACH OBEN (40,7 -> 43,1 Pp) — ein
Hinweis, dass die abstrakte „Matrix-Treue" für dieses Chassis kein verlässlicher Näherungswert
für rho ist; entscheidend war die empirische Messung, nicht die Heuristik.

## Was geprüft und verworfen wurde

**PUBLIKUM** (`{intelligence:50, health:50}`, die zwei matrix-leichtesten Attribute des ganzen
Rezepts) sieht auf den ersten Blick nach demselben Fehler aus wie Tennis'/Climbings
PUBLIKUM/ROBUST-Funde in den Kommentaren direkt über `BUEHNE_ART.fechten` — ist es hier **nicht**:

| PUBLIKUM-Variante | rho/Spiel kaderfest | Spannweite |
|---|---:|---:|
| vorher (intelligence50/health50) | 0,809 | 0,184 |
| voller Tausch: speed60/power40 (stärkste Matrix-Unterrepräsentation) | 0,798 | 0,160 |
| Teiltausch: awareness50/health50 | 0,801 | 0,268 |
| Teiltausch + NERVEN-Fix kombiniert | 0,807 | 0,262 |

In **jeder** getesteten Fassung schlechter als PUBLIKUM unangetastet zu lassen — und mit deutlich
größerer Kaderfest-Spannweite (0,26-0,27 statt 0,18-0,20). Vermutliche Ursache: awareness/
torment/dexterity tragen nach dem NERVEN-Fix bereits GRUNDLAGE+TECHNIK+NERVEN (drei von sieben
Rollen); ein vierter Kanal auf demselben Attribut sättigt eher, statt zusätzliches Signal zu
liefern — derselbe Kannibalisierungs-Effekt, den `docs/design/climbing-kalibrierung-16-09.md`
für einen übersteuerten Sub-Skill beschreibt. PUBLIKUM blieb deshalb unverändert.

**SPITZENMOMENT** und **WAGNIS** auf ihre jeweilige Matrix-Proportion nachgezogen
(SPITZENMOMENT: torment41/dexterity33/speed26 statt dexterity40/speed35/torment25; WAGNIS:
torment49/speed31/power20 statt speed45/torment30/power25) — beide isoliert getestet, beide
verschlechterten rho (0,814 bzw. 0,824 gegenüber 0,826 unverändert). Nicht übernommen.

**AUSDAUER** nicht angefasst: sein einziger Kanal ist die chassis-generische Ermüdungsformel
(`ermued=1-max(0,(60-AUSDAUER))·0,0035·(ri/(rundenN-1))`), die ALLE Bühnen-Disziplinen teilen —
eine Änderung dort wäre kein Fechten-lokaler Hebel und hätte gegen die Vorgabe verstoßen, keine
gemeinsamen Funktionen anzufassen (parallele Runde arbeitet an `stepFechten()`/`zeichneFechten()`
im selben Chassis).

## Ergebnis

`node scripts/miss-alle-disziplinen.mjs 24 fechten`, kaderfest (5 echte Kader-Paarungen aus
`data/generated/kaderfamilie-live-save.json`):

| | vorher | nachher |
|---|---:|---:|
| rho je Spiel (Median) | 0,809 | **0,826** |
| Spannweite je Spiel | 0,184 | 0,203 |
| rho Saison (Median) | 0,909 | 0,888 |
| Spannweite Saison | 0,140 | 0,161 |
| Puffer zur 0,80-Schranke | 0,009 | **0,026** |
| Abnahme | bestanden (dünn) | **bestanden** |

**Isolationsnachweis:** `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig, ohne Filter)
vor und nach der Änderung verglichen (vorher: Arbeitsbaum per `git stash` auf den unveränderten
Stand zurückgesetzt, danach `git stash pop`) — alle neunzehn anderen Zeilen bit-identisch, nur
Fechten bewegt sich:

```
vorher:  fechten  buehne  12  0.809  0.184  0.909  0.140  bestanden
nachher: fechten  buehne  12  0.826  0.203  0.888  0.161  bestanden
```

Fechten teilt sich das Bühnen-Chassis mit sechs weiteren Disziplinen (Gewichtheben, Showcase,
Eiskunstlauf, Breaking, Wettessen, Speed-Schach, I-Spy, Tennis), aber die Änderung sitzt
ausschließlich in `BUEHNE_ART.fechten.rezept` — kein gemeinsamer Code wurde angefasst, `duell:true`/
`fechten:true`/`rundenN`/`failAbzug` blieben unverändert.

## Ehrliche Einordnung: 0,85 nicht erreicht, Puffer bleibt dünner als das Kaderrauschen

Der Puffer zur 0,80-Schranke stieg von 0,009 auf 0,026 — fast das Dreifache, und robuster als
vorher. **Er bleibt aber kleiner als das gemessene Kaderrauschen** (Spannweite 0,203): das
strenge Kriterium „Puffer größer als Kaderrauschen" (Auftrag Punkt 4) ist NICHT erreicht, und
das aspirative 0,85-Ziel aus CLAUDE.md ebenfalls nicht. Mehrere zusätzliche Hebel wurden geprüft
und verworfen (PUBLIKUM, SPITZENMOMENT, WAGNIS, siehe oben) — jeder bewegte rho in die falsche
Richtung oder war schlicht wirkungslos. Das deutet darauf hin, dass innerhalb des bestehenden
Sieben-Rollen-Rezepts (reine Attributumverteilung, kein neuer Kanal) mit der aktuellen
Fünf-Kaderpaarungen-Messung nicht viel mehr als 0,826 sauber herauszuholen ist — dieselbe
Größenordnung wie bei Climbing (0,834) und deutlich besser als bei Football, wo dieselbe
Methode an der bestehenden Slot-Bonus-Kopplung scheiterte
(`docs/design/football-balance-runde-nach-e3-15-09.md`).

Zwei plausible nächste Schritte, keiner in dieser Runde umgesetzt:

- **Kaderfamilie erweitern** (`messgrundlage-kaderfest.md` Abschnitt 4 empfiehlt das explizit
  für Disziplinen mit hoher Spannweite): mit nur fünf Paarungen ist der Median selbst bei
  Bewegungen dieser Größenordnung (0,01-0,02) noch unpräzise — ein robusterer Messwert könnte
  einen höheren, aber bisher im Rauschen versteckten Puffer sichtbar machen, oder umgekehrt
  zeigen, dass 0,826 bereits am oberen Rand dessen liegt, was das Rezept hergibt.
- **Ein neuer, zusätzlicher Kanal** (z. B. ein interaktiver Paar-Rechner analog zu
  `baueHebenDuelle`, wie der Kopfkommentar bei `BUEHNE_ART.fechten` selbst für eine spätere
  Phase andeutet) würde mehr Ereignisse in den direkten Vergleich beider Fechter einspeisen —
  aber CLAUDE.md warnt ausdrücklich, dass mehr Ereignisse fast nie helfen, wenn die Validität
  (Saison-rho) das eigentliche Problem ist. Saison-rho liegt hier bei 0,888, deutlich über der
  Einzelspiel-Zahl — das Muster passt eher zu „Mechanik belohnt das Richtige, aber zu laut" als
  zu einem Rezeptfehler, was echte Sinkhorn-Kalibrierung (Recherche F.2) als nächsten Schritt
  nahelegt, sobald ein Bühnen-Äquivalent zu `baue-feldspiel-rezept.mjs` existiert.

## Verifikation

- `node --check public/mockups/battle-mode.engine.js` — OK.
- `npx tsc --noEmit` — Ausgabe bit-identisch (906 Zeilen, 560 `error TS`) zu einem frischen
  `origin/main`-Checkout (`215fa615`); alle Fehler sind vorbestehend und liegen in
  `tests/transfermarkt-*.test.ts` u. Ä., unberührt von dieser Änderung (reines `.js`, nicht
  typgeprüft).
- `npx tsx scripts/pruefe-slot-invariante.ts` — hält, maximale Abweichung über alle 20
  Disziplinen × 6 Größen: 0,005 Pp (Schranke 0,2 Pp), Fechten selbst bei ≤0,003 Pp.
- `npx vitest run tests/battle-mode-arena-team-points.test.ts tests/arena-headless-runner.test.ts
  tests/battle-arena-ein-modell-ueberall.test.ts tests/spiele-bahn-invarianten.test.ts
  tests/battle-arena-rennplan-ansage.test.ts tests/battle-zielansage-kontrakt.test.ts` — 121
  Tests, alle grün.
- `node scripts/baue-rangtreue-basislinie.mjs 24` — neu gebaut, Diff gegen die alte Basislinie
  isoliert auf `gemessenAm` und den `fechten`-Block.
- `npx node scripts/pruefe-rangtreue-schranke.mjs` — s. Ausgabe unten.

## Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — `BUEHNE_ART.fechten.rezept.{GRUNDLAGE,TECHNIK,NERVEN}`
  neu gewichtet, Kommentar mit Befund/Hypothese/Messwerten ergänzt. `PUBLIKUM`, `SPITZENMOMENT`,
  `AUSDAUER`, `WAGNIS`, `rundenN`, `failAbzug`, `duell`/`fechten`-Flags unverändert.
- `data/generated/rangtreue-basislinie.json` — neu gebaut (`baue-rangtreue-basislinie.mjs 24`).
- `docs/design/fechten-rezeptkalibrierung-16-09.md` (dieses Dokument, neu).

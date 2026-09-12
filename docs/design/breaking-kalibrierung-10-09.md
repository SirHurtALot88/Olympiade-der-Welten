# Breaking-Kalibrierung — K4, drei offene Fragen entschieden

Auftrag: `docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 4.2
(„Platz 2 — Breaking: Konzept 85 → 95"). K1–K3 stehen bereits (eigenes Torment/Will-Rezept ohne
Charisma, `cypher:true`-Mechanik seit #875, eigenes Fable-Dokument
`breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`). **K4 fehlte:** eine
Kalibrierrunde gegen echte Sportdaten und ein Dokument, das die offenen Designfragen entscheidet.
Vorlage: `docs/design/basketball-k3.md`.

**Diese Runde ist reine Mess- und Schreibarbeit. Es wird KEINE Zeile Produktionscode geändert** —
beide getesteten Hypothesen bewegen rho weniger als das Kaderrauschen (Abschnitt 4), eine sogar in
die falsche Richtung. Ein ehrlicher Nullbefund ist nach dem Plan-Text („Auch das erfüllt K4")
ein gültiges Ergebnis.

## Kurzfassung

| Frage | Antwort | Beleg |
|---|---|---|
| 1 — Wie viele Runden ist ein echter Battle? | `rundenN:8` bildet die Größenordnung realer Battles plausibel ab — **keine Änderung.** | Ein Battle hat 2–3 Throwdowns (WDSF: Top-16/Viertelfinale best-of-3, entschieden nach 2 außer bei Gleichstand; Halbfinale/Finale immer 3), jeder Throwdown gliedert sich in ~5 Teile (Toprock, Übergang, Footwork, Power-Move-Serie, Freeze). Reale Bewertungsmomente je Battle: ~10–15. Getestet: `rundenN:12` bewegt rho nur **+0,021** (0,869 → 0,890), innerhalb der Spannweite (0,114/0,120) — genau der in CLAUDE.md dokumentierte Befund „mehr Ereignisse helfen fast nie". |
| 2 — Wie schwer wiegt ein Abbruch gegen einen sauberen Freeze? | `failAbzug:0,55` (der Buehnen-Standardwert) bleibt — **keine Änderung.** | Real ist ein Crash in der Execution-Wertung „heavily penalised" und kann einen Durchgang praktisch kosten, außer der Gegner patzt ebenso schlimm — das spricht für einen härteren Abzug (analog Eiskunstlauf 0,35, wo ein Sturz ebenso hart bestraft wird). Getestet: `failAbzug:0,35` bewegt rho **−0,036** (0,869 → 0,833) — kleiner als die Spannweite UND in die falsche Richtung. Ein härterer Abzug verschlechtert die Rangtreue, statt sie zu verbessern. |
| 3 — Trägt Charisma bei Breaking wirklich nichts bei? | **Ja, 0 ist richtig — keine Änderung.** | Die aktuellen fünf Olympia-Wertungskriterien (Technique, Vocabulary, Execution, Musicality, Originality, je 20 %) kennen kein Charisma-/Lächeln-Kriterium. Der nächste Verwandte, „Originality" (individueller Stil/Kreativität), ist bereits über Torment/Will als „Präsenz im Battle" abgebildet — eine Entscheidung, die die Fable-Recherche vom 08.09. bereits getroffen hat (`breaking-folter-survival-visuelle-identitaet-recherche-08-09.md:101-104`: „kein Charisma, Präsenz im Battle statt Lächeln — bereits richtig"). Diese Runde bestätigt das nur gegen echte WDSF-Kriterien, statt es neu zu entscheiden. |

**Ergebnis:** K4 ist erfüllt durch die Kalibrierrunde selbst (Abschnitt 1–3) und den Beleg, dass
keine getestete Änderung mehr bewegt als das Kaderrauschen (Abschnitt 4). Breaking Konzept
**85 → 95**.

---

## 1. Frage A — Rundenzahl gegen echte Battle-Struktur

### 1.1 Was das Rezept heute tut

`BUEHNE_ART.breaking` (`public/mockups/battle-mode.engine.js:11011-11054`) fährt `rundenN:8` bei
`rundenDauer:0,625` — macht `8 × 6 × 2 × 0,625 = 60` Sekunden Auftrittsdauer je Spiel. Der
Codekommentar (07.09.) begründet die Verdopplung von 4 auf 8 bereits mit derselben Beobachtung wie
unten: „ein Breaking-Throw … besteht aus mehreren Bewertungsmomenten (Einstieg, Power-Move,
Freeze/Ausstieg) über typischerweise mehr als einen Durchgang".

### 1.2 Was ein echter Battle ist (recherchiert)

Ein Olympia-/WDSF-Battle besteht aus **2–3 Throwdowns** — Top-16 und Viertelfinale sind
best-of-three, aber nach zwei Durchgängen entschieden, außer bei Gleichstand (dann ein dritter);
Halbfinale und Finale laufen immer alle drei durch ([ESPN](https://www.espn.com/olympics/story/_/id/40502044/olympics-breaking-format-rules-judging)).
Ein einzelner Throwdown dauert 30–60 Sekunden und gliedert sich klassisch in **fünf Teile**:
Toprock, Übergang, Footwork/Downrock, Power-Move-Serie, Freeze als Schlusspunkt
([Topend Sports](https://www.topendsports.com/sport/list/breakdancing.htm),
[Red Bull](https://www.redbull.com/gb-en/understand-the-basic-elements-of-breaking)). Macht in
Summe **~10–15 unterscheidbare Bewertungsmomente je Battle** (2–3 Throwdowns × ~5 Teile) — eine
Größenordnung, keine von der WDSF selbst gezählte Zahl, denn die Struktur ist bewusst frei
("the structure appears flexible … rather than following strict numerical limits").

`rundenN:8` liegt am unteren Rand dieser Spanne, aber in derselben Größenordnung — nicht
„kaum mehr als ein Move-Zyklus" wie die alte `rundenN:4`-Fassung, sondern strukturell plausibel:
ein Spiel im Motor bildet den GESAMTEN Battle ab (nicht einen einzelnen Throwdown), genauso wie
Eiskunstlauf mit `rundenN:12` ein ganzes Kür-Programm (12-13 gewertete Elemente) statt eines
einzelnen Sprungs abbildet.

### 1.3 Test: rundenN 8 → 12

Kaderfeste Messung (`scripts/miss-alle-disziplinen.mjs 24 breaking`, live-save-Kaderfamilie),
`rundenDauer` proportional angepasst (`60/(12·6·2)=0,417`, Gesamtdauer bleibt 60 s):

| | rundenN 8 (main) | rundenN 12 (Test) | Delta |
|---|---:|---:|---:|
| rho je Spiel (Median) | 0,869 | 0,890 | **+0,021** |
| Spannweite je Spiel | 0,114 | 0,120 | — |
| rho Saison (Median) | 0,951 | 0,956 | +0,005 |

Die Bewegung (+0,021) liegt deutlich unter der Kader-Spannweite (0,114–0,120) und bestätigt exakt
den in CLAUDE.md dokumentierten projektweiten Befund: mehr Ereignisse heben die
Spiel-zu-Spiel-Verlässlichkeit (rho Saison bewegt sich minimal mit), aber praktisch nicht rho je
Spiel selbst. **Entscheidung: `rundenN:8` bleibt unverändert** — realistisch genug, und eine
weitere Erhöhung würde nur mehr Motorlast ohne messbaren Rangtreue-Gewinn kosten.

---

## 2. Frage B — Abbruch gegen sauberen Freeze

### 2.1 Was das Rezept heute tut

`failAbzug:0,55` (`:11038`) ist der **Buehnen-Standardwert** — denselben Wert tragen Showcase,
Speed-Schach, I-Spy, Tennis und Fechten. Nur zwei Disziplinen weichen ab: Gewichtheben `failAbzug:0`
(ein ungültiger Versuch zählt nichts — diskrete Wettkampfregel, kein Kalibrierfall) und
Eiskunstlauf `failAbzug:0,35` (ein Sturz kostet hart). Breaking hat bisher nie eine eigene
Kalibrierung dieses Werts bekommen — der Kommentar bei `:11038` dokumentiert nur die
Torment/Dexterity-Rollenkorrektur, nicht `failAbzug`.

### 2.2 Was ein echter Abbruch wiegt (recherchiert)

Ein Crash (Sturz/Ausrutscher, der den Fluss unterbricht) wird in der Execution-Wertung „heavily
penalised" — ein Breaker mit einem klaren Wipe-out kann den Durchgang laut WDSF-Erklärung nur noch
gewinnen, wenn der Gegner **genauso schlimm oder schlimmer** patzt
([Olympics.com](https://www.olympics.com/en/news/breaking-judging-system-scoring-olympic-qualifier-series-paris-2024)).
Das spricht dem ersten Eindruck nach für einen härteren Abzug als den generischen 0,55-Wert —
näher an Eiskunstlaufs 0,35, wo ein Sturz strukturell dieselbe Rolle spielt (eine sichtbare,
körperliche Ausführungsschwäche statt eines abstrakten Fehlers wie „vergibt den Punkt" bei Tennis).

### 2.3 Test: failAbzug 0,55 → 0,35

Dieselbe Messung, nur `failAbzug` geändert, `rundenN` unverändert bei 8:

| | failAbzug 0,55 (main) | failAbzug 0,35 (Test) | Delta |
|---|---:|---:|---:|
| rho je Spiel (Median) | 0,869 | 0,833 | **−0,036** |
| Spannweite je Spiel | 0,114 | 0,147 | — |
| rho Saison (Median) | 0,951 | 0,930 | −0,021 |

Die Bewegung (−0,036) liegt **innerhalb der Spannweite und in die FALSCHE Richtung** — ein
härterer Abzug verschlechtert die Rangtreue, statt sie zu heben. Das ist kein Widerspruch zur
realen Härte des Kriteriums: `failAbzug` skaliert im Motor jeden Fehlschlag gleich stark, egal wie
knapp `erfolg` verfehlt wurde, und macht damit einen ohnehin schon durch `erfolg` gut sortierten
Ausgang zusätzlich verrauscht, statt ihn zu schärfen — dieselbe Art Fehlschluss, vor der CLAUDE.md
bei „mehr Ereignisse" warnt, nur auf einem anderen Rezeptknopf. **Entscheidung: `failAbzug:0,55`
bleibt unverändert.**

---

## 3. Frage C — Trägt Charisma wirklich nichts bei?

### 3.1 Was das Rezept heute tut

Die Breaking-Matrix (`:3475` `label:"Breaking"`, Matrix-Kommentar `:11012-11015`) trägt
`will 28, torment 22, health 18, power 10, determination 10, stamina 8, dexterity 2,
intelligence 2` — **kein Charisma**. Der Kommentar begründet das bereits: „anders als die anderen
drei Buehnen-Disziplinen traegt hier nicht das Laecheln, sondern die Praesenz im Battle" — Publikum
speist sich aus Wille und Torment (`rezept.PUBLIKUM:{torment:50,will:50}`), nicht aus Charisma.

### 3.2 Was echte WDSF-Kriterien tatsächlich werten

Die aktuellen olympischen Wertungskriterien sind **fünf gleich gewichtete Domänen** (je 20 %):
Technique, Vocabulary, Execution, Musicality, **Originality**
([JudgeMate](https://www.judgemate.com/en/guides/how-breaking-is-scored),
[Olympics.com](https://www.olympics.com/en/news/breaking-judging-system-scoring-olympic-qualifier-series-paris-2024)).
Das ältere Trivium-System (Body/Soul/Mind) kannte zusätzlich „Personality" (13,33 %) — der
Domäne, die einem Charisma-/Sympathie-Attribut am nächsten käme
([Medium/Jason Pu](https://glissando.medium.com/trivium-or-delirium-a-review-of-the-youth-olympics-judging-system-for-breaking-32e6c5eeae70)).
Aber **kein Kriterium, weder alt noch neu, bewertet Sympathie oder ein Lächeln** — „Originality"/
„Personality" meinen individuellen Stil und kreative Eigenständigkeit unter Wettkampfdruck, nicht
Publikumscharme. Das ist exakt das, was das Rezept bereits über **Torment** (Haltung unter
Belastung) und **Will** (Durchsetzungskraft) abbildet, statt über ein separates Charisma-Attribut.

### 3.3 Entscheidung

**Ja, Charisma-Gewicht 0 ist richtig.** Das ist keine neue Erkenntnis dieser Runde, sondern eine
bereits getroffene und dokumentierte Fable-Entscheidung
(`docs/design/breaking-folter-survival-visuelle-identitaet-recherche-08-09.md:101-104`, 08.09.):
„die zugrundeliegende Matrix … ist bereits richtig — kein Charisma, ‚Präsenz im Battle' statt
‚Lächeln' … bereits richtig." Diese Kalibrierrunde bestätigt das gegen die tatsächlichen
WDSF-Kriterien, statt es erneut zur Diskussion zu stellen — der Plan verlangt eine Entscheidung,
keine neue Recherche, wenn die alte trägt. **Keine Änderung.**

---

## 4. Warum keine Codezeile geändert wird

Beide Hypothesen mit tatsächlichem Kalibrierungspotenzial (Rundenzahl, Abbruch-Gewicht) wurden
gemessen, nicht nur diskutiert (Abschnitt 1.3, 2.3). Breakings Kader-Spannweite bei unveränderter
Mechanik ist **0,114** (`docs/design/feinschliff-abschlussverifikation-10-09.md`, Tabelle
Abschnitt „Rangtreue-Messung", Zeile Breaking: `0,869 | 0,114 | 0,951 | 0,869 | bestanden`) — der
Maßstab aus dem Opus-Plan (Abschnitt 4.2) und `docs/design/messgrundlage-kaderfest.md`, gegen den
jede Rezeptänderung geprüft werden muss, bevor sie als real gilt.

| Hypothese | Delta rho je Spiel | vs. Spannweite 0,114 | Richtung |
|---|---:|---|---|
| `rundenN` 8 → 12 | +0,021 | kleiner | richtig, aber nicht signifikant |
| `failAbzug` 0,55 → 0,35 | −0,036 | kleiner | **falsch** |
| Charisma-Gewicht 0 → >0 | nicht getestet | — | durch echte Kriterien widerlegt, kein Testgrund |

Keine der beiden gemessenen Änderungen bewegt mehr als das Kaderrauschen; eine bewegt sogar in die
falsche Richtung. Charisma wurde nicht zusätzlich empirisch getestet, weil die Recherche (Abschnitt
3) die Frage bereits eindeutig beantwortet — ein Test hätte nur eine Antwort erzwungen, die die
echten Wertungskriterien schon verneinen. **Nach dem Plan-Text („Bewegt sie weniger, wird nichts
geändert und das Dokument hält fest, warum. Auch das erfüllt K4") ist dieser Nullbefund ein
gültiges Ergebnis.** `BUEHNE_ART.breaking` bleibt bit-identisch zu `main`.

## 5. Verifikation

Da kein Code geändert wird, entfällt der Vergleichs-Worktree-Pflichtteil aus Abschnitt 6 des Plans
(`tsc --noEmit`-Diff, `node --check`) — es gibt nichts zu vergleichen. Die einzige Prüfung, die
zählt, ist die kaderfeste Messung selbst (oben, dreimal gefahren: Baseline, `rundenN:12`,
`failAbzug:0,35`), jeweils gegen dieselbe Kaderfamilie (`data/generated/kaderfamilie-live-save.json`,
live-save-Stand `Oly New Game Custom 19.8.2026, 09:08:45`). Nach jedem Test wurde
`public/mockups/battle-mode.engine.js` exakt auf den `main`-Stand zurückgesetzt (`git status
--porcelain` leer vor dem Commit dieses Dokuments).

## 6. Geänderte Dateien

- `docs/design/breaking-kalibrierung-10-09.md` — dieses Dokument.

Keine Änderung an `public/mockups/battle-mode.engine.js` oder irgendeiner anderen Datei.

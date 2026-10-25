# Battlefield TMP/AUS: Zwei-Strom-Pp-Messung und Realkampf-Varianzvergleich (15.10.)

**Ergebnis dieser Runde: Normierung bleibt draußen. Kein Commit an `aufEignung()`,
`battle-mode.engine.js` oder `battle-mode.rezepte.js`.** Reine Messrunde, die exakt den in
`docs/design/tmp-aus-pp-chassis-diagnose-15-10.md` Abschnitt 5 ("Empfehlung", Punkt 2 +
"Konkrete Empfehlung") skizzierten nächsten Schritt fährt: eine echte Zwei-Strom-Pp-Messung
für Battlefield plus ein Realkampf-Varianzvergleich über mehrere echte Paarungen, nicht nur
die eine V-W/A-A-Stichprobe der Diagnose-Runde.

**Warum nur Battlefield:** TDM und Mini-DM sind laut Diagnose rho-gebunden, nicht Pp-gebunden
(CLAUDE.md ordnet rho vor Pp bei Zielkonflikt) — eine TMP/AUS-Änderung würde ihnen nicht
helfen. Battlefield ist die einzige der drei verbliebenen Nutzer des Arena-Duell-Chassis
(Fechten ist seit 03.09. ausgezogen), für die Pp tatsächlich der praktische Engpass ist.

---

## 1. Methode

**Pp-Messung:** `node scripts/messe-arena-einfluss.mjs battlefield 16` und dieselbe mit
`--saat-versatz=10000000`, zwei unabhängige Saatströme wie von CLAUDE.md für jede Pp-Abnahme
verlangt. n=16 (im geforderten Fenster 12–24).

**Realkampf-Varianzvergleich:** ein temporärer Messhaken in `aufEignung()`
(`window.__TMP_AUS_ALPHA`, additiv, Default 0 → bit-identisch zum Stand ohne Haken — exakt
dieselbe Konstruktion wie in der Diagnose-Worktree vom selben Tag), dazu ein neues Skript
`scripts/miss-battlefield-tmp-aus-varianz-15-10.mjs`: für jede der fünf echten Paarungen aus
`data/generated/kaderfamilie-live-save.json` (live-save, nicht die eine V-W/A-A-Stichprobe)
wird per `window.__arena.kaderSetzen({heim,gast})` die Aufstellung getauscht und
`window.__arena.serieVon("battlefield", 24)` gefahren — bei alpha = 0 (heutiger Stand), 1
(volle Normierung wie LP/ANG/VER) und, weil das Ergebnis bei alpha=1 gemischt ausfiel (s.
Abschnitt 3), zusätzlich bei alpha = 0,5.

**Der Messhaken ist nach dieser Runde wieder entfernt** (`git checkout` auf die Originaldatei)
— dieser PR enthält keinen Diff an `battle-mode.engine.js`, nur das neue Messskript und dieses
Dokument.

---

## 2. Ergebnis 1 — Pp heute, zwei Ströme

| Strom | Pp gesamt |
|---|---:|
| saat-versatz=0 | **30,1 Pp** |
| saat-versatz=10000000 | **37,1 Pp** |

Beide liegen weit unter den über einen Monat alten 110/101,7-Pp-Zahlen aus der Diagnose — die
Rezept-Korrektur vom 02./03.09. (TMP auf `awareness/intelligence/charisma` statt
`speed/dexterity`, s. Diagnose Abschnitt 3.3) hat seitdem sichtbar gewirkt: Speed, Dexterity
und Will lesen in **beiden** Strömen exakt 0 %, bei Matrixgewicht 0 — der historische
"kostenlose" Kanal über Matrixgewicht-0-Attribute ist für Battlefield nicht mehr nachweisbar.

Attribut-Aufschlüsselung beider Ströme:

| Attribut | Matrix | Strom 0 | Strom 10M |
|---|---:|---:|---:|
| intelligence | 16 | 24,1 % (+8,1) | 16,3 % (+0,3) |
| charisma | 20 | 16,5 % (−3,5) | 12,0 % (−8,0) |
| spirit | 16 | 16,4 % (+0,4) | 23,5 % (+7,5) |
| awareness | 10 | 14,1 % (+4,1) | 17,1 % (+7,1) |
| torment | 12 | 11,1 % (−0,9) | 14,2 % (+2,2) |
| power | 10 | 9,9 % (−0,1) | 11,4 % (+1,4) |
| stamina | 4 | 6,5 % (+2,5) | 3,3 % (−0,7) |
| determination | 4 | 1,5 % (−2,5) | 2,1 % (−1,9) |
| speed/dexterity/will | 0 | 0 % | 0 % |
| health | 8 | 0 % (−8,0) | 0 % (−8,0) |

**Zwei getrennte Befunde stecken in dieser Tabelle, nicht einer:**

1. **Awareness ist in beiden Strömen über Matrix** (+4,1 / +7,1 Pp) — awareness ist Zutat im
   `battlefield.rezept.TMP` (`awareness:36`, s. Diagnose Abschnitt 3.3). Das deckt sich exakt
   mit dem in der Diagnose (Abschnitt 2.3) an der Persönlichkeits-Runde vom 07.10. gezeigten
   Mechanismus: ein matrixgewichtetes Attribut, das ZUSÄTZLICH TMP speist, kassiert einen
   zweiten, unnormierten Bonus obendrauf. Intelligence/spirit/charisma schwanken zwischen den
   Strömen stärker (vermutlich Rauschen aus den anderen Rezept-Zutaten, nicht derselbe saubere
   TMP-Effekt) — awareness ist das einzige Attribut, das in BEIDEN Strömen konsistent und klar
   über der Matrix liegt.
2. **Health (−8,0 Pp in beiden Strömen, identisch) ist ein separater, von TMP/AUS unabhängiger
   Befund.** Health speist laut Rezept LP, nicht TMP/AUS — seine fehlende Wirkung lässt sich
   mit dieser Normierungsfrage nicht erklären und ist nicht Gegenstand dieses Auftrags. Wird
   hier nur dokumentiert, damit eine künftige Battlefield-Runde nicht glaubt, TMP/AUS wäre die
   ganze Lücke.

---

## 3. Ergebnis 2 — Realkampf-Varianz über fünf echte Paarungen

`serieVon("battlefield", 24)` je Paarung, Siegquote und Score-Varianz (Differenz Heim−Gast
über alle 24 Läufe, nicht nur über die verschiedenen Endstände):

| Paarung | alpha=0 (heute) | alpha=0,5 | alpha=1 (volle Normierung) |
|---|---|---|---|
| vigilante-armageddon | 100 % · Var 0,2 | 96 % · Var 2,1 | 96 % · Var 1,5 |
| coldsteel-direlegion | 83 % · Var 3,5 | 92 % · Var 3,0 | 100 % · Var **0,3** |
| goldengladiators-silversoldiers | 100 % · Var 0,5 | 100 % · Var 0,3 | 100 % · Var **0,1** |
| mortalsin-natureswrath | 92 % · Var 1,2 | 71 % · Var 2,4 | 83 % · Var 3,2 |
| piratecrew-raginglunatics | 100 % · Var 0,0 | 100 % · Var 0,0 | 100 % · Var 0,0 |

**Das Bild ist gemischt, nicht eindeutig — und genau das entscheidet gegen einen Build.**

- Für **coldsteel-direlegion** und **goldengladiators-silversoldiers** verengt sich die
  Score-Streuung **monoton** mit steigendem alpha (3,5→3,0→0,3 bzw. 0,5→0,3→0,1) — exakt der
  historische Blowout-Mechanismus aus der 24.08.-Diagnose, nur diesmal an echten Paarungen
  nachgewiesen, die mit der alten V-W/A-A-Stichprobe nie getestet wurden. Schon bei alpha=0,5
  ist die Verengung sichtbar, nicht erst bei voller Normierung.
- Für **vigilante-armageddon** und **mortalsin-natureswrath** verhält es sich umgekehrt: die
  Varianz **steigt** mit alpha (0,2→2,1→1,5 bzw. 1,2→2,4→3,2).
- **piratecrew-raginglunatics** ist für diese Frage uninformativ: bei allen drei
  alpha-Werten exakt 24/24 Kämpfe 4:0 — die Paarung ist so einseitig (Eignungsabstand), dass
  sie schon bei alpha=0 komplett kollabiert ist; TMP/AUS-Normierung kann daran nichts mehr
  ändern oder verschlechtern.

**Zusatzbefund, nicht Teil des Entscheidungskriteriums, aber dokumentationswürdig:** Schon bei
alpha=0 — dem HEUTIGEN, unveränderten Stand — zeigen 3 von 5 echten Paarungen eine sehr
blowout-lastige Verteilung (piratecrew 24/24 exakt 4:0, vigilante 19/24 exakt 4:0, golden 14/24
exakt 4:0). Das ist ein chassis-weiter Befund, der mit TMP/AUS nichts zu tun hat (er besteht ja
schon OHNE jede Normierung) — nicht Gegenstand dieses Auftrags, aber ein Hinweis für eine
künftige Battlefield-Rezeptrunde, dass die Score-Varianz dort unabhängig von dieser Frage ein
eigenes Thema ist.

---

## 4. Entscheidung nach dem in der Diagnose festgelegten Kriterium

Build-reif wäre die Normierung nur, wenn die Messung entweder (a) weiterhin KEINEN Blowout
zeigt, oder (b) einen alpha-Wert findet, der Pp spürbar senkt, ohne die Score-Streuung sichtbar
zu verengen.

- **(a) trifft nicht zu:** für 2 von 5 echten Paarungen reproduziert sich die Verengung klar
  und monoton mit steigendem alpha.
- **(b) trifft ebenfalls nicht zu:** auch beim Zwischenwert alpha=0,5 — dem naheliegenden
  Kompromiss — bleibt die Verengung für genau dieselben zwei Paarungen sichtbar (nur
  abgeschwächt, nicht aufgehoben). Es gibt in den drei getesteten Werten keinen, der die
  Verengung für alle Paarungen vermeidet.

**Damit bleibt es bei der Diagnose: kein Commit an `aufEignung()`, `battle-mode.engine.js`
oder `battle-mode.rezepte.js`.** Der historische Blowout-Befund vom 24.08. ist mit der alten
V-W/A-A-Stichprobe nicht reproduzierbar (s. Diagnose, bestätigt auch hier: `vigilante-
armageddon` entspricht dieser Paarung und zeigt bei alpha=1 KEINE Verengung) — er reproduziert
sich aber, mit derselben Methode auf vier zusätzliche echte Paarungen angewendet, für zwei von
ihnen deutlich. Die ehrliche Lesart ist nicht "der Befund ist falsch" oder "der Befund gilt
unverändert", sondern: **das Risiko ist real und paarungsabhängig, und es gibt noch keinen
alpha-Wert, der es zuverlässig umgeht.** Eine künftige Runde, die das angehen will, müsste genau
hier ansetzen — zum Beispiel prüfen, ob sich die beiden "verengenden" Paarungen durch ein
gemeinsames Merkmal (Eignungsabstand, Heiler-Anteil, Slot-Verteilung) von den beiden
"verbreiternden" unterscheiden lassen —, nicht einfach einen anderen alpha-Wert raten.

**Unverändert offen, unabhängig von dieser Runde:** die Health-Lücke (−8,0 Pp, beide Ströme)
und die grundsätzliche Blowout-Neigung des Battlefield-Chassis bei alpha=0 (Abschnitt 3,
Zusatzbefund) — beides eigene Befunde, die eine künftige Battlefield-Rezeptrunde angehen
müsste, aber außerhalb dieses Auftrags liegen.

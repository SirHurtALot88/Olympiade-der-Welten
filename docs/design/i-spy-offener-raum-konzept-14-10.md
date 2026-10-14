# I-Spy: offener Raum, exklusive Fundorte — Konzeptpapier zu Punkt 28e/28b (14.10.)

**Reines Konzeptpapier für die Hälfte von Punkt 28, die NICHT gebaut wurde.** Auftrag: K7 aus
`docs/design/fable-konzept-chris-feedback-13-10.md` Abschnitt 5.7, mit den Querschnitts-Bausteinen
Q7 (Abschnitt 3.7, die Kontaktregel) und Q8 (Abschnitt 3.8, Zustands-Ikonen) sowie dem
29-Punkte-Überblick in Abschnitt 1. Quelle des Wunsches: `docs/design/chris-feedback-breite-
runde-13-10.md`, Task #129 Punkt 28. `engine.js` meint `public/mockups/battle-mode.engine.js`
(Stand `main`, 14.10.).

## 0. Was in dieser Runde bereits als Code geliefert wurde

Fünf Teile stecken in Chris' Wunsch, zwei davon Klasse A, präsentatorisch, ohne Mess-Risiko — beide
sind **in dieser Runde bereits gebaut, verifiziert und PR-bereit** (Branch
`i-spy-sichtbare-hinweise-14-10`):

- **28a — Sprechblasen-Ikonen** (Baustein Q8): drei neue Zustände über dem Kopf jedes Teilnehmers,
  zusätzlich zur schon vorhandenen großen Lupe. Während `suchen` zeigt eine kleine Pille das
  Sub-Skill-Kürzel des gerade bearbeiteten Fundorts (LOGIK/MENSCH/FINGER), während `gehen` ohne
  Reaktion ein Pfeil ("will dorthin"), während `idle` (kein Ziel diesen Tick) "…" ("wartet"). Reine
  `viz*`-Ablesung aus bereits vorhandenen Feldern (`u.vizPhase`, neu `u.vizIspySkill`), kein `rr()`.
- **28c/d — Hinweisstärke und Main-Skill je Fundort**: die Sterne (`ispySterne()`, unverändert seit
  PR 1) zeigten die Stufe/den Ertrag schon; neu ist `ispyFundortBadge()`, das über jedem der zwölf
  Fundorte den benötigten Sub-Skill plus Punktwert einblendet (z. B. „LOGIK · 60"), bei den beiden
  Mehrwege-Tresoren zusätzlich den Nebenweg gedämpft darunter („o. FINGER"). Reine Referenzdaten aus
  `BUEHNE_ART["i-spy"].fundorte`/`ISPY_PUNKTWERT`, kein Spoiler über Ausgänge.

Verifiziert: `node scripts/miss-alle-disziplinen.mjs 24 i-spy` liest unverändert **0,750 / 0,177 /
0,881 / 0,210** (bit-identisch zum Stand vor dieser Runde), `npx eslint public/mockups/battle-
mode.engine.js` bleibt bei 0 Fehlern, drei einschlägige Vitest-Suiten (100 Tests) grün,
Screenshot-Sonde (`scripts/screenshot-disziplin.mjs i-spy`) bestätigt beide Bausteine visuell.
**Dieses Papier handelt ausschließlich von den verbleibenden drei Teilen — 28e (offener Raum) und
28b (exklusive Fundorte, Schubsen/Warten) —, die NICHT gebaut wurden.**

## 1. Chris' Wunsch, vollständig zitiert

Task #129 Punkt 28, Chris wörtlich: „bei I Spy wäre es noch gut wenn die Spieler miteinander
interagieren können und müssen, wenn man mit ner Lupe überm kopf sieht dass sie gerade analysieren
oder suchen Also dass man wie so sprechblasen verschiedene Icons hat um zu sehen was der Spieler
gerade denkt und tun will! **und dass an jedem Ort wo man suchen kann nur 1 Spieler stehen darf,
wenn ein gegner hin will muss er ihn weg schubsen oder warten bis der fertig ist** Für den
Zuschauer sollte erkennbar sein, wo die fettesten Hinweise sind damit man mitfiebern kann welche
Geheimnisse stark sind und welche vllt ein dickes Schloss haben aber wenig bringen - und man müsste
erkennen welcher Main Skill benötigt wird **Der Raum sollte nicht getrennt sein und alle Spieler
können sich ÜBERALL hin bewegen!**"

Die beiden fettgedruckten Sätze sind 28e/28b — Thema dieses Papiers.

## 2. Ist-Zustand: zwei Räume, nicht einer — und warum

`BUEHNE_ART["i-spy"].fundorte` trägt zwölf Fundorte an festen Positionen. Seit **I1** (27.09.,
Broadcast-Optik-Recherche) zeichnet `bodenSchatzsuche()` diese zwölf Möbel **zweimal** — einmal in
jeder Bildschirmhälfte, getrennt durch einen „Trennsteg" (`engine.js:24271 ff.`). Mechanisch sind
das zwei **vollständig unabhängige Kopien** desselben Zwölf-Fundort-Layouts: Heim bespielt seine
eigene Truhenkopie, Gast seine eigene, und `ispyFundortXY(f,side)` bildet dieselbe normierte
Koordinate nur auf die Hälfte der Leinwand ab, die zur jeweiligen Seite gehört. Zwischen den Seiten
fließt laut Kopfkommentar bei `baueSchatzsuche()` **ausschließlich Information** — Sichtbarkeit
eines Fundes und ob ein Läufer losgeschickt wird (R-2, Konzept Abschnitt 3.3/3.4) — „nie das
Truhen-Objekt selbst". Ein Spieler von Team A kann einem Spieler von Team B **niemals** an einem
physischen Fundort begegnen, weil es diesen Fundort für beide Seiten zweimal, unabhängig
voneinander gibt.

Das ist keine Verlegenheitslösung, sondern eine **explizit dokumentierte, gemessene
Architekturentscheidung** (`engine.js:19343 ff.`, Kommentar „ARCHITEKTUR-ENTSCHEIDUNG"):

> „PR 1 hat aus gemessenen Gründen (‚EIGENE, VOLLSTÄNDIG UNABHÄNGIGE SCHATZSUCHE JE SEITE') JEDER
> Seite eine eigene Kopie des Raums gegeben, statt eines einzigen von beiden Seiten gemeinsam
> bespielten Pools — ein echter gemeinsamer Pool ohne Reaktionsmechanik maß rho auf **0,53** ab."

Drei unabhängige Dokumente bestätigen dieselbe Zahl mit demselben Befund:

| Quelle | Zitat |
|---|---|
| `i-spy-fable-reaktionskanal-22-09.md:36` | „ein geteilter Pool maß 0,53" |
| `i-spy-fable-reaktionskanal-22-09.md:160` (Tabellenzeile „G Geteiltes Brett") | „Beide Seiten spielen um dieselben Truhen. Wäre die einzig ‚wahre' Reaktion. **Tot**: PR 1 maß 0,53 (**Zugriffsreihenfolge dominiert den Sub-Skill**)." |
| `i-spy-opus-konzeptreview-26-09.md:41, 366, 702` | „Getrennte Räume je Seite bleiben (ein geteilter Pool maß 0,53)." / „Keine geteilten Truhen zwischen den Teams. […] Der geteilte Pool maß 0,53, und das bleibt eine **harte Grenze**." |

**Punkt 28e/28b ist damit nicht irgendeine neue Idee — es ist exakt die Option „G Geteiltes Brett",
die das Projekt am 22.09. bereits evaluiert, gemessen und mit einer Diagnose verworfen hat.** Die
Diagnose ist präzise: „Zugriffsreihenfolge dominiert den Sub-Skill" heißt, dass bei einem echten
gemeinsamen Pool die Frage „wer ist zufällig zuerst da" (eine Funktion aus Zug-Timing, Tick-Position
in der Warteschlange, Reihenfolge-Zufall) den Punktausschlag stärker bestimmt als die eigentliche
Eignung des Spielers — und rho dadurch von 0,750 auf 0,53 einbricht, weit unter die bereits
verfehlte 0,80-Schranke.

## 3. Die Kernfrage: trägt die Bühnen-Duell-Lehre?

`docs/design/fable-ideen-buehne-duell-30-09.md` (Speed-Schach/Fechten/Tennis) formuliert ein
Prinzip, das dort rho-Risiko „per Konstruktion null" macht:

> „Die Leistungsschicht bleibt solo, nur die Ergebnisschicht wird interaktiv. Jeder Spieler würfelt
> wie heute seine Durchgänge für sich (`u.summe` bleibt Zeichen für Zeichen der Messwert für rho),
> aber wer den Punkt/das Gefecht/das Brett gewinnt, entsteht erst aus dem Vergleich beider
> Solo-Leistungen."

Der Grund, warum das sicher ist, steht im selben Dokument (Abschnitt 1.2), konkret an der Stelle im
Code: `setz()` würfelt jeden Teilnehmer **vollständig unabhängig**, bevor überhaupt ein Gegner
feststeht. Der `art.duell`-Block paart danach Brett i gegen Brett i und bildet `vorteil` — eine
**reine Nachher-Differenz zweier bereits fertiger Zahlen**. Diese Differenz fließt nirgends in
`u.summe` zurück; `wert()` liest weiterhin die eigene Punktsumme. Die interaktive Schicht sitzt
**strikt nach dem gewürfelten Ereignis** und verändert nie, was gewürfelt wurde oder wie oft. Genau
das ist dieselbe Regel, die Gewichtheben trägt („380 kg gehoben, auch wenn er verliert") und die F1
am 26.09. für Fechten umgesetzt hat.

**I-Spys 28b ist strukturell das Gegenteil.** „Nur 1 Spieler darf an einem Fundort stehen, ein
Gegner muss wegschubsen oder warten" ist keine Nachher-Interpretation zweier bereits feststehender
Zahlen — es ist ein **Vorher-Tor**: Es entscheidet, **ob und wann ein Spieler überhaupt würfeln
darf**. Ein Spieler, der warten muss, verliert nicht die Interpretation eines Ergebnisses, er
verliert den **Versuch selbst** — in einem auf acht Ticks fest budgetierten Spiel ist das eine
geringere Zahl an Spür-/Knack-Ereignissen, nicht nur eine andere Lesart derselben Ereignisse. Das
ist exakt die Fallunterscheidung, die die Bühnen-Duell-Lehre selbst zieht (dort Abschnitt 1.2: „Das
heißt für jede Klasse-B-Idee: solange sie **nach** `setz()` ansetzt … **kein `rr()` zieht** und
`u.summe`/`u.runden[].punkte` nicht verändert" — Hervorhebung hier) und die 28b nicht erfüllen
kann, weil die Exklusivität per Definition vor dem Wurf greifen muss, sonst gibt es nichts, worüber
sich „wegschubsen" lohnt.

**Antwort auf die Kernfrage: Nein, die Lehre trägt hier nicht — nicht aus Mangel an
Ausführungssorgfalt, sondern aus einem strukturellen Grund, der sich nicht durch bessere
Kalibrierung auflösen lässt: Bühnen-Duell macht die interaktive Schicht sicher, weil sie NACH der
Messung sitzt; I-Spys Exklusivität müsste VOR der Messung sitzen, um überhaupt etwas zu bedeuten.**
Und für genau diesen Fall liegt bereits eine Messung vor, keine Vermutung: 0,53.

## 4. Drei Fehlschläge, nicht einer — I-Spys Chassis ist bereits dreifach als fragil belegt

Der geteilte Pool (0,53) ist nicht der einzige dokumentierte, gescheiterte Umbauversuch an diesem
Chassis. Zwei weitere, strukturell andere Ideen sind seither geprüft und verworfen worden:

| Versuch | Datum | Idee | Ergebnis | Quelle |
|---|---|---|---|---|
| **Geteilter Pool** ("G Geteiltes Brett") | 22.09. (gemessen als Teil von PR 1, 21.–22.09.) | Beide Seiten spielen um dieselben zwölf Truhen | **rho 0,53** (Abbruchkriterium weit verfehlt) | `i-spy-fable-reaktionskanal-22-09.md` |
| **P1 „Spur statt Los"** | 26.09. | Personengebundene Spuren statt des geteilten Truhen-Pools je Seite | rho je Spiel **0,659–0,689** (acht Varianten), 0 von 5 paarweise besser, Star Rang 1 38,3 % (Ziel 47,5 %) | `i-spy-p1-prototyp-befund-26-09.md` |
| **I-2k „Kennerblick"** | 07.10. | Nebenweg-Mehrwege im Finden (Kompetenz-Mittel statt Primärweg-Maximum) | rho 0,717–0,738 (Ist 0,750), Saison bis 0,804 (Ist 0,881), 6 von 8 Abbruchkriterien verfehlt | `stand-aller-disziplinen.md` Abschnitt 7, Nachtrag 07.10. |

Alle drei folgten demselben Protokoll (isolierte Worktree, kein Commit am Motor, Abbruchkriterium
vor dem Bau festgelegt) — ein Protokoll, das 28e/28b ebenfalls verdient, falls Chris es trotz dieses
Papiers versuchen will (Abschnitt 6). Die gemeinsame Lehre aus allen drei: **I-Spys
Saison-Validität ist mit 0,881 bereits eine der besten aller zwanzig Disziplinen — das Problem sitzt
ausschließlich in der Verlässlichkeit, und jeder bisherige Versuch, daran über eine Strukturänderung
zu drehen, hat die Validität stärker beschädigt, als er die Verlässlichkeit gehoben hat.**

## 5. Warum Kontestation Rauschen zufügt, kein Signal

I-Spys rho-Zerlegung (CLAUDE.md; `rho(Spiel)=rho(Saison)·√Verlässlichkeit`) rechnet mit den
aktuellen Zahlen 0,750/0,881 auf eine implizite Verlässlichkeit von rund **0,724**
(`(0,750/0,881)²`). Die Schranke von 0,80 verlangt bei unveränderter Validität eine Verlässlichkeit
von **0,825** — ein Dokumentationskommentar im Motor selbst nennt exakt diese beiden Zahlen
(`engine.js`, Rezept-Kopfkommentar bei `BUEHNE_ART["i-spy"]`: „Verlaesslichkeit 0,724, noetig fuer
0,80 bei der gemessenen Validitaet waere 0,825"). **Verlässlichkeit steigt, wenn mehr Ereignisse
stärker mit der tatsächlichen Eignung korrelieren — nicht, wenn mehr Ereignisse dazukommen, die von
einer dritten, fremden Größe abhängen.**

Eine echte, seitenübergreifende Exklusivität fügt genau eine solche fremde Größe hinzu: ob ein
Spieler seinen Versuch an einem Fundort überhaupt durchführen kann, hängt jetzt zusätzlich davon ab,
**ob und wann ein Gegner zufällig denselben Fundort anvisiert hat** — eine Größe, die selbst aus
dessen eigenem Spürwurf plus Zug-Timing entsteht und nur schwach mit der Eignung des
**kontestierten** Spielers korreliert. Das ist exakt die von „Zugriffsreihenfolge dominiert den
Sub-Skill" beschriebene Dynamik. Es handelt sich nicht um „mehr Ereignisse" im Sinne von CLAUDE.md
(„Mehr Ereignisse helfen fast nie") — es ist ein KONFUNDIERENDER Kanal, der bestehende Ereignisse
unzuverlässiger macht, indem er eine zusätzliche, eignungsferne Zufallsquelle in genau die Zahl
einspeist, die rho misst (`u.summe`).

**Die Analogie zu Takeshis `tackleNerven` (CLAUDE.md, Q7-Abschnitt) trägt hier sogar verschärft:**
dort kostete Fremdkontakt, der einen Lauf zerstört, Saison-rho 0,937 → 0,902 — ein Verlust von 0,035
Punkten bei einer Disziplin, die vorher weit über der Schranke lag und sich den Verlust leisten
konnte. I-Spy steht bei 0,750, **bereits unter** der Schranke, mit praktisch keinem Puffer. Die
Q7-Regel „Kontakt kostet, nimmt nicht" (nur Zeit/Position, nie ein schon erreichtes Ergebnis) hält
bei Takeshi, weil dort Zeit ein kontinuierliches, nachholbares Gut ist. I-Spy hat dagegen ein **hart
auf acht diskrete Ticks budgetiertes** Zeitkonto — verlorene Zeit in einem frühen Tick ist nicht
„nur" Zeit, sie ist ein direkt verlorener Versuch, weil es keinen neunten Tick zum Nachholen gibt.
„Kostet nur Zeit" ist bei I-Spy näher an „kostet nur Punkte" als bei jeder anderen Disziplin, für
die Q7 bisher gedacht war.

## 6. Was tatsächlich sicher wäre — und was es nicht leistet

**28e allein, rein kosmetisch (Klasse A, sofort baubar):** den Trennsteg entfernen und beide
Raum-Hälften als EIN durchgehendes Bild zeichnen, in dem beide Teams sichtbar überall laufen —
mechanisch bleiben es weiterhin zwei unabhängige Truhenkopien (`u.summe` unverändert, bit-identisch
messbar wie 28a/c/d). Das erfüllt Chris' **Satz** „Der Raum sollte nicht getrennt sein und alle
Spieler können sich ÜBERALL hin bewegen" wörtlich und bildlich — es erfüllt aber **nicht** den
Exklusivitäts-Satz direkt davor: zwei Spieler, die im Bild am selben Fundort zu stehen scheinen,
konkurrieren in Wahrheit um nichts, weil jede Seite ihre eigene Truhe an derselben Koordinate
bespielt (exakt das „Theater"-Muster, das die Reaktionsmechanik seit PR 2 schon für den Läufer
betreibt, s. `i-spy-fable-reaktionskanal-22-09.md` Abschnitt 1: „mechanisch ist die Reaktion schon
heute Theater über das eigene Brett"). **Das wäre ehrlich nur eine Teilerfüllung**, und ich schlage
nicht vor, sie stillschweigend als „28e/28b erledigt" zu verbuchen — wenn Chris sie will, sollte er
wissen, dass sie die Begegnung nur zeigt, nicht herstellt.

**Der bereits vorhandene, naheliegendste Baustein, falls echte Kontestation je versucht wird:**
Innerhalb EINER Seite existiert Kontestation schon heute. Der Fundort-Kopfkommentar
(`engine.js:15900 f.`) hält fest: „NERVEN entscheidet die Bearbeitungsreihenfolge, wenn mehrere
Teilnehmer im selben Tick um dieselbe … Truhe konkurrieren" — plus die „K-D Wettlauf mit
Fortschritt"-Ausnahme (`engine.js:19335 ff.`), die einem begehrten Fundort einen zweiten Versuch im
selben Tick erlaubt: „Wer zuerst dran ist (NERVEN-Reihenfolge), versucht zuerst; scheitert er,
bleibt die Truhe für den nächsten Interessenten … offen. Niemand verliert seinen Zug allein durch
die Kollision." Das ist bereits fast wörtlich Chris' Bild — nur bislang ausschließlich zwischen den
sechs Spielern DERSELBEN Seite, nie gegen den Gegner. Jeder künftige Versuch an 28b sollte hier
ansetzen (dieselbe Formel, größere Population), statt eine komplett neue Kollisionsmechanik zu
erfinden — das ändert nichts an der in Abschnitt 5 benannten Gefahr, hält den Suchraum für einen
Prototyp aber klein.

## 7. Wenn Chris es trotzdem versuchen will

Dieses Papier rät vom direkten Bau ab, nicht von jedem weiteren Versuch. Drei Dinge würde ich
verlangen, bevor auch nur ein Prototyp beginnt — dasselbe Protokoll, das P1 und I-2k schon
durchlaufen haben:

1. **Isolierte Worktree, kein Commit am Motor**, bis gemessen ist.
2. **Abbruchkriterium vorher fixiert**, nicht nachträglich gerechtfertigt — Vorschlag: rho je Spiel
   ≥ 0,78 (die I-2k-Messlatte), **UND** paarweise besser als der Ist-Stand in ≥ 4 von 5 Kader-
   Varianten, **UND** Star auf Rang 1 ≥ 45 % (die kaderfeste n=48-Nachmessung des Ist-Stands aus
   `stand-aller-disziplinen.md` liest 47,1 %), **UND** Pp-Abweichung ≤ 25 bei zwei unabhängigen
   Saatströmen (CLAUDE.md-Pflichtprüfung — eine neue Mechanik, die WER ZUERST DA WAR einführt, kann
   leicht ein Attribut wie `speed`/`awareness` überproportional durchreichen, ohne dass das in der
   Matrix so vorgesehen ist).
3. **Nicht den vollen Zwölf-Fundort-Pool gemeinsam machen.** Falls überhaupt, zuerst eine
   **Low-Dose-Variante** nur für die beiden Tresore (Stufe 3, die „fettesten Hinweise", um die es
   Chris offensichtlich am meisten geht) — dieselbe Dosis-vor-Vollausbau-Disziplin, mit der
   `ISPY_HINWEIS_BONUS` kalibriert wurde (0 → 0,15 → 0,30 → 1,0, monoton fallend gemessen). Ein
   Scheitern bei zwei von zwölf Fundorten verliert weniger, ein Erfolg zeigt, ob die Dynamik
   überhaupt tragfähig ist, bevor man sie auf alle zwölf ausweitet.

Realistische Erwartung, auf Basis der drei bisherigen Fehlschläge: **eher nein**. Aber „eher nein,
ungemessen" ist eine schwächere Aussage als die, die dieses Papier treffen soll — deshalb der
Vorschlag, es im kleinen Maßstab zu testen, statt die Tür endgültig zu schließen.

## 8. Fazit

- **28a, 28c, 28d sind gebaut, gemessen, bit-identisch** — Klasse A, PR-bereit (s. Abschnitt 0).
- **28e (offener Raum) ist als reine Optik ohne echte Exklusivität ebenfalls Klasse A und sicher
  baubar** — erfüllt aber nur die Hälfte von Chris' Satz, nicht die Begegnung selbst, und sollte
  nicht stillschweigend als vollständige Erfüllung verkauft werden.
- **28b (exklusive Fundorte, echtes Schubsen/Warten über Teamgrenzen) überträgt die
  Bühnen-Duell-Lehre nicht**, weil die Exklusivität strukturell VOR der Messung ansetzen müsste
  (ein Zugriffs-Tor), während die Bühnen-Duell-Sicherheit daraus entsteht, dass ihre interaktive
  Schicht NACH der Messung ansetzt (ein Ergebnis-Vergleich). Diese Diagnose ist nicht neu hergeleitet
  worden — sie ist bereits am 22.09. gemessen worden (rho 0,53) und seither als harte Grenze
  dokumentiert.
- **Ehrliche Antwort auf die Kernfrage aus dem Konzeptdokument:** Nein, der offene Raum mit echter
  Exklusivität bewegt I-Spy nicht näher an 0,80, sondern weiter davon weg — nicht spekulativ, sondern
  anhand der bereits vorliegenden Messung. Wer die Rangtreue heben will, arbeitet bei I-Spy wie bei
  jeder anderen Disziplin an der Validität — und I-Spys Validität ist mit 0,881 schon eine der
  stärksten im Projekt. Das verbleibende Defizit sitzt in der Verlässlichkeit, und eine
  seitenübergreifende Kontestation verschärft genau dieses Defizit, statt es zu lindern.

## 9. Entscheidungen, die Chris gehören

- **E-I1:** Soll 28e als rein kosmetische, mechanisch ungeteilte Raumzusammenlegung gebaut werden
  (Abschnitt 6), mit der ausdrücklichen Einschränkung, dass sie keine echte Begegnung herstellt?
- **E-I2:** Soll 28b trotz der 0,53-Messung und der beiden zusätzlichen Fehlschläge (P1, I-2k) als
  kontrollierter, dosierter Prototyp versucht werden (Abschnitt 7), mit vorher fixiertem
  Abbruchkriterium? Oder bleibt I-Spy bei der Reaktionsmechanik, die es seit PR 2 hat (sichtbare
  Funde, Läufer mit Sichtbonus, aber kein echter Kontakt)?

## Quellen

**Gelesen, im Repo:**
- `docs/design/fable-konzept-chris-feedback-13-10.md` — Abschnitt 1 (29-Punkte-Tabelle, Zeile 28),
  3.7 (Q7 Kontaktregel), 3.8 (Q8 Zustands-Ikonen), 5.7 (K7)
- `docs/design/chris-feedback-breite-runde-13-10.md` — Abschnitt „I-Spy", Punkt 28
- `docs/design/i-spy-schatzsuche-konzept-21-09.md` — Chris' Ursprungskonzept, Abschnitt 2.1 (Raum),
  5 (visuelle Umsetzung)
- `docs/design/i-spy-fable-reaktionskanal-22-09.md` — Abschnitt 1 (Architektur-Befund), Tabelle
  Abschnitt 4 (Varianten A–H, Zeile „G Geteiltes Brett")
- `docs/design/i-spy-opus-konzeptreview-26-09.md` — Abschnitt zu „Die beiden Teams spielen parallel
  Solitär", Abschnitt 8 (harte Grenze)
- `docs/design/i-spy-p1-prototyp-befund-26-09.md`, `docs/design/stand-aller-disziplinen.md`
  Abschnitt 7 (P1- und I-2k-Befunde, Nachtrag 07.10.)
- `docs/design/fable-ideen-buehne-duell-30-09.md` — Abschnitt 1.2/Kurzfassung Punkt 1 (die
  Bühnen-Duell-Lehre selbst)
- `public/mockups/battle-mode.engine.js` — `BUEHNE_ART["i-spy"]` (Rezept, Fundorte,
  Architektur-Entscheidung-Kommentar `:19343 ff.`), `baueSchatzsuche()`, `bodenSchatzsuche()`,
  `ispyFundortXY()`/`ispyFuehrung()`

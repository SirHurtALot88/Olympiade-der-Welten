# Climbing-Kontakt: Herunterziehen, Vorbeiziehen, Wehren — Konzeptrunde K3 (14.10.)

**Konzeptpapier, kein Code, keine Freigabe.** K3 aus `fable-konzept-chris-feedback-13-10.md`
Abschnitt 5.3, Ausarbeitung von Task #109 / Punkt 8 aus `chris-feedback-breite-runde-13-10.md`.
Chris, wörtlich: „Spieler-Interaktion beim Klettern (herunterziehen, aneinander vorbeiziehen,
Wehren) […] die Möglichkeit haben aneinander vorbei zu ziehen aber sich evtl wehren
können/müssen."

**Nichts an `public/mockups/battle-mode.engine.js` wurde für dieses Papier geändert.** Die
Formel ist gegen eine **disposable Kopie** des Motors prototypisiert und gemessen (Anhang A
zeigt den vollständigen Patch zur Reproduktion); die Produktionsdatei bleibt unberührt, wie von
der Aufgabe verlangt. **Dieses Papier ist ausdrücklich papier-first**, nicht „Konzept + Bau in
einem Schritt" wie einige der anderen K-Runden: Climbing-Kontakt hat am 24.09. bereits ein Veto
von Chris selbst überstanden (s. Abschnitt 1), und dieses Papier schlägt vor, dieses Veto
umzudrehen — das braucht sein ausdrückliches Ja, bevor irgendein PR entsteht.

---

## 0. Ergebnis vorab

1. **Was heute schon da ist, ist kein Kontakt, sondern ein Drucksignal.** `druckQuelle:"duell"`
   (Climbing-Gegencheck 24.09., Abschnitt 3.1) senkt die Balance des Hinterherkletternden
   kontinuierlich, wenn sein Duellpartner vorn liegt — das ist die **mechanische** Antwort auf
   „vorbeiziehen", aber es gibt keine Hand, keinen Zug, kein Wehren. Chris' Wunsch nach einer
   **Handlung** („herunterziehen", „sich wehren") ist damit nicht erfüllt, nur seine Wirkung
   abstrahiert.
2. **Der Gegencheck vom 24.09. hat einen Stör-/Kontaktgriff (G-1) ausdrücklich abgelehnt** —
   nicht aus Spielbalance-Gründen, sondern weil echtes Wettkampfklettern (IFSC §5.2 A) Eingreifen
   verbietet und weil ein gemeinsamer Griff Climbing mechanisch wieder in Richtung Takeshi's
   Castle (Kontakt-Hindernislauf) geschoben hätte — exakt das Bild, über das Chris sich vorher
   beschwert hatte. Dieses Papier schlägt vor, G-1 in einer engen, gedeckelten Form **doch**
   einzuführen, gestützt auf E4 (Masterkonzept Abschnitt 9): „Arena-Klettern statt
   Wettkampfklettern" ist eine legitime, bewusste Abweichung vom Realismus-Maßstab — aber es ist
   **Chris' Entscheidung**, sein eigenes Veto umzudrehen, nicht die dieses Papiers.
3. **Vorschlag:** zwei feste **Kreuzungsgriffe** je Routenpaar (zwischen den drei Henkel-Exen,
   nicht im Crux-Bereich), an denen der jeweils Führende seinen Duellpartner herunterziehen kann.
   Zugstärke aus `WUCHT` (Kraftzug, bereits ein Climbing-Subskill), Widerstand aus `GLEICHGEWICHT`
   (Kopf) und der aktuellen Balance des Betroffenen — beides bereits matrixlizenzierte Kanäle,
   keine neuen Attribute. Der Betroffene hat immer eine Antwort: **Wehren**, ein eigener Wurf
   gegen dieselben zwei Attribute, der bei Erfolg den Balanceverlust auf einen kleinen Rest
   drückt. Beide Seiten zahlen Zeit. Kein Zug wird vernichtet — es gibt keinen Kanal, über den
   dieser Kontakt einen Sturz, einen Rang oder eine Höhe direkt verändert; er wirkt ausschließlich
   über `u.balance`, denselben Kanal, über den `druckQuelle:"duell"` bereits wirkt.
4. **Gemessen, zwei unabhängige Saatströme, kaderfest (Kader-Familie, 24 Rennen je Paarung):**
   rho je Spiel 0,833 / 0,816 (Basislinie ohne Kontakt: 0,837 / 0,814–0,839, s. Abschnitt 5) —
   **beide über 0,80, kein Rückgang außerhalb des Kaderrauschens.** Pp-Abweichung 12,0 / 9,5
   (Zielwert ≤ 25, Budget-Methode) — **weit im Budget**, weil die Formel ausschließlich
   Climbing-eigene Subskill-Werte (`WUCHT`, `GLEICHGEWICHT`) verwendet, die die Matrix bereits
   trägt. Häufigkeit (300 Rennen, finale Eichung) 3,83 Ereignisse je Rennen, 93 % der Rennen mit
   mindestens einem — **innerhalb des Zielkorridors 2–4**. Spiegeltest: 53 % der Ziehenden auf der
   Heimseite, 47 % wehren erfolgreich — **nahe 50:50**, keine strukturelle Seitenverzerrung.
5. **Die Abbruchregel greift nicht:** rho bleibt in beiden Strömen klar über 0,80. Trotzdem bleibt
   dies ein Konzept, kein Bauauftrag — s. Abschnitt 8 für die offenen Fragen an Chris, zuerst
   E4 selbst.

---

## 1. Ausgangslage: ein Veto, das umgedreht werden soll

**Der Wunsch (Task #109, Punkt 8, 13.10.):** „Spieler-Interaktion beim Klettern (herunterziehen,
aneinander vorbeiziehen, Wehren)... die Möglichkeit haben aneinander vorbei zu ziehen aber sich
evtl wehren können/müssen." Drei Handlungen: **Ziehen** (Angriff), **Vorbeiziehen** (die neutrale
Überholung, die heute schon über Duelldruck erzählt wird) und **Wehren** (die Antwort).

**Der Gegencheck vom 24.09.** (`climbing-opus-gegencheck-24-09.md`, Frage 1, Abschnitt 3.1) hat
genau das geprüft und abgelehnt:

> „G-1 kommt nicht als ‚gemessener Schalter' in den Motor, sondern gar nicht […] Im echten
> Klettern gibt es keinen Kontakt […] Genau das ist Chris' Beschwerde. ‚Das ist ja n Hindernislauf'
> heißt: Climbing sieht aus wie eine Bahn mit Hindernissen. […] G-1 würde Climbing mechanisch
> wieder an Takeshi annähern."

Begründet war das Veto mit drei Dingen: IFSC verbietet Eingreifen real (§5.2 A), ein gemeinsamer
Griff widerspricht dem Routenaufbau (§8.1 D), und — am schwersten — es wäre das zweite Mal, dass
derselbe Fehler passiert, den Chris selbst schon einmal gerügt hat (Climbing = Hindernislauf statt
echtes Klettern). Stattdessen hat der Gegencheck den **Duelldruck** (G-2) als Erzählung für
„vorbeiziehen" vorgeschlagen und produktiv gesetzt — das ist der Stand von heute.

**Was sich seitdem geändert hat, ist nicht die Faktenlage, sondern der Auftrag.** Die Breite-Runde
vom 13.10. (Task #109) und das Masterkonzept (E4, Abschnitt 9) benennen das Problem beim Namen: „Chris
weiß, dass er damit sein eigenes Veto vom 24.09. umdreht und dass IFSC Kontakt verbietet — er will
es trotzdem (Arena-Klettern statt Wettkampfklettern)?" Diese Frage ist **noch nicht
beantwortet** — E4 steht im Masterkonzept als Empfehlung, nicht als Chris-Zitat. Dieses Papier
behandelt E4 deshalb als Arbeitshypothese, die mit einer konkreten, gemessenen Formel geprüft wird
— nicht als bereits erteilte Freigabe. **Jede Umsetzung braucht sein ausdrückliches Ja**, bevor
der erste Produktions-PR entsteht, weil er dasselbe Veto zum zweiten Mal in die andere Richtung
träfe.

**Was das Veto nicht betrifft:** Die beiden harten Projektregeln aus dem Gegencheck gelten
unverändert fort und sind in diesem Papier kein Verhandlungsgegenstand:

- **„Kein Zug wird durch fremde Hand vernichtet"** (CLAUDE.md, Takeshis `tackleNerven` hat das
  gemessen 0,937 → 0,902 Saison-rho gekostet).
- **Kontaktstärke aus den schweren Matrixattributen der Disziplin**, nicht aus einem generischen
  Kraftwert (Q7 Kontaktregel, Abschnitt 3.7 des Masterkonzepts).

---

## 2. Die Regel, unter der das überhaupt denkbar ist (Q7)

Q7 — Die Kontaktregel (Masterkonzept Abschnitt 3.7) ist der gemeinsame Nenner für Climbing,
Battlefield, Breaking und I-Spy und gibt vier Leitplanken vor, an denen sich dieses Papier misst:

1. **Kontakt kostet, er nimmt nicht.** Zeit, Balance, Position — nie Höhe, Treffer, Punkte, die
   schon stehen.
2. **Kontaktstärke aus den schweren Matrixattributen der Disziplin.**
3. **Der Angegriffene hat immer eine eigene Antwort** aus seinen eigenen Attributen — der
   Nebenweg im Sinne von „mehrere Wege zum Erfolg".
4. **Immer als gemessener Schalter**, mit Spiegeltest.

E4 übersetzt das für Climbing konkret: „Herunterziehen" als **Abrutschen mit Höchstmarke** — wer
gezogen wird, verliert sichtbar Boden, aber `u.hoch` (die gewertete Höchstmarke, IFSC §9.1) fällt
nie. Das Bild ist „runtergezogen", die Wertung ist „kein Zug vernichtet". Das ist exakt die
Garantie, die A-2 (Abrutschen, Gegencheck 3.3) für den **eigenen** Sturz schon gibt — dieses Papier
übersetzt sie jetzt auf **fremden** Einfluss.

---

## 3. Geometrie: zwei Kreuzungsgriffe je Routenpaar

Heute klettern zwölf Teilnehmer auf zwölf **getrennten, gespiegelten** Routen nebeneinander
(`bodenWand()`, `druckQuelle:"duell"`-Paarbildung `Math.floor(bahnZ/2)`) — Heim-Slot *i* gegen
Gast-Slot *i*, wie beim Rock-Master-Lead-Duell. Es gibt **keine** gemeinsamen Griffe; das war die
richtige Entscheidung des Gegenchecks und bleibt es (IFSC §8.1 D, „Griffe außerhalb der eigenen
Route" beenden den Versuch).

**Vorschlag für K3:** keine neuen, gemeinsamen Griffe, sondern **zwei der zehn bestehenden
`hindernisse`-Positionen je Route werden zu Kreuzungspunkten erklärt** — Index 4 und 7
(Positionen 0,44 und 0,71). Das sind bewusst **keine** der drei Henkel-/Exe-Positionen (Index
2/5/8 = 0,26/0,53/0,80, `WAND_EXE_INDIZES`/`zonen`) und **nicht** die Crux im oberen Wanddrittel
(die laut Gegencheck 3.8 in allen drei Layouts auf den nicht-Henkel-Slots der oberen Hälfte liegt).
Ein Kontaktversuch an einer Rastexe wäre unplausibel (dort hält man sich fest, nicht am Nebenmann)
und ein Kontaktversuch im Crux-Bereich würde sich mit der ohnehin schwersten Passage stapeln, was
die Pp-Abweichung unnötig treibt.

- **Zwei je Routenpaar, nicht mehr.** Chris' eigener Maßstab ist „sichtbar, aber selten" — zwei
  Gelegenheiten je Duell, von denen nur ein Teil tatsächlich feuert (s. Abschnitt 6), liefert das.
- **Einer im unteren, einer im oberen Wanddrittel** — ein Kontaktmoment früh (noch frisch, aber
  schon ein Vorsprung möglich) und einer spät (Pump wirkt bereits, die Balance ist angegriffener).
- **Dieselben zwei Indizes in allen drei Routen-Layouts** (Überhang/Platte/Dach), weil nur die
  Henkel-Slots layoutfest sind — Index 4 und 7 sind in allen drei Kursen Nicht-Henkel-Slots, bleibt
  also layoutunabhängig nutzbar, ohne die Kreuzungsgeometrie an die Layout-Kalibrierung zu
  koppeln.
- **Kein neuer Asset, keine neue Grafik-Schicht nötig:** Ein Kontaktversuch ist ein Ereignis am
  bestehenden Griff, nicht ein neues Wand-Element. Die Umsetzung bräuchte höchstens eine kurze
  visuelle Geste (ein Schweber „zieht X herunter" wie an anderen Stellen der Bahn), keine neue
  Zeichenroutine.

---

## 4. Formel: Herunterziehen

**Auslöser.** An einem Kreuzungsgriff (Übergang `vor<cp && u.pos>=cp`, einmal je Griff und Duell,
analog zu den bestehenden Zwischenzeiten-Checks) wird geprüft, ob die beiden Duellpartner nah
beieinander sind (`|pos_A − pos_B| ≤ zugSchwelle`). **Nur wer an diesem Griff vorn liegt, kann
ziehen** — er verteidigt seinen Vorsprung gegen den aufholenden Partner. Das ist die wörtliche
Übersetzung von „aneinander vorbeiziehen": der Vordere spürt den Nebenmann aufholen und reagiert.

**Zugstärke des Ziehenden** — ausschließlich aus `WUCHT` (Climbing-Subskill „Kraftzug",
Rezept `power:42, determination:28, health:30` — dieselben Attribute, mit denen auch der
Zangen-Griff und der Kraftzug-Nebenweg am eigenen Griff bezahlt werden, kein neuer Kanal):

```
zugStärke = WUCHT_ziehender / 100
```

**Widerstand des Gezogenen** — aus `GLEICHGEWICHT` (Climbing-Subskill „Kopf",
`determination:40, will:30, awareness:30`, derselbe achte Subskill, der auch den Duelldruck
dämpft) und der **aktuellen** Balance (wer schon wackelt, ist leichter zu ziehen — dieselbe Logik
wie beim bestehenden `balanceAbzugGrad`):

```
widerstand = 0,6 × (GLEICHGEWICHT_gezogener / 100) + 0,4 × balance_gezogener
```

**Balanceverlust, wenn das Wehren fehlschlägt** (s. Abschnitt 5), gedeckelt:

```
verlust = min(zugDeckel, zugBasis × max(0, zugStärke − widerstand))
zugBasis = 0,30   zugDeckel = 0,15
```

Der Deckel (0,15) liegt bewusst über den Selbstkosten der bestehenden Nebenwege am eigenen Griff
(Kraftzug 0,10 / Umsetzen 0,05) — ein erfolgreicher Zug durch einen Gegner soll spürbarer sein als
eine eigene kleine Unsicherheit, aber unter dem, was mehrere Sekunden Duelldruck am Stück kosten
(`druckMax 0,6 × druckGrad 0,02/s`). Der Verlust schreibt **ausschließlich** `u.balance` des
Gezogenen, denselben Kanal, über den auch Duelldruck und die Steigung schon wirken. Niedrige
Balance erhöht über das längst bestehende `balanceAbzugGrad` die Fehlgriffchance am **nächsten
eigenen** Griff — der eigentliche Sturz fällt also weiterhin aus dem **eigenen** Wurf des
Gezogenen, nie aus dem des Ziehenden. Das ist exakt die Garantie „kein Zug wird durch fremde Hand
vernichtet".

---

## 5. Formel: Wehren (der Nebenweg)

Q7 verlangt, dass der Angegriffene **immer** eine eigene Antwort aus eigenen Attributen hat. Der
Gezogene wirft **vor** der Zug-Auflösung gegen eine Erfolgschance aus denselben zwei Attributen,
diesmal aus seiner eigenen Sicht:

```
wehrChance = clamp(0,5 + (WUCHT_gezogener − WUCHT_ziehender)/200
                       + (GLEICHGEWICHT_gezogener − 50)/300, 0.05, 0.85)
gewehrt = rr() < wehrChance
```

**Bei Erfolg:** Der Balanceverlust wird auf einen kleinen Rest gedrückt
(`zugDeckelGewehrt = 0,03` statt bis zu 0,15) — das Wehren kostet trotzdem etwas Haltung (man
bremst sich ab), aber der Großteil des Angriffs läuft leer.

**Bei Fehlschlag:** Der volle, gedeckelte Verlust aus Abschnitt 4 greift.

Das macht Wehren zum **Nebenweg im Sinne der Mehrwege-Leitlinie** (Masterkonzept Abschnitt 5.3,
Chris 21.09.): ein Kletterer mit schwacher Griffkraft, aber starkem Kopf (hohes `GLEICHGEWICHT`,
niedriges `WUCHT`) hat trotzdem eine valide Verteidigung — er hält nicht mit den Armen, sondern
behält die Nerven. Das passt zur bestehenden Rollenaufteilung der acht Climbing-Subskills, in der
`GLEICHGEWICHT` schon als „der Kopf unter Druck" eingeführt ist (Gegencheck 2.4/3.3, gestützt durch
Pijpers/Oudejans/Bakker 2005).

---

## 6. Zeitkosten beider Seiten

Ein Zugversuch ist eine Handlung, keine Nebenwirkung — beide Seiten zahlen etwas, unabhängig vom
Ausgang, über denselben `u.huerde`-Zeitmechanismus, den jedes andere Hindernis an der Wand schon
benutzt:

| Wer | Zeitkosten | Wann |
|---|---:|---|
| Ziehender | 0,5 s (`zugZeitAngriff`) | **immer**, sobald er den Zug versucht |
| Gezogener, Wehren erfolgreich | 0,25 s (`zugZeitWehr`) | zusätzlich zum kleinen Balancerest |
| Gezogener, Wehren fehlgeschlagen | keine direkte Zeit | der Balanceverlust wirkt indirekt über eine höhere Fehlgriffchance am nächsten Griff |

Der Ziehende zahlt **immer** einen Preis fürs Greifen zum Nebenmann statt zum eigenen nächsten
Griff — ein Zug, der nie versucht würde, wenn er umsonst wäre. Der erfolgreich Wehrende zahlt eine
kleine, bewusste Zeit fürs Abfangen (er bremst aktiv ab), der erfolgreich Gezogene zahlt stattdessen
in der Währung, die Climbing für Unsicherheit ohnehin vorsieht: Balance, die sich erst am nächsten
Griff auszahlt oder kostet.

---

## 7. Messung (Prototyp, disposable Kopie — s. Anhang A für den Patch)

**Methode:** kaderfest, Kader-Familie aus `data/generated/kaderfamilie-live-save.json` (fünf
echte Team-Paarungen), wie es CLAUDE.md und `miss-alle-disziplinen.mjs` für jede Abnahme
verlangen. Zwei unabhängige Saatströme (1337/7919 und 424242/6089, das zweite Paar identisch zu
`scripts/miss-climbing-zweiter-saatstamm.mjs`). Pp über `scripts/messe-arena-einfluss.mjs
climbing 48`, ebenfalls zwei Saatströme (`--saat-versatz=10000000`). Häufigkeit/Spiegeltest über
eine um `gezogen`/`wehr`/`seite`-Felder erweiterte `wandProbe()`, 300 Rennen.

| Kennzahl | Strom 1 | Strom 2 | Ziel | Status |
|---|---:|---:|---|---|
| rho je Spiel (Median, kaderfest) | 0,833 | 0,816 | > 0,80 | **bestanden, beide** |
| rho je Spiel, Spannweite | 0,135 | 0,119 | — | vergleichbar zur Basislinie (0,125–0,134) |
| rho Saison (Median) | 0,881 | 0,888 | — | unauffällig |
| Pp-Abweichung | 12,0 | 9,5 | ≤ 25 | **bestanden, beide** |
| Zieh-Ereignisse je Rennen | 3,83 (gepoolt, 300 Rennen) | | 2–4 | **im Korridor** |
| Rennen mit ≥ 1 Ereignis | 93 % | | sichtbar | passt zu „sichtbar, aber selten" |
| Wehr-Erfolgsquote | 49,3 % | | — | ausgeglichen, kein Attacker-Bias |
| Anteil Ziehender von Heimseite | 53,0 % | | ≈ 50 % | **Spiegeltest bestanden** |

**Basislinie zum Vergleich** (dieselbe disposable Kopie, Kontakt-Block deaktiviert, identische
Saatströme): rho je Spiel 0,837 (Strom 1) bzw. 0,814–0,839 laut der zuletzt dokumentierten
Kalibrierrunde (`stand-aller-disziplinen.md`). Der Unterschied zwischen 0,837 und 0,833/0,816 liegt
**innerhalb der gemessenen Kaderrauschen-Spannweite** (0,12–0,13) — kein Befund, der auf einen
echten Rückgang hindeutet, eher Rauschen aus der zusätzlichen `rr()`-Ziehung je Ereignis.

Pp lag vor dieser Runde laut Kalibrierungsdokumentation bei 14,2 / 11,1 (zwei Ströme, nach dem
PR-2-Pp-Fix) — mit Kontakt gemessen 12,0 / 9,5. Das ist **kein Zufall**: Die Kontaktformel liest
ausschließlich `WUCHT` und `GLEICHGEWICHT`, zwei Kanäle, die die Matrix bereits mit 8 bzw. (über
determination/will/awareness) tragenden Gewichten versieht — ein zusätzlicher Kanal auf
bereits-matrixtreuen Attributen zieht die Pp-Zahl eher zusammen als auseinander, wie es das
Gegencheck-Muster bei `tempoVon()`s ENDTEMPO-Umschichtung schon gezeigt hat.

**Eichung der Häufigkeit.** Mit dem anfänglich versuchten `zugSchwelle = 0,05` lag die Quote bei
6,89 Ereignissen je Rennen (zu häufig — fast jedes zweite Kreuzungsgriff-Duell hätte gefeuert).
Auf `zugSchwelle = 0,02` gesenkt (die beiden Kletterer müssen innerhalb von 2 % der Wandhöhe
beieinander sein), fällt die Quote auf 3,83 — mitten im Zielkorridor. Das ist der einzige
Parameter, der in dieser Runde tatsächlich kalibriert wurde; alle anderen Zahlen
(`zugBasis`/`zugDeckel`/Zeitkosten) sind erste, plausible Startwerte, keine Feinabstimmung — eine
echte Mechanikrunde müsste sie wie jede andere Climbing-Zahl gegen die Budget-Methode
(`scripts/messe-arena-einfluss.mjs`) nachschärfen.

**Was nicht gemessen wurde, weil es diesen Rahmen sprengt:** die drei Routen-Layouts
(Überhang/Platte/Dach) einzeln, das Zusammenspiel mit `rastUnter`/Zeitlimit über viele Spieltage,
und ein echter Einzelkader-Vergleich (diese Runde ist bewusst ausschließlich kaderfest, wie
CLAUDE.md es für eine Abnahmezahl fordert).

---

## 8. Abbruchregel-Status

Die Abbruchregel aus dem Masterkonzept (5.3) lautet: **fällt rho unter 0,80, wird die Mechanik
Bild statt Regel** — ein Ticker „versucht vorbeizuziehen", der den bereits bestehenden
Duelldruck-Signal (G-2) wiederverwendet, ohne eine eigene Wertungswirkung.

**Sie greift hier nicht.** Beide gemessenen Ströme liegen klar über 0,80 (0,833/0,816), mit
Spannweiten, die der heutigen Basislinie entsprechen. Der Prototyp ist also, soweit eine
Papier-Messung das zeigen kann, **nicht** zum Scheitern verurteilt — das ändert nichts daran, dass
dies ein Konzeptpapier bleibt, keine Abnahme. Eine echte Mechanikrunde mit vollem Messplan
(drei Layouts, Einzelkader, Langzeit-Interaktion mit Rast/Zeitlimit) müsste die Zahlen trotzdem neu
ziehen, bevor irgendetwas davon produktiv geht.

---

## 9. Was noch offen ist — Fragen an Chris

1. **E4 selbst, zuerst.** Chris hat am 24.09. gegen Climbing-Kontakt entschieden, weil IFSC ihn
   verbietet und weil er Climbing nicht wieder wie einen Hindernislauf aussehen lassen wollte. Will
   er dieses Veto für eine gedeckelte, „kein Sturz, nur Balance/Zeit"-Form umdrehen — ausdrücklich
   als **Arena-Klettern, nicht Wettkampfklettern**? Ohne ein klares Ja hier ist der Rest dieses
   Papiers eine durchgerechnete Möglichkeit, kein Auftrag.
2. **Reicht die Geometrie?** Zwei Kreuzungsgriffe je Routenpaar sind ein Vorschlag, kein
   gemessenes Optimum — eine echte Mechanikrunde sollte prüfen, ob ein oder drei Griffe das Bild
   (und die Häufigkeit) besser trifft, und ob die Position (unteres/oberes Drittel) für Chris'
   Vorstellung von „aneinander vorbeiziehen" passt.
3. **Soll Herunterziehen den bestehenden Duelldruck ERSETZEN oder ERGÄNZEN?** Dieses Papier
   behandelt beide als unabhängige Kanäle (Duelldruck wirkt kontinuierlich und beidseitig,
   Herunterziehen punktuell und nur vom Führenden aus) — das ist eine Designentscheidung, die
   Chris' Bild von „wer greift wen an" direkt betrifft.
4. **Ist der Zeitpreis fürs Ziehen hoch genug, um Spam zu verhindern?** 0,5 s ist ein erster Wert;
   mit der Häufigkeit von 3,83 je Rennen scheint das zu reichen, aber eine Mechanikrunde mit allen
   drei Layouts könnte etwas anderes zeigen.
5. **Visuelle Umsetzung:** reicht ein Schweber/Ticker-Satz („X zieht Y am Kreuzungsgriff
   herunter") analog zu bestehenden Ereignismeldungen, oder will Chris eine eigene kurze
   Animation (die Hand greift zum Nebenmann)? Letzteres wäre ein zusätzlicher Arbeitsschritt, der
   in diesem Papier nicht beziffert ist.

---

## Anhang A — der gemessene Prototyp-Patch (NICHT in der Produktionsdatei)

Drei additive Blöcke an einer **disposable Kopie** von `public/mockups/battle-mode.engine.js`
(kopiert komplett mit `battle-mode.html`/`.css`/`.rezepte.js`, damit Playwright sie lädt). Jeder
Block ist hinter climbing-eigenen Feldern gegated (`BA().kreuzungsPos`), jede andere Bahn-Disziplin
bleibt unberührt — dasselbe Muster, das `druckQuelle`/`balanceSteigungGrad` bereits für den
bestehenden Duelldruck-Block benutzen.

**1. Neue Felder in `BAHN_ART.climbing`, direkt nach der `druckQuelle`-Zeile:**

```js
druckQuelle:"duell", druckSchwelle:0.10, druckMax:0.6, druckGrad:0.02,
kreuzungsPos:[0.44,0.71], zugSchwelle:0.02, zugBasis:0.30, zugDeckel:0.15,
zugDeckelGewehrt:0.03, zugZeitAngriff:0.5, zugZeitWehr:0.25,
```

**2. Neuer Block in `stepSpurt()`, zwischen dem Duelldruck-Block und der HUERDEN-Schleife**
(`vor`/`dt`/`u` sind an dieser Stelle bereits in Scope, derselbe Übergangs-Check wie bei den
Zwischenzeiten):

```js
if(BA().kreuzungsPos){
  u.zugAusgeloest=u.zugAusgeloest||{};
  BA().kreuzungsPos.forEach((cp,ki)=>{
    if(u.zugAusgeloest[ki]||!(vor<cp&&u.pos>=cp))return;
    u.zugAusgeloest[ki]=true;
    const partner=LAEUFER.find(o=>o!==u&&o.seite!==u.seite&&o.fertig==null
      &&Math.floor(o.bahnZ/2)===Math.floor(u.bahnZ/2));
    if(!partner)return;
    const abstand=Math.abs(u.pos-partner.pos);
    if(abstand>(BA().zugSchwelle??0.05))return;
    if(u.pos<=partner.pos)return;   // nur wer vorn liegt, verteidigt den Vorsprung
    const ziehender=u, gezogener=partner;
    ziehender.huerde=Math.max(ziehender.huerde||0, BA().zugZeitAngriff??0.5);
    const zugStaerke=(ziehender.WUCHT||0)/100;
    const widerstandBasis=0.6*((gezogener.GLEICHGEWICHT||0)/100)+0.4*(gezogener.balance??1);
    const wehrChance=Math.max(0.05,Math.min(0.85,
      0.5+((gezogener.WUCHT||0)-(ziehender.WUCHT||0))/200
        +((gezogener.GLEICHGEWICHT||0)-50)/300));
    const gewehrt=rr()<wehrChance;
    if(gewehrt){
      gezogener.huerde=Math.max(gezogener.huerde||0, BA().zugZeitWehr??0.25);
      gezogener.balance=Math.max(0,(gezogener.balance??1)-(BA().zugDeckelGewehrt??0.03));
      gezogener.wehrCount=(gezogener.wehrCount||0)+1;
      feedRoutine(gezogener.seite,gezogener.n+" wehrt sich gegen "+ziehender.n+" am Kreuzungsgriff.");
    } else {
      const verlust=Math.min(BA().zugDeckel??0.15,
        (BA().zugBasis??0.30)*Math.max(0,zugStaerke-widerstandBasis));
      gezogener.balance=Math.max(0,(gezogener.balance??1)-verlust);
      gezogener.gezogenCount=(gezogener.gezogenCount||0)+1;
      feedEreignis(ziehender.seite,ziehender.n+" zieht "+gezogener.n+" am Kreuzungsgriff herunter.");
    }
  });
}
```

**3. Diagnosefelder in `wandProbe()`** (reine Mess-Erweiterung, kein Einfluss auf Simulation):
in der `laeufer`-Zuordnung `gezogen:u.gezogenCount||0, wehr:u.wehrCount||0, seite:u.seite,
bahnZ:u.bahnZ` ergänzen, und im Rückgabeobjekt `gezogenJeKopf`/`wehrJeKopf`/`ereignisseJeRennen`/
`rennenMitEreignisAnteil`/`wehrErfolgsquote`/`ziehenderHeimAnteil` nach demselben Muster wie
`abgerutschtJeKopf` ergänzen (Division durch Kopfzahl bzw. Rennenzahl, Mirror-Anteil über
`z.seite`).

**Reproduktion:** `scripts/miss-climbing-kontakt-prototyp-rho.mjs` (in diesem PR enthalten) misst
rho gegen eine beliebige, mit obigem Patch versehene Kopie:

```sh
cp -r public/mockups /pfad/zur/kopie
# <obige drei Bloecke in /pfad/zur/kopie/battle-mode.engine.js einfuegen>
node scripts/miss-climbing-kontakt-prototyp-rho.mjs 24 1337 7919 /pfad/zur/kopie/battle-mode.html
node scripts/miss-climbing-kontakt-prototyp-rho.mjs 24 424242 6089 /pfad/zur/kopie/battle-mode.html
node scripts/messe-arena-einfluss.mjs climbing 48 /pfad/zur/kopie/battle-mode.html
node scripts/messe-arena-einfluss.mjs climbing 48 /pfad/zur/kopie/battle-mode.html --saat-versatz=10000000
```

---

## Quellen

- `docs/design/fable-konzept-chris-feedback-13-10.md` Abschnitt 1 (Punkt 8, Task #109), Abschnitt
  3.7 (Q7 Kontaktregel), Abschnitt 5.3 (K3), Abschnitt 9 (E4).
- `docs/design/chris-feedback-breite-runde-13-10.md` Punkt 8 (Chris-Zitat).
- `docs/design/climbing-opus-gegencheck-24-09.md` Abschnitt 3.1 (G-1-Ablehnung), 3.3 (A-2/
  Höchstmarke), 2.4/3.3 (GLEICHGEWICHT), Abschnitt 6 (Chris' Veto-Passage).
- `docs/design/stand-aller-disziplinen.md` (Climbing-Basislinie, Kalibrierungshistorie).
- `lib/player-generator/official-discipline-weights.ts`, `public/mockups/battle-mode.engine.js`
  (`BAHN_ART.climbing`, `stepSpurt()`, `wandProbe()`) — nur gelesen, nicht verändert.
- CLAUDE.md (rho/Pp-Abnahmeregeln, Eignungsmatrix-Sperre, Spiegeltest-Pflicht).

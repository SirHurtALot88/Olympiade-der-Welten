# Football: Kickoff-Return, QB-Slot, Kicker/Punter-Slot — Opus/Fable-Konsultation (14.10.)

**Konzeptpapier, kein Code, keine Freigabe.** Antwort auf Frage 4 aus
`docs/design/football-kickoff-regeln-konzept-14-10.md` Abschnitt 7 ("frag Fable"), zusammen mit
Chris' vier übrigen Antworten vom 14.10. auf dieselbe Fragenliste. Alle Zeilenangaben gelten für
`public/mockups/battle-mode.engine.js` und `lib/lineups/matchday-slot-roles.ts` auf
`origin/main` `8ec25064` (14.10., letzter Commit vor dieser Runde) — gegen `5da90654`, den Stand
des K5-Papiers, geprüft: der Diff zwischen beiden Commits liegt an `battle-mode.engine.js` bei
572 Einfügungen/150 Löschungen, aber ausschließlich außerhalb der hier zitierten Football-
Abschnitte (Showcase/Eiskunstlauf-Reihenfolge, Zeile ~17189) — jede hier zitierte Zeilennummer ist
gegen `8ec25064` erneut nachgesehen, nicht nur aus dem K5-Papier übernommen. **Nichts an
`battle-mode.engine.js` wurde für dieses Papier geändert.**

---

## 0. Chris' fünf Antworten, worum es hier geht

Aus `football-kickoff-regeln-konzept-14-10.md` Abschnitt 7, der Reihe nach:

1. **Kickoff-Return:** „ja" — gebaut werden soll eine echte Rückgabemechanik.
2. **Kicker/Punter-Slot:** „kanst auch einen slot machen der dazu passt" — ein eigener
   Kaderslot mit passendem Stat-Profil statt Punter/Kicker weiter ad hoc aus den sechs
   Feldspielern zu ziehen.
3. **NFL vs. vereinfacht:** „nfl" — bestätigt, reale Komplexität bleibt (eigene Punt-
   Entscheidung, Field Goal ab ~38 Yards), kein Arena-Football-„jeder 4. automatisch"-Modell.
4. **Reicht der Klasse-A-Teil als risikoarmer erster Schritt, bevor Kickoff-Return überhaupt
   gebaut wird?** „frag Fable" — **das ist die Frage dieses Papiers.**
5. **Formationszuweisung an die gewürfelte Rolle koppeln:** „ja soll nen QB slot geben der auch
   von der stat verteilung passen soll genauso wie die blocker oder runner und kp was es noch so
   gibt" — Chris will mehr als die rein visuelle Koppelung, die das K5-Papier als Alternative
   skizziert hatte (Abschnitt 6, Klasse A: „der gewürfelte Passer bewegt sich kurz zur
   QB-Position"). Er will einen echten **QB-Kaderslot** mit eigenem, stat-gewichtetem Profil,
   parallel zu „Blocker oder Runner" — und ist sich selbst nicht sicher, was es sonst noch an
   Rollen gibt. Abschnitt 1 beantwortet das mit Zeilenbelegen.

---

## 1. Footballs tatsächliche Rollen-/Slot-Struktur heute — präzise, mit Zeilenbelegen

**Kurzfassung vorab: es gibt heute GENAU EINE Rollen-/Slot-Struktur für Football, und sie ist
NICHT das, wonach „Blocker oder Runner" klingt.** Chris hat vermutlich — sein eigenes „kp was es
noch so gibt" bestätigt das — zwei unterschiedliche Systeme im Projekt im Kopf vermischt, von
denen eines für Football gar nicht existiert.

### 1.1 Was es gibt: sechs generische „Slot-Rollen" fürs Lineup-Bildschirm-Textsystem

`lib/lineups/matchday-slot-roles.ts:241-253` listet Footballs sechs Einträge im
`DISCIPLINE_ROLE_THEMES`-Katalog:

```
football: [
  roleTheme("linepower",    "Line Power",     …, ["power","health"], …),
  roleTheme("routeburst",   "Route Burst",     …, ["speed","dexterity"], …),
  roleTheme("fieldread",    "Field Read",      …, ["awareness","determination"], …),
  roleTheme("ballhawk",     "Ball Hawk",       …, ["torment","awareness"], …),
  roleTheme("redzone",      "Red Zone",        …, ["power","torment"], …),
  roleTheme("lockerleader", "Locker Leader",   …, ["health","stamina"], …),  // Ausgleichsslot
]
```

Das ist dasselbe generische Sechs-Rollen-Schema, das **jede** Feldspieldisziplin bekommt (TDM,
Basketball, Hockey, Climbing, Fechten — Zeilen 97-277 derselben Datei): sechs Themen, deren
`focus`-Attribute Textzeilen für den Lineup-Bildschirm liefern und einen kleinen, numerischen
„Rollen-Bonus" auf die **projizierte Spielstandsvorschau** legen. Das ist die Funktion
`calculateMatchdayProjectedPreview` (Zeile 920-1003) → `resolveWeightedAttributeScore` auf
`baseWeightProfile` gegen `slotWeightProfile` (Zeile 733-738, `SLOT_PROFILE_MODIFIER_SCALE=2.2`,
Zeile 69) — eine Zahl, die der Manager auf dem Aufstellungsbildschirm sieht, **bevor** das Spiel
läuft.

**Entscheidender Befund: dieses System berührt den echten Spielmotor (`battle-mode.engine.js`)
überhaupt nicht.** Es gibt keinen Import, keinen Aufruf, keine gemeinsame Datenstruktur zwischen
`matchday-slot-roles.ts` und der Live-Simulation. Die sechs Namen „Line Power", „Route Burst" usw.
sind **reine Text-/Vorschau-Flavour** — sie beeinflussen, was der Manager vor dem Spieltag liest
und welche Zahl als „projizierter Score" erscheint, aber **nicht**, wer im simulierten Spiel wirft,
läuft oder blockt. Das ist wichtig, weil Chris' Formulierung „ein Slot, der auch von der
Stat-Verteilung passen soll … genauso wie die Blocker oder Runner" nahelegt, er erwarte, dass ein
Slot hier etwas im echten Spiel verändert — das tut er heute für keine Disziplin, Football
eingeschlossen.

**„Blocker" und „Runner" existieren unter diesen Namen nirgends in diesem System**, auch nicht bei
einer anderen Disziplin. Was existiert, ist der Kommentar bei Hockeys Torwart-Eintrag (Zeile
170-182): der Torwart ist die EINZIGE Rolle im ganzen Katalog, die eine Sonderbehandlung bekommt
(`buildGoaltenderDelta`, Zeile 475-520, `buildSlotWeightProfilesWithGoaltender`, Zeile 527-564) —
weil der Torwart im Live-Motor eine echte, mechanisch eigene Figur ist (s. 1.3). Football hat
dieses Muster nicht, weil Football im Live-Motor keine feste Positions-Identität kennt (s. 1.2).

### 1.2 Was es im Live-Motor gibt: sechs Feldplätze nach Team-Reihenfolge, keine benannten Rollen

`starteSnap()` (`battle-mode.engine.js:10707-10742`) weist die sechs Formationsplätze
(`SLOTS_FOOTBALL_OFF`, Zeile 9960-9965, zwei Formationen „eng"/„weit" zu je sechs
`{tiefe,breite}`-Koordinaten) strikt nach Array-Index zu:

```js
FSTEAM[fb.side].forEach((u,i)=>{
  const s=offTab[i%offTab.length];
  plaetze[u.id]=fkClamp(losX-zumFeld*s.tiefe,H/2+s.breite);
});
```

Slot 0 steht an der tiefsten Koordinate (der QB-/Center-Platz), Slots 2/3 außen (Receiver-artig),
Slot 5 nah an der Line. Das sind geometrische Plätze mit visueller Bedeutung — **keine Attribute
hängen an einem Slot-Index**. Wer an Platz 0 steht, ist schlicht `FSTEAM[fb.side][0]` — der erste
Spieler in der Team-Aufstellungsreihenfolge, unabhängig davon, ob er je einen Ball berührt.

Mechanisch entscheidet stattdessen **jeder einzelne Zug neu** eine gewichtete Verlosung:
`resolvePass()` (Zeile 10218-10244) zieht den Passer über
`fkLos(off,"PASSGENAUIGKEIT")` (Zeile 10219, `FK_LOS_KAPPA=3.4`, Zeile 10127), den Receiver über
`fkLos(restOff,"TEAMGEIST")` (Zeile 10226), den Pass-Rusher über `fkLos(def,"ABWEHR_PASS")`
(Zeile 10220). `resolveLauf()` (nicht zitiert im K5-Papier, analoger Aufbau) zieht den Läufer
vermutlich über `LAUFKRAFT`. Jede dieser Verlosungen läuft über `gewichtetesLosNach()` (Zeile
11253) — ein Spieler mit hohem Stat wird bevorzugt gezogen, aber **jeder** Spieler im Feld hat
eine von null verschiedene Chance.

**Das ist kein Unfall, sondern eine bereits gemessene, bewusste Entscheidung — und der Grund,
warum Chris' Q5-Wunsch technisch heikel ist.** Der Kommentar direkt vor `waehlePlayCall`
(Zeile 10068-10079) hält einen früheren Versuch fest:

> „Erstversuch war ein EINMAL je Spiel gezogener Depth Chart (fester QB/RB/PassRusher/
> RunStopper, wie ein echtes Football-Team ihn haette) — gemessen SCHLECHTER (rho 0,167/0,280
> gegen 0,277/0,413 mit dynamischer Wahl) […] auf sechs Spieler bleiben so real nur zwei bis drei
> je Seite je ueberhaupt eine Ballberuehrung, der Rest steht bei EXAKT Null."

Ein **fest** zugewiesener QB-Slot (eine Identität, die über das ganze Spiel feststeht) ist exakt
dieser bereits durchgefallene „Depth Chart"-Ansatz. Chris' Q5-Wunsch muss deshalb so übersetzt
werden, dass er diesen bekannten Fehler nicht wiederholt — s. Abschnitt 3.2 für den konkreten
Vorschlag (Gewichtsverstärkung statt Identitätsfestlegung).

### 1.3 Der einzige echte Gegenbeispiel-Fall: Hockeys Torwart — und warum er für Football nicht direkt übertragbar ist

Hockey hat tatsächlich eine Figur mit fester, spielweiter Identität und eigener Wertformel: der
Torwart. `u.torwart` ist ein echtes Flag auf dem Spielerobjekt (`battle-mode.engine.js:8657`),
`stehtImTor()`/`aufDemEis()` filtern ihn aus allen Feldrollen heraus (Zeile 8296, 9021, 9068-9073),
und `torwartRoh()` (Zeile 9419, 9427) berechnet seine eigene Erfolgsquote über eine eigene
Attribut-Mischung, nicht über `fkLos` auf einen Feldspieler-Pool. Das ist ein echtes,
mechanisch wirksames Rollen-System — aber:

- **Der Torwart wird nicht gewürfelt, er wird per Konvention fest bestimmt** (Slot-Index 2 bei
  3-6 Spielern, `matchday-slot-roles.ts:172-177`, „die LETZTE Rolle … traegt das negative
  Summendelta"-Logik gilt dafür nicht, der Torwart ist eine Sonderrolle). Das funktioniert bei
  Hockey, weil ein Torwart real nie Feldspieler wird und umgekehrt — eine echte
  Eins-zu-eins-Entsprechung zur Sportart, keine „wer ist heute zufällig am besten"-Frage.
- **Football hat diese reale Entsprechung nicht in gleicher Schärfe.** Ein echtes NFL-Team hat
  zwar einen designierten Starting-QB — aber jeder Snap wird trotzdem von genau diesem einen
  Mann geworfen, nicht von einem zufällig besten verfügbaren Werfer im Kader. Genau diese reale
  Fixierung ist es, die der gescheiterte Depth-Chart-Versuch (1.2) nachgebaut und gemessen
  schlechter gefunden hat — **nicht weil Realismus falsch wäre, sondern weil sechs Feldspieler zu
  wenige sind, um eine feste Rolle zu tragen, ohne den Rest der Mannschaft auf Null zu setzen.**
  Hockey entgeht diesem Problem, weil der Torwart ohnehin aus der Feldrollen-Verlosung
  herausgenommen wird (er bekommt nie den Puck zum Weiterspielen in der Form, in der ein
  Feldspieler ihn bekommt) — es gibt dort keine zweite Mechanik, die um dieselbe Identität
  konkurriert.

**Fazit Abschnitt 1:** Football hat heute **keinen** Blocker-/Runner-Slot-Split mit eigener
Wertformel — das ist Hockeys (Torwart) bzw. ein reines Lineup-Vorschau-Textmuster (die sechs
generischen Rollen), das Chris wahrscheinlich im Kopf hatte, ohne dass es für Football etwas
Mechanisches bedeutet. „Kp was es noch so gibt" ist damit beantwortet: es gibt nichts anderes.
Ein neuer QB-/Kicker-Slot für Football wäre entweder (a) ein neues Lineup-Vorschau-Thema ohne
Wirkung auf den echten Spielausgang (billig, aber löst Chris' eigentlichen Wunsch nicht — er will
ja, dass der Slot „auch von der Stat-Verteilung passen soll", das klingt nach echter Wirkung), oder
(b) eine neue, football-eigene Motor-Mechanik nach dem Vorbild von Hockeys Torwart, aber mit der
in 1.2 belegten Einschränkung, dass eine reine Identitätsfixierung bereits gemessen schlechter
abschneidet. Abschnitt 3 löst diesen Widerspruch auf.

---

## 2. Antwort auf Frage 4: Klasse-A-Slice zuerst, oder direkt in den großen Umbau?

### 2.1 Die Ausgangslage, nüchtern

| Größe | Aktueller Stand | Quelle |
|---|---|---|
| rho/Spiel | 0,818 (bestanden, Puffer 0,018) | `stand-aller-disziplinen.md:948` |
| rho/Saison | 0,874 | dieselbe Zeile |
| Pp-Abweichung | 47,3 (24.09.-Messung) bis 71,1 (nach einem gescheiterten P1-Versuch); zuletzt 51,7/57,8 (zwei Saatströme, 02.10.) | `stand-aller-disziplinen.md:552,574-579`; `football-rezept-sondierung-awareness-ausdauer-spirit-02-10.md` |
| Pp-Ziel | ≤ 25 (CLAUDE.md) | — |
| Produktionsstatus | außerhalb `ARENA_RESOLVED_DISCIPLINE_IDS` | `lib/battle/arena-resolved-disciplines.ts:166-169` |

Football erfüllt die rho-Schranke mit knappem, aber echtem Puffer. Es verletzt die Pp-Schranke
**massiv** — fast das Doppelte bis fast das Dreifache des Zielwerts, je nach Messzeitpunkt. Sechs
der zwölf Matrixattribute (awareness, will, spirit, intelligence, charisma, stamina) tragen laut
`stand-aller-disziplinen.md:574-579` praktisch nichts mechanisch bei, gegen 3-25 Pp Matrixgewicht
je Attribut (spirit allein wiegt in der LOCKED Matrix 25 Pp — das schwerste Einzelattribut der
gesamten Football-Zeile, s. `official-discipline-weights.ts:307`, `torment: football:16`-Zeile
und die anderen Werte in derselben Tabelle: power 6, health 14, determination 8, stamina 6,
awareness 11, will 10, charisma 4, spirit 25, torment 16 — Summe 100). Zur Erinnerung: das ist die
**gesperrte Matrix**, die Football per Spiel-Eignungs-Override (`spiel-eignung-overrides.ts:100-111`,
legitim seit 05.09., Chris' eigene Entscheidung) für die SPIELORDNUNG durch power 22/health 18/
speed 14/torment 12/determination 10/awareness 8/stamina 6/dexterity 4/spirit 3/will 3 ersetzt —
die Pp-Pflichtprüfung läuft aber ausdrücklich gegen die **Matrix**, nicht gegen den Override (das
ist der ganze Sinn der Prüfung: zeigen, ob die Mechanik das bezahlt, was dem Spieler auf dem
Kaderbildschirm angesagt wird — der Override selbst wurde eingeführt, WEIL beide Ordnungen
rho 0,427 auseinanderlagen, s. `spiel-eignung-overrides.ts:14-17`; die Pp-Prüfung ist eine
zweite, unabhängige Linse auf dasselbe Grundproblem).

### 2.2 Was ein Kickoff-Return, ein QB-Slot und ein Kicker-Slot mit der Pp-Zahl machen würden

**Alle drei Vorhaben könnten die Pp-Zahl VERBESSERN, wenn sie an die richtigen, bisher toten
Attribute binden — und genauso leicht VERSCHLECHTERN, wenn sie an bereits übergewichtete
Attribute binden.** Das ist keine rhetorische Floskel, sondern an einem konkreten Präzedenzfall
bereits einmal in beide Richtungen beobachtet worden:

- **Negativ-Beleg (P1, 02.10.):** Ein Versuch, dem Spielstand-/Uhr-Bewusstsein über genau die
  toten Attribute awareness/stamina einen Kanal zu geben, drückte Pp von 47,3 auf 71,1 —
  VERSCHLECHTERT, nicht verbessert, obwohl die Absicht genau richtig war (tote Attribute einen
  Kanal geben). `football-rezept-sondierung-awareness-ausdauer-spirit-02-10.md` zeigt in
  derselben Runde auch den Gegenfall: eine vorsichtigere, bei n=48 abgesicherte Version senkte Pp
  von 57,05 auf 54,75 UND hob rho leicht (0,804→0,808) — reine Prozentverschiebung **innerhalb**
  bestehender Sub-Skills, keine neue Mechanik.
- **Was das für Kickoff-Return/QB-Slot/Kicker-Slot heißt:** keines der drei ist von sich aus
  "sicher gut" für Pp. Die Pp-Wirkung hängt vollständig davon ab, WELCHE Attribute der neue Code
  liest — ein Kickoff-Return, der (wie unten in 3.1 vorgeschlagen) LAUFTEMPO/LAUFKRAFT für den
  Returner zieht, gibt **speed** (Matrix 0 Pp bei Football!) erstmals überhaupt einen Kanal — das
  würde die SUMME der Pp-Abweichung nicht automatisch senken, weil speed ja mit Matrixgewicht 0
  dasteht: jeder mechanische Kanal für speed IST per Definition eine neue Abweichung (0 Pp
  Vorgabe, >0 % gemessen). Der Fix für sechs toten Attribute (awareness, will, spirit,
  intelligence, charisma, stamina) hilft nur, wenn die NEUEN Mechaniken ausgerechnet DIESE sechs
  lesen, nicht beliebige andere.
- **Konkret für die drei Vorhaben:** QB-Slot (3.2) und Kicker/Punter-Slot (3.3) sind gezielt so
  entworfen, dass sie **spirit, will, stamina und awareness** lesen — vier der sechs toten
  Matrixattribute, zusammen 8+10+6+25=49 Pp Matrixgewicht (mehr als die Hälfte der gesamten
  Pp-Abweichung). Das ist kein Zufall, sondern die Leitlinie dieses Papiers: **die drei neuen
  Bausteine sind so gewählt, dass sie zuerst die Pp-Lücke angreifen, nicht nur Chris' Wunschliste
  abarbeiten.** Charisma und intelligence bleiben bei 0 — kein Baustein in diesem Papier gibt
  ihnen einen Kanal, weil weder ein Kickoff-Return noch ein QB/Kicker-Slot plausibel von
  „Ausstrahlung" oder „Verstand" abhängen sollte, ohne die Eignungsmatrix selbst zu hinterfragen
  (verboten, s. CLAUDE.md).

### 2.3 Die eigentliche Antwort auf Frage 4

**Nein, der reine Klasse-A-Slice ist jetzt NICHT mehr der sinnvollste erste Schritt — aber auch
nicht, weil er überflüssig wäre, sondern weil die Reihenfolge, die ihn nötig gemacht hat, sich
durch Chris' heutige Antworten verändert hat.**

Die Logik des K5-Papiers war: Klasse A zuerst, WEIL die große Mechanik (Kickoff-Return) noch nicht
autorisiert war und ein rein visueller Fix am wenigsten riskiert, die bestehende Pp-Verletzung zu
verschlimmern (Frage 4 im K5-Papier war wörtlich genau danach gefragt). Das war am 14.10. morgens
richtig. Jetzt, mit Chris' Ja zu Kickoff-Return, QB-Slot UND Kicker-Slot, ändert sich die
Kalkulation in zwei Punkten:

1. **Der Klasse-A-Slice (Snap-Animation an den richtigen Platz, FG/Punt-Momentum, 3.-Versuch-
   Hervorhebung) bleibt unabhängig sinnvoll und bleibt Schritt 1** — er ist rho-/Pp-bit-identisch
   (reine Optik, kein neuer `rr()`-Aufruf, s. K5-Papier Abschnitt 6), kostet nichts an Risiko, und
   BEHEBT bereits den Kern von Chris' ursprünglicher Beschwerde („es geht gar nicht richtig
   voran"). Ihn auszulassen, um direkter zum großen Umbau zu kommen, spart keine Zeit — er ist
   klein — und verschenkt eine komplette, günstige Sichtbarkeits-Korrektur.
2. **Aber: der QB-Slot (Chris' Q5) und der Kicker-Slot (Chris' Q2) sind KEINE Klasse-B/C-
   Erweiterungen des Kickoff-Returns — sie sind eine EIGENE, vorgelagerte Rezeptkorrektur, die
   man sinnvollerweise VOR dem Kickoff-Return angeht, nicht danach.** Grund: beide binden an
   genau die toten Pp-Attribute (awareness, will, stamina, spirit), die die Pp-Pflichtprüfung seit
   September offen hält, UND sie ändern das Gewicht, mit dem bestehende Sub-Skills bereits
   gezogen werden (PASSGENAUIGKEIT, AUSDAUER) — exakt der Bereich, an dem die 02.10.-Rezeptrunde
   schon einmal gearbeitet hat und in dem Pp-Wirkung **gemessen**, nicht geraten werden muss. Den
   Kickoff-Return — die einzige Komponente, die wirklich neue `rr()`-Aufrufe und einen neuen
   Spielzustand braucht (s. 3.1) — danach zu bauen, heißt: die Rezeptbasis steht schon fest
   gemessen, bevor eine zusätzliche, seltene, aber neue Zufallsquelle (Kickoff-Return) oben drauf
   kommt.

**Reihenfolge-Empfehlung, mit Begründung je Schritt:**

| # | Schritt | Warum hier und nicht woanders |
|---|---|---|
| 1 | Klasse-A-Slice (Snap-Platz, FG/Punt-Momentum, 3rd-Down-Text) | risikofrei, behebt Chris' Kernbeschwerde sofort, keine Pp-/rho-Interaktion |
| 2 | Kicker/Punter-Slot (3.3) | kleinster neuer Mechanik-Baustein, bindet an bereits existierenden, aber toten Sub-Skill (AUSDAUER) — kein neuer Sub-Skill nötig, nur eine neue Leseseite |
| 3 | QB-Slot (3.2) | größerer Eingriff (ändert die Passer-Lotterie-Gewichtung selbst), aber direkt am Kern von Chris' Q5 — am besten NACH dem Kicker-Slot, weil beide dieselbe Pp-Messung teilen und die Reihenfolge erlaubt, zwei unabhängige Effekte zu trennen, statt sie in einer PR zu vermengen |
| 4 | Kickoff-Return (3.1) | die einzige echte neue Zustandsmaschine — zuletzt, weil sie strukturell am meisten Risiko trägt (neuer Spielzustand zwischen Serien) und am wenigsten von der Rezept-Fixierung der Schritte 2-3 unabhängig ist (der Returner-Pool sollte den dann schon korrigierten LAUFTEMPO/LAUFKRAFT-Kanal nutzen) |

Diese Reihenfolge weicht von der Opus-Konzeptreview-Reihenfolge vom 26.09. (Punter vor
Kicker vor Return vor Onside, zitiert in `football-kickoff-regeln-konzept-14-10.md` Abschnitt 4)
nur in einem Punkt ab: sie zieht den **Pp-Fix** (Punter/Kicker UND QB) komplett vor den
**Kickoff-Return**, statt Punter/Kicker als Unterschritte EINES Special-Teams-Blocks direkt vor
dem Return zu behandeln. Begründung: Chris hat heute drei getrennte Autorisierungen gegeben
(Q1 Return, Q2 Kicker-Slot, Q5 QB-Slot) — das erlaubt, sie als drei unabhängig messbare PRs zu
behandeln statt als einen Block, und drei unabhängige Messungen sind nach CLAUDE.md
(„jede Disziplin, jede neue Mechanik … Pflichtprüfung") ohnehin nötig.

**Eine Pp-Verbesserung ist bei Schritt 2/3 nicht garantiert, nur plausibel gemacht** (s. 2.2) —
jeder der drei Schritte braucht nach CLAUDE.md zwingend eine volle rho-/Pp-Messung (zwei
Saatströme) VOR dem nächsten Schritt, nicht nur am Ende der Reihe. Das greift exakt die Lehre aus
dem gescheiterten P1-Versuch auf (Pp 47,3→71,1 — ein kleiner, gut gemeinter Eingriff kann die Zahl
in die falsche Richtung bewegen).

---

## 3. Build-Plan: Kickoff-Return, QB-Slot, Kicker/Punter-Slot

Für alle drei gilt dieselbe Leitlinie wie für jede Rezeptänderung in diesem Projekt: **Attribute
kommen ausschließlich aus der gesperrten Matrix bzw. dem bereits autorisierten Football-Override
(`spiel-eignung-overrides.ts:100-111`)** — kein neues Attributgewicht wird erfunden, nur
bestehende Gewichte bekommen einen (ggf. neuen) mechanischen Kanal.

### 3.1 Kickoff-Return

**Zustand heute:** `beginneFootballSerie()` (`battle-mode.engine.js:10779-10786`) setzt nach jedem
Score den Ballbesitz unsichtbar auf `d.startSpot` (75, die alte 25-Yard-Touchback-Linie im
VERALTETEN Touchback-Schema — die reale NFL-Regel liegt seit der 2025-Saison bei der 35, s. K5-
Papier Abschnitt 2.1). Kein Kick-Flug, kein Returner, keine Deckung.

**Rezept-Vorschlag (Primärweg/Nebenweg-Muster, CLAUDE.md „mehrere Wege zum Erfolg"):**

- **Returner-Auswahl:** `fkLos(recv,"LAUFKRAFT")` — derselbe Sub-Skill, den `resolveLauf`
  vermutlich schon für Laufspielzüge zieht (LAUFKRAFT-Rezept: `power:41,health:33,speed:26`,
  Zeile 7364 — bereits rho 0,909 zur Eignung, UNVERÄNDERT seit der Rezept-Feinkalibrierung). Das
  ist der von der K5-Opus-Konzeptreview vorgeschlagene Kanal (Abschnitt 4 dort: „Returner über
  LAUFTEMPO/LAUFKRAFT gezogen") — hier bewusst NUR LAUFKRAFT (die fachliche Spielstärke), nicht
  LAUFTEMPO (das ist die rein physische Bewegungsgeschwindigkeits-Formel, speed:52/stamina:32/
  dexterity:16, Zeile 7371 — disziplinübergreifend für die Animation, kein fachlicher Kanal, s.
  Kommentar dort „Lauftempo ist eine physische, keine football-spezifische Eigenschaft").
- **Rückgabe-Yards:** eine Gauß-Verteilung um einen Mittelwert, der von LAUFKRAFT UND der
  gegnerischen Coverage abhängt (`fkLos(cov,"ABWEHR_LAUF")` auf der kickenden Seite) — Primärweg
  für den Returner ist LAUFKRAFT, der Nebenweg für die kickende Mannschaft ist eine Verlustchance
  über ABWEHR_LAUF (bereits existierender Sub-Skill, `torment:55,power:30,health:15`,
  Zeile 7367). Kein neuer Sub-Skill nötig — beide Seiten des neuen Spielzugs lesen ausschließlich
  bereits existierende, bereits rho-geprüfte Kanäle.
- **Touchback-Anteil:** real ~67 % (Rückgabequote 32,8 % laut K5-Papier Abschnitt 2.1) — als feste
  Quote, keine Attributabhängigkeit (ein Touchback ist eine taktische Entscheidung des Kickers,
  nicht des Returners; ein Kicker-Attributkanal dafür würde in den Kicker-Slot gehören, s. 3.3,
  nicht in den Return selbst).
- **Onside Kick:** aus Risikogründen explizit NICHT Teil dieser Runde — die K5-Opus-
  Konzeptreview reiht ihn selbst zuletzt ein (Abschnitt 4, Punkt 5), als seltenstes aller
  Ereignisse mit dem höchsten Rauschrisiko pro Ereignis.

**Pp-Wirkung, ehrlich eingeschätzt:** LAUFKRAFT und ABWEHR_LAUF sind BEREITS existierende,
BEREITS gemessene Kanäle — ihr Matrixgewicht (power/health/speed für LAUFKRAFT, torment/power/
health für ABWEHR_LAUF) ändert sich durch den Kickoff-Return nicht grundlegend, nur die
HÄUFIGKEIT, mit der sie gezogen werden, steigt leicht (1-3 zusätzliche Ziehungen je Spiel: ein
Return je Score plus zwei Halbzeit-Kickoffs). Das ist eher ein rho-Risiko (zusätzliches Rauschen
auf wenige, seltene Ereignisse, exakt die CLAUDE.md-Warnung „mehr Ereignisse helfen fast nie") als
ein Pp-Risiko — und genau deshalb zuletzt in der Reihenfolge (Abschnitt 2.3).

**Risiko/Chassis:** Kickoff ist bei Football der einzige Moment ohne laufenden Down/Distance-
Zustand — `fsLive.football` existiert zwischen Serien kurz nicht. Eine eigene
`starteKickoff()`-Phase (analog zu `starteSnap()`, aber mit eigenem `stufe`-Automat) ist eine neue
football-eigene Funktion, **kein Eingriff in `bauFeldspiel()` selbst** — der gemeinsame Chassis-
Code für Basketball/Hockey bleibt unberührt, solange die neue Phase ausschließlich aus
football-eigenen Aufrufstellen (`beginneFootballSerie`, nicht aus dem generischen
`stepFeldspielLive`) erreicht wird. Das ist dieselbe Nachweispflicht, die die Opus-Runde vom
09.10. für ihre eigenen Vorschläge schon erbracht hat (`git diff` zeigt Basketball/Hockey
unberührt).

### 3.2 QB-Slot

**Was Chris will, präzise übersetzt (s. Abschnitt 1.2/1.3):** nicht eine feste Spieler-Identität
über das ganze Spiel (das ist der bereits gescheiterte Depth-Chart-Versuch), sondern ein
Kaderslot, dessen **Stat-Profil** als Signal funktioniert — der Manager weiß, welcher Spieler für
diese Rolle "gebaut" ist, und die Mechanik soll diesem Spieler eine erkennbar höhere Chance geben,
tatsächlich der gewürfelte Passer zu sein, OHNE die anderen fünf Spieler auf Null zu setzen.

**Vorschlag: eine Gewichtsverstärkung im bestehenden `fkLos`-Mechanismus, keine Identitätsfixierung.**

1. **Slot-Zuweisung (Kaderebene, außerhalb des Live-Motors):** ein neuer, football-eigener
   Lineup-Slot "QB", analog zu `matchday-slot-roles.ts`s bestehendem Rollenkatalog, aber — anders
   als die sechs generischen Themen aus 1.1 — mit einer echten Rückwirkung auf den Live-Motor,
   nicht nur auf die Vorschauzahl. Der Manager weist diesen Slot einem Spieler im Kader zu (wie
   er heute schon die sechs generischen Slot-Rollen zuweist).
2. **Profil, aus dem bestehenden Passer-Rezept abgeleitet, nicht neu erfunden:** PASSGENAUIGKEIT
   ist bereits `{power:40,determination:35,dexterity:25}` (Zeile 7363, rho zur Eignung 0,801 —
   "QB-Kanal repariert"). Der QB-Slot-Text sollte GENAU diese drei Attribute nennen (power,
   determination, dexterity) — nicht spirit/charisma, wie die alte, vor-10.09.-Fassung der
   generischen Football-Rollen es noch tat (s. Kommentar `matchday-slot-roles.ts:232-240`: genau
   dieser Fehler — Text nannte Attribute, die die Mechanik nicht bezahlt — ist bei Football schon
   einmal passiert und wurde am 10.09. für die generischen Rollen behoben).
3. **Mechanische Kopplung — der eigentliche Kern:** `fkLos(off,"PASSGENAUIGKEIT")` in
   `resolvePass()` (Zeile 10219) bekommt einen MULTIPLIKATIVEN Bonus für den Spieler mit
   QB-Slot-Zuweisung, z. B. `gewichtFn = u => Math.pow(Math.max(1,u.PASSGENAUIGKEIT-LOS_NULLPUNKT),
   FK_LOS_KAPPA) * (u.id===qbSlotId ? QB_SLOT_BONUS : 1)`, mit `QB_SLOT_BONUS` klein genug, um die
   Lotterie-Eigenschaft zu erhalten (jeder andere Spieler bleibt ziehbar), aber groß genug, um
   sichtbar zu sein (Vorschlag: 1,3-1,6, **zu kalibrieren, nicht zu raten** — dieselbe
   Kaderfest-Messung wie jede andere Rezeptänderung). Das ist der entscheidende Unterschied zum
   gescheiterten Depth-Chart-Versuch: dort war die Identität FEST (Chance der anderen = 0 für
   diese Rolle), hier bleibt sie PROBABILISTISCH VERSCHOBEN (Chance der anderen > 0, nur kleiner).
4. **Parallel für Läufer/weitere Rollen, falls gewünscht:** dasselbe Muster ließe sich auf
   LAUFKRAFT (Läufer-Slot, "Runner" in Chris' eigener Sprache) und ABWEHR_PASS/ABWEHR_LAUF
   (Pass-Rusher-/Run-Stopper-Slot) übertragen — das deckt tatsächlich "Blocker oder Runner" ab,
   nur dass "Blocker" mechanisch eher PASSSCHUTZ (der Passer verteidigt sich laut Zeile 10228
   SELBST, s. K5-Papier Abschnitt 3.3 — ein echter Blocker-Slot bräuchte zuerst eine eigene
   Offensive-Line-Entität, die es heute nicht gibt, s. 3.4 unten) entspräche als "Runner". **Dieses
   Papier schlägt vor, mit NUR dem QB-Slot zu beginnen** (höchste Sichtbarkeit, direkteste
   Antwort auf Q5, kleinster Eingriff) und Runner-/Rusher-Slots als eigene, spätere Iteration zu
   behandeln, nicht in derselben PR.

**Pp-Wirkung:** PASSGENAUIGKEIT liest heute schon power/determination/dexterity — ein QB-Slot-
Bonus verändert NICHT, welche Attribute zählen, sondern verstärkt die Häufigkeit, mit der der
bereits stärkste Kanal (PASSGENAUIGKEIT, 0,0060-Koeffizient in der Kurve, Zeile 7159, der
schwerste Einzelterm im ganzen Rezept) gezogen wird. Das ist potenziell NEUTRAL bis leicht
NEGATIV für Pp (es verstärkt einen bereits übergewichteten Kanal, statt einem untergewichteten
einen neuen zu geben) — **anders als der Kicker-Slot (3.3), der gezielt tote Attribute bedient,
verbessert der QB-Slot die Pp-Zahl wahrscheinlich NICHT von sich aus.** Seine Rechtfertigung ist
Chris' ausdrücklicher Wunsch (Q5) und die Validität/Lesbarkeit ("der Spieler am QB-Platz ist der,
der auch wirft"), nicht die Pp-Schranke. Die Pflichtmessung muss das explizit zeigen, nicht
nur hoffen.

### 3.3 Kicker/Punter-Slot

**Zustand heute:** `resolveFieldgoal()` (Zeile 10287-10294) ist eine reine Distanzformel ohne
Spielerattribut. `resolvePunt()` (Zeile 10296) gibt eine feste Netto-Distanz zurück (`puntNetto`,
Konstante 40, Zeile 7079). Der Sub-Skill AUSDAUER existiert bereits (`stamina:67,will:33`,
Zeile 7370) — gelesen wird er heute von KEINER Spielformel (derselbe Befund, der den P1-Versuch
vom 02.10. motiviert hat, s. 2.2).

**Vorschlag:** ein eigener Kaderslot "Kicker/Punter", der (a) den Spieler bestimmt, dessen
AUSDAUER für Field-Goal-/Punt-Würfe gelesen wird, und (b) AUSDAUER erstmals an eine echte
Formel koppelt:

- **Field Goal:** `resolveFieldgoal(spot, kicker)` liest `kicker.AUSDAUER` als Zuschlag/Abzug auf
  die distanzbasierte Grundchance — Primärweg bleibt die Distanzstufe (real die stärkste
  Determinante, s. K5-Papier Abschnitt 2.3), AUSDAUER liefert einen kleinen Korrekturterm (z. B.
  ±3-5 Prozentpunkte um die Distanzstufe), nicht eine komplette Neuformel. Klein halten ist
  wörtlich die eigene Risikoeinschätzung der Opus-Konzeptreview („Ihr Kredit muss klein bleiben,
  sonst entsteht Rauschen").
- **Punt:** `resolvePunt(spot, netto, punter)` ersetzt die Konstante 40 durch `36 + (punter.
  AUSDAUER-50)*0.1` o. ä. — ein Punter mit AUSDAUER 70 trägt den Ball netto weiter als einer mit
  AUSDAUER 30, bleibt aber in einer realistischen Bandbreite (reale NFL-Netto-Punt-Distanz liegt
  um 40-45 Yards, K5-Papier Abschnitt 2.2).
- **Slot-Profil-Text:** AUSDAUER selbst ist stamina 67/will 33 — der Kicker/Punter-Slot-Text
  sollte exakt diese zwei Attribute nennen, nicht (wie der alte Football-Rollentext vor dem
  10.09.-Fix) spirit/charisma.

**Pp-Wirkung — der stärkste Hebel der drei Vorschläge:** stamina (Matrixgewicht 6) und will
(Matrixgewicht 10) sind ZWEI der sechs komplett toten Attribute aus Abschnitt 2.2 — ihr
mechanischer Anteil liegt laut `stand-aller-disziplinen.md:574-579` heute bei 0-0,7 %. Ein
Kicker/Punter-Slot, der AUSDAUER tatsächlich liest, hebt diesen Anteil auf einen Wert, der
näher an ihrem Matrixgewicht (6+10=16 Pp) liegt — das ist der einzige der drei Vorschläge, der die
Pp-Abweichung MIT HOHER WAHRSCHEINLICHKEIT tatsächlich senkt, nicht nur potenziell. **Risiko:** der
P1-Versuch vom 02.10. hat bereits gezeigt, dass ein gut gemeinter AUSDAUER-Kanal (dort: Uhr-/
Spielstand-Bewusstsein) Pp von 47,3 auf 71,1 trieb, statt es zu senken — derselbe Baustein
(AUSDAUER), ein anderer mechanischer Ort. Das ist KEIN Beweis, dass der Kicker-Slot ebenso
scheitert — der P1-Kanal betraf eine Entscheidungsfunktion (`waehleVierterVersuch`), die weit öfter
aufgerufen wird (jeder vierte Versuch) als ein Field-Goal-/Punt-Versuch (wenige je Spiel), und ein
seltener Kanal verschiebt die Gesamtsumme typischerweise weniger dramatisch. Trotzdem: **Pflicht-
Messung vor jedem Merge, nicht Vertrauen auf diese Einschätzung.**

### 3.4 Was bewusst NICHT in diesem Papier vorgeschlagen wird

- **Ein echter Blocker-/Offensive-Line-Slot.** `resolvePass()` rechnet die Sack-Chance direkt aus
  `rusher.ABWEHR_PASS − passer.PASSSCHUTZ` (Zeile 10228) — der Passer verteidigt sich mechanisch
  selbst. Ein echter Blocker würde eine dritte, bisher nicht existierende Entität in die Formel
  einführen (nicht nur einen Slot-Bonus auf einen bestehenden Sub-Skill, wie QB/Kicker) — laut
  Opus-Plan vom 09.10. (`opus-plan-football-gameplay-09-10.md` Abschnitt 6, zitiert im K5-Papier
  Abschnitt 6) der Baustein mit dem höchsten Risiko, den Korridor ein zweites Mal zu verschieben.
  Bewusst außerhalb dieses Papiers, eigene Runde, eigene Messung.
- **Ein Run-Stopper-/Defensive-Slot** nach demselben Muster wie der QB-Slot (3.2, Punkt 4) wäre
  technisch einfach anzuhängen, ist aber nicht Teil von Chris' heutiger Autorisierung (er nannte
  „Blocker oder Runner", nicht explizit die Defensive) — als mögliche Erweiterung notiert, nicht
  empfohlen für diese Runde.
- **Safety, Two-Point-Conversion, Overtime, Halbzeit-Kickoff-Seitenwechsel.** Alle vier bleiben
  genuinely fehlend (K5-Papier Abschnitt 3.4) und sind von keiner der fünf Chris-Antworten vom
  14.10. berührt — eigene, spätere Entscheidung.

---

## 4. Wie die drei Bausteine mit der bestehenden Pp-Verletzung zusammenhängen — Reihenfolge, nicht Gleichzeitigkeit

Direkt beantwortet, weil der Auftrag ausdrücklich danach fragt: **Pp-Fix und Feature-Bau laufen
hier nicht getrennt nacheinander, sondern SIND größtenteils derselbe Schritt.** Der Kicker/Punter-
Slot (3.3) und der QB-Slot (3.2) sind beide gleichzeitig (a) das, was Chris angefragt hat, UND
(b) ein Versuch, die Pp-Pflichtprüfung zu erfüllen, weil sie beide tote Matrixattribute (stamina/
will bzw. implizit den bereits bestehenden, aber unterrepräsentierten PASSGENAUIGKEIT-Kanal)
ansprechen. Das ist kein Zufall — Abschnitt 3 wurde bewusst so entworfen.

**Was NICHT zusammenfällt:** der Kickoff-Return (3.1) hilft der Pp-Zahl kaum (er verstärkt
bestehende, bereits gut gewichtete Kanäle wie LAUFKRAFT, statt tote Kanäle zu bedienen) und
trägt stattdessen ein rho-Risiko (neue, seltene Zufallsquelle). Deshalb steht er in der
Reihenfolge (2.3) zuletzt: **Pp-Fix zuerst (Schritte 2-3), weil er sowohl Chris' Wunsch als auch
die Pflichtprüfung gleichzeitig bedient; die reine Feature-Erweiterung (Schritt 4) danach, weil sie
keinen Pp-Vorteil bringt und ihr rho-Risiko separat, ohne gleichzeitige Rezeptverschiebung,
gemessen werden sollte.**

Eine abschließende Einschränkung: selbst wenn Schritte 2-3 wie geplant wirken, bleibt ungewiss, ob
sie ALLEIN ausreichen, Pp unter 25 zu drücken. Awareness (Matrixgewicht 11, aktuell −0,335
Korrelation zur echten Eignung laut `football-rezept-sondierung-awareness-ausdauer-spirit-02-10.md`
Abschnitt 1) und intelligence/charisma (0 Pp in der Matrix selbst, also irrelevant für die
Pp-Zahl) bleiben von keinem der drei Vorschläge berührt — ein Rest-Pp-Betrag von geschätzt
20-30 Pp ist nach Schritt 3 plausibel, nicht garantiert unter 25. Eine vierte, noch offene Runde
(P2-P4 des Opus-Plans: Spielplan-/Box-Reads, O-Line, Special Teams als Ganzes) bleibt
wahrscheinlich nötig — dieses Papier löst die Pp-Verletzung nicht vollständig, sondern senkt sie
gezielt in Richtung der Schranke.

---

## 5. Offene Risiken und ehrliche Unsicherheiten

1. **Die QB-Slot-Bonusstärke (3.2, Punkt 3) ist nicht kalibriert, nur als Mechanismus skizziert.**
   Ob 1,3 oder 1,6 oder ein ganz anderer Wert die richtige Balance zwischen „sichtbar der QB wirft
   öfter" und „die anderen fünf bleiben eine echte Chance" trifft, ist eine offene,
   messungsgebundene Frage — genau wie `FK_LOS_KAPPA=3,4` selbst einmal gegen Kappa=2
   durchgemessen wurde (Zeile 7698), bevor es gesetzt wurde.
2. **Unklar, ob ein QB-Slot-Bonus über `fkLos` technisch sauber in die bestehende
   `gewichtetesLosNach`-Funktion (Zeile 11253) integriert werden kann, ohne deren generische
   Natur zu verletzen** — sie wird von praktisch jeder Feldspieldisziplin für andere Zwecke
   genutzt (Basketball/Hockey-Ballbesitz, Footballs eigene Receiver-/Rusher-Ziehung). Eine
   football-eigene Variante (`fkLosMitSlotBonus`) statt einer Änderung der generischen Funktion
   ist der naheliegende, chassis-sichere Weg — aber das ist eine Implementierungsentscheidung
   für die Baurunde, nicht für dieses Papier.
3. **Die Annahme „Kicker/Punter-Slot verbessert Pp eher als QB-Slot" (Abschnitt 3.2/3.3) ist
   plausibel begründet, aber NICHT gemessen.** Beide könnten in die jeweils andere Richtung
   überraschen — exakt die Lehre aus dem P1-Fall vom 02.10.
4. **Die reale Kopplungsstärke zwischen Slot-Zuweisung und Lotterie-Ergebnis hat keine reale
   NFL-Entsprechung, an der man fitten könnte** — anders als die Field-Goal-Erfolgsquote (gegen
   echte 2024-Daten kalibriert) oder die Sack-Quote (gegen echte 2024-Daten kalibriert) ist „wie
   stark soll ein zugewiesener QB-Slot die Wurflotterie verschieben" eine reine Spieldesign-Frage
   ohne externen Realitäts-Anker. Die Kalibrierung muss ausschließlich gegen rho/Pp laufen, nicht
   gegen eine zitierbare Quelle.
5. **Dieses Papier geht davon aus, dass ein neuer, football-eigener Lineup-Slot-Typ („QB",
   „Kicker/Punter") technisch ins bestehende Kader-/Aufstellungssystem passt** (parallel zu den
   sechs generischen `matchday-slot-roles.ts`-Themen, aber mit echter Motor-Rückwirkung). Ob das
   bestehende Aufstellungs-UI/-Datenmodell (`lib/lineups/`) eine SOLCHE neue Slot-Kategorie
   (mit echter mechanischer Wirkung statt nur einer Vorschauzahl) ohne größeren Umbau aufnehmen
   kann, wurde für dieses Papier NICHT geprüft — das ist eine eigene technische Machbarkeits-
   Frage für die Baurunde, kein hier beantworteter Punkt.
6. **Die Kickoff-Return-Mechanik (3.1) führt einen neuen Spielzustand zwischen Serien ein** (eine
   eigene Snap-Phase ohne laufenden Down/Distance-Kontext). Ob das bestehende Feed-/HUD-System
   (Down-&-Distance-Anzeige, `engine.js:14029-14032`) für diesen Zwischenzustand sauber
   degradiert (z. B. „Kickoff" statt „1st & 10" anzeigt), ist ungeprüft.

---

## Quellen

- `docs/design/football-kickoff-regeln-konzept-14-10.md` — primäre Quelle dieses Papiers,
  vollständige Regel-Recherche (Abschnitt 2) und Sichtbarkeits-Audit (Abschnitt 3), Frage 4
  (Abschnitt 7, Punkt 4) ist der direkte Auftrag für diese Konsultation.
- `docs/design/football-rezept-sondierung-awareness-ausdauer-spirit-02-10.md` — Pp-Diagnose,
  Einzelattribut-Korrelationen (Abschnitt 1), gescheiterter P1-Versuch (Pp 47,3→71,1).
- `docs/design/stand-aller-disziplinen.md` — rho-/Pp-Tabellen, Football-Zeilen 552, 574-579, 948.
- `docs/pm-briefings/opus-plan-football-gameplay-09-10.md` — Risikoabschätzung, Reihenfolge-
  Vorschlag für Special Teams (zitiert über das K5-Papier).
- `football-konzeptreview-26-09` (Branch, nicht gemergt) → Opus-Konzeptreview, P4-Vorschlag
  Kickoff-Return (zitiert über das K5-Papier Abschnitt 4).
- `lib/player-generator/official-discipline-weights.ts` — gesperrte Matrix, Football-Zeile
  (power 6, health 14, determination 8, stamina 6, speed 0, dexterity 0, awareness 11,
  intelligence 0, will 10, charisma 4, spirit 25, torment 16).
- `lib/player-generator/spiel-eignung-overrides.ts` — Footballs legitimer Spiel-Eignungs-
  Override (power 22, health 18, speed 14, torment 12, determination 10, awareness 8, stamina 6,
  dexterity 4, spirit 3, will 3), unangetastet, nur zitiert.
- `lib/lineups/matchday-slot-roles.ts` — generisches Sechs-Rollen-Lineup-Vorschausystem (Zeilen
  97-278 Katalog, 241-253 Football, 462-564 Hockeys Torwart-Sonderfall, 69/733-738 Vorschau-
  Bonusmechanik).
- `lib/battle/arena-resolved-disciplines.ts` — Produktionsstatus, Football bewusst außerhalb
  (Zeilen 85-169).
- `public/mockups/battle-mode.engine.js`, `origin/main` `8ec25064` — alle Zeilenangaben in
  Abschnitt 1 und 3 (SLOTS_FOOTBALL_OFF 9960-9965, waehleFormationOffense 9992, FK_LOS_KAPPA
  10127, resolvePass 10218-10244, resolveFieldgoal 10287-10294, resolvePunt 10296,
  animiereFootballZug 10313-10364, starteSnap 10707-10742, beginneFootballSerie 10779-10786,
  Rezept-Sub-Skills 7363-7370, Hockey-Torwart 8296/8657/9021/9068-9073/9419/9427,
  gewichtetesLosNach 11253, spielmacherLos 11124-11129, LOS_NULLPUNKT/LOS_KAPPA 7697-7700).

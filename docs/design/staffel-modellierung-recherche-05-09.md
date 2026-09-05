# Staffel: Diagnose, Vorbild, Rezeptvorschlag (Fable, 05.09.2026)

Stand: `d74e3b98` (`origin/main`, 05.09.; Motor identisch mit dem lokalen Stand-Doku-Branch
`a607e875`, auf dem gemessen wurde — `git diff` zwischen beiden berührt keine Motorzeile). Alle `engine.js`-Zeilen meinen
`public/mockups/battle-mode.engine.js` auf diesem Stand. **Der Motor wurde nicht angefasst**
— die einzige Datei dieses Branches ist dieser Bericht. Alle Vorher/Nachher-Zahlen unten
stammen aus **Kopien** des Mockups im Scratchpad (`mock-e1`, `mock-e2b`, …), gepatcht und mit
derselben kaderfesten Messung gefahren, die auch `scripts/miss-alle-disziplinen.mjs` benutzt
(`scripts/lib/rangtreue-messung.mjs`, fünf echte Kader-Paarungen, n = 24). Die unveränderte
Kopie reproduziert die eingecheckte Basislinie **bit-identisch** (0,681 / 0,398 / 0,706 /
0,650) — die Kopien messen also dasselbe wie das Repo.

Auftrag (Chris, Budget freigegeben): Staffel als nächste Disziplin nach dem Schema
Tennis/Fechten und Football modellieren. Vorgabe aus `CLAUDE.md`: rho je Spiel über 0,80,
kaderfest; **an der Validität arbeiten, nicht an der Uhr.**

---

## 0. Die Antwort in fünf Sätzen

1. **Die Staffel ist kein Zufalls- und kein Ereignisproblem.** Dasselbe Bein desselben
   Läufers streut über 24 Saaten um median 0,017 s; Verlässlichkeit nach der Formel aus
   `CLAUDE.md` ≈ 0,93. rho je Spiel (0,681) und rho Saison (0,706) liegen deshalb fast
   gleichauf — **reines Validitätsproblem**, wie die Stand-Tabelle vermutet hat.
2. **Die Validitätsdecke ist die alte Bahn-Entscheidung „Rezept gibt Form UND Menge, Eignung
   nur Anzeige"** (`engine.js:14798–14808`, dort ausdrücklich „eine Frage an Chris"). Gepoolt
   über 1440 Läuferzeilen erklärt der Tempo-Mix aus ANTRITT/ENDTEMPO die Etappenzeit zu
   rho 0,948 — aber `eig` und dieser Mix ordnen die Läufer nur zu **0,776** gleich. Mehr
   kann kein Maß und keine Mechanik herausholen, solange die Menge nicht an der Eignung
   hängt. Ein Drittel der Matrix (awareness 12, charisma 10, dexterity 8) sitzt in
   Sub-Skills, die im 1,7-s-Bein tot sind (Restreserve am Beinende median **88 %**; STEHEN,
   WUCHT, ROBUST korrelieren mit der Etappenzeit zu 0,05 / 0,10 / −0,09).
3. **Der Rezept-Fix im bestehenden Chassis reicht — kein eigenes Chassis.** Die
   Eignungskopplung, die die Arena seit Chris' Einwand („wieso zusätzlich unterschiedliche
   Kampfkraft?") hat (`aufEignung`, `engine.js:3785`), auf die Staffel übertragen — **eine
   Zeile in `bauSpurt`, mit `art.staffel` gegated** — hebt kaderfest **0,681 → 0,858**
   (Spannweite 0,398 → 0,212), in **allen fünf** Kader-Varianten. Mit Plänen ohne
   Tempostrafe und halbierter Patzerquote zusammen **0,915 (Spannweite 0,089), Saison
   0,951**. Spurt und Zeitfahren bleiben dabei bit-identisch (nachgemessen). Bei den
   Kadergrößen, die der Saisonplan für die Staffel wirklich würfelt (2, 4, 5, 6 je Seite —
   nie 3), steht die Basis bei **0,138** (zwei je Seite) bzw. 0,633 (vier), die
   Kombination bei **0,950 / 0,948** (Nachtrag, Teil 3.8).
4. **Was die echte 4×100 auszeichnet — fliegender Start, Wechselzone, Reihenfolge, DNF-Risiko
   (21 % der Männerstaffeln in WM/Olympia-Finals 2000–2019) — ist heute nur zur Hälfte da:**
   der Wechsel ist ein stufenloser Zeitpreis (gut), aber er kann nur *kosten*, nie *bringen*;
   ein fliegender Start existiert nicht; das DNF-Drama fehlt ganz, dafür „patzt" jeder
   elfte Wechsel mild. Der Vorschlag in Teil 3 macht aus dem Wechsel das, was er real ist:
   ein **Zeitgewinn**, an dem Abgeber (ENDTEMPO), Annehmer (ANTRITT) und Technik/Absprache
   (awareness, dexterity, charisma, spirit) je einen Kanal haben.
5. **Realistischer Sprung:** 0,68 → **0,86–0,92** je Spiel (gemessen, nicht geschätzt, für
   K1–K3), Spannweite auf ein Viertel; die Sport-Mechanik (K4–K6) kommt danach und wird gegen diese
   Zahl gemessen, nicht umgekehrt. Aufwand: Rezept-Fix **gering**, Wechsel-als-Gewinn
   **mittel**, Assets **gering** (ein Stab in Canvas, eine Zonenmarkierung über den
   vorhandenen Markerzeichner, `idle`-Blatt für die Wartenden ist schon da).

---

## 1. Diagnose: warum beide Zahlen niedrig sind

### 1.1 Was die Staffel heute ist — und was seit der Bahn-Recherche vom 02.09. gebaut wurde

Die Staffel ist eine Konfiguration des Bahn-Chassis (`BAHN_ART.staffel`, `engine.js:14558`):
sechs Läufer je Seite, sechs gleich lange Abschnitte, zwei feste Bahnen, kein Windschatten,
kein Tackle, keine Hindernisse. Immer nur einer je Mannschaft läuft (`u.aktiv`); die
übrigen stehen an ihrer `beinVon`-Marke. Bei `u.pos >= beinBis` geht der Stab weiter
(`engine.js:15259–15329`).

Von den fünf Schritten der Bahn-Recherche (`bahn-disziplinen-recherche-fable.md` 1.6) sind
**vier gebaut**, einer nicht — und einer wurde anders gebaut als vorgeschlagen:

| Schritt | Vorschlag 02.09. | Stand heute |
|---|---|---|
| S1 Sog vom Stehenden | `vordermann` prüft `aktiv` | gebaut (`:14877`) — und der Windschatten danach ganz abgeschaltet (`schatten:false`), weil er nur noch der zurückliegenden Mannschaft zufiel |
| S2 Einzelmaß | Split-Differenz **zum Gegner auf demselben Bein** | **anders gebaut**: `wert = −etappenZeit + wechselKonto` (`:17148`), absolut, nicht relativ — **zu Recht**, s. 1.4 |
| S3 Feld stauchen | `tempoSpanne` 0,90 → 0,45 | nicht gebaut — und die Messung unten sagt: **richtig so** (Teil 3, E-SPAN) |
| S4 Anlaufphase, Wechsel als Zeitpreis | τ-Beschleunigung, `verlust = 0,09·(1−Q)` | Zeitpreis gebaut (`WECHSEL_MAX/K/MIN`, stufenlos aus TECHNIK beider), Patzer als Los (`WECHSEL_PATZER`, ROBUST senkt), **Anlaufphase/fliegender Start nicht** |
| S5 Kurve, WUCHT → ZONE | Kurvenmalus über WENDIGKEIT | Kurve gebaut (`kurvenFaktor`, `:14941`, in der Mitte jedes Abschnitts); WUCHT wurde nicht ZONE, sondern „Zug an der Spitze" (verbilligt Reserveverbrauch, `:15128`) |

Dazu zwei Bahn-Fixes, die die Staffel zuerst getroffen haben: die Eignungslücke
`p.d[d]||0` (`:14826`, Stand-Doku Abschnitt 3) und die Etappen-lokale Phase/Ermüdung
(`laufAnteil`, `:14936`). Die Zahl stieg damit von −0,038 (Teamzeit-Maß) über 0,598
(02.09., Einzelkader) auf **0,681 kaderfest** — und blieb dort stehen.

### 1.2 Was die Sonde sagt — zwei eigene Messungen, keine Motoränderung

Werkzeug: `window.__arena.disziplinProbe("staffel", {n:24, kaderFamilie})` und
`window.__arena.spiele("staffel", saat)` (liefert das volle `rennFertig`-Protokoll mit
Sub-Skills, `etappenZeit`, `wechselKonto`, `reserve`). Skripte im Scratchpad
(`staffel-diagnose.mjs`, `staffel-diagnose2.mjs`), nicht committet.

**Je Kader-Variante** (n = 24, dieselben fünf Paarungen wie die Basislinie):

| Variante | rho je Spiel | Star auf Rang 1 | Star in Top 2 | Star Letzter | Paare ≥ 15 Pkt richtig | Paare < 2 Pkt richtig |
|---|---:|---:|---:|---:|---:|---:|
| vigilante-armageddon | 0,415 | 79 % | 96 % | 0 % | 84,3 % | 47,7 % |
| coldsteel-direlegion | 0,681 | 63 % | 71 % | 0 % | 95,9 % | 49,6 % |
| goldengladiators-silversoldiers | 0,719 | 83 % | 96 % | 0 % | 89,0 % | 54,3 % |
| mortalsin-natureswrath | 0,813 | 25 % | 83 % | 0 % | 92,4 % | 55,6 % |
| piratecrew-raginglunatics | 0,675 | 88 % | 88 % | 0 % | 90,7 % | 55,4 % |
| **Median / gesamt** | **0,681** | **68 %** | **87 %** | **0 %** | **90,8 %** | **~50 %** |

Nach der ehrlicheren Abnahme aus `CLAUDE.md` (Star, Paartreue mit Abstand) steht die Staffel
damit **nicht schlechter als Hockey** (Star Rang 1: 58 %, Top 2: 78 %). Was rho drückt, sind
die engen Paare (Münzwurf, wie überall) — und etwas Spezifisches, das erst je Bein sichtbar
wird:

**Je Bein** (48 Zeilen je Bein und Variante: derselbe Heim- und derselbe Gastläufer, 24
Saaten): rho(eig, −Etappe) liegt in 21 von 30 Bein-Paaren bei **0,79–1,00** — und in **sieben
bei −0,40 bis −0,56**. Beispiel vigilante, Bein 0: Eignung 35,8 im Mittel, rho −0,562; Bein
2: Eignung 50,7, rho +0,966. Ein negatives Bein-rho heißt: der **eignungsschwächere** der
beiden Läufer auf diesem Abschnitt ist über 24 Saaten **konsistent schneller**. Das ist kein
Rauschen (die Zeiten sind deterministisch, s. u.), sondern eine Ordnung, die die Mechanik
anders trifft als die Matrix.

**Gepoolt über alle 1440 Läuferzeilen** (5 Varianten × 24 Rennen × 12):

| Größe | rho mit −Etappe | rho mit `eig` |
|---|---:|---:|
| ANTRITT | **0,905** | 0,791 |
| ENDTEMPO | 0,829 | 0,571 |
| Mix 0,73·ANTRITT + 0,27·ENDTEMPO (die effektive Tempoformel bei 1,7-s-Beinen und 3,2-s-Phase) | **0,948** | **0,776** |
| WENDIGKEIT (Kurve) | 0,675 | 0,716 |
| TECHNIK (Wechsel) | 0,313 | 0,683 |
| STEHEN (Ermüdung) | 0,053 | −0,101 |
| WUCHT („Zug an der Spitze") | 0,098 | 0,387 |
| ROBUST („Verlässlichkeit") | −0,086 | −0,191 |
| **`eig` selbst** | **0,805** | — |

Lesart: die Etappenzeit *ist* der Tempo-Mix (0,948). Die Eignung folgt diesem Mix aber nur
zu 0,776 — **das ist die Decke**. Und drei der sieben Sub-Skills tun im Rennen nichts:

- **Restreserve am Beinende: median 88 %, Minimum 71 %.** Der Kraft-Haushalt (`KRAFT_VON`,
  230 + 2,4·…) ist für ein 11-s-Rennen bemessen; ein 1,7-s-Bein verbraucht ihn nie. Damit
  ist alles tot, was über die Reserve wirkt: STEHEN als Vorrat, WUCHT als Verbilligung
  (`SPITZE_ZUG`), das Sparen der Pläne. Spirit (45 % von WUCHT) und Charisma (33 %) sitzen
  in einem Kanal ohne Wirkung — genau der Befund, den der Code-Kommentar an `:15117` für
  die *vorige* Fassung beschreibt, nur eine Ebene tiefer.
- **Die Pläne kosten Zeit ohne Gegenwert.** `halten` läuft 72 % des Beins mit Tempo 0,94,
  `schluss` 55 % mit 0,90 — als Sparplan gedacht, aber es gibt nichts zu sparen. Gemessen:
  `angehen` 1,668 s, `halten` 1,763 s, `schluss` 1,832 s (Mix-Mittel 56,4 / 54,4 / 49,9 —
  teilweise Kader, teilweise Plan). Weil `planJeSlot` die Pläne fest auf Slots legt
  (startrunner/curverunner → angehen, tempolink/batontech → halten, chaserunner/anchor →
  schluss), ist das ein **Bein-Bias**: Beine 1, 2, 4, 5 sind je nach Plan 4,6–6,1 %
  langsamer, und `wert` vergleicht über Beine hinweg.
- **Der Wechsel entscheidet keine Rennen.** Zielabstand median 0,69 s; Wechselverlust
  median 0,144 s je Übergabe (beiden Teams); in **2 von 120** Rennen kippt der Wechsel das
  Ergebnis gegenüber der reinen Etappensumme. Patzerquote **9,0 % je Wechsel**, 43 von
  120 Rennen mit mindestens einem Patzer. Das eignungsstärkere Team gewinnt **98,3 %**.
- **Das Rennen ist deterministisch.** Spannweite der Etappenzeit desselben Läufers über
  24 Saaten: median **0,017 s**, max 0,057 s (Formkarten plus Patzer). `rr()` trifft in der
  Staffel nur den Patzer.

### 1.3 Die Zerlegung nach `CLAUDE.md`

    rho(ein Spiel) = rho(Saison) × √Verlässlichkeit
    0,681          = 0,706      × √V   →   V ≈ 0,93

Verlässlichkeit 0,93 ist die höchste im Projekt (Hockey 0,755). **Mehr Ereignisse — mehr
Beine, längere Beine, mehr Wechsel — würden hier nichts bewegen.** Die Saisonzahl 0,706 ist
das Problem, und sie hat drei benennbare Ursachen, in dieser Reihenfolge des Gewichts:

1. **Menge nicht an der Eignung** (Decke 0,776): die Rezepte gewichten die zwölf Attribute
   ein zweites Mal, anders als die Matrix — derselbe „Konstruktionsfehler unter allen
   anderen", den Chris für die Arena benannt hat (`engine.js:3766`). Die Bahn hat ihn
   bewusst behalten und als Frage an Chris markiert (`:14805–14808`). Die Staffel ist die
   Bahn, in der er am teuersten ist, weil sie **kein** Element hat, das die Form (Hürde,
   Sog, Rempler) zur Geltung bringt — sie ist fast reines Tempo.
2. **Tote Kanäle** für ein Drittel der Matrix (Reserve nie leer; WUCHT ohne Kanal; STEHEN
   ohne Strecke; TECHNIK nur als halber Verlust im Konto).
3. **Bein-Bias durch Pläne** (Tempostrafe ohne Sparnutzen, fest an Slots).

### 1.4 Was NICHT die Ursache ist — drei Hypothesen, die die Sonde ausschließt

- **Nicht das Maß.** Post-hoc auf denselben Protokollen gerechnet (Median über die fünf
  Varianten, rho je Spiel):

  | Maß | rho je Spiel | Spannweite | rho Saison |
  |---|---:|---:|---:|
  | heute: −Etappe + Konto | **0,713** | 0,377 | 0,741 |
  | −Etappe allein | 0,637 | 0,663 | 0,671 |
  | bein-relativ zum Gegner (Vorschlag 02.09., S2) | 0,601 | 0,504 | 0,587 |
  | bein-relativ + Konto | 0,685 | 0,258 | 0,657 |
  | −Etappe + 2×Konto | 0,622 | 0,276 | 0,678 |

  Das heutige Maß ist das beste der fünf. Das Konto **hilft** (+0,08 gegenüber der nackten
  Etappe). Der bein-relative Vorschlag aus der Bahn-Recherche ist **widerlegt**: sechs
  gespiegelte Paare tragen keine Information darüber, ob der Heim-Läufer auf Bein 3 besser
  ist als der Heim-Läufer auf Bein 4 — genau das, was rho über zwölf braucht. (Die 0,713
  hier gegen 0,681 in der Basislinie: `spiele()` zieht die Formkarten anders als
  `disziplinProbe`; die Rangfolge der Maße ist davon unabhängig.)
- **Nicht der Zufall.** Verlässlichkeit 0,93, Etappenstreuung 0,017 s. Die Patzer (9 % je
  Wechsel) sind das einzige Los und kippen 2 von 120 Rennen.
- **Nicht die Ereigniszahl.** Die Uhr ist bereits so kurz, dass Ermüdung und Reserve
  nichts messen — mehr Uhr würde diese Kanäle zwar wecken, aber die Decke 0,776 nicht heben.

---

## 2. Was eine echte 4×100-m-Staffel auszeichnet — mit Quellen

Abgerufen für diesen Bericht (Volltexte per WebFetch/`pdf-parse`, Zahlen wörtlich):

| Kennzahl | Wert | Quelle |
|---|---|---|
| Wechselzone | seit 01.11.2017 **30 m** (vorher 20 m + 10 m Anlauf); die alte 20-m-Zone beginnt heute 10 m nach Zonenbeginn | Wikipedia „4 × 100 metres relay"; Roșculeț/Tomescu/Dulceață 2025 (Analele UNEFS), Abb. 1 |
| Staffel gegen Einzelzeiten | „typically **2–3 seconds** faster than the sum of best times" | Wikipedia, ebd. |
| Faustformel der Effizienz | Vorhersage = Σ 100-m-Bestzeiten **− 3,3 s**; Italien beste Wechseleffizienz (97,95 %), Jamaika trotz WR die schlechteste (97,47 %) | Review 2025, Abschnitt zur dritten Studie |
| Ein Vereinsbeispiel | Σ Einzelzeiten 51,90 s, Staffelzeit 49,53 s — **2,37 s** „aus dem Stabwechsel"; „the baton must always remain as the fastest member of the squad" | Livingston AC, „Introductory Guide", Teil I |
| Fliegender Start | nach 20 m Anlauf **89 %** des Maximaltempos; ~50 m bis zum Maximum | Ward-Smith & Radford 2002, zitiert in Zarębska 2021 und Review 2025 |
| Stab-Tragezeit je Bein (Modell) | Bein 1 **9,82 s** (aus dem Stand), Beine 2–4 **8,88 s** (fliegend) — 0,94 s je Bein | Ward-Smith & Radford 2002, Tab. 4 (aus `bahn-disziplinen-recherche-fable.md`) |
| Tatsächlich gelaufene Beinlängen | Bein 1: 90–110 m, **Bein 2: 80–120 m**, Bein 3: 80–120 m, Bein 4: 90–110 m — Bein 2 kann das längste *oder* das kürzeste sein | Livingston AC, Teil I, Tabelle |
| Übergabe selbst | „takes place on two strides in less than 1 s"; optimale freie Distanz **~1 m** (Review) bzw. 1,5–2 m (Zarębska) | Zarębska et al. 2021; Review 2025 |
| Übergabepunkt gegen Zonenzeit | r = −0,45 (Männer, 1./3. Wechsel) bis **−0,72** (Frauen, 2. Wechsel); HP erklärt höchstens **50 %** der Zonenzeit | Zarębska et al. 2021, Acta Kinesiologica 15 Supp. 1 |
| Sorgfalt gegen Tempo | ~**0,1 s je Wechsel** zwischen „flat out" und „sicher" | Ward-Smith & Radford 2002, S. 378 (aus der Bahn-Recherche) |
| Kurve | 1./3. Wechsel „mostly on bends, increased difficulty"; Innenbahnen verlieren mehr | Review 2025 |
| **Ausfallquote** | Männer WM/Olympia-Finals **2000–2019: 21,1 %** (56 von 266) DNF/DQ; Frauen **17,3 %** (45 von 260); 1995–2001: **25,5 %** ausgeschieden, 14,3 % DQ | Zarębska et al. 2021; Radford & Ward-Smith 2003 (zitiert in beiden) |
| Wer gewinnt | GB 2004 Olympiasieger mit Σ Einzelzeiten **40,77 s** gegen USA **39,59 s** (Zweite) — „extensive differences in technical quality" | Zarębska et al. 2021 |
| Reihenfolge (Modell) | schnellster Läufer auf **Bein 1**, die zwei langsamsten auf 3 und 4; Gesamteffekt der Reihenfolge nur 0–0,06 s | Ward-Smith & Radford 2002, Tab. 12/13 |
| Reihenfolge (Trainerpraxis) | Bein 1: sicherer Blockstarter und Kurvenläufer; Bein 2: 200-m-Typ (Tempohärte, längstes Bein); **Bein 4: der Schnellste** („Glory leg", aber: „always pre-selecting the fastest for the last leg can rapidly …" — Reihenfolge testen) | Livingston AC, Teil I |
| Kooperation | Priming auf Kooperation erhöhte die Stabgeschwindigkeit in der Zone um **30 cm/s** | Bry et al. 2009, zitiert im Suchergebnis (nicht selbst gelesen) |

**Was daraus für die Modellierung folgt:**

1. **Der Wechsel ist real ein Gewinn, kein Risiko.** 2–3 s auf 37 s (6–8 %) kommen daraus,
   dass drei von vier Läufern *fliegend* starten. Unser Wechsel kann nur kosten
   (0,04–0,42 s) — das ist die falsche Richtung. Ein Läufer kann heute nicht durch einen
   guten Wechsel *schneller* sein als sein Tempo.
2. **Die Zonenzeit gehört dem Paar** und hängt zur Hälfte am Übergabepunkt (Absprache,
   Timing) und zur Hälfte am Tempo beider (Einlauf des Abgebers, Anlauf des Annehmers).
   Damit haben ENDTEMPO des Abgebers und ANTRITT des Annehmers real einen Kanal, der über
   das eigene Bein hinausreicht — heute nicht.
3. **DNF ist real ein Fünftel aller Finals.** Ein Team mit den vier besten Einzelläufern
   verliert real oft. Für die Rangtreue *einer Mannschaft* ist das Gift; für die Rangtreue
   *eines Läufers* muss es nicht Gift sein, wenn der Patzer denen angeschrieben wird, die
   ihn verursacht haben (Konto) — genau so ist es heute gebaut. Die Frage ist die Höhe
   (Teil 3, K3) und ob es ein *echtes* DNF geben soll (Teil 6, Frage 2).
4. **Beinlängen sind variabel** (80–120 m): der Annehmer läuft dem Abgeber entgegen, der
   Abgeber trägt den Stab in die Zone hinein. Das ist der Ort, an dem Tempohärte (STEHEN)
   und der 200-m-Typ real sitzen — und ein natürlicher Kanal für das heute tote STEHEN.
5. **Reihenfolge:** Modell und Praxis widersprechen sich beim Anker, sind sich aber einig,
   dass Bein 1 einen guten Starter braucht und die Wechsel-Paare zusammengehören. Für die
   KI-Aufstellung heißt das: bester ANTRITT auf Bein 1, bestes TECHNIK-Paar an den
   Wechseln, der Rest nach Tempo — und die Reihenfolge ist real nur 0,06 s wert, sie darf
   also kein großer Hebel sein.

---

## 3. Rezeptvorschlag mit Zahlen — gemessen, wo es ging

Sechs Kandidaten, die ersten drei **an Kopien gemessen**, die übrigen drei begründet und mit
Startwerten versehen. Alle mit `art.staffel` bzw. `BA().staffel` gegated; Spurt und
Zeitfahren wurden auf der K1-Kopie nachgemessen und sind **bit-identisch** zur Basislinie
(Spurt 0,652 / 0,559 / 0,690 / 0,643; Zeitfahren 0,867 / 0,050 / 0,909 / 0,056).

### 3.1 K1 — Eignungskopplung auf der Bahn (der Hebel)

Die Arena-Antwort auf Chris' Einwand, übertragen: die Rezepte geben die **Form** (wer ist
Antritts- oder Tempoläufer, wer der sichere Wechsler), die Eignung gibt die **Menge**.
Skizze für `bauSpurt`, direkt nach `const w=spurtWerte(p,attr);` (`engine.js:14793`):

```js
// STAFFEL: MENGE AUS DER EIGNUNG, FORM AUS DEM REZEPT (wie aufEignung in der Arena).
if(art.staffel){
  const eigW=(p.d[d]!=null?p.d[d]:gewichtet(p.a,BASIS_JE_DISC[d]||{}))+engP+breitP+eigHebung(p,d);
  const m=0.73*w.ANTRITT+0.27*w.ENDTEMPO;      // die effektive Tempoformel eines 1,7-s-Beins
  const f=m>0?eigW/m:1;
  for(const k in w)w[k]=Math.round(Math.max(1,Math.min(100,w[k]*f)));
}
```

Zwei Spielarten gemessen (E2a: Mittel aller sieben Sub-Skills = Eignung; E2b: Tempo-Mix =
Eignung), je mit und ohne K2:

| Kopie | rho je Spiel (Median) | Spannweite | rho Saison | Spannweite | je Variante | Star Rang 1 / Top 2 | Paare ≥ 15 |
|---|---:|---:|---:|---:|---|---|---:|
| **Basis** (= Repo) | 0,681 | 0,398 | 0,706 | 0,650 | 0,42 0,68 0,72 0,81 0,68 | 68 % / 87 % | 90,8 % |
| E1 (nur K2, Pläne ohne Tempostrafe) | 0,689 | 0,271 | 0,713 | 0,622 | 0,48 0,63 0,71 0,75 0,69 | 56 % / 78 % | 90,8 % |
| **E2b (K1, Tempo-Mix = Eignung)** | **0,858** | 0,212 | 0,888 | 0,302 | 0,71 0,92 0,86 0,88 0,83 | 60 % / 88 % | 96,7 % |
| E1 + E2a (K1 über alle sieben, + K2) | 0,868 | 0,208 | 0,888 | 0,268 | 0,72 0,85 0,93 0,89 0,87 | 71 % / 88 % | 98,1 % |
| **E1 + E2b (K1 + K2)** | **0,864** | **0,140** | **0,944** | **0,093** | 0,77 0,91 0,85 0,89 0,86 | 62 % / 90 % | 97,0 % |
| **E1 + E2b + PATZ (K1 + K2 + K3, der Vorschlag)** | **0,915** | **0,089** | **0,951** | 0,093 | 0,85 0,94 0,92 0,91 0,93 | 63 % / 95 % | **99,6 %** |

Der Sprung von K1 allein (+0,18) ist größer als die CI-Schranke der Disziplin (0,119) und
tritt in **jeder** der fünf Varianten auf (kleinster Einzelwert 0,42 → 0,71). Nach der
Faustregel aus `messgrundlage-kaderfest.md` — Bewegung muss die eigene Spannweite
übertreffen — ist er mit 0,177 gegen 0,398 *formal* noch im Rauschband; die
fünf-von-fünf-Richtung ist das eigentliche Argument. Die Kombination K1+K2+K3 (+0,23,
kleinster Einzelwert 0,85, Spannweite 0,089) liegt dann auch formal außerhalb: ihre
Bewegung übertrifft die Spannweite der Basis nicht, aber jede einzelne Variante liegt
über dem **besten** Basiswert (0,81). Sie ist mein Vorschlag als Grundlage.

**Warum das kein Betrug an der Messung ist:** `eig` ist die Matrix, und die Matrix ist
Chris' Definition dessen, was die Disziplin belohnen soll („immer über die
Diszi-Gewichtungen gehen"). Die Kopplung macht die Mechanik der Matrix gehorsam; die Form
(wer wechselt sauber, wer läuft die Kurve) bleibt beim Rezept — und wird erst durch K3–K5
wieder zu einem Unterschied, der rho *kosten* darf.

**Die eine Entscheidung darin, die Chris gehört:** dieselbe Kopplung würde Spurt (0,652)
und Takeshi (0,697) vermutlich ebenfalls heben. Hier nur für die Staffel vorgeschlagen,
weil nur sie gemessen ist und weil Spurt/Takeshi Formelemente (Hürde, Rempler, Fallen)
haben, die die Kopplung anders wirken lassen. Frage 1 in Teil 6.

### 3.2 K2 — Pläne ohne Tempostrafe; Pläne als Wechselrisiko

`halten`/`schluss` auf `tempo:1.00` (E1). Allein bringt das wenig (0,689) und kostet sogar
Star-Treue; zusammen mit K1 halbiert es die Spannweite (0,212 → 0,140) und hebt die
Validität auf 0,944, weil der Bein-Bias wegfällt.

Damit die drei Pläne nicht bedeutungslos werden, bekommen sie die Rolle, die die Pläne
real haben (Ward-Smith: ~0,1 s je Wechsel zwischen „flat out" und „sicher" — auf unsere
Uhr, Bein ~1,7 s statt ~9 s, Faktor ~5,3: **~0,02 s**):

| Plan | heute | Vorschlag | Wirkung am Wechsel (Startwerte) |
|---|---|---|---|
| Halten → **Sicher** | tempo 0,94 | tempo 1,00 | Verlust +0,02 s, Patzerchance ×0,5 |
| Angehen → **Normal** | tempo 1,00 | tempo 1,00 | wie heute |
| Schlussmann → **Volles Risiko** | tempo 0,90 | tempo 1,00 | Verlust −0,02 s, Patzerchance ×1,8 |

Das ist dieselbe Denkfigur wie die Rennplan-Ansage (`planWechsel`): reine Zahlen, die der
Motor je Wechsel liest, kein neuer Zustand. Chris kann dann *am Wechsel* eingreifen — das
ist die Entscheidung, die eine Staffel real hat.

### 3.3 K3 — Patzer seltener, aber angeschrieben (gemessen)

`WECHSEL_PATZER` 0,22 → 0,11 (E2b + PATZ): **0,906** (0,143) / Saison 0,881; Paare ≥ 15 Pkt
richtig **99,3 %**. Das ist die beste Einzelspielzahl aller Kopien und kostet nichts —
der Patzer bleibt, halb so oft. Größenordnung gegen real: bei 9 % je Wechsel haben 36 % der
Rennen einen Patzer; real fallen 21 % der *Teams* aus (≈ 4,6 % je Wechsel bei fünf Wechseln,
bzw. 7,6 % bei drei). Halbiert (≈ 4,5 % je Wechsel) liegen wir bei der realen Quote — nur
ist unser Patzer mild (0,5–0,9 s), nicht tödlich. Ob es daneben ein *echtes* DNF geben soll
(1–2 % je Rennen, Team scheidet aus), ist Frage 2 in Teil 6 — für die Rangtreue der Läufer
ist es neutral, solange es über das Konto beiden Beteiligten angeschrieben wird und der
Rest des Teams seine Etappenzeit behält.

### 3.4 K4 — Der Wechsel als Gewinn: fliegender Start im Konto

Das ist die Mechanik, die die Staffel von einem Sprint mit sechs Startern unterscheidet, und
sie ist heute nicht da. Vorschlag, der **keinen** neuen Zufall einführt (Lehre aus dem
Hockey-Zoneneintritt) und die Etappenzeit über Beine vergleichbar hält:

```
// WECHSEL u → v, im Block bei `naechster` (engine.js:15263 ff.)
Q     = 0.45·(u.TECHNIK+v.TECHNIK)/200 + 0.30·u.ENDTEMPO/100 + 0.25·v.ANTRITT/100
        // 55 % Tempo (Zarębska/China 2025: Einlauf r −0,60, Anlauf r −0,50), Rest Technik
gewinn = FLIEG_MAX · Q                 // FLIEG_MAX ≈ 0,16 s: real 0,94 s von 9,8 s (9,6 %) eines 1,7-s-Beins
verlust = wie heute (WECHSEL_MAX − koennen·WECHSEL_K), Patzer wie K3
netto   = gewinn − verlust             // gut: +0,12 s, mittel: ±0, schlecht: −0,25 s
v.startT = rennT − netto·0,65          // der Annehmende "hat schon Tempo" — er startet in der Uhr früher
v.etappenZeit wird um `netto` bereinigt (wie heute um wechselVerlust), damit die Etappe
   ein Stand-Start-Maß bleibt; `netto` geht je zur Hälfte in u.wechselKonto und v.wechselKonto.
```

Damit haben erstmals Kanäle: ENDTEMPO des Abgebers über sein Bein hinaus (stamina/will),
ANTRITT des Annehmers vor seinem Bein (speed/spirit), TECHNIK beider (awareness/dexterity/
charisma). Bein 1 startet aus den Blöcken (kein Gewinn) — das ist real, und weil der
Gewinn ins Konto geht und nicht in die Etappe, entsteht daraus **kein** Bein-Bias.
Erwartung: rho bleibt in der Nähe von K1–K3 (das Konto trägt heute schon +0,08), die
Spannweite zwischen Varianten kann steigen, weil TECHNIK-Paare nun sichtbar werden. Zu
messen, nicht zu behaupten.

### 3.5 K5 — Tote Kanäle wecken, ohne die Uhr zu verlängern

- **WUCHT → ZONE** (spirit 45, charisma 33, speed 22): der Sub-Skill, der `Q` in K4 den
  Absprache-Anteil liefert (Bry 2009: Kooperation → +30 cm/s Stabgeschwindigkeit). Damit
  sitzen spirit 16 und charisma 10 der Matrix in einem Kanal, der Zeit bringt, statt in
  einem, der Reserve verbilligt, die niemand verbraucht.
- **STEHEN**: statt Ermüdung auf einem 1,7-s-Bein (heute 0,05) die **variable Beinlänge**
  aus dem Sport: der Annehmende darf bis zu 20 % des Beins des Abgebers „entgegenlaufen"
  (Livingston: 80–120 m) — wer Stehvermögen hat, trägt den Stab tiefer in die Zone und
  entlastet den Nachfolger. Das ist eine Entscheidung je Wechsel (Plan!), keine
  Dauerermüdung. Alternativ, billiger: `muedGrad` für die Staffel auf 0 und STEHEN aus
  der Wertung nehmen (die Matrix bepreist stamina 16 — das gehört dann in ENDTEMPO).
- **ROBUST** bleibt, was es ist: senkt die Patzerchance. Mit K3 ist das ein sichtbarer
  Kanal (Paare 99 %).
- **Konstanz-Stat**: existiert im Projekt nur als Vorschlag
  (`battle-mode-gameplay-grundmodell.md` Teil C, Traits → Zahl, nicht gebaut; Formkarten-
  Streufaktor `0,4 + 1,2·(1−K/100)`). Für die Staffel ist heute **ROBUST = „Verlässlichkeit"**
  der Konstanz-Kanal, und er reicht. Empfehlung: nicht darauf warten; wenn das Konstanz-Stat
  kommt, hängt es an der Patzerchance, nicht an der Etappe.

### 3.6 K6 — Kurve und Feld: was NICHT zu drehen ist (gemessen)

| Kopie | rho je Spiel | Spannweite | Befund |
|---|---:|---:|---|
| E2b + `tempoSpanne` 0,90 → 0,45 (S3 aus der Bahn-Recherche) | 0,828 | 0,309 | **schlechter** — ein gestauchtes Feld macht Patzer und Wechsel lauter, ohne dass sie mehr Können tragen |
| E2b + `KURVE_KOSTEN` 0,12 → 0,20 | 0,847 | 0,193 | innerhalb des Rauschens; WENDIGKEIT trägt mit 0,12 bereits 0,675 |

Die Kurve ist damit *fertig genug*; der Vorschlag S3 der Bahn-Recherche ist zurückzuziehen.

### 3.7 Der Soll-Abgleich Matrix ↔ Kanäle (womit die Sondierung nach dem Umbau zu vergleichen ist)

| Attribut | Matrix | heutiger Kanal | Ziel nach K1–K5 |
|---|---:|---|---|
| speed | 24 | ANTRITT/ENDTEMPO (lebendig), WENDIGKEIT, WUCHT (tot) | Tempo + Anlaufgewinn (K4) |
| stamina | 16 | ENDTEMPO (lebendig), STEHEN (tot), ROBUST | Einlaufgewinn des Abgebers (K4), Beinlänge (K5) |
| spirit | 16 | ANTRITT (lebendig), WUCHT (tot), ROBUST | ANTRITT + ZONE (K5) |
| awareness | 12 | TECHNIK (halb), WENDIGKEIT (Kurve) | Übergabepunkt in Q (K4), Kurve |
| charisma | 10 | TECHNIK (halb), WUCHT (tot) | Absprache in ZONE/Q |
| dexterity | 8 | TECHNIK (halb), WENDIGKEIT | Hand in Q, Kurve |
| will | 8 | ENDTEMPO, STEHEN (tot) | ENDTEMPO, ROBUST (Patzer) |
| determination, health | 4, 2 | STEHEN/ROBUST | ROBUST |

Messwerkzeug danach: dieselbe Sonde (`staffel-diagnose2.mjs`, Spalte „rho(sub, −Etappe)")
— kein Sub-Skill darf unter 0,25 bleiben, und rho(eig, Tempo-Mix) muss über 0,95 liegen.

### 3.8 Nachtrag: die Kadergrößen, die der Saisonplan wirklich würfelt

`buildSeasonPlayerCount` (`lib/season/season-discipline-schedule.ts:64–75`) würfelt je
Disziplin und Saison 2–6 je Seite; trifft der Wurf die Basis der Disziplin (Staffel:
`playerCount: 3`, `lib/data/dataAdapter.ts:63`), wird um ±1 verschoben. Eine Staffel läuft im
echten Spiel also mit **2, 4, 5 oder 6** Läufern je Seite (≈ 30 / 30 / 20 / 20 %), nie mit
3. Die Sonde misst standardmäßig 6. Nachgemessen mit `--je-seite` (n = 24, dieselbe Familie):

| je Seite | Basis (= Repo) | K1 (E2b) | K1+K2+K3 |
|---:|---:|---:|---:|
| 2 | **0,138** (Spannweite 1,550; eine Variante −0,683) | 0,883 (0,348) | **0,950** (0,306) |
| 4 | 0,633 (0,602) | 0,879 (0,281) | **0,948** (0,131) |
| 6 (Standard) | 0,681 (0,398) | 0,858 (0,212) | **0,915** (0,089) |

Zwei Dinge daraus. Erstens: **die heutige Staffel ist bei zwei je Seite praktisch eine
Lotterie** (vier Werte, Bein-Bias durch die Pläne, Rezept gegen Matrix) — und das ist die
häufigste Kadergröße. Zweitens: die Kopplung ist bei jeder Größe die Antwort, und der
Vorschlag hält die 0,80 bei allen drei gemessenen Größen mit Abstand. (Die Zeilen 2 und 4
sind reine rho-Werte; die Star-/Paar-Statistik der Sonde lief dort noch mit sechs.)

### 3.9 KI-Aufstellung

Die Ersatzaufstellung (`bauSpurt`, `:14775`) sortiert nach Eignung und setzt Slot 0 =
startrunner mit dem Besten — das entspricht zufällig Ward-Smiths Modell (Schnellster auf
Bein 1). Nach K4 ist die richtige Regel: bester ANTRITT auf Bein 1 (Blockstart, kein
Anlaufgewinn), bestes TECHNIK-Paar an die Wechsel 2/3 (die Kurvenwechsel), Anker nach
ENDTEMPO. Effekt real 0,06 s — bewusst klein halten.

---

## 4. Assets und Optik — was da ist, was fehlt

Geprüft: `public/sprites/baukasten/README.md` und `quellen.json` (LPC-Satz, 209 Blätter
+ weibliche Körper), `public/sprites/arena/` (Bahn-Kachel, Zaun, Bäume), `public/sprites/
football/quellen.json` (Kenney-Sportpaket, CC0), `bodenSpurt`/`zeichneSpurt`
(`engine.js:14233`, `:15356`), `app/foundation/discipline-stage/arena/disciplines/track.tsx`.

| Element | Stand | Befund |
|---|---|---|
| Läufer laufend | LPC `run`/`walk` für Körper, Kopf, Haar, Stoffkleidung — ja; Waffen/Umhang/Platte ohne `run` (README) | ausreichend; Staffelläufer tragen keine Waffe |
| **Wartende Läufer** | stehen an ihrer Marke, werden aber mit `vx:4` gezeichnet (`:15363`: `vx:u.stolper>0?0:4`) — **sie laufen auf der Stelle** | `idle`-Blatt existiert (`k_idle`, `kw_idle`, `g_idle`); ein `vx:0` für `!u.aktiv` genügt — **kein neues Asset** |
| **Staffelstab** | kein Prop. `t_stab` im Baukasten ist ein Zauberstab (LPC „gnarled staff", 192-px-Thrust-Blatt) — falsch; Kenney-Sportpaket (CC0, bereits für Football/Basketball genutzt) listet Fußball/Tennis/Football/Basketball/Baseball/Golf/Bowling/Dodgeball, **kein belegter Leichtathletik-Inhalt** | ein Stab ist ein 10×3-px-Rechteck in Teamfarbe an der Hand des Aktiven (Handpunkte sind nach `sprite-handpunkte.md` bekannt) — **3 Zeilen Canvas, kein Download**; beim Wechsel springt er zum Nachfolger, der Schwebetext „Stab weiter" existiert bereits |
| **Wechselzone** | nicht gezeichnet; `hindernisse:[]`. Der Markerzeichner in `bodenSpurt` (`:14313 ff.`) kennt Hürde/Kurve/Griff je `hindernisWort` | Zonen als `hindernisse` an den fünf `beinVon`-Marken eintragen (Motor prüft dort nichts, weil `staffel` den Hürdenblock nicht erreicht — zu verifizieren) und ein vierter Zweig `hindernisWort:"Wechsel"`: zwei gelbe Querstriche mit 30-m-Band dazwischen — **gering** |
| Vier/sechs unterscheidbare Läufer | heute zwei Bahnen, alle Läufer eines Teams auf derselben Bahn, gestaffelt an ihren Marken; Name und Plan über dem Kopf | ausreichend; Bein-Nummer als kleines Badge (1–6) am Wartenden wäre die eine sinnvolle Ergänzung |
| Bahnbild | geteiltes `bodenSpurt` (Ocker-Kachel, Zaun, Bäume) | wie 17 andere Disziplinen; kein eigenes Bild nötig für die Abnahme |
| Produktion (`track.tsx`) | Oval mit Token je Team, Ghost-Marker, **Handoff-Funke existiert** (`handoffActive`) | unabhängig vom Mockup; keine Änderung durch diesen Vorschlag |

Kurz: **kein Asset zu beschaffen.** Drei kleine Zeichenänderungen (idle für Wartende, Stab
in Canvas, Zonenmarker) machen die Staffel erkennbar; Lizenzfragen entstehen nicht.

---

## 5. Aufwand: Rezept-Fix im Bahn-Chassis gegen eigenes Chassis

**Eigenes Chassis** hieße: eigene `bau*/step*/zeichne*`-Funktionen, `MOTOREN`-Anmeldung,
Sonde, Zeichnung, Ansage-Bedienung — der Weg von Tennis/Fechten (dort zwingend, weil das
Feldspiel/die Arena die Mechanik *falsch* abbildeten). Hier ist das Chassis **richtig**: die
Staffel ist ein Rennen mit Abschnitten, und alles Staffelspezifische liegt bereits in
~70 gegateten Zeilen (`grep -c staffel`). Die Decke (0,776) sitzt nicht im Chassis, sondern
in einer Zeile, die das Chassis für alle fünf Bahnen teilt. **Empfehlung: Rezept-Fix.**

| # | Schritt | Aufwand | Abnahme | Chris entscheidet |
|---|---|---|---|---|
| 1 | K1 Eignungskopplung (`bauSpurt`, `art.staffel`-gated) + K2 Pläne `tempo:1.00` | **gering** (≈ 10 Zeilen) | `miss-alle-disziplinen.mjs 24 staffel` ≥ 0,85; Spurt/Zeitfahren/Klettern/Takeshi bit-identisch; Basislinie neu bauen | ob die Kopplung auch für Spurt/Takeshi kommt (Frage 1) |
| 2 | K3 `WECHSEL_PATZER` 0,11 | **trivial** | ≥ 0,88; Patzer je Wechsel ≈ 4–5 % (Sonde) | DNF ja/nein (Frage 2) |
| 3 | Optik: idle für Wartende, Stab, Zonenmarker, Bein-Badge | **gering** (≈ 40 Zeilen Canvas) | Sichtprüfung `scripts/zeige-feldspiel-arena.mjs`-Pendant für die Bahn bzw. Screenshot | Abnahme des Bildeindrucks |
| 4 | K2b Pläne als Wechselrisiko | **gering** | Sondierung: Plan „Sicher" senkt Patzer, kostet 0,02 s; rho unverändert ±0,03 | Bezeichnungen |
| 5 | K4 fliegender Start im Konto, K5 WUCHT → ZONE | **mittel** (≈ 60 Zeilen, ein neuer Datenblock) | rho ≥ 0,85 gehalten; `rho(sub, −Etappe)` für TECHNIK/ZONE > 0,25; Zielabstand ≤ 0,7 s; Wechsel kippt 5–10 % der Rennen (real: „a well-skilled team … faster than four faster athletes") | Größe `FLIEG_MAX` |
| 6 | K5 variable Beinlänge (STEHEN) | **mittel** | wie 5 | ob überhaupt (Frage 4) |
| 7 | Kadergröße 5 nachmessen (`--je-seite=5`; 2/4/6 s. 3.8) und die Abnahme auf „≥ 0,80 bei 2, 4, 5 und 6" festschreiben wie beim Gewichtheben | gering | rho je Größe berichtet | ob eine 2er-Staffel bleibt, ob `playerCount` 4 wird (Frage 5) |
| 8 | Produktivierung (`ARENA_RESOLVED_DISCIPLINE_IDS`, PPS-Referenz) | hoch, eigener Auftrag | wie Hockey/Gewichtheben | — |

Reihenfolge-Regel wie bei Football: erst Mechanik (1–2, dann 5), dann Rezept-Feintuning;
nie zwei Eingriffe in einer Messung.

---

## 6. Offene Fragen an Chris

1. **Eignungskopplung nur für die Staffel oder für alle fünf Bahnen?** Die Bahn hat den
   Konstruktionsfehler bewusst behalten und dich gefragt (`engine.js:14805`). Für die
   Staffel ist die Antwort gemessen (+0,18). Spurt (0,652) und Takeshi (0,697) sind die
   nächsten Kandidaten, aber ungemessen.
2. **Soll es ein echtes DNF geben?** Real 21 % der Finals. Vorschlag: ja, aber selten
   (1–2 % je Rennen), als Drama; für die Läuferwertung neutral über das Konto. Alternativ
   nur der milde Patzer wie heute, halb so oft.
3. **Wer läuft Bein 1?** Ward-Smith sagt der Schnellste, die Trainerpraxis sagt „der
   sichere Starter, der Schnellste als Anker". Die KI-Aufstellung folgt heute der Eignung
   (= Ward-Smith). Nach K4 wäre „bester ANTRITT vorn, bester ENDTEMPO hinten" die
   sportliche Regel — soll die KI das, oder bleibt der Anker der Star (Spielgefühl)?
4. **Variable Beinlängen (K5) — ja oder nein?** Real und der einzige ehrliche Kanal für
   Stehvermögen; kostet aber eine sichtbare Änderung an den Marken.
5. **Die Kadergröße:** der Saisonplan würfelt je Disziplin 2–6 je Seite, und für die
   Staffel (`playerCount: 3`) verschiebt er eine 3 immer auf 2 oder 4
   (`season-discipline-schedule.ts:64–75`). Eine Staffel läuft im echten Spiel also mit 2,
   4, 5 oder 6 Läufern je Seite — nie mit 3, und in 30 % der Saisons zu **zweit**. Ist das
   gewollt? Heute liest die Zweier-Staffel rho **0,138** (Teil 3.8); mit dem Vorschlag
   0,950. Unabhängig davon: soll `playerCount: 3` für eine Staffel bleiben, oder ist 4
   (vier Beine wie im Sport) die ehrlichere Basis?
6. **Konstanz-Stat** (`grundmodell` Teil C): bleibt es bei ROBUST als Verlässlichkeit, oder
   soll das Trait-basierte Stat kommen — dann als Patzer-Modulator, nicht als Tempo?

---

## 7. Was ich nicht geprüft habe / Methodik

- Alle Kopien liegen im Scratchpad und sind **nicht** committet; der Motor im Repo ist
  unverändert (`git status` sauber außer diesem Bericht). Die Patches sind in Teil 3
  wörtlich abgedruckt, damit die Umsetzung sie nicht neu erfinden muss.
- K4/K5 sind **nicht gemessen** — sie sind die sportliche Mechanik, die auf der gemessenen
  Grundlage K1–K3 aufsetzt. Ihre Erwartung („rho gehalten, Wechsel kippt 5–10 %") ist
  Prognose, keine Zahl.
- Die Sub-Skill-Korrelationen sind Spearman gepoolt über Varianten; eine echte
  Sinkhorn-Sondierung (`einflussVon`/Pp) für die Bahn habe ich nicht gefahren, weil
  `baue-feldspiel-rezept.mjs` die Bahn nicht kennt (Handbuch 7, Schritt 7).
- `spiele()` und `disziplinProbe` ziehen die Formkarten unterschiedlich (0,713 gegen
  0,681 auf demselben Maß) — die Post-hoc-Tabelle in 1.4 ist in sich konsistent, aber
  nicht auf die Nachkommastelle mit der Basislinie vergleichbar.
- Ward-Smith & Radford 2002 selbst habe ich nicht erneut abgerufen; die Zahlen daraus
  stammen aus `bahn-disziplinen-recherche-fable.md` (dort Tab. 4/8/12/13 aus dem PDF) und
  sind in Zarębska 2021 und dem Review 2025 unabhängig zitiert. Das Scientific-Reports-Papier
  2025 (China, Zonenzeit-Regression) war nur als Abstract erreichbar (Cookie-Redirect).
- Livingston-Leitfaden Teil III (Coaching Points, Checkmark-Distanzen) lag nicht im
  abgerufenen PDF.

## Quellen

- Zarębska, Kusy, Włodarczyk, Osik, Zieliński (2021): *Effective baton exchange in the 4x100 m
  relay race*, Acta Kinesiologica 15, Supp. 1, S. 27–31 — akinesiologica.com (PDF, Volltext)
- Roșculeț, Tomescu, Dulceață (2025): *A review of baton passing strategies in 4x100 m relay*,
  Analele UNEFS — analefefs.ro (PDF, Volltext)
- Livingston AC: *An Introductory Guide to 4 x 100m Relay Racing*, Teil I (Team Selection) und
  Teil II (Rules) — livingstonac.com (PDF, Volltext)
- Ward-Smith & Radford (2002): *A mathematical analysis of the 4×100 m relay*, J Sports Sci 20:
  369–381 — über `docs/design/bahn-disziplinen-recherche-fable.md` und die beiden obigen
- Radford & Ward-Smith (2003): *The baton exchange during 4x100 m relay: a mathematical
  analysis*, J Sports Sci — zitiert in beiden obigen
- Wikipedia: *4 × 100 metres relay* (Zone seit 2017, „2–3 seconds faster", DQ „common")
- Suchergebnisse (nicht selbst gelesen): Bry et al. 2009 (Kooperations-Priming, +30 cm/s);
  Scientific Reports 2025 s41598-025-20829-6 (Abstract); sprintingworkouts.com,
  seanbernstein.com (Zonenstruktur, „second leg strongest")
- Repo: `CLAUDE.md`, `docs/design/stand-aller-disziplinen.md`,
  `docs/design/bahn-disziplinen-recherche-fable.md`, `docs/design/messgrundlage-kaderfest.md`,
  `docs/design/tennis-fechten-buehne-umsetzung.md`, `docs/design/neue-disziplin-handbuch.md`,
  `docs/design/neue-disziplin-assets.md`, `docs/design/battle-mode-gameplay-grundmodell.md`,
  `public/mockups/battle-mode.engine.js`, `scripts/lib/rangtreue-messung.mjs`,
  `lib/season/season-discipline-schedule.ts`, `lib/data/dataAdapter.ts`

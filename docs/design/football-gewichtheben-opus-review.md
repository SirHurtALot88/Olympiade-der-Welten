# Football + Gewichtheben: Opus-Review

Stand 04.09.2026, Branch `claude/football-gewichtheben-opus-review`, abgezweigt von
`origin/main` `f5dcf306` (enthält PR #763 Gewichtheben und PR #764 Football, beide gemerged).
Auftrag von Chris, wörtlich: „Kannst du bitte Hockey und football und gewichtheben soweit
fertig machen dass man damit erstmal zufrieden sein kann inkl review von opus etc" — dies ist
das angeforderte Review für zwei der drei Disziplinen. Dazu zwei direkte Fragen von Chris:
„gewichtheben wie sieht es aus mit gameplay?" und „football feld? assets? Monument?
Aufstellungen usw".

**Reines Review — keine Zeile Motor-Code geändert.** Jede Zahl unten ist entweder in dieser
Runde selbst nachgemessen (mit dem Befehl, der sie erzeugt hat) oder aus einer benannten
externen Quelle. Was ich gefunden habe und nicht selbst repariert habe, steht in Abschnitt C
als Liste.

---

## Kurzfassung

| Frage | Antwort |
|---|---|
| **Gewichtheben-Gameplay** | **Ja, das ist ein guter erster Abschluss.** rho 0,887 unabhängig nachgemessen und exakt reproduziert. Die umstrittene Entscheidung (`HEBEN_TAGESMAX_ANSAGE_K=0,0045`) ist **haltbar** — die „±22 %" sind ein theoretischer Endpunkt, den kein Spieler im echten Kader erreicht; real sind es **6,8 % je Standardabweichung** und ±10 % zwischen dem 10. und 90. Perzentil. Das liegt **unter** dem, was die Sportpsychologie für einen einzigen akuten Psych-up misst (Tod et al. 2005: +11,8 %). **Empfehlung: Variante B behalten**, aber die Größe im Code umbenennen (s. B.5). |
| **Football-Feld** | Vektoriell gezeichnet, korrekt proportioniert, zwei Endzonen, Yard-Linien alle 10 Yards, Mittellinie. **Für ein Mockup in Ordnung.** Es fehlen Hash Marks, Yard-Zahlen und Torstangen (Letztere bewusst weggelassen). |
| **Football-Assets** | Ball (Kenney, CC0) wird gezeichnet und sitzt am gemessenen Handpunkt. Drei Helm-Sprites sind geladen, aber **nicht gezeichnet** — die Absage in PR #764 ist fachlich korrekt begründet, und der Nebenbefund („die Helme sind fast konturlose weiße Ringe") entwertet den Nutzen ohnehin. Trikot/Schulterpolster: die Suche in `football-assets.md` ist gründlich und der Nullbefund glaubwürdig. |
| **Football-Aufstellungen** | Formationen sind gemessen sauber getrennt (0,5 % der Frames unter 24 px — **unabhängig auf drei Saaten reproduziert**) und treffen die reale NFL-Tendenz erstaunlich genau. **Aber: während eines Spielzugs bewegt sich AUSSCHLIESSLICH der Ball, kein Spieler.** Das ist eine bewusste Entwurfsentscheidung im Code, steht aber in keinem der drei Football-Berichte im Fazit — für Chris' Frage „Aufstellungen usw" ist es die wichtigste Auskunft (s. B.4). |
| **„Monument"** | **Kein Treffer im ganzen Repository** — nicht im Code, nicht in `docs/`, nicht in den Assets, nicht in den Bug-Reports. Ich rate nicht, was gemeint war (s. B.1). |
| **Football gesamt** | **Optisch/strukturell ja, mechanisch nein.** rho je Spiel 0,460, unabhängig reproduziert — „durchgefallen" nach der eigenen Nomenklatur des Projekts, und das sagen die Berichte auch selbst. Als „erster Wurf, den man sich anschauen kann" trägt es; als spielreife Disziplin nicht. |
| **Gefundene Mängel** | Vier, keiner davon ein Absturz: eine sichtbar zu kurze Field-Goal-Flugbahn (C.1), ein toter `down`-Parameter in drei Entscheidungsfunktionen (C.2), eine veraltete Kalibrierungs-Notiz im Gewichtheben-Motor (C.3) und — der praktisch wichtigste — **`docs/design/stand-aller-disziplinen.md` trägt für Football noch die alte Zahl 0,305 statt 0,460** (C.4). |

---

## 0. Was ich unabhängig nachgemessen habe

Nichts unten ist aus einem Bericht übernommen. Alle Läufe auf `origin/main` `f5dcf306`,
kaderfest gegen `data/generated/kaderfamilie-live-save.json` (fünf echte Team-Paarungen,
110 Spieler, Quelle „Oly New Game Custom 19.8.2026").

```sh
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben basketball football
node scripts/miss-football-korridor.mjs 120
```

| Größe | Bericht sagt | Ich messe | Deckung |
|---|---:|---:|---|
| Gewichtheben rho je Spiel (jeSeite 6) | 0,887 / Spanne 0,224 | **0,887 / 0,224** | exakt |
| Gewichtheben rho Saison | 0,944 | **0,944 / 0,261** | exakt |
| Gewichtheben Variante A (`K=0`) | 0,720 / 0,223 | **0,720 / 0,223** | exakt |
| Basketball (Kontrolle) | 0,757 / 0,102 | **0,757 / 0,102** | exakt |
| Football rho je Spiel | 0,460 / 0,258 | **0,460 / 0,258** | exakt |
| Football rho Saison | 0,692 / 0,196 | **0,692 / 0,196** | exakt |
| Football-Korridor (alle 14 Zeilen) | s. `football-rezept-kalibrierung.md` 3.4 | **Zeile für Zeile identisch** | exakt |
| Football-Formationsabstand (`diagAbstaende`, Saat 1337) | 32,6 px / 0,5 % unter 24 px | **32,6 px / 0,5 %** | exakt |

Die Variante-A-Gegenprobe habe ich selbst gefahren (Konstante per `sed` auf `0`, gemessen,
Datei aus einer Sicherung zurückgestellt, `git status` danach sauber) — **die entscheidende
Zahl dieser ganzen Gewichtheben-Runde ist damit unabhängig bestätigt, nicht geglaubt.**

Zusätzlich habe ich die Formationsmessung auf **zwei weiteren Saaten** wiederholt, die in
keinem Bericht vorkommen (4711: 0,5 % unter 24 px; 90210: 0,2 %) — die 0,5-%-Zahl ist kein
glücklicher Einzelwurf.

**CI von PR #764:** alle drei Läufe grün (`full-test-suite`, `test-and-smoke`,
`persistenz-suiten`, GitHub Actions Run 33838020521). Das relativiert die in beiden Berichten
sehr breit ausgeführten `npm test`-Probleme: die Suite ist **auf der CI durchgelaufen**, sie
scheiterte nur lokal an der Drei-Agenten-Last. Die Berichte hätten das prüfen können und tun
es nicht — kein Fehler, aber eine unnötige Sorgenfalte für Chris.

---

# Teil A — Gewichtheben

## A.1 Die Frage, um die es geht

`HEBEN_TAGESMAX_ANSAGE_K = 0,0045` (`battle-mode.engine.js:10017`) lässt seit Commit
`575b6ddd` das Selbstvertrauen eines Hebers seine **Hebe-Obergrenze** skalieren:

```js
u.tagesmax = (HEBEN_KG_BASIS + u.LAST*HEBEN_KG_PRO_LAST) * (1 + (u.ANSAGE-50)*HEBEN_TAGESMAX_ANSAGE_K);
```

Vorher (Variante A) hing `tagesmax` allein an `LAST` (power 60 / health 25 / determination
15), und `ANSAGE` (charisma 60 / power 15 / speed 25) wirkte nur auf Eröffnungshöhe,
Sprunggröße und den Risiko-Maßstab — also nur auf die **Erfolgswahrscheinlichkeit innerhalb**
eines physisch festen Fensters.

Der Bericht rechnet vor: ANSAGE 99 gegen ANSAGE 1 sind ±22 % auf die Obergrenze. Das klingt
nach viel. Es ist die Zahl, an der sich das Review entscheidet.

## A.2 Was die Änderung mechanisch WIRKLICH tut — der Punkt, den beide Berichte nicht sauber ausschreiben

Ich habe die Formeln durchgerechnet statt sie zu lesen. Das Ergebnis ist wichtiger als die
±22 %:

Die Ansage ist `kg ≈ anteil × max(u)`, wobei `max(u)` (`maxReissen`/`maxStossen`) direkt aus
`tagesmax` folgt. Das Risiko wird gegen `risikoMax = max(u) × (1 + (ANSAGE-50)×FLEX)`
gerechnet. Also:

    ueber = kg/risikoMax − 1 ≈ anteil/(1 + FLEX×(ANSAGE−50)) − 1

**Der `tagesmax`-Faktor kürzt sich in dieser Quotienten heraus.** Variante B verändert die
Erfolgswahrscheinlichkeit also **gar nicht** — sie skaliert ausschließlich die
**Kilogramm-Zahl am Ausgang**, und die ist genau das, was `MOTOREN[...].wert()` liest und
womit rho gemessen wird.

**Das lässt sich an den eigenen Zahlen des Berichts nachprüfen**, und es geht auf: in der
Korridor-Tabelle (`gewichtheben-zufriedenstellend.md` Abschnitt 2) sind der 1. und 2. Versuch
zwischen A und B **bit-identisch** (84,5/78,6 gegen 84,5/78,6 im Reißen), nur der dritte
Versuch bewegt sich (62,1 → 58,0 %). Genau das sagt meine Rechnung voraus: der dritte Versuch
ist der einzige, in dem eine **absolute** Kilogrammzahl von außen einfließt (`beste(gegner)+1`
im Duellstand-Zweig), also der einzige, in dem sich der `tagesmax`-Faktor nicht wegkürzt.

**Warum das für die Bewertung entscheidend ist:** Variante B ist kein zweiter, additiver
Charisma-Kanal in die Erfolgschance (das wäre Doppelzählung neben `HEBEN_WAGNIS_ANSAGE_FLEX`
gewesen, und ich habe genau danach gesucht). Sie ist eine **saubere, deterministische
Skalierung der Ausgangsgröße** — mechanisch derselbe Kanaltyp, den `LAST` schon hat.

## A.3 Die ±22 % sind nicht die Zahl, die im Spiel vorkommt

Der Bericht rechnet mit ANSAGE 1 und ANSAGE 99. Das sind rechnerische Randwerte. Ich habe
gemessen, was der **echte Kader** hergibt (110 Spieler aus dem live-save-Abbild,
`ANSAGE = 0,60·charisma + 0,15·power + 0,25·speed` nach dem Rezept):

| Größe | Wert |
|---|---:|
| ANSAGE Mittel | 44,7 |
| ANSAGE Standardabweichung | 15,2 |
| ANSAGE Spanne (min–max über 110 Spieler) | 5,3 – 74,3 |
| `tagesmax`-Faktor bei ANSAGE min / max | **0,799 – 1,109** |
| `tagesmax`-Faktor beim 10. / 90. Perzentil | **0,884 – 1,077** |
| **Wirkung je Standardabweichung ANSAGE** | **6,8 %** |

**Die ±22 % kommen im Spiel nicht vor.** Der extremste Spieler des gesamten Kaders liegt bei
−20 %, der stärkste bei +11 %. Zwischen einem typisch „mental starken" (p90) und einem typisch
„mental schwachen" (p10) Heber liegen **rund 22 % Gesamtspanne, also etwa ±10 % um die Mitte**.

Zum Vergleich, dieselbe Rechnung für `LAST`: Standardabweichung 23,7, Spanne 3,5–91,3 →
`tagesmax` von 113 bis 447 kg, ein Faktor 3,9. **`LAST` bleibt mit weitem Abstand der
Haupttreiber**, genau wie es die Matrix (power 28 gegen charisma 23) will. Nebenbefund, den
ich mitgemessen habe: `r(ANSAGE, LAST) = −0,093` auf dem echten Kader — die beiden Kanäle sind
praktisch unkorreliert, es gibt also keine versteckte Doppelzählung über die Spielerauswahl.

## A.4 Gegen die Literatur gehalten

Die Frage lautet: ist eine trait-gebundene Schwankung von **6,8 % je SD**, mit
p10–p90-Spanne von rund 22 %, für die maximale Wettkampfleistung eines Hebers zu groß?

**Nein — sie liegt eher am unteren Rand des Gemessenen.**

**Akute Zustandseffekte (state), dieselbe Person, derselbe Tag.** Die sauberste Zahl kommt von
Tod, Iredale, McGuigan, Strange & Gill (2005): 20 trainingserfahrene Probanden, maximale
isokinetische Bankdrückkraft unter drei Bedingungen. „Psyching-up" gegen Ablenkung ergab
**+11,8 %** (95-%-KI 6–18 %), gegen ein Aufmerksamkeits-Placebo **+8,1 %** (KI 3–13 %)
([PubMed 16095409](https://pubmed.ncbi.nlm.nih.gov/16095409/); Vorläufer-Übersicht:
Tod, Iredale & Gill 2003, *Sports Medicine*,
[Springer](https://link.springer.com/article/10.2165/00007256-200333010-00004)). Eine neuere
systematische Übersicht bestätigt die Richtung: **65 % der Versuche** finden eine Steigerung
der maximalen Kraftproduktion durch Psyching-up
([Übersicht 2023](https://www.researchgate.net/publication/376086631_The_Effects_of_Psyching-Up_on_Maximal_Force_Production_A_Systematic_Review)).

**Der Extremwert der Literatur.** Ikai & Steinhaus (1961), *Journal of Applied Physiology* —
die klassische „Disinhibitions"-Studie: isometrische Ellbogenbeugung unter Zuruf, Schuss,
Alkohol, Adrenalin und Hypnose, mit gemessenen Veränderungen von **+26,5 % bis −31 %**
([Journal of Applied Physiology](https://journals.physiology.org/doi/abs/10.1152/jappl.1961.16.1.157)).
Diese Zahl ist methodisch umstritten und darf nicht als Zielwert genommen werden — sie zeigt
aber, dass selbst die aggressivste je publizierte Schätzung des psychischen Kraftanteils die
**volle Spanne** unseres Modells (0,80–1,11) nicht überschreitet.

**Der Trait-Zusammenhang.** Moritz, Feltz, Fahrbach & Mack (2000), Meta-Analyse über 45
Studien und 102 Korrelationen: mittlere Korrelation zwischen Selbstwirksamkeit und
Sportleistung **r = 0,38**
([PubMed 10999265](https://pubmed.ncbi.nlm.nih.gov/10999265/)); neuere Meta-Analysen im
Hochleistungssport bestätigen den Befund
([PMC12352364, 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12352364/)). Ein r von 0,38
zwischen einer Persönlichkeitsgröße und der Leistung entspricht — bei einer Leistungsstreuung
in der Größenordnung, die unser Kader hat — **genau der Art moderater Verschiebung, die 6,8 %
je SD beschreibt**.

**Die entscheidende Unterscheidung, die den Ausschlag gibt.** Die Tod-Zahlen sind
*Zustands*-Effekte: dieselbe Person, dieselbe Woche, nur eine andere Vorbereitungsroutine.
Unser `ANSAGE` ist aber ein **Merkmal** — es unterscheidet zwei *verschiedene* Athleten. Der
Unterschied zwischen einem Heber, der über Jahre in jedem Wettkampf über seiner Trainingsform
öffnet, und einem, der auf der Bühne regelmäßig einbricht, umfasst neben der Tagesform auch
Trainingsbereitschaft im Grenzbereich, Technikstabilität unter Last und Ansage-Mut. Dass ein
solcher **Merkmals**-Unterschied etwa doppelt so groß ausfällt wie eine einmalige
**Zustands**-Manipulation im Labor, ist die konservative Erwartung, nicht die kühne.

**Fazit A.4: 6,8 % je SD sind sportwissenschaftlich unauffällig.** Wäre der Koeffizient
dreimal so groß (±22 % zwischen p10 und p90 *je Seite*, also eine Gesamtspanne um 60 %),
würde ich abraten. Bei 0,0045 nicht.

## A.5 Die eine Sache, die ich anders machen würde: die Benennung, nicht die Zahl

Der Code-Kommentar über der Konstante heißt „ANSAGE UND DIE **PHYSISCHE** OBERGRENZE", der
Bericht spricht von „der physischen Hebe-Obergrenze". **Das ist die einzige Stelle, an der ich
der Argumentation nicht folge** — und es ist eine Sprach-, keine Zahlenfrage.

`tagesmax` ist nach Variante B kein physiologisches 1RM mehr, sondern ein
**Wettkampf-Tagesmaximum**: was dieser Athlet an diesem Tag auf dieser Bühne tatsächlich
zustande bringt. Genau so misst es auch die Literatur — Tod misst nicht die maximale
Querschnittskraft des Muskels, sondern die abgerufene Kraft. Und genau so ist es
gewichtheben-fachlich unangreifbar: das offizielle Ergebnis eines Wettkampfs IST die abgerufene
Leistung, nicht das Potenzial.

**Empfehlung:** Konstante und Kommentar umbenennen (`HEBEN_TAGESMAX_ANSAGE_K` bleibt, aber der
Kommentar sollte „physische Obergrenze" durch „Wettkampf-Tagesmaximum (die abgerufene, nicht
die physiologisch mögliche Höchstlast)" ersetzen). Das kostet nichts, macht aus einer
angreifbaren Design-Behauptung eine belegte, und die von der letzten Runde gestellte Frage
(„gehört Selbstvertrauen auch in die physische Obergrenze?") beantwortet sich damit sauber
mit: **nein, in die physische nicht — in die abgerufene schon, und die ist die, die im Spiel
zählt.**

## A.6 Die ehrliche Gegenrede, die im Bericht fehlt

Ich empfehle Variante B, aber Chris soll das eine Gegenargument kennen, das keiner der beiden
Berichte ausspricht:

**Die rho-Messung ist an dieser Stelle teilweise zirkulär.** rho misst die Rangkorrelation
zwischen der Eignung (die per Matrix zu 23 % aus charisma besteht) und dem Spielergebnis. Ein
Attribut, das **deterministisch** in die Ausgangsgröße multipliziert, bildet sein Matrixgewicht
per Konstruktion besser ab als eines, das nur über eine gedeckelte Wahrscheinlichkeit wirkt.
Der Sprung von 0,720 auf 0,887 beweist deshalb **nicht**, dass die Mechanik realistischer
geworden ist — er beweist, dass sie **matrixtreuer** geworden ist. Dass gleichzeitig die
Pp-Abweichung von 23,1 auf 17,3 fällt und charisma bei 23,4 % gegen Matrixgewicht 23 landet,
ist keine zweite unabhängige Bestätigung, sondern **dieselbe Tatsache in einer anderen
Einheit**. Der Bericht führt beide als getrennte Belege („drei unabhängig gemessene Größen")
— das ist zu großzügig.

**Warum ich trotzdem für B bin:** die Matrix ist die Design-Absicht dieses Projekts. Wenn die
Matrix sagt „charisma soll 23 % dieser Disziplin ausmachen", dann ist ein Motor, der das
liefert, richtig — und zwar unabhängig davon, ob die Kennzahl teilweise zirkulär ist. Der Test,
der **nicht** zirkulär ist, ist der Realitätsabgleich aus A.4, und den besteht die Zahl. Beides
zusammen trägt; die rho-Zahl allein täte es nicht.

## A.7 Zwei Nebenbefunde aus dem Kader

**Die Rangfolge der Stärksten dreht sich.** Unter Variante B verliert der physisch stärkste
Heber des Kaders die Spitze:

| Heber | ANSAGE | LAST | `tagesmax` A | `tagesmax` B |
|---|---:|---:|---:|---:|
| Lava Golem | 71,3 | 86,7 | 429 | **471** |
| Draco | 70,3 | 79,2 | 401 | 438 |
| Terradon | 46,3 | 84,8 | 422 | 415 |
| **Brontar** | 31,7 | **91,3** | **447 (Rang 1)** | 410 (Rang 4) |

Das ist kein Fehler — es ist genau die beabsichtigte Aussage („der Kräftigste ist nicht
automatisch der Sieger"). Chris sollte es aber wissen, weil es sich im Spiel als „mein
stärkster Heber verliert gegen einen schwächeren" bemerkbar macht, und das ist eine
Erzählentscheidung, keine Kalibrierung.

**Die Sinclair-Obergrenze bleibt real plausibel.** Der stärkste Heber des Kaders kommt unter B
auf 471 Sinclair-kg. Talakhadzes Weltrekord liegt bei 492 — der Kader bleibt also knapp
darunter, so wie es der Motorkommentar bei `HEBEN_KG_PRO_LAST` vorsieht. Nur die Notiz selbst
ist jetzt veraltet (s. C.3).

**Und ein Faktenabgleich, den ich mitgenommen habe:** der Motor rechnet mit
`HEBEN_ANTEIL_REISSEN = 0,455` und misst 46,8 % Reißen-Anteil am Zweikampf. Real liegt das
beste Reißen bei Spitzenhebern in einer Spanne von 78–82 % des Stoßens
([Breaking Muscle](https://breakingmuscle.com/why-you-need-to-know-your-snatch-to-clean-and-jerk-ratio/)),
also 43,8–45,1 % Anteil am Zweikampf. **Unsere 46,8 % liegen knapp über dem realen Band**, aber
innerhalb des Zielkorridors 44–47 % aus Plan 6.1. Kein Handlungsbedarf, nur zur Kenntnis.

## A.8 Verdict Gewichtheben

**Ja — der Stand ist „gut genug für jetzt", und die Entscheidung soll so bleiben.**

- rho 0,887 bei jeSeite 6 unabhängig reproduziert. **Erste Disziplin dieser Runde, die die
  0,80-Schranke aus CLAUDE.md wirklich nimmt.**
- Der Mechanismus ist sauber (kein Doppelkanal, A.2), die Größenordnung sportwissenschaftlich
  gedeckt (A.4), der Korridor hält bei beiden Varianten, alle vier Archetypen führen weiter.
- Die Ein-Zeilen-Umkehr ist echt: `HEBEN_TAGESMAX_ANSAGE_K=0` genügt, kein zweiter Code-Ort
  betroffen — ich habe sie gefahren und sie liefert exakt die dokumentierten 0,720 zurück.
- **Was ich ändern würde:** nur die Benennung (A.5) und die veraltete Kalibrierungsnotiz (C.3).
  Beides Kommentararbeit, keine Zahl.
- **Was ehrlich offen bleibt** und in den Berichten korrekt benannt ist: jeSeite 4 nur 0,760,
  Techniker/Zocker sind die schwächeren Archetypen, und **S6 (Produktivierung) ist nicht
  begonnen** — `ARENA_RESOLVED_DISCIPLINE_IDS` enthält nachgeprüft weiterhin nur
  `["basketball"]` (`lib/resolve/battle-mode-arena-team-points.ts:80`). Gewichtheben ist eine
  Mockup-Disziplin; nichts davon berührt einen echten Spielstand.

---

# Teil B — Football

## B.1 Zuerst: „Monument" — kein Treffer, bitte um Klärung

Ich habe im gesamten Repository gesucht (Code, `docs/`, `public/sprites/`, `lib/`, `app/`,
Bug-Report-Branch, Git-Historie), gross-/kleinschreibungsunabhängig, auch nach den
naheliegenden deutschen und englischen Varianten. **Kein einziger Treffer.**

Ich rate deshalb bewusst nicht. Drei Möglichkeiten, die mir plausibel scheinen, damit Chris
schnell sagen kann, welche gemeint ist:

1. Ein **Stadion-/Kulissenobjekt** im Hintergrund des Football-Feldes (analog zu den
   Zuschauerstreifen beim Basketball, `bkDa("zuschauer")`)?
2. Etwas aus einem **anderen Projekt oder Chat**, das versehentlich hier gelandet ist?
3. Eine **Ehrentafel/Rekordwand** im Spiel (dafür gäbe es `docs/design/leaders-ausbau.md`, das
   aber nichts mit Football zu tun hat)?

Alles Weitere unten beantwortet die drei Fragen, die eindeutig sind: Feld, Assets,
Aufstellungen.

## B.2 Feld

`bodenFeldspiel()` (`battle-mode.engine.js:9087–9107`) zeichnet den Football-Zweig rein
vektoriell, kein Asset nötig. Nachgelesen, nicht angenommen:

| Element | Code | Real | Urteil |
|---|---|---|---|
| Außenlinie | `strokeRect(W*0.04, 50, W*0.92, H-100)` | Spielfeld inkl. beider Endzonen | korrekt |
| Endzonen | zwei Füllungen `W*0.04–0.13` und `W*0.87–0.96` | je 10 Yards, 1/12 der Gesamtlänge | **maßstäblich richtig** (0,09/1,20 = 7,5 %, real 10/120 = 8,3 %) |
| Yard-Linien | 9 Linien, `W*0.13 + W*0.74*(i/10)` | alle 10 Yards | korrekt |
| Mittellinie | betont bei `W/2` | 50-Yard-Linie | korrekt |
| Spielrichtung | links↔rechts entlang der langen Canvas-Achse | wie im TV | richtig entschieden |

**Was fehlt:** Hash Marks (die zwei inneren Punktreihen), die Yard-Zahlen („10, 20, 30 …"),
Torstangen (bewusst weggelassen, Begründung im Code plausibel: am Canvas-Rand kaum lesbar) und
5-Yard-Zwischenlinien (real gibt es eine Linie alle 5 Yards, gezeichnet ist eine alle 10).

**Urteil: für ein Mockup dieser Auflösung völlig in Ordnung.** Die Endzonenfüllung allein macht
das Feld eindeutig als American Football lesbar. Wenn Chris eine Ausbaustufe will, sind die
Yard-Zahlen der billigste sichtbare Gewinn (vier `fillText`-Aufrufe je Seite), Hash Marks der
zweitbilligste.

**Ein Konstruktionsdetail, das ich lobe:** `FIELD()` (`engine.js:5789`) erhebt genau die
Zeichen-Konstanten zur mechanischen Wahrheit, statt sie ein zweites Mal hinzuschreiben. Das ist
dieselbe Lehre wie bei `korbXVon()` und der Grund, warum Zeichnung und Mechanik hier nicht
auseinanderlaufen können. Richtig gemacht.

## B.3 Assets

**Ball: erledigt und gut gelöst.** `public/sprites/football/ball_football.png` (Kenney Sports
Pack, CC0, 14×16 px) wird gezeichnet und sitzt über den **gemessenen Handpunkten**
(`BK_HAND_LINKS`/`BK_HAND_RECHTS` aus `docs/design/sprite-handpunkte.md`) in der Hand des
Trägers, nicht vor der Bauchmitte. Vektor-Rückfall vorhanden, falls das Bild nicht lädt.
Lizenznachweis in `public/sprites/football/quellen.json`.

**Helm: geladen, aber nicht gezeichnet — und die Absage ist richtig.** Die drei Sprites liegen
in `FK_TEILE`. PR #764 hat das Overlay geprüft und **bewusst nicht gebaut**. Ich habe die
Begründung nachvollzogen und halte sie für stichhaltig, nicht für eine Ausrede:

- Ein Overlay braucht einen Kopf-Ankerpunkt. Den gibt es nur für die prozedural gezeichnete
  „Reihermech"-Klasse (`kopfX`/`kopfY`).
- Für **Vollbild**-Kreaturen (Lava Golem, Krag'Zul …) gibt es keinen — dieselbe Arbeit, die
  `sprite-handpunkte.md` für die Hockeyschläger-Hand einmal komplett durchgemessen hat, wäre
  für die Kopf-Ankerstelle erneut fällig.
- Für normale LPC-Körper-Sprites gibt es überhaupt keinen im Code berechneten Kopfpunkt.
- **Der Nebenbefund entscheidet die Sache endgültig:** laut `football-assets-check.png` sind
  die drei Helme „reine weiße Ringe ohne Detail". Selbst mit Ankerpunkt wäre der sichtbare
  Gewinn klein. Ein Sprite-Vermessungsvorhaben in der Größenordnung von `sprite-handpunkte.md`
  für einen weißen Ring auf einem Golem-Kopf ist ein schlechter Tausch.

**Urteil: die Absage ist begründet, nicht bequem.** Wenn Helme später wirklich gewollt sind,
braucht es zuerst bessere Sprites, dann erst die Ankerpunkt-Vermessung — in dieser Reihenfolge.

**Trikot/Schulterpolster: der Nullbefund ist glaubwürdig.** `football-assets.md` dokumentiert
eine echte Suche: das LPC-Generator-Repo vollständig geklont (89 353 Dateien), Dateinamen
durchsucht; OpenGameArt mit einer **Kontrollabfrage** verifiziert (`keys=sword` → 767 Treffer),
bevor die Nulltreffer als echte Nulltreffer gewertet wurden. Das ist die richtige Methodik —
die meisten „ich habe gesucht und nichts gefunden"-Berichte in diesem Repo tun das nicht. Die
beiden echten American-Football-Funde wurden geprüft und mit nachvollziehbarer Begründung
verworfen (Einzel-GIF ohne Frames, geschlossene Vektorfigur ohne separierbare Ebene).

## B.4 Aufstellungen — die wichtigste Auskunft für Chris

### B.4.1 Wie nah die Formationen an der echten NFL sind

Die Auswahl (`engine.js:5852–5853`) ist zwei Zeilen:

```js
const waehleFormationOffense=(down,toGo)=>toGo<=3?"eng":"weit";
const waehleFormationDefense=(down,toGo)=>toGo<=6?"basis":"nickel";
```

Gegen die echte NFL-Saison 2024 gehalten:

| Modellregel | Reale NFL 2024 | Urteil |
|---|---|---|
| Kompakte/„eng"-Formation (I-Formation-artig) nur bei toGo ≤ 3 | Under-Center wird 2024 **nur noch in zwei Situationen bevorzugt: innerhalb von drei Yards vor der Endzone oder bei einem Yard bis zum First Down** ([Gridiron Deep Dive](https://gridirondeepdive.substack.com/p/under-center-vs-shotgun-in-modern)) | **überraschend gut getroffen**, Schwelle nur leicht zu großzügig (3 statt 1) |
| Gespreizte/„weit"-Formation (Shotgun-artig) sonst | Shotgun war 2024 bei **62–70 % aller Snaps** ([Sharp Football Stats](https://www.sharpfootballstats.com/snap-rates--shotgun-v-under-center--off-.html), [Gridiron Deep Dive](https://gridirondeepdive.substack.com/p/under-center-vs-shotgun-in-modern)) | **passt** |
| Nickel-Defense ab toGo > 6 | Nickel ist 2024 die **De-facto-Basisformation, ~65–67 % der Defensiv-Snaps** ([CBS Sports](https://www.cbssports.com/nfl/news/heres-why-the-nickel-defense-is-the-new-base-defense-in-the-nfl), [Acme Packing Company](https://www.acmepackingcompany.com/2024/5/28/24166507/green-bay-packers-jeff-hafley-scheme-2024-nickel-base-dime-percentages-joe-barry-keisean-nixon)) | **passt in der Richtung**, Anteil vermutlich etwas zu niedrig |
| I-Formation als eine von zwei Offensivformationen | I-Formation liegt 2024 bei **unter 5 %** aller Snaps ([Gridiron Deep Dive](https://gridirondeepdive.substack.com/p/under-center-vs-shotgun-in-modern)) | für ein Zwei-Formations-Modell die einzig sinnvolle Wahl, aber sie wird häufiger gerufen als real |

**Urteil: die Formationslogik ist für ein Mockup mit sechs Feldspielern deutlich besser
recherchiert als nötig.** Die Berichte zitieren echte Quellen (Wikipedia zu
[Shotgun](https://en.wikipedia.org/wiki/Shotgun_formation),
[4–3](https://en.wikipedia.org/wiki/4%E2%80%933_defense),
[Nickel](https://en.wikipedia.org/wiki/Nickel_defense)) und die Umsetzung folgt ihnen.

### B.4.2 Ein konkreter Widerspruch zwischen Doku und Code

`football-live-migration.md` schreibt, die Shotgun-Formation setze den QB „5-7 Yards
zurückversetzt" und zitiert dafür die Wikipedia-Quelle. **Das hält der Code nicht ein.**

Nachgerechnet mit den echten Canvas-Maßen (1240 × 470, `battle-mode.html:83`): das 100-Yard-Feld
liegt zwischen `W*0.13` und `W*0.87`, also 917,6 px für 100 Yards → **9,18 px pro Yard**.

| Slot | Code | in Yards | real |
|---|---:|---:|---|
| „eng", QB unter Center | tiefe 24 px | 2,6 yd | ~1 yd — passt |
| „eng", Running Back | tiefe 80 px | 8,7 yd | I-Formation-Tailback ~7 yd — **gut** |
| **„weit", QB (Shotgun)** | **tiefe 130 px** | **14,2 yd** | **5–7 yd — mehr als doppelt so tief** |
| „basis", Linebacker | tiefe 90 px | 9,8 yd | ~4–5 yd — etwa doppelt so tief |
| „nickel", Defensive Back | tiefe 170 px | 18,5 yd | tiefer Safety 12–15 yd — plausibel |

Das ist **kein Bug** — die Tiefen sind, wie der Code selbst offen sagt, für die Lesbarkeit
gespreizt („nächster O-Mann mindestens 24 px, nächster D-Mann mindestens 30 px"). Aber der
Bericht behauptet Quellentreue an einer Stelle, an der der Code bewusst davon abweicht.
**Empfehlung: ein Satz im Code-Kommentar** („die Tiefen sind gegenüber den realen Yards um
etwa Faktor 2 gestreckt, damit sich zwölf 32-px-Figuren auf 470 px Canvas-Höhe nicht
überlagern — die *Reihenfolge* der Tiefen ist real, die *Absolutwerte* sind es nicht").

Nebenbei: die Breitenskala ist eine andere. Das Feld ist quer nur 370 px für 53,3 Yards
(**6,94 px pro Yard**), und `fkClamp` hält alle Figuren 20 px innerhalb der Seitenlinie. Ein
Wide Receiver bei `breite: 200` landet dadurch geklemmt bei rund 23,8 Yards von der Feldmitte —
was der realen Wide-Split-Position (~22–24 Yards) **sehr genau entspricht**. Der Zufall spielt
hier für uns.

### B.4.3 Die Abstandsmessung hält — unabhängig auf drei Saaten

Die Kernbehauptung von PR #764 („0,5 % der Frames unter 24 px, runter von 10–16 px") habe ich
selbst gefahren (`window.__arena.diagAbstaende(saat, 90, "football")`):

| Saat | mittlerer nächster Nachbarabstand | unter 30 px | unter 24 px | unter 18 px | unter 12 px |
|---:|---:|---:|---:|---:|---:|
| 1337 (die Saat des Berichts) | 32,6 px | 22,2 % | **0,5 %** | 0,1 % | 0,0 % |
| 4711 (neu) | 36,4 px | 10,3 % | **0,5 %** | 0,1 % | 0,0 % |
| 90210 (neu) | 31,7 px | 13,5 % | **0,2 %** | 0,0 % | 0,0 % |

**Bestätigt, und stabiler als der Bericht selbst zeigen konnte.** Eine kleine Nuance: der
Bericht liest die Spalte `zeichnung`; die Spalte `sim` (die reinen Simulationskoordinaten ohne
Zeichenversatz) steht schlechter da (1,0 % unter 24 px, 0,6 % unter 12 px). Für die Sichtprüfung
ist `zeichnung` die richtige Spalte — aber es ist erwähnenswert, dass die *mechanischen*
Positionen enger stehen als die gezeichneten.

### B.4.4 Der Befund, der in keinem Fazit steht: es bewegt sich nur der Ball

`bewegeSpielerLive()` (`engine.js:8084`):

```js
const stehtStill = fsLive.phase==="freiwurf" || fsLive.phase==="snap";
```

Football bleibt **für die gesamte Dauer von der Formation bis zum Spielzug-Ergebnis** in der
Standphase. Der Code sagt das selbst, unmissverständlich (`engine.js:8077–8081`):

> „Football bleibt fuer die GESAMTE Snap-bis-Ergebnis-Dauer in dieser Standphase (kein
> Dribbeln/Freilaufen zwischen Formation und Spielzug-Ausgang) — **nur der Ball bewegt sich**
> (animiereFootballZug), die elf ausserhalb des Balls stehen fest in Formation"

Dazu kommt: `animiereFootballZug()` interpoliert `fsBall` immer zwischen `s.losX` und `zielX`
auf **konstanter Höhe `H/2`** — auch ein Laufzug und ein kompletter Pass zu einem weit
außen stehenden Receiver laufen mittig über das Feld. Der Träger bekommt den Ball erst bei
`phase >= 0.96` per `traegerId` zugeschrieben, und die Ballposition wird **nicht** an die
Position des Trägers gebunden (nur ein kleiner Handpunkt-Versatz beim Zeichnen).

**Praktisch heißt das:** ein Football-Spielzug sieht aus wie zwölf stehende Figuren in zwei
sauberen Formationen, über die ein Ball auf einer Bogenbahn mittig hinwegfliegt und dann bei
der nächsten Aufstellung woanders wieder auftaucht. Das ist **die richtige Reihenfolge der
Arbeit** — erst die Formationen richtig hinstellen, dann sie sich bewegen lassen — und es ist
im Code bewusst und begründet so gebaut (der vorherige Versuch, sie laufen zu lassen, ergab den
„Klumpen", den Chris zu Recht beanstandet hat). Aber:

**Keiner der drei Football-Berichte nennt das in seinem Fazit.** `football-zufriedenstellend.md`
Abschnitt 8 listet als offen: die rho-Schranke, das Helm-Overlay und zwei Mechanik-Hebel — die
stehenden Spieler stehen nicht dabei. Für Chris' Frage „Aufstellungen usw" ist das aber die
Antwort, die er als Erstes sehen wird, sobald er hinschaut. Deshalb steht sie hier ganz oben in
der Kurzfassung.

## B.5 Spielzug-Wahl gegen die echte NFL

| Fenster | Modell (Laufanteil) | Real |
|---|---:|---|
| toGo ≤ 2 | 68 % Lauf, 32 % Screen | kurze Distanz ist real klar laufbetont — **passt** |
| toGo 3–6 | 55 % Lauf | plausibel |
| toGo 7–11 | 46 % Lauf | 1st & 10 real: **53 % Lauf / 47 % Pass** ([NFL.com](https://www.nfl.com/news/first-down-success-is-the-key-to-third-down-conversions-09000d5d80ae2bf7)) — **passt gut** |
| toGo > 11 | 28 % Lauf | real deutlich passlastiger, aber richtige Richtung |

Der Gesamt-Korridor bestätigt es: 25,4 Laufversuche gegen 24,2 Passversuche je Team (real
27,0/29,9). **Das Verhältnis stimmt, die Gesamtzahl der Spielzüge ist zu niedrig** — Football
spielt in unserem Motor rund 50 statt rund 60 Snaps je Team. Punkte je Team 16,3 gegen real 22,9
folgt direkt daraus.

**Aber:** die Fenstertabelle hängt allein an `toGo`. Siehe C.2 — `down` wird in drei Funktionen
entgegengenommen und in keiner benutzt. Real ist der Down der **stärkste** Prädiktor überhaupt:
3rd & 8 ist praktisch immer ein Pass, 1st & 10 ist etwa 50/50, und beide fallen bei uns ins
gleiche Fenster mit identischem 46-%-Laufanteil. Für einen dritten Versuch mit langer Distanz
einen Laufzug in fast der Hälfte der Fälle zu rufen, ist die auffälligste Abweichung von echtem
Football, die im Motor steckt — real liegt die First-Down-Quote eines solchen Laufs bei
**5,5 %** ([The Spax](https://www.thespax.com/nfl/analyzing-nfl-third-down-play-calling/)), es
tut also praktisch niemand.

## B.6 Rezept und Korridor

Der Korridor (`miss-football-korridor.mjs 120`) ist Zeile für Zeile reproduziert und liegt für
jede Kennzahl in der richtigen Größenordnung. Die Kalibrierungsrunde ist **methodisch die beste
Arbeit in diesem Football-Stapel**: die frischen NFL-2024-Zahlen ersetzen die ältere
zengm-Tabelle mit Begründung, der Absturz-Fix (`footballDownWeiter` ohne `traeger`) ist ein
echter Korrektheitsfehler, und Abschnitt 4.6 dokumentiert einen **negativen** Befund
(„gepoolte Attribut-Korrelation ist kein verlässlicher Rezept-Proxy"), damit die nächste Runde
den Weg nicht wiederholt. Genau so soll das aussehen.

Zwei fachliche Anmerkungen zum Rezept selbst:

**Die Football-Matrix ist vermutlich die eigentliche Validitäts-Bremse, nicht das Rezept.**
`BASIS_JE_DISC.football` lautet `spirit 25, torment 16, health 14, awareness 11, will 10,
determination 8, power 6, stamina 6, charisma 4`. Daraus folgt zwangsläufig
`PASSGENAUIGKEIT: {will 54, determination 46}` (weder Geschicklichkeit noch Wahrnehmung stehen
zur Verfügung) und `LAUFKRAFT: {spirit 56, health 30, power 14}` — ein Running Back, dessen
Laufkraft zu 56 % aus Geist besteht und zu 14 % aus Kraft. Die Kalibrierung hat das Beste aus
dem gemacht, was die Matrix hergibt; sie kann aber nicht reparieren, dass `power` in einer
Kollisionssportart mit Gewicht 6 an neunter Stelle steht. **Wenn Football je über 0,80 kommen
soll, führt der Weg vermutlich über eine MATRIX-Diskussion, nicht über eine dritte
Rezeptrunde** — die Berichte deuten das an (Abschnitt 6.2, „eine neue MATRIX-Diskussion"),
sprechen es aber nicht als Hauptursache aus.

**`awareness` mit Matrixgewicht 11 korreliert auf dem echten Kader mit −0,335 gegen die
Football-Eignung.** Das ist ein bemerkenswerter Befund, den die Kalibrierungsrunde richtig
behandelt hat (awareness aus allen Sub-Skills herausgehalten). Er verdient trotzdem eine eigene
Zeile in Chris' Aufmerksamkeit: ein Attribut, dem die Matrix das drittgrößte Gewicht gibt und
das im echten Kader **negativ** mit der daraus errechneten Eignung korreliert, deutet auf einen
Fehler in der Eignungsformel oder der Matrix hin — nicht auf ein Rezeptproblem.

## B.7 Verdict Football

**Optisch und strukturell: ja, das ist ein vorzeigbarer erster Wurf.** Feld korrekt, Ball
richtig verdrahtet, Formationen sauber getrennt und real recherchiert, sieben unterscheidbare
Zugtypen, Downs und Line of Scrimmage funktionieren, keine Abstürze mehr, CI grün.

**Mechanisch: nein, und das sagen die Berichte auch selbst.** rho je Spiel 0,460 (reproduziert)
gegen die Schranke 0,80 — „durchgefallen", nicht „knapp". Der Zuwachs der Kalibrierungsrunde
(+0,155) liegt zudem **unter** der eigenen Kader-Spannweite (0,258), ist nach der Regel aus
`messgrundlage-kaderfest.md` also nicht sauber von Null unterscheidbar. Der Bericht sagt das
selbst und rechnet es nicht schön — das rechne ich ihm hoch an.

**Direkt auf Chris' Fragen:**

- **Feld?** Fertig und richtig. Ausbaustufen wären Yard-Zahlen und Hash Marks, beide billig,
  beide optional.
- **Assets?** Ball fertig und gut. Helm liegt bereit, wird bewusst nicht gezeichnet, und die
  Begründung trägt (die Sprites taugen ohnehin wenig). Trikot/Schulterpolster existiert
  nachweislich nicht als LPC-Ebene; die vorhandene `schulter`-Ebene bleibt der beste Behelf.
- **Aufstellungen?** Sauber getrennt, real recherchiert, gemessen ohne Klumpen. **Aber sie
  stehen still — während eines Spielzugs bewegt sich nur der Ball.** Das ist der nächste
  sichtbare Schritt, wenn Football weiter soll.
- **Monument?** Bitte um Klärung, s. B.1.

---

# Teil C — Was ich gefunden und NICHT repariert habe

Vier Punkte. Keiner davon ist ein Absturz, keiner blockiert etwas. Ich habe sie bewusst nicht
selbst behoben, weil dies ein Review ist — sie stehen hier mit der jeweiligen Ein-Zeilen-Lösung,
damit eine spätere Runde sie in Minuten erledigen kann.

## C.1 Der Field-Goal-Ball fliegt sichtbar zu kurz — dieselbe Fehlerklasse, die PR #764 gerade behoben hat

`animiereFootballZug()`, `engine.js:6017`:

```js
const zielSpot = s.spielTyp==="fg" ? Math.max(0, fb.spot-17) : Math.max(1, fb.spot-fb.puntNetto);
```

`resolveFieldgoal()` (`engine.js:5988`) rechnet die Kickdistanz als `spot + 17` — die 17 sind
die 10 Yards Endzone plus rund 7 Yards Snap/Halter. Die Animation **subtrahiert** dieselbe 17
vom Spot, statt den Ball bis zum Tor fliegen zu lassen. Ein Field Goal wird nur bei
`spot <= 38` versucht; bei einem typischen Versuch aus `spot = 30` (also einem 47-Yard-Kick)
fliegt der Ball damit sichtbar bis Spot 13 und bleibt **13 Yards vor der Torlinie liegen** — er
erreicht die Endzone nie, egal ob der Kick gut war oder nicht.

Das ist exakt die Fehlerklasse, die PR #764 für unvollständige Pässe gerade behoben hat: die
Animation zeigt etwas anderes, als angesagt wurde. Da keine Torstangen gezeichnet sind, fällt
es weniger auf — aber ein erfolgreiches Field Goal sieht aus wie ein zu kurzer Punt.

**Vermutete Ein-Zeilen-Lösung** (nicht von mir gemessen, deshalb als Vorschlag markiert):

```js
const zielSpot = s.spielTyp==="fg" ? 0 : Math.max(1, fb.spot-fb.puntNetto);
```

Der Ball fliegt dann bis zur Torlinie. `vollziehFootballErgebnis()` liest bei `typ:"fg"` weder
`zielSpot` noch `erg.yards` — die Änderung wäre wie die vorige rein optisch. **Vor dem Einbau
sollte jemand das nachmessen, nicht nur nachlesen.**

## C.2 `down` wird in drei Entscheidungsfunktionen entgegengenommen und nie benutzt

- `waehlePlayCall(down, toGo)` — `engine.js:5868`
- `waehleFormationOffense(down, toGo)` — `engine.js:5852`
- `waehleFormationDefense(down, toGo)` — `engine.js:5853`
- (`waehleFootballTier(down, toGo)` — `engine.js:5918`, ebenfalls)

Alle vier verzweigen ausschließlich über `toGo`. Kein Fehler im Sinne von „stürzt ab" — aber
der Down ist im echten Football der stärkste Prädiktor der Spielzugwahl (B.5), und die
Parameter stehen bereits in der Signatur, warten also nur auf ihre Verwendung. Das ist der
billigste noch offene Realismus-Hebel, den Football hat: eine Zeile pro Funktion. Ob er auch
rho hebt, ist offen — er würde die Verlässlichkeit vermutlich eher senken (weniger Laufzüge auf
3rd & long heißt weniger Ballberührungen für laufstarke Spieler).

## C.3 Die Kalibrierungsnotiz zu `HEBEN_KG_PRO_LAST` ist seit Variante B veraltet

`engine.js:9938–9941` sagt:

> „T_max = 100 + 3,8 x LAST Sinclair-kg. Kontrolle an den Raendern: LAST 100 -> 480
> (Talakhadze hebt 492) …"

Seit Variante B kommt der ANSAGE-Faktor obendrauf: LAST 100 bei ANSAGE 99 ergibt rechnerisch
**586** statt 480 — deutlich über dem Weltrekord, den die Notiz als Plausibilitätsgrenze
zitiert. **Praktisch tritt das nicht ein** (ich habe es geprüft: der stärkste Heber des echten
Kaders landet bei 471 kg, s. A.7), aber die Notiz sagt jetzt etwas, das nicht mehr stimmt, und
sie ist genau die Stelle, an der eine spätere Runde die Ränder wieder prüfen würde.
**Kommentarzeile, keine Zahl.**

## C.4 `stand-aller-disziplinen.md` trägt für Football noch die alte Zahl — der praktisch wichtigste Punkt

Die zentrale Statustabelle des Projekts ist für Football an **fünf Stellen veraltet**. Sie zeigt
weiterhin den Stand vor der Rezept-Kalibrierung:

| Zeile | Steht dort | Richtig wäre |
|---:|---|---|
| 56 | `**Football** \| Feldspiel \| **0,305** \| 0,321 \| 0,448 \| 0,448 \| durchgefallen` | 0,460 / 0,258 / 0,692 / 0,196 |
| 103 | `jetzt … **0,305 / 0,448** \| football-live-migration.md` | 0,460 / 0,692, Bericht `football-rezept-kalibrierung.md` |
| 107–110 | „dessen Kopfzahl trotzdem **gesunken** ist, weil das neue Rezept noch aus reinen Platzhaltern besteht" | das Rezept ist seit dem 04.09. gemessen, nicht mehr Platzhalter |
| 283–287 | „Football braucht eine echte Rezeptkalibrierung … nächster Schritt: ein Football-Analogon zu `miss-hockey-skillmittel.mjs`" | ist erledigt; `skillMittel` ist gemessen (0,446), `miss-football-korridor.mjs` existiert |
| 396 | „**28 %** … **Rezept vollständig ungemessene Platzhalter** … Kopfzahl bewegte sich RUECKWAERTS (0,345→0,305)" | Rezept gemessen, Kopfzahl jetzt 0,460 |

Die Gewichtheben-Runde hat ihre Zeile korrekt nachgezogen (Zeile 102: 0,887/0,944). Die beiden
Football-Runden desselben Tages haben es beide vergessen.

**Warum das mehr wiegt als es klingt:** `stand-aller-disziplinen.md` ist das Dokument, in das
Chris und jeder künftige Agent schauen, um zu entscheiden, wo als Nächstes gearbeitet wird. Es
sagt derzeit, Football brauche eine Rezeptkalibrierung, die bereits gefahren ist — die nächste
Runde würde also mit hoher Wahrscheinlichkeit **exakt die Arbeit wiederholen**, vor der
`football-zufriedenstellend.md` Abschnitt 1 ausdrücklich warnt („weiteres Rezept-Grinding hat
abnehmenden Grenzertrag").

Ich habe die Datei **nicht** angefasst, weil die Korrektur mehr ist als ein Zahlentausch (die
Prosa in 107–110 und 283–287 müsste umformuliert werden) und weil das eine bewusste
Entscheidung von Chris sein sollte, nicht ein Nebeneffekt eines Reviews. **Es ist aber der eine
Punkt aus diesem ganzen Review, den ich als Nächstes erledigen würde.**

---

## Quellen dieses Reviews

**Gewichtheben / Sportwissenschaft**

- Tod, D., Iredale, K. F., McGuigan, M. R., Strange, D. E. O. & Gill, N. (2005): „Psyching-up
  enhances force production during the bench press exercise", *Journal of Strength and
  Conditioning Research* — +11,8 % gegen Ablenkung, +8,1 % gegen Placebo.
  <https://pubmed.ncbi.nlm.nih.gov/16095409/>
- Tod, D., Iredale, F. & Gill, N. (2003): „'Psyching-Up' and Muscular Force Production",
  *Sports Medicine*. <https://link.springer.com/article/10.2165/00007256-200333010-00004>
- Systematische Übersicht (2023): „The Effects of Psyching-Up on Maximal Force Production" —
  65 % der Versuche zeigen eine Steigerung.
  <https://www.researchgate.net/publication/376086631_The_Effects_of_Psyching-Up_on_Maximal_Force_Production_A_Systematic_Review>
- Ikai, M. & Steinhaus, A. H. (1961): „Some factors modifying the expression of human
  strength", *Journal of Applied Physiology* — Spanne +26,5 % bis −31 %.
  <https://journals.physiology.org/doi/abs/10.1152/jappl.1961.16.1.157>
- Moritz, S. E., Feltz, D. L., Fahrbach, K. R. & Mack, D. E. (2000): „The Relation of
  Self-Efficacy Measures to Sport Performance: A Meta-Analytic Review", *RQES* — r = 0,38 über
  45 Studien. <https://pubmed.ncbi.nlm.nih.gov/10999265/>
- „Self-Efficacy in High-Performance Sports: A Systematic Review and Meta-Analysis" (2025).
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC12352364/>
- „Effects of Priming with Light vs. Heavy Loads on Weightlifting Performance" — Stoßen +3,1 %
  nach schwerem Priming, Reißen unverändert.
  <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11843885/>
- Reißen-zu-Stoßen-Verhältnis bei Spitzenhebern (78–82 %).
  <https://breakingmuscle.com/why-you-need-to-know-your-snatch-to-clean-and-jerk-ratio/>

**Football / NFL**

- Shotgun- gegen Under-Center-Anteil 2024 (62–70 %), I-Formation unter 5 %, Under-Center nur
  noch bei ≤ 1 Yard bzw. an der Goalline bevorzugt.
  <https://gridirondeepdive.substack.com/p/under-center-vs-shotgun-in-modern> ·
  <https://www.sharpfootballstats.com/snap-rates--shotgun-v-under-center--off-.html>
- Nickel als De-facto-Basisformation, ~65–67 % der Defensiv-Snaps.
  <https://www.cbssports.com/nfl/news/heres-why-the-nickel-defense-is-the-new-base-defense-in-the-nfl>
  · <https://www.acmepackingcompany.com/2024/5/28/24166507/green-bay-packers-jeff-hafley-scheme-2024-nickel-base-dime-percentages-joe-barry-keisean-nixon>
- Lauf/Pass am First Down (53 % / 47 %).
  <https://www.nfl.com/news/first-down-success-is-the-key-to-third-down-conversions-09000d5d80ae2bf7>
- Third-Down-Playcalling, First-Down-Quote eines Laufs bei langer Distanz 5,5 %.
  <https://www.thespax.com/nfl/analyzing-nfl-third-down-play-calling/>
- Formationsdefinitionen (dieselben Quellen, die die Migrationsrunde benutzt hat):
  <https://en.wikipedia.org/wiki/Shotgun_formation> ·
  <https://en.wikipedia.org/wiki/4%E2%80%933_defense> ·
  <https://en.wikipedia.org/wiki/Nickel_defense> ·
  <https://en.wikipedia.org/wiki/I_formation>

**Repo-intern gelesen**

`docs/design/gewichtheben-gameplay-fertig.md`, `gewichtheben-zufriedenstellend.md`,
`gewichtheben-plan.md`, `football-rezept-kalibrierung.md`, `football-live-migration.md`,
`football-assets.md`, `football-zufriedenstellend.md`, `football-rollout-plan.md`,
`stand-aller-disziplinen.md`, PR #764 (Beschreibung, Diff, Check-Runs), Commits `575b6ddd`,
`60bad611`, `f91a42b8`, `d88eb2dd`, `04d3f821`, sowie
`public/mockups/battle-mode.engine.js` (Gewichtheben-Block 9560–10200, Football-Block
3759–3925 / 5780–6260 / 8064–8090 / 9080–9110) und
`lib/resolve/battle-mode-arena-team-points.ts:80`.

## Wie ich nachgemessen habe

```sh
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben basketball football
node scripts/miss-football-korridor.mjs 120
node --check public/mockups/battle-mode.engine.js
```

Variante A: dieselbe Messung mit `HEBEN_TAGESMAX_ANSAGE_K` per `sed` auf `0` gesetzt, danach
aus einer Sicherung zurückgestellt (`git status` sauber, keine Änderung committed).

ANSAGE-/LAST-Verteilung und `tagesmax`-Faktoren: direkt aus
`data/generated/kaderfamilie-live-save.json` gerechnet (110 eindeutige Spieler über alle fünf
Kader-Varianten), mit den Rezeptgewichten aus `BUEHNE_ART.gewichtheben.rezept`.

Formationsabstände: `window.__arena.diagAbstaende(saat, 90, "football")` über Playwright auf
`public/mockups/battle-mode.html`, Saaten 1337 / 4711 / 90210.

Skalen-Umrechnung Pixel↔Yards: aus `battle-mode.html:83` (Canvas 1240 × 470) und `FIELD()`
(`engine.js:5789`).

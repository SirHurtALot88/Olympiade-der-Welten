# Staffel: „Marke und Zug" — Nachtkonzept für die ereignisarme Bahn-Disziplin (03.10.)

**Reine Konzeptrunde. Kein Code geändert, kein Verhaltens-PR.** Auftrag aus Chris' Erweiterung
vom 03.10. abends: „bei den anderen event poors bitte heute über die nacht auch konzepte
ausarbeiten damit wir für gewichtheben und die anderen 8 auf jeden fall die konzepte haben, denk
gern um die ecke, hol infos aus dem internet und probier dich aus." Ausgangspunkt ist der
Staffel-Eintrag (Zeile 4) in `docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` und
Chris' Grundsatz vom 02.10.: „mehr risiko führt dazu dass jemand sich evtl übertrifft oder unter
dem druck oder gewicht einbricht."

Die Zahlen in Abschnitt 5 kommen aus einem **Offline-Modell** der Staffel (Scratch-Skript
außerhalb des Repos, nicht committet), das die heutige Mechanik aus `battle-mode.engine.js`
nachbaut (`tempoVon`, `kurvenFaktor`, Wechselzweig in `stepSpurt`, `KRAFT_VON`, Pp-Hebung wie
`einflussVon` mit +15 und matrixgewichteter Eignungsanhebung) und auf dem echten live-save-Kader
rechnet (`data/generated/kaderfamilie-live-save.json`, fünf Paarungen, zehn Teams, Top-6 je Team
nach `d.staffel`). Das Modell trifft den Motor im Basisfall auf ±0,01 rho und ±1 Pp (5.1) — es
zeigt Größenordnungen und Richtungen, keine Nachkommastellen, und es kennt weder Slot- noch
Form- noch Trait-Zuschläge. Alles ist am Motor nachzumessen, bevor irgendetwas gilt.

---

## 0. Ergebnis vorab

1. **Die Staffel ist nicht zu wenig Rennen, sondern zu wenig Entscheidung.** Zwei Bahnen ohne
   jede Berührung, Pläne, die alle `tempo:1.00` fahren, eine Puste-Reserve, die nie bindet
   (Median 88 % Rest), ein WUCHT-Kanal („Zug an der Spitze"), der mechanisch tot ist — die
   einzigen echten Momente sind die fünf Wechsel je Seite, und auch die sind heute ein reiner
   Zeitverlust mit Streuung, kein Risikoregler. Mehr Ereignisse auf die Uhr zu packen hilft
   nicht (CLAUDE.md: Validität, nicht Verlässlichkeit); was fehlt, ist das, was reale Staffeln
   spannend macht: **die Marke** (Abschnitt 2).
2. **Konzept „Marke und Zug": ein Rennplan je Läufer mit zwei Gesichtern.** Jeder Läufer hat eine
   Haltung Absichern/Normal/Angreifen. Im **Wechsel** ist sie die Anlaufmarke des Nehmers
   (kurz/normal/weit: fliegender Gewinn, Streuung, Patzerrisiko), auf dem **Bein** ist sie das
   Tempo (vorn drauflegen, hinten tragen — oder einbrechen). Tragen muss den Angriff **WUCHT
   („Zug", spirit/charisma) zusammen mit TECHNIK („Übersicht", awareness/dexterity/charisma)** —
   genau die Attribute, die heute unter ihrem Matrixgewicht liegen. Normal bleibt bit-identisch.
3. **Stufe 1 ohne Oberfläche:** die Haltung wird deterministisch aus Kader und Persönlichkeit
   abgeleitet, nach dem Muster `sandsackPersoenlichkeit()` aus Paket 1 des Sandsack-Finales
   (PERSZIEL/PERSDEF). Draufgänger greifen an, Bollwerke sichern ab, Duellanten greifen an, wenn
   sie hinten liegen. KI und Mensch bekommen dieselbe Regel. **Stufe 2** gibt dem Manager das
   Feld selbst — und braucht das Grundgerüst (Zeile 0 im Papier vom 02.10.), das ohnehin für
   Gewichtheben gebaut wird.
4. **Modell-Befund (5.3):** Marke + Zug mit KI-Vorgabe hebt rho je Spiel von 0,881 auf 0,911, den
   Sentinel vigilante-armageddon von 0,811 auf 0,867, senkt Pp von 36,3/36,7 auf 30,2/31,1,
   verdoppelt fast die Führungswechsel (1,03 → 1,48 je Rennen), halbiert den Zielabstand
   (0,44 → 0,31 Sim-s), bringt den eignungsbesten Läufer in 77 % statt 66 % auf Rang 1 — und die
   Haltung **kippt 10 % der Sieger** gegenüber „alle Normal". Das ist Chris' „gewisser Impact".
   Zufällige Haltungen (schlechtester Fall für rho) kosten nur 0,01 rho.
5. **Pp ≤ 25 erreicht auch dieses Konzept nicht.** Der Rest sitzt in Speed (+10 über Matrix) und
   Stamina (+4) — im Tempo-Kanal (ANTRITT/ENDTEMPO), den kein Wechsel- oder Haltungskonzept
   anfasst. Das ist eine eigene Rezept-/Nenner-Runde, kein Argument gegen dieses Konzept, das Pp
   um ~6 senkt statt es zu verschlechtern.
6. **Ein Fehler, der im Modell passiert ist und im Motor nicht passieren darf (5.2):** In der
   ersten Kalibrierung war der Angriff ein Knopf, der **immer schlechter** war (Zusatz-Ermüdung
   fraß den Bonus schon bei WUCHT 60). Ergebnis: rho 0,81, Charisma-Anteil 0, Favorit gewinnt
   nur 44 %. Designregel 3 aus dem 02.10.-Papier („kein Knopf darf immer besser sein") gilt
   wörtlich auch umgekehrt — der Break-even des Angriffs ist das Kalibrierziel Nummer 1.
7. **Klasse: B** für Marke und Zug (Mechanik, keine Sendezeit-Änderung, keine Wertungsänderung),
   **A/A\*** für das Bild (Bein-Duell-Banner, Abstandsuhr, Anweisungsbilanz), **S** für Stufe 2
   (neues Feld in der Einsatzliste), **T nur, falls** Chris eine eigene Rennplan-Tafel vor dem
   Start will (Abschnitt 6 — ich empfehle, sie in den vorhandenen Einlauf zu legen, also A). Die
   radikalere Idee „Verfolgungsstaffel" (Team Pursuit, Einholen beendet das Rennen) habe ich
   durchdacht und **nicht** empfohlen (4.4): sie wäre W und bricht die Einzelwertung.

Abschnitt 8 ist die Entscheidungsvorlage.

---

## 1. Problemrahmen: was heute im Code steht

Alles in `public/mockups/battle-mode.engine.js`, Stand `origin/main` `68563962`.

* **Ablauf.** `BAHN_ART.staffel` (`:35346`): sechs Beine je Seite, `bahnenFest:2`, kein
  Windschatten (`schatten:false`, gemessen: Sog kostete Validität 0,762 → 0,601), kein Tackle. Es
  läuft immer genau **einer je Seite**, die anderen fünf stehen gedimmt im Innenfeld
  (`if(BA().staffel&&!u.aktiv)continue`). Ein Bein dauert ~1,7 Sim-s, das Rennen ~10,5 Sim-s; bei
  `ZEIT_DEHNUNG` 14,65 sind das rund **154 Zuschausekunden**.
* **Tempo** (`tempoVon`, `:37201`): `(92 + 0,90·grund)·planT·mued·stolper·…` mit `grund` als
  Blende ANTRITT → ENDTEMPO über 3,2 s ab Beinstart, `mued` ab 45 % des Beins aus STEHEN, Kurve
  in der Mitte jedes Beins (`kurvenFaktor`, WENDIGKEIT). **Alle drei Pläne** (`halten`,
  `angehen`, `schluss`) stehen auf `tempo:1.00` — der Plan tut nichts außer Sog-Suche, die es
  ohne Windschatten nicht gibt (Opus-Review 26.09., 0.3).
* **Wechsel** (`stepSpurt`, `:38168–38254`): `verlust = max(0,04; 0,42 − koennen·0,0036) +
  Streuung(dreieckig, aus koennen) + ggf. Patzer(0,34·…)`, `koennen` = Schnitt der TECHNIK beider.
  Der Verlust ist physisch (`naechster.stolper=verlust`, 35 % Tempo), wird aus der Etappenzeit
  des Nehmers herausgerechnet (×0,65) und je zur Hälfte beiden ins `wechselKonto` geschrieben.
  **Es gibt keinen fliegenden Gewinn** — kein Wechsel ist je schneller als ein Stand-Start. Genau
  das unterscheidet real eine Staffel von vier Einzelzeiten (K4 in
  `staffel-modellierung-recherche-05-09.md` 3.4, ST-P1 im Opus-Review, dreimal konzipiert, nie
  gebaut).
* **Reserve** (`KRAFT_VON`, `:35817`): `230 + (0,7·STEHEN + 0,3·ROBUST)·2,4` ≈ 350; Zehr je
  Sekunde ≈ 22. Auf einem 1,7-s-Bein werden ~38 verbraucht: **Puste kann hier strukturell nie
  binden** (Kommentar `:35382`: „KEIN Laeufer unter 77 %, Median 88,3 %"). Damit ist auch
  `SPITZE_ZUG` (WUCHT verbilligt den Zehr, `:37469`) ein toter Kanal — Spirit 16 + Charisma 10,
  ein Viertel der Matrix, ohne Wirkung außer über die Mengenkopplung.
* **Wertung** (`bahnLeistung`, `:31412`): `−etappenZeit + wechselKonto` je Läufer, Rang über alle
  zwölf; Team: wer zuerst im Ziel ist.
* **Abnahme heute** (PR #1123/#1127): rho je Spiel 0,893 (n=24) / 0,895 (n=48), Pp 37,7/41,1,
  **vigilante-armageddon 0,716/0,698 — unter der Schranke, offen auf `main`.** Fünfzehn
  Konstantenvarianten (`WECHSEL_*`/`KURVE_*`) konnten das nicht beheben; Diagnose dort: TECHNIK
  wirkt nur über den Schnitt zweier Läufer an höchstens zwei von fünf Wechseln, Charismas
  einziger Kanal ist exakt der Hebel, der den Sentinel schädigt. **Fazit der Kalibrierrunde,
  wörtlich: „eine echte Lösung … bräuchte vermutlich eine Mechanik-Änderung."** Dieses Papier
  ist diese Mechanik-Änderung.
* **Sendung** (Audit 30.09.): 4,5 Tickerzeilen/Minute, bis 85 s ohne Banner, bis 22 s Stille,
  Bild steht 50 %. Zehn Übergaben plus ~0,3 Patzer plus ~1 Führungswechsel je Rennen — das ist
  die gesamte Ereignisliste.
* **Entschieden und hier nicht angefasst** (`staffel-offene-fragen-plus-takeshis-castle-05-09.md`,
  Fable-Ideen 30.09. 0.4): kein Team-DNF, keine variablen Beinlängen (K5), kein Konstanz-Stat,
  Bein 1 = Bester auf Slot 0, Zweier- bis Sechser-Staffel müssen funktionieren.
* **Team-Feier:** Phase 1 (Baukasten, Gewichtheben, Breaking) ist gemergt (`f58e11f1`); Phase 2
  Staffel (drei Haken: Übergabe/Ziel in `stepStaffel`, Führungswechsel in `updateHudBahn`) ist
  konzipiert, nicht gebaut (`team-publikum-feiermomente-konzept-30-09.md` 3.3). Dieses Konzept
  liefert ihr zwei weitere Auslöser (Scharf-Wechsel gelungen, Einbruch des Gegners).

---

## 2. Recherche: was reale Staffelformate beim Zuschauen tragen

Gesucht wurde nicht „wie läuft eine Staffel", sondern **welche Elemente die Dramaturgie tragen**
und welche davon unserer Staffel fehlen.

### 2.1 Leichtathletik 4×100 m: die Wechselzone ist ein Risikoregler

* Seit dem 1. April 2018 gibt es keine getrennte Beschleunigungszone mehr: „The acceleration zone
  has been eliminated for the 4 x 100m and 4 x 200m relays. These zones have been merged into one
  takeover zone 30m in length" ([SCA USATF, 2018 rule changes](https://www.scausatf.org/2018-track-field-rule-changes/));
  „each takeover zone shall be 30m long, of which the scratch line is 20m from the start of the
  zone" ([Wikipedia, 4 × 100 metres relay](https://en.wikipedia.org/wiki/4_%C3%97_100_metres_relay)).
  Der Nehmer läuft **auf eine Marke** los, die der Trainer je Paar setzt; eine weite Marke bringt
  Tempo und das Risiko, dass der Stab nicht ankommt oder die Übergabe aus der Zone fällt.
* Die Übergabe außerhalb der Zone ist ein Totalausfall: „If the baton changes hands even slightly
  outside this boundary, the team is automatically disqualified, regardless of performance"
  ([Trackbarn, What is a relay](https://trackbarn.com/blogs/faq/what-is-a-relay-in-track-and-field)).
  Disqualifikationen in Finals sind kein Randfall — Zarębska 2021 (bereits im Repo zitiert): 21 %
  der Teams je Rennen. **Für uns bleibt der Totalausfall entschieden draußen** (kein DNF, 1.1);
  die Lehre ist nicht die DQ, sondern dass die **Marke eine Entscheidung je Paar** ist.
* Warum das zuschauend wirkt: „One mistimed handoff. One lane violation. One runner who fades
  just a little too soon, and the whole thing falls apart. […] Every exchange zone feels like a
  cliffhanger. Every anchor leg is a climax. […] No lead ever feels safe, no result ever feels
  guaranteed. That volatility isn't a flaw—it's the appeal. […] It's chess at 20 miles per hour"
  ([Marathon Handbook, Why relays are the most underrated track event](https://marathonhandbook.com/why-relays-are-the-most-underrated-track-event/)).

### 2.2 Leichtathletik 4×400 m: die Reihenfolge ist Taktik, das Schlussbein ein Duell

* Reihenfolge als Entscheidung, die Rennen gewinnt: „Britain famously won the gold medal by
  changing the running order and putting the fastest athlete, Roger Black, who usually ran the
  anchor leg, out first and putting Kriss Akabusi on the final leg" (WM 1991). Beinprofile: Bein 1
  „must be consistent", Bein 2 „technical baton skills, body awareness", Bein 3 „aware of all that
  is happening throughout the race, who's ahead and behind", Anker: „it is a culmination of the
  first three legs as you can't win it on your own!" — und der Anker darf das Ego nicht „overdo it
  and finish poorly" lassen ([Athletics Weekly, An in-depth look into the 4x400m relay](https://athleticsweekly.com/performance/an-in-depth-look-into-the-4x400m-relay-1039972814/)).
* Die Dramaturgie des Schlussbeins: „viewers can readily see how far behind a team is when they
  get the baton and see the seemingly insurmountable odds of making up such ground in one single
  lap" ([Science of Running](https://www.scienceofrunning.com/2016/05/why-our-attention-to-times-is-killing.html)).
  Der **sichtbare Abstand an der Übergabe** ist das Spannungsmaß — nicht die Zeit.

### 2.3 Bahnrad Team Pursuit: Führungsarbeit kostet, und der Dritte zählt

* „Changes to the relative position of cyclists are most efficiently performed on either of the two
  banked turns"; „the position of the third rider is pivotal because final times are measured as
  the third team member's front wheel crosses the finishing line … it is common for one rider to
  take a ‚death pull'" ([Wikipedia, Team pursuit](https://en.wikipedia.org/wiki/Team_pursuit)).
  Pacing-Modelle (Wagner et al., [arXiv 1104.0775](https://arxiv.org/pdf/1104.0775)) optimieren
  **ungleiche Führungslängen** je Fahrerprofil — wer stark ist, zieht länger. Das ist unser
  „Zug an der Spitze" (WUCHT), nur dass er bei uns nichts kostet und nichts bringt.

### 2.4 Langlauf-Staffel und Biathlon: der Verband baut Spannung bewusst in die Zone

* Die FIS hat die Männerstaffel auf 4×7,5 km verkürzt, um „competitions … more compact for TV
  transmission" zu machen, und verlangt „an extended path for the ski exchange zone" to „animate
  the competition, and … provide the media with longer athlete coverage" ([SkiTrax, FIS rule
  updates mean more suspense for TV audience](https://skitrax.com/fis-xc-competition-rules-updates-mean-more-suspense-for-tv-audience/)).
  **Ein Verband verlängert die Wechselzone, weil dort die Geschichte entsteht.** Bei uns ist die
  Zone eine Zahl im Konto.
* Biathlon-Staffel: drei Nachlader, dann Strafrunde — „the extra rounds give athletes the
  opportunity to attempt to shoot faster in a pressure-packed race where speed and accuracy on the
  range can make a huge impact" ([Olympic.ca, Biathlon 101](https://olympic.ca/2025/11/27/biathlon-101-everything-you-need-to-follow-team-canada-on-the-range-and-the-snow)).
  Das Muster: ein **abgestufter Fehler** (Nachlader = Zehntel, Strafrunde = Sekunden), kein
  Alles-oder-nichts. Exakt unser Wechsel-Patzer (0,34 Sim-s, bewusst „häufiger und kleiner").

### 2.5 Schwimmen: die Übergabe wird auf die Hundertstel gemessen und gezeigt

* „A tolerance of 0.03 seconds is given in favour of the swimmer before a relay break is
  identified" ([Swiss Timing / Aquatics GB](https://aquaticsgb.com/documents/350/Swiss_Timing_Relay_Break_Detection_Communication.pdf)).
  Die Wechselreaktion steht in jeder Übertragung als Zahl im Bild — der Zuschauer sieht, **wer
  scharf gewechselt hat**. Das ist Fables 4.2 („Wechselgewinn als Zahl"), das hier zur
  Anweisungsbilanz wird.

### 2.6 Ekiden (Japan): die Übertragung erzählt den Abstand, nicht den Führenden

* Hakone Ekiden erreicht Einschaltquoten von ~30 %; „road race broadcasts outside Japan mostly
  show the leader, but ekiden broadcasts cover the development of the race from multiple
  perspectives … it's not just about who's leading, but who started where, who's overtaking,
  who's dropping, and who's still to come later" ([Japan Running News via German Road Races, Brett
  Larner](https://news.germanroadraces.de/?p=226793); [World Athletics, Land of the rising
  run](https://worldathletics.org/competitions/world-athletics-championships/world-athletics-championships-tokyo-2025-7190593/news/series/land-of-rising-run-national-running-boom)).
  Jede Übergabestation zeigt **den Abstand und wer noch kommt**. Bei uns steht der Abstand nie im
  Bild, und „wer noch kommt" (die fünf Wartenden) hat keine Erwartung, die man lesen könnte.

### 2.7 Was davon unserer Staffel fehlt

| Element real | Bei uns heute | Konzept-Baustein |
|---|---|---|
| Marke je Paar (weit = Tempo + Risiko) | Wechsel = Verlust ohne Entscheidung | **B1 Marke** |
| Fliegender Wechsel schneller als Stand-Start | kein Gewinn, nur Verlust | **B1** (K4) |
| Führungsarbeit kostet, Zug trägt | WUCHT mechanisch tot | **B2 Zug** |
| Anker: alles raus oder verkrampfen | Pläne wirkungslos | **B2 + bedingte Haltung** |
| Reihenfolge als Taktik | KI setzt Bester vorn, Rest beliebig | später ST-P2 (4.5) |
| Abstand an jeder Übergabe im Bild | nie | **B4 Abstandsuhr** |
| Wechselreaktion als Zahl | Konto intern | **B4 Anweisungsbilanz** |
| Verlängerte Zone als Bühne | Übergabe 0,55 s Animation | **B4 Anlaufmarke sichtbar** |

---

## 3. Das Konzept: „Marke und Zug"

### 3.1 Leitidee

Die Staffel bekommt **eine** Entscheidung je Läufer — die Haltung — und die wirkt an **zwei**
Stellen, die beide schon im Code existieren und beide heute nichts entscheiden: im Wechsel
(`verlust`-Formel) und auf dem Bein (`planT`/`mued` in `tempoVon`). Normal ist an beiden Stellen
bit-identisch zu heute. Kein neuer Zufallszug außer dort, wo er schon fällt (Streuung/Patzer im
Wechsel); der Angriff auf dem Bein ist deterministisch aus eigenen Attributen.

### 3.2 Baustein B1 — Die Marke (Wechsel als Risikoregler, mit fliegendem Gewinn)

Der Nehmer setzt mit seiner Haltung die Anlaufmarke; das ist K4/ST-P1 mit einem Zusatz
(WUCHT in `Q` als „Absprache", Opus' „sichere Wahl" für Spirit/Charisma):

```
koennen  = (u.TECHNIK + v.TECHNIK)/2                         // wie heute
Q        = 0,35·koennen/100 + 0,20·u.ENDTEMPO/100 + 0,20·v.ANTRITT/100 + 0,25·((u.WUCHT+v.WUCHT)/2)/100
gewinn   = FLIEG_MAX · Q · marke.g                           // FLIEG_MAX 0,16–0,32 Sim-s (6.3)
verlust  = wie heute, Streuung × marke.s, Patzerchance × marke.p
netto    = verlust − gewinn
netto>0: v.stolper = netto, v.wechselVerlust += 0,65·netto    // wie heute
netto<0: v.startT  = rennT + 0,65·netto                       // "er hat schon Tempo" (K4)
konto:   u.wechselKonto −= netto/2; v.wechselKonto −= netto/2  // je zur Hälfte, wie heute
```

| Marke (Haltung des Nehmers) | Gewinn | Streuung | Patzer | Bild |
|---|---:|---:|---:|---|
| Absichern („kurze Marke") | ×0,6 | ×0,7 | ×0,5 | Nehmer wartet, Stab kommt sicher an |
| Normal | ×1,0 | ×1,0 | ×1,0 | wie heute |
| Angreifen („weite Marke") | ×1,4 | ×1,3 | ×2,0 | Nehmer zieht früh an, der Stab kommt vielleicht nicht sauber |

Werte sind Opus' Vorschlag vom 26.09., im Modell so gerechnet. Die richtige Wahl hängt am
Paar: zwei gute Wechsler gewinnen mit „Angreifen", zwei schwache verlieren damit (I-Spy-Prinzip
der monotonen Politik). **Bein 1 startet aus dem Block — kein Gewinn, keine Marke.**

### 3.3 Baustein B2 — Der Zug (Haltung auf dem Bein: übertreffen oder einbrechen)

```
Angreifen:  halt = 1 + 0,05                                        // bis 45 % des Beins
            ab 45 %: halt = max(0,80; 1,05 − (100 − traeger)·0,00004·(anteil − 0,45)·100)
            traeger = 0,5·WUCHT + 0,5·TECHNIK                       // "Zug und Übersicht"
Absichern:  halt = 1 − 0,012                                        // gleichmäßig, kein Fade
Normal:     halt = 1                                                // bit-identisch
```

* **Break-even bei `traeger` ≈ 65:** darüber bringt der Angriff netto Zeit, darunter endet er
  langsamer als Normal — der Läufer „bricht ein", sichtbar als Fade und als Banner. Das ist
  Chris' Satz in einer Zeile: Risiko → übertrifft sich (hoher Zug) oder bricht ein (niedriger).
* **Warum WUCHT + TECHNIK und nicht Puste:** die Reserve kann auf 1,7 s nicht binden (1.); ein
  Angriffs-Budget über Puste bräuchte Zehr ×9 und wäre eine Erfindung. Der Fade-Kanal ist
  derselbe wie `mued`, nur mit anderem Träger. WUCHT allein (Spirit 45) schießt Spirit über die
  Matrix (19,4 vs 16, 5.3); halb TECHNIK zieht Awareness/Dexterity/Charisma mit hoch, die alle
  unter der Matrix liegen. **Das ist die Mehrwege-Leitlinie innerhalb eines Kanals:** Zug ist
  der Primärweg, Übersicht der Nebenweg.
* `SPITZE_ZUG` (`:37469`) bleibt, wie es ist — es ist tot und stört nicht.

### 3.4 Baustein B3 — Die Automatik (Stufe 1) und der Manager (Stufe 2)

**Stufe 1 — deterministisch aus Kader und Persönlichkeit, keine Oberfläche.** Dasselbe Muster
wie `sandsackPersoenlichkeit()` (Paket 1 Sandsack-Finale, `team`-Wert aus Zusammenhalt/Bindung/
Zielneigung/Haltung) plus die Eignung des Läufers:

| Persönlichkeit (PERSZIEL/PERSDEF) | Haltung Bein | Marke (als Nehmer) |
|---|---|---|
| Draufgänger (`speer`, `wild`) | Angreifen, immer | Angreifen |
| Duellant (`bedrohung`) | **bedingt:** Angreifen, wenn die Seite beim Beinstart hinten liegt | Normal |
| Opportunist (`schwach`) | Angreifen nur, wenn `traeger` ≥ 65 (rechnet) | Normal |
| Bollwerk (`naechster`, `vorsichtig`) | Normal | Absichern, wenn Paar-TECHNIK < 50 |
| Beschützer (`schild`, `defensiv`) | Absichern | Absichern |
| Schleicher (`hinten`) | Normal | Normal |

Dazu eine Kader-Regel, die über der Persönlichkeit liegt: ein Paar mit TECHNIK-Schnitt ≥ 55
darf scharf wechseln (Opus-Schwelle), unter 45 wird abgesichert — ein Draufgänger mit
Butterfingern bekommt also keine weite Marke. **Im Modell steht die reine Kader-Regel** (5.3,
„KI-Vorgabe": Angreifen bei `traeger` ≥ 65, Absichern bei Paar-TECHNIK < 45); die Persönlichkeits-
tabelle ist der Vorschlag für den Bau, nicht gemessen — `leitePers()` war im Scratch nicht
nachzubauen.

**Bedingte Anweisung** („Schlussmann greift an, wenn hinten") ist Befund B aus dem 02.10.-Papier:
vorher gesetzt, in der Simulation ausgelöst, im Ticker sichtbar („Anweisung greift: Kessa geht
alles raus"). Sie ist situativ — das war der Sog-Fehler — aber hier hängt der **Ausgang** am
eigenen `traeger`, die Lage entscheidet nur, *ob* er angreift. Modell 5.3: rho-neutral, kippt
15 % der Sieger.

**Stufe 2 — der Manager setzt die Haltung je Läufer** in der Einsatzliste (Absichern/Normal/
Angreifen, Vorgabe „Automatik"). Braucht das Grundgerüst aus Zeile 0 des 02.10.-Papiers
(Übergabe `{d,slot,haltung}` statt `{d,slot}` in `arena-kader-adapter.ts`, dabei Formkarte/
Intensität reparieren). Das wird für Gewichtheben ohnehin gebaut — **die Staffel sollte derselbe
Bau sein, nicht ein zweiter.** Chris' Frage im Aufstellungsdialog wird: „Traue ich diesen beiden
den scharfen Wechsel zu — und hat mein Anker den Zug, es hinten raus zu tragen?"

### 3.5 Baustein B4 — Das Bild (Klasse A/A\*, ohne Sendezeit)

Nichts davon verändert Simulation oder Dauer; alles liest Felder, die B1–B3 ohnehin schreiben.

1. **Anlaufmarke sichtbar.** `u.vizAnlauf` zieht den Nehmer heute ab 86 % des Vordermann-Beins
   an (`STAFFEL_ANLAUF_AB`). Mit Marke: Absichern 0,92, Normal 0,86, Angreifen 0,78 — man **sieht**
   die weite Marke, bevor der Stab kommt. (Das ist der kleine Hebel aus dem 02.10.-Papier, hier
   nur noch Anzeige.)
2. **Wechsel-Zeile mit Vorzeichen.** Heute „X übergibt an Y — 0,21 s im Wechsel". Neu:
   „scharfer Wechsel: −0,12 s gewonnen" / „sicher übergeben: +0,05 s" / „Wechsel verpatzt bei
   weiter Marke: +0,41 s" — die Schwimm-Zahl (2.5).
3. **Bein-Duell-Banner** (Muster: Break-Banner Tennis, PR #1135): nach jeder Übergabe „Bein 3:
   Kessa 1,68 s gegen Draco 1,74 s — Bein gewonnen". Sechs Banner je Rennen gegen heute null; das
   ist das Maß „gegen den Gegner auf demselben Bein", das ST-P2 ohnehin braucht.
4. **Abstandsuhr** im Bug (Ekiden): „+0,31 s" / „−0,08 s", gefärbt in Teamfarbe, springt an jeder
   Übergabe. A\* (ein Merker je Übergabe).
5. **Einbruch-Banner**: „Draco bricht ein — der Angriff trägt nicht" (big, wenn der Führende).
6. **Anweisungsbilanz im Endstand** (Fable 4.2): „Durch Wechsel gewonnen: −0,31 s · Angriffe:
   2 getragen, 1 eingebrochen". Chris sieht, ob der Rennplan sich gelohnt hat.
7. **Team-Feier Phase 2** bekommt mit „Scharf-Wechsel gelungen" und „Gegner bricht ein" zwei
   Auslöser mehr als die drei aus dem 30.09.-Konzept.

**Ereignisrechnung je Rennen (154 Zuschausekunden):** heute 10 Übergabe-Zeilen + ~0,3 Patzer +
~1,0 Führungswechsel ≈ **11**. Mit Konzept: 10 Übergaben mit Vorzeichen + 6 Bein-Duell-Banner +
~1,5 Führungswechsel + ~1,8 Angriffsmomente (getragen/eingebrochen) + ~0,3 Patzer + Abstandsuhr
bei jeder Übergabe ≈ **20** — ohne eine Sekunde mehr Sendung. Die längste bannerlose Strecke
fällt von 85 s auf die Dauer eines Beins (~25 s).

---

## 4. Optionen mit Aufwand und Risiko

| Option | Inhalt | Klasse | Aufwand | Risiko | Modell |
|---|---|---|---|---|---|
| **O1 Marke pur** (B1 + KI-Marke + B4.1/B4.2) | ST-P1 wie Opus, plus WUCHT in `Q` | B (+A) | klein (~40 Zeilen im Wechselzweig, Konstanten, Ticker) | gering; Patzer steigen 0,29 → 0,45 je Rennen | rho 0,902 · Pp 31,7/33,5 · kippt 7 % |
| **O2 Marke und Zug** (B1 + B2 + B3 Stufe 1 + B4) — **Empfehlung** | wie O1, dazu Haltung auf dem Bein und Persönlichkeits-Automatik | B (+A/A\*) | mittel (~120 Zeilen, Pp-Sonde, Sichtprobe) | Break-even muss sitzen (5.2); Spirit-Überschuss bei falschem Träger | rho 0,911 · Pp 30,2/31,1 · kippt 10 % |
| **O3 O2 + bedingter Schlussmann** | Duellant/Anker greift an, wenn hinten | B | klein obendrauf | situativ — nur mit Vorher/Nachher-Messung | rho 0,914 · kippt 15 % · Zielabstand 0,29 |
| **O4 O2 + Stufe 2 Manager-Feld** | Haltung in der Einsatzliste | **S** (+B) | mittel, zusammen mit Gewichtheben-Grundgerüst | Zufallsfall gemessen: rho 0,902, Sentinel 0,825 | V2z in 5.3 |
| **O5 Verfolgungsstaffel** (4.4) | Team Pursuit: Start gegenüber, Einholen beendet | **W + B**, evtl. T | groß | bricht Einzelwertung (12 Läufer brauchen 12 Etappen) | **nicht empfohlen** |
| **O6 Beine mit Charakter** (ST-P2) | Kurven-/Geradenbeine, Rangnorm gegen Gegner auf demselben Bein | B | mittel–groß | Bein-Bias, braucht neues Maß | nicht modelliert; B4.3 bereitet das Maß vor |
| **O7 Eingespielte Paare** (Fable 4.1) | Saisonzähler je Geber/Nehmer-Paar, bis +0,10 auf `Q` | **S** | mittel | gering, kleiner Bonus | setzt O1 voraus |

### 4.1 Warum O2 und nicht O1

O1 löst Pp am stärksten (die Marke ist der Charisma-Kanal) und ist der kleinste Bau — aber sie
liefert nur Momente **an den Übergaben**, also genau da, wo die Staffel heute schon ihre einzigen
Momente hat. Chris' Satz handelt vom Läufer, der sich übertrifft oder einbricht — das passiert
**auf dem Bein**, und das ist B2. Erst mit B2 bewegt sich der Abstand zwischen den Übergaben
(Führungswechsel 1,03 → 1,48), und erst B2 gibt dem Anker eine Rolle. O1 ist der sichere erste
Bauschritt *innerhalb* von O2, nicht die Alternative dazu.

### 4.2 Warum B2 ohne B1 nicht reicht (V4 in 5.3)

Bein-Haltung allein: rho 0,886, Pp 36,7/37,5 — kein Pp-Gewinn, weil der Tempo-Kanal die
Attribute trägt, die ohnehin überzeichnet sind. Die Marke ist der Teil, der die *richtigen*
Attribute ins Ergebnis bringt; der Zug ist der Teil, den man sieht.

### 4.3 Was bewusst nicht vorgeschlagen wird

* **Anfeuerung der Wartenden als Tempo** (Fable 4.4): Team-Mittel, ordnet die Einzelwertung nach
  den Attributen der *anderen* — das Sog-Problem in Reinform.
* **Puste als Angriffsbudget:** strukturell tot auf 1,7 s (1.), und ein neues Budget nur für die
  Staffel wäre eine zweite Reserve neben der ersten.
* **Windschatten/Break nach Bein 1** (4×400-Muster): gemessen rho-schädlich (0,762 → 0,601).
* **DQ/Team-DNF bei weiter Marke:** entschieden (1.1), und das Modell zeigt, dass der kleine,
  häufige Patzer (0,34 Sim-s) enge Rennen entscheidet, ohne Spiele zu entwerten.
* **Mehr Beine oder längere Beine:** mehr Ereignisse heben die Verlässlichkeit, nicht die
  Validität (CLAUDE.md, Hockey-Befund) — und sind T.

### 4.4 Um die Ecke gedacht und verworfen: die Verfolgungsstaffel

Die radikalste Idee dieser Nacht: beide Teams starten **gegenüber** auf dem Oval (Team Pursuit),
im Bild gibt es nur noch einen Abstand, und wer den Gegner **einholt**, hat sofort gewonnen. Das
wäre der größte Hebel für die Dramaturgie (der Abstand ist das ganze Bild) und ein eigener
Sendungsbogen wie das Sandsack-Finale. Verworfen, aus drei Gründen: (1) **W** — die Wertung
ändert sich (Einholen statt Zielzeit), (2) beim Einholen laufen die restlichen Beine des
eingeholten Teams nicht mehr — ohne Etappenzeit keine Einzelwertung, `MOTOREN.staffel.wert()`
und die rho-Sonde brechen (zwölf Läufer brauchen zwölf Etappen), (3) ein Einholen ist nur bei
großem Eignungsabstand möglich, also genau dort, wo die Rangordnung ohnehin stimmt — es erzählt
nichts Neues. Ließe man die Beine trotzdem auslaufen, wäre „Einholen" nur ein Banner — und das
ist B4.4 (Abstandsuhr) in anderer Verpackung. Festgehalten, damit es nicht ein zweites Mal
recherchiert wird.

### 4.5 Reihenfolge als Taktik (Roger Black 1991)

Die Recherche macht klar, dass die **Reihenfolge** die zweite große Staffel-Entscheidung ist.
Heute: Bester auf Slot 0, KI nach Eignung (entschieden 1.2). Mit B1/B2 bekommt die Reihenfolge
erstmals Konsequenzen (wer bildet mit wem ein Paar, wer ist Anker mit Zug) — aber ein echtes
„wer läuft wo" braucht ST-P2 (Kurven-/Geradenbeine) und das Maß gegen den Gegner auf demselben
Bein (B4.3 bereitet es als Anzeige vor). Das ist eine Folgerunde, keine Vorbedingung.

---

## 5. Offline-Diagnose: rho und Pp

### 5.1 Das Modell trifft den Motor

| Größe | Motor (`main`, PR #1123/#1127) | Modell V0 |
|---|---:|---:|
| rho je Spiel, Median 5 Paarungen, n=48 | 0,895 | 0,881 |
| Pp, n=48, zwei Saatströme | 37,7 / 41,1 | 36,3 / 36,7 |
| Speed / Stamina / Spirit (Matrix 24/16/16) | 34,7 / 23,6 / 14,6 | 35,9 / 22,3 / 15,7 |
| Awareness / Charisma / Dexterity / Will (12/10/8/8) | 7,6 / 3,1 / 4,9 / 6,9 | 8,0 / 4,0 / 3,6 / 7,3 |
| vigilante-armageddon | **0,698** | 0,811 |

Alles bis auf den Sentinel liegt innerhalb ±1,5 Pp bzw. ±0,015 rho. **Den Sentinel-Absturz
reproduziert das Modell nicht** — er hängt vermutlich an Slot-/Form-/Trait-Zuschlägen oder der
konkreten Slot-Aufstellung, die das Modell nicht kennt (Top-6 nach `d.staffel`, Bester vorn).
Alle Sentinel-Zahlen unten sind deshalb nur **Richtung**, keine Vorhersage für den Motor.

### 5.2 Erster Anlauf: der Angriff, der immer verlor

Mit Fade-Beiwert 0,0010 (statt 0,00004) war Angreifen für jeden Läufer unter WUCHT ~97 ein
Netto-Verlust: rho 0,811, Sentinel 0,58, Favorit gewinnt 43,8 %, Star auf Rang 1 nur 40,8 %,
**Charisma-Anteil 0,0** (die Angreifer mit hohem Charisma verloren), Pp 43,3. „Alle Angreifen"
sah dagegen gut aus (rho 0,904, Star 82,9 %) — weil alle gleich litten und die WUCHT-Unterschiede
nur verstärkt wurden. Das ist die Falle: eine Mechanik kann im Extremfall „alle" glänzen und in
der realen Mischung aus Angreifern und Normalen die Rangordnung zerlegen. **Kalibrierziel für
den Bau: Break-even des Angriffs bei `traeger` ≈ 60–65, nachgewiesen mit der KI-Mischung, nicht
nur mit den Extremfällen.**

### 5.3 Ergebnisse, kalibriert (Fade 0,00004, Plus 0,05, Träger 0,5·WUCHT+0,5·TECHNIK, FLIEG_MAX 0,24; n=48 rho, n=24 Pp, zwei Saatströme)

| Variante | rho/Spiel | rho Saison | Sentinel | Pp (S1/S2) | Führungs-wechsel | Zielabstand (Sim-s) | knapp < 0,3 s | Favorit gewinnt | Star Rang 1 | Patzer | Angriffe eingebrochen | Sieger kippt |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| V0 Basis (heute) | 0,881 | 0,907 | 0,811 | 36,3 / 36,7 | 1,03 | 0,44 | 42 % | 71 % | 66 % | 0,29 | — | — |
| V1 Marke, alle Normal (FLIEG 0,16) | 0,895 | 0,907 | 0,853 | 35,3 / 35,7 | 1,02 | 0,42 | 43 % | 72 % | 65 % | 0,29 | — | 0 % |
| V1k Marke mit KI (ST-P1 pur, FLIEG 0,16) | 0,902 | 0,907 | 0,860 | 31,7 / 33,5 | 1,02 | 0,41 | 42 % | 70 % | 63 % | 0,45 | — | 7 % |
| V1k, FLIEG 0,32 | 0,918 | 0,918 | 0,881 | 29,4 / 30,3 | 0,94 | 0,37 | 44 % | 75 % | 56 % | 0,45 | — | 8 % |
| **V2 Marke + Zug, KI-Vorgabe** | **0,911** | **0,925** | **0,867** | **30,2 / 31,1** | **1,48** | **0,31** | **50 %** | 71 % | **77 %** | 0,31 | 1,8 | **10 %** |
| V2 mit Träger nur WUCHT | 0,916 | 0,930 | 0,916 | 36,3 / 36,9 | 1,09 | 0,43 | 37 % | 85 % | 72 % | 0,34 | 3,2 | 13 % |
| V2x alle Angreifen (Extrem) | 0,895 | 0,916 | 0,867 | 35,6 / 35,7 | 1,07 | 0,41 | 40 % | 78 % | 71 % | 0,71 | 11,6 | 10 % |
| V2y alle Absichern (Extrem) | 0,907 | 0,907 | 0,860 | 36,3 / 36,8 | 1,00 | 0,39 | 45 % | 71 % | 64 % | 0,15 | 0 | 5 % |
| V2z Zufalls-Haltung (schlechtester Fall) | 0,902 | 0,911 | 0,825 | 32,8 / 34,1 | 1,65 | 0,36 | 47 % | 75 % | 60 % | 0,37 | 3,4 | 15 % |
| V3 V2 + Schlussmann bedingt | 0,914 | 0,916 | 0,874 | 30,2 / 31,1 | 1,55 | 0,29 | 52 % | 76 % | 77 % | 0,31 | 2,8 | 15 % |
| V4 nur Zug, ohne Marke | 0,886 | 0,900 | 0,860 | 36,7 / 37,5 | 1,13 | 0,41 | 41 % | 80 % | 69 % | 0,29 | 3,2 | 9 % |

Attributanteile V2 (Matrix in Klammern): speed 34,3 (24) · stamina 19,8 (16) · spirit 17,0 (16)
· awareness 8,8 (12) · charisma 7,0 (10) · dexterity 4,3 (8) · will 5,8 (8) · determination 3,0
(4) · health 0 (2). Gegenüber V0 steigt Charisma von 4,0 auf 7,0, Awareness von 8,0 auf 8,8,
Dexterity von 3,6 auf 4,3; Stamina fällt von 22,3 auf 19,8. **Der Rest (Speed +10) sitzt im
Tempo-Kanal** — vier der sieben Sub-Skills lesen Speed, und `tempoSpanne 0,90` trägt ihn
durch. Das ist mit keinem Wechsel-/Haltungskonzept zu beheben und gehört in eine eigene
Rezept-/Nenner-Runde (die bisherigen, PR #1123, waren dort „chaotisch"). **Pp ≤ 25 bleibt
offen; dieses Konzept bewegt Pp in die richtige Richtung und verschlechtert nichts.**

### 5.4 Lesart

* **Validität steigt, nicht nur die Spannung.** rho Saison 0,907 → 0,925: die Mechanik belohnt
  mehr vom Richtigen (Charisma, Awareness bekommen Kanäle), nicht nur lauter.
* **Der Sentinel bewegt sich in die richtige Richtung** (0,811 → 0,867 im Modell), aber ob das
  die 0,698 im Motor über 0,80 hebt, weiß nur die Motor-Messung bei n=48. Das ist **die**
  Abnahmebedingung dieses Konzepts, nicht der Median.
* **Der Träger entscheidet über Pp, nicht über rho:** nur WUCHT gibt rho 0,916 / Sentinel 0,916,
  aber Pp 36,3 (Spirit 19,4); halb TECHNIK gibt Pp 30,2 bei rho 0,911. Beides ist vertretbar —
  CLAUDE.md sagt rho vor Pp, aber der rho-Unterschied liegt im Rauschen (Spannweite 0,14), der
  Pp-Unterschied nicht. Empfehlung: 0,5/0,5, am Motor nachprüfen.
* **Zufällige Haltungen kosten 0,01 rho** (V2z gegen V2) und 0,04 beim Sentinel: der Manager kann
  mit falschen Haltungen Rennen verlieren (15 % kippen), aber nicht die Rangordnung zerlegen. Das
  ist genau das Verhältnis, das Designregel 2 („Obergrenze im eigenen Korridor") verlangt.
* **Größe des fliegenden Gewinns ist ein Zielkonflikt:** FLIEG_MAX 0,32 gibt rho 0,918 und Pp
  29,4, aber der Star landet nur noch in 56 % auf Rang 1 (von 63 %) — weil der Gewinn hälftig
  auf beide geht und das eigene Bein weniger wiegt. 0,24 ist der Kompromiss im Modell; am Motor
  mit „Star auf Rang 1" und „Paartreue mit Abstand" nachmessen, nicht nur mit rho.
* **Was das Modell nicht kann:** Slot/Form/Trait, Zweier- bis Fünfer-Staffel (nur Sechser
  gerechnet — B1/B2 sind beingrößenunabhängig, B3 muss `jeSeite` 2–6 abfangen), die exakte
  Tick-Länge des Motors, die Persönlichkeitstabelle aus 3.4.

---

## 6. Klasse-Einordnung (ehrlich, von Chris zu bestätigen)

| Teil | Klasse | Begründung |
|---|---|---|
| B1 Marke, B2 Zug, B3 Stufe 1 | **B** | Mechanik-Änderung in `stepSpurt`/`tempoVon`, neues Feld `u.haltung` am Läufer-Objekt (kein Spielstand). Keine Wandzeit-Änderung: das Rennen bleibt ~10,5 Sim-s, die Marke verschiebt Übergaben um ±0,2 Sim-s (<2 %). Keine Wertungsänderung: `bahnLeistung` bleibt `−etappenZeit + wechselKonto`, Teamsieg bleibt Zielzeit. **Nach dem Session-Muster (PR #1127/#1136) baut ein Agent Klasse B nicht ohne Chris' Go.** |
| B3 bedingte Anweisung | B | wie oben, ein Lesezugriff auf die Führung beim Beinstart — situativ, deshalb mit Vorher/Nachher-Pflicht |
| B3 Stufe 2 (Manager-Feld) | **S** | neues Feld in der Einsatzliste, Übergabe `{d,slot,haltung}`, Persistenz — Chris entscheidet; identisch mit Zeile 0 des 02.10.-Papiers |
| B4.1/B4.2/B4.3/B4.5 | A | reine Anzeige aus vorhandenen Feldern, kein `rr()` |
| B4.4 Abstandsuhr, B4.6 Bilanz | A\* | je ein Merker im HUD-/Endstand-Pfad |
| Rennplan-Tafel vor dem Start (nicht empfohlen) | **T** | jede Sekunde vor dem Startschuss ist Zuschauzeit, die der Zuschauer nicht gewählt hat — wie die Lastenplan-Tafel beim Sandsack. **Empfehlung: den Rennplan in die vorhandene Einlauf-Bauchbinde legen (A), keine Tafel.** Falls Chris die Tafel will, ist das seine T-Entscheidung. |
| O5 Verfolgungsstaffel | W + B (+T) | nicht empfohlen (4.4) |

Zweimal lag eine Selbsteinstufung „nur Anzeige" daneben (Fechten PR #1111, D7 PR #1117). Deshalb
hier die Gegenprobe: **Gibt es irgendeinen Teil, der die Sendedauer ändert?** Nein — kein neuer
Stopp, keine Pause, keine Tafel, keine verzögerte Enthüllung; die Simulation läuft im selben
`loop()`-Takt. Einbrüche verlangsamen einen Läufer um bis zu 20 % über die zweite Beinhälfte,
das sind im Extrem +0,2 Sim-s je Bein, also unter 3 Zuschausekunden je Rennen — keine
Sendezeitänderung im Sinne des Broadcast-Papiers, aber ich nenne es, damit Chris es weiß.

---

## 7. Prüfweg, falls Chris Ja sagt

1. **Vorher-Messung** auf dem Bau-Commit: `node scripts/miss-alle-disziplinen.mjs 48 staffel`
   (Einzelpaarungen über `.varianten` ausgeben, nicht nur Median), `node scripts/messe-arena-einfluss.mjs
   staffel 48` und `…-zweiter-saatstamm.mjs staffel 48`, dazu Star-auf-Rang-1 und Paartreue mit
   ≥ 15 Punkten Abstand (Muster `docs/design/hockey-opus-review-nhl.md` 5.3).
2. **Bau O1 zuerst** (Marke, KI-Marke, Ticker-Vorzeichen) — Haltung aller auf „normal" muss
   bit-identisch zu heute messen (Designregel 1). Dann O2 (Zug, Automatik Stufe 1).
3. **Nachher**, je Stufe: dieselben Sonden; Pflichtfälle KI-Vorgabe beider Seiten, „alle
   Angreifen", „alle Absichern", Zufalls-Haltung (Hash aus dem Namen, wie im Modell). Abnahme:
   rho Median > 0,80 **und** vigilante-armageddon > 0,80 bei n=48 (Sentinel als Veto, wie in
   PR #1127 vereinbart), Pp nicht schlechter als 37,7/41,1 (Ziel ≤ 25 bleibt offen, s. 5.3),
   Star auf Rang 1 nicht unter heutigem Wert.
4. **Break-even-Nachweis** (5.2): Angreifer mit `traeger` ≥ 65 sind im Mittel schneller als ihr
   Normal-Lauf, unter 55 langsamer — als eigene Tabelle in der PR.
5. **Isolation**: `miss-alle-disziplinen.mjs 24 spurt time-trial takeshis-castle climbing`
   bit-identisch (alles hinter `BA().staffel` gegated).
6. **Sichtprobe** `scripts/screenshot-disziplin.mjs staffel` und `scripts/probe-staffel-ton.mjs`
   (die Übergabe-Töne hängen an `u.gestolpert`, das bleibt).
7. **Beingrößen 2–6** (`staffelProbe` mit `art.jeSeite` 2/4/6): Bein 1 ohne Marke, letztes Bein
   als Anker — die Automatik darf bei zwei je Seite nicht auf einen nicht existierenden
   Mittelläufer zeigen.

---

## 8. Entscheidungsvorlage für Chris

1. **Konzept „Marke und Zug" grundsätzlich: Ja / Nein / nur O1 (Marke)?**
2. **Haltung als eigene Achse neben Intensität** (Schonen/Normal/Pushen bleibt die
   Kraftreserve über die Saison) — die offene Frage 1 aus dem 02.10.-Papier gilt hier genauso.
   Ich empfehle: eigene Achse, ein Feld für Bein **und** Marke (3.1), nicht zwei.
3. **Stufe 1 (Automatik aus Persönlichkeit, ohne Oberfläche) zuerst?** Ich empfehle Ja — wie beim
   Sandsack-Finale, gleiches Muster, kein neues Grundgerüst nötig.
4. **Bedingter Schlussmann** (O3, „Angreifen, wenn hinten"): Ja / Nein? Modell: rho-neutral, kippt
   15 % der Sieger, Zielabstand 0,29 — der dramatischste Baustein, aber situativ.
5. **Rennplan im Einlauf (A) oder eigene Tafel (T)?** Ich empfehle Einlauf.
6. **Träger des Angriffs**: 0,5·WUCHT + 0,5·TECHNIK (Pp-günstig, Empfehlung) oder reines WUCHT
   (rho-günstig, Spirit überzeichnet)?
7. **Fliegender Gewinn `FLIEG_MAX`**: 0,24 (Kompromiss) — oder größer (mehr rho/Pp, weniger
   Star-auf-Rang-1)?
8. **Stufe 2 (Manager-Feld) zusammen mit dem Gewichtheben-Grundgerüst bauen** — Ja / später?
9. **Soll die Pp-Lücke im Tempo-Kanal (Speed +10)** als eigene Runde angesetzt werden? Sie ist
   unabhängig von diesem Konzept und bisher bei jeder Konstantenkalibrierung „chaotisch" gewesen.

---

## 9. Abnahme dieser Runde

* `git diff --stat` gegen `origin/main`: nur diese Datei. **Kein Code geändert**, keine Engine-
  Zeile, kein Skript committet.
* Modell-Skript liegt außerhalb des Repos (Scratch), wie bei den Opus-/Fable-Konsultationen
  #1137/#1138; die Formeln stehen vollständig in Abschnitt 3 und 5, damit eine Bau-Runde sie
  ohne das Skript nachrechnen kann.
* Keine Eignungsmatrix-Zeile berührt oder in Frage gestellt (`official-discipline-weights.ts`
  bleibt die Ansage; dieses Konzept arbeitet daran, sie durchzureichen).
* Keine Breakdance-, keine DNF-, keine K5-Recherche wiederholt.

## Quellen

* [SCA USATF, 2018 Track & Field rule changes (30-m-Zone)](https://www.scausatf.org/2018-track-field-rule-changes/)
* [Wikipedia, 4 × 100 metres relay](https://en.wikipedia.org/wiki/4_%C3%97_100_metres_relay)
* [Trackbarn, What is a relay in track and field](https://trackbarn.com/blogs/faq/what-is-a-relay-in-track-and-field)
* [Marathon Handbook, Why relays are the most underrated track event](https://marathonhandbook.com/why-relays-are-the-most-underrated-track-event/)
* [Athletics Weekly, An in-depth look into the 4x400m relay](https://athleticsweekly.com/performance/an-in-depth-look-into-the-4x400m-relay-1039972814/)
* [Science of Running, Why our attention to times is killing the sport](https://www.scienceofrunning.com/2016/05/why-our-attention-to-times-is-killing.html)
* [Wikipedia, Team pursuit](https://en.wikipedia.org/wiki/Team_pursuit)
* [Wagner et al., Evolving pacing strategies for team pursuit track cycling (arXiv 1104.0775)](https://arxiv.org/pdf/1104.0775)
* [SkiTrax, FIS XC competition rules updates mean more suspense for TV audience](https://skitrax.com/fis-xc-competition-rules-updates-mean-more-suspense-for-tv-audience/)
* [Olympic.ca, Biathlon 101](https://olympic.ca/2025/11/27/biathlon-101-everything-you-need-to-follow-team-canada-on-the-range-and-the-snow)
* [Aquatics GB / Swiss Timing, Relay break detection](https://aquaticsgb.com/documents/350/Swiss_Timing_Relay_Break_Detection_Communication.pdf)
* [Japan Running News (Brett Larner) via German Road Races, Hakone Ekiden broadcast](https://news.germanroadraces.de/?p=226793)
* [World Athletics, Land of the rising run](https://worldathletics.org/competitions/world-athletics-championships/world-athletics-championships-tokyo-2025-7190593/news/series/land-of-rising-run-national-running-boom)
* Repo: `staffel-modellierung-recherche-05-09.md` (K4, Zarębska 2021, Bry 2009),
  `bahn-disziplinen-opus-konzeptreview-26-09.md` (ST-P1/P2/P3), `fable-ideen-bahn-30-09.md` (4.1/4.2),
  `bahn-staffel-pp-rezeptrunde-02-10.md`, `bahn-staffel-wechsel-kurve-kalibrierung-02-10.md`,
  `manager-risiko-interaktivitaet-konzept-02-10.md`, `gewichtheben-sandsack-finale-paket1-umsetzung-03-10.md`
  (PERSZIEL/PERSDEF-Muster), `team-publikum-feiermomente-konzept-30-09.md` (Phase 2 Staffel).

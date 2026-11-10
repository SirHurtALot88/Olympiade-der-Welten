# Alle zwanzig Disziplinen auf Top-Niveau: Fahrplan (PM, 09.11.)

Auftrag, Chris wörtlich: „ja nicht nur sagen was fehlt, opus ist doch PM, der soll mal sagen was
gemacht werden muss damit alle 20 diszis am ende auf so nem top level sind!" Dieses Dokument ist
deshalb **kein weiteres Audit**, sondern ein Bauplan: was wofür gebaut wird, in welcher
Reihenfolge und mit welchem Aufwand.

**Zweite Fassung (09.11., abends): aus den offenen Fragen sind Entscheidungen geworden.** Chris
auf die Absicht, ihm E1–E6 zur Wahl vorzulegen: „opus is dein PM der kann sowas und darf es
entscheiden!" Abschnitt 5 hält deshalb keine Optionen mehr fest, sondern Entscheidungen mit
Begründung. Abschnitt 4 ist eine Auftragsliste, die ein Koordinator direkt an Bau-Agenten geben
kann. **Zwei Dinge bleiben ausdrücklich bei Chris und sind von der Ermächtigung nicht gedeckt:**
jede neue PixelLab-Figur, -Animation oder -Requisite, und jeder Merge. Die Merge-Reihenfolge in
Abschnitt 4 ist eine Empfehlung. Ob etwas gemergt ist, steht in diesem Dokument nirgends als
Tatsache.

**Dritte Fassung (10.11.): Der PM bestimmt die Reihenfolge, und die Wertung steht jetzt vor dem
Bild.** Chris, wörtlich: „Reihenfolge etc bestimmt opus pm der führt dich durchs projekt". Und zur
neuen obersten Priorität: „Das was auf dem Feld passiert soll auch das in den Stats sein! Und das
in jeder Disziplin!" Diese Fassung ändert deshalb dreierlei:

1. **Neuer Abschnitt W (vor allem anderen):** Football, Hockey, TDM und das Battlefield-Duell auf
   echte Wertung. Mit eigener Diagnose je Disziplin. Das Ergebnis weicht an zwei Stellen vom
   Briefing ab: **Football ist kein Rezeptfall**, sondern hat einen Zielkonflikt zwischen den
   beiden Abnahmen (W.2). **Das Battlefield-Duell wird in der Liga gar nicht gebucht** (W.4).
2. **Die Etiketten-Arbeit** aus `spieler-labels-weniger-text-10-11.md` (L0–L3) ist in die
   Auftragsliste einsortiert (Abschnitt 4.3, E12).
3. **Die Merge-Warteschlange ist neu geordnet** (Abschnitt 4.1, E13). #1370, #1372 und #1360
   kommen hinzu. Die Kulissen-PRs rücken nach hinten, weil sie sich gegenseitig blockieren.

**Die verbindliche Gesamtreihenfolge steht in Abschnitt G**, direkt nach dieser Tabelle. Alle
Zahlen, die ich in dieser Fassung neu nenne, habe ich nachgeprüft: am Code, an
`data/generated/disziplin-abnahme.json` und per Probe-Merge (`git merge-tree`). Die
Override-Korrelation in W.2 habe ich selbst nachgerechnet.

### Die Entscheidungen auf einen Blick

| # | Frage | Entschieden (Begründung: Abschnitt 5) |
|---|---|---|
| E1 | Welches Spurt-Format im echten Spiel, und wie wird gewählt? | **Fest im Saisonkalender über den Durchgang** (Option A, über das schon vorhandene `occurrenceInSeason`). **1. Durchgang HYROX, 2. Durchgang klassisch.** Die Hatz kommt erst nach ihrer Nacharbeit dazu und wechselt sich dann im 2. Durchgang saisonweise mit klassisch ab. Kein Hash, keine Liga-Einstellung. Gilt ab der nächsten neu angelegten Saison. |
| E2 | Zielbänder der Sendedauer | Zielwert je Disziplin und Format, **Toleranz ±15 %**, Leitplanke **0:50–5:00** ohne ausdrückliche Vorgabe von Chris. **Hatz 3:00** (30 s je Welle), **Battlefield-Pod 3:30**, **Climbing 1:30**, **Spurt klassisch zurück auf 3:00**, HYROX 3:30 (3:52 liegt im Band). Alle anderen: Ist ist Ziel. |
| E3 | Takeshi: Einzelrangliste? | **Nein.** Takeshi bleibt teamzentriert. P2.5 ist gestrichen. |
| E4 | Rangliste im Bild oder daneben? | **Im Bild, auf der Leinwand**, oben rechts nach dem HYROX-Muster. Die Ecke ist ein Parameter. Die DOM-Tabellen bleiben als Zusatz bestehen, `#ttroster` wird nicht umgebaut. |
| E5 | Kulissen-Politur Football/Hockey/TDM | **Zurückgestellt**, bis Strang M sie in die organische Wertung bringt. Ausnahme: Fehlerbehebung. |
| E6 | PixelLab | **Die Hatz geht ohne neue Figur live.** Der Fegearm bleibt ein unbestellter Vorschlag an Chris. Die kahlen Grundfiguren werden erst untersucht (Auftrag A2). |
| E7 | Bau-Reihenfolge und Zuständigkeit | **Ersetzt durch E8 und Abschnitt G** (10.11.). Die Zonenregel aus 4.2 gilt weiter und ist um zwei Zonen für Strang W erweitert. |
| **E8** | **Priorität (10.11.)** | **Strang W (Feld = Wertung) geht vor jeder visuellen Arbeit.** Er belegt zuerst beide Engine-Slots. Die Fahrplan-Aufträge A3 und folgende laufen an der Engine nur in einem Slot, den W gerade nicht braucht (Abschnitt G). |
| **E9** | **Reihenfolge in W** | **Hockey zuerst** (am nächsten an der Schranke, schon angeschlossen, rho durch Chris abgedeckt), **gleichzeitig TDM** in der anderen Zone. **Football danach**, erst nach Chris' Antwort auf Q-F. Das Battlefield-Duell bekommt **keinen** Mechanikbau, nur einen Nachweis (W.4). |
| **E10** | **TDM: Gefecht statt freier Kampf** | TDM wird nach dem **Battlefield-Gefecht-Muster** gewertet: deterministisch aus den Matrix-Kanälen entschieden, von der Arena abgespielt. Chris hat das Muster am 02.11. für Battlefield gewählt. Das sichtbare Format bleibt (6 gegen 6, Respawn, kein Kill-Limit, 3:00). Begründung: W.3. |
| **E11** | **Hockey: Rezept zuerst, K-Schock als Rückfall** | Erst eine stabile Messbasis, dann Spirit dünn verteilen (Basketball-Muster). Reicht das nicht, kommt K-Schock (`hockey-spirit-kanal-konzept-06-10.md`). Den Bau gebe ich hiermit frei (Mechanik, keine Matrix, kein PixelLab). |
| **E12** | **Etiketten (L0–L3)** | L0 gehört in den HYROX-Rollout und muss vor A4 auf `main` sein. L1 kommt **direkt nach A6** und vor A7/A9, damit Climbing und Hatz gleich mit Icons gebaut werden. L2 läuft im Bühnen-Slot nach A5 und schluckt A11. L3 kommt zuletzt. Puste-Leiste: gedimmt, solange sie voll ist (Chris, 10.11.). **Breaking-Rollen-Icons: Schild/Faust, entschieden** (E12, Abschnitt 5). |
| **E13** | **Merge-Warteschlange** | **#1370 → #1372 → #1360 → Spurt-Stapel #1364…#1371 → #1359 → #1362 → #1363** (Abschnitt 4.1, probe-gemergt). |
| **Q-F** | **Die einzige Frage an Chris** | **Football: Gegen welche Gewichte wird abgenommen?** Override (meine Empfehlung) oder Matrix. Ohne diese Antwort ist Football nicht abnehmbar (W.2). |

---

## G. Gesamtreihenfolge (verbindlich, 10.11.)

Diese Liste kann der Koordinator direkt abarbeiten. **Merges macht nur Chris.** Die Nummern sind
eine Reihenfolge, keine Wichtigkeit: Was in derselben Zeile mit „∥" steht, läuft gleichzeitig.

| # | Was | Wer | Zone (4.2) | Startbedingung |
|---:|---|---|---|---|
| 1 | Merges #1370 → #1372 → #1360 | Chris | – | sofort; alle drei mergen sauber auf `main` und aufeinander |
| 2 | **W1a Hockey: Messbasis** ∥ **W2a TDM: Gefecht-Prototyp mit Abnahme** | 2 Bau-Agenten | W1: **F** · W2: **K** | sofort, Basis `main`, unabhängig von 1 |
| 3 | Merges Spurt-Stapel #1364 → #1367 → #1368 → #1369 → #1371 | Chris | – | nach 1; mergt sauber auf 1 |
| 4 | **W0 Battlefield-Duell-Nachweis** | 1 Agent, keine Engine | `lib/`, `tests/` | jederzeit, ½ Sitzung |
| 5 | **W1b Hockey: Rezeptrunde** (falls nötig **W1c K-Schock**) → **W1d Hockey scharf schalten** | Slot F | F, dann `lib/` | nach W1a |
| 6 | **W2b TDM: Abspielen, Runner, Buchung** → **W2c scharf schalten** | Slot K | K, dann `lib/` | nach W2a, nur wenn W2a beide Schranken besteht |
| 7 | Rebase und Merges #1359 → #1362 → #1363 | Rebase-Agent, dann Chris | Kulissen-Ledger, bei #1363 auch Engine (Bühne/A-Boden) | nach 3; die drei konfliktieren untereinander (4.1) |
| 8 | **Q-F beantwortet** → **W3 Football** (W3a Messung → W3b Rezept bzw. Mechanik → W3c scharf) | Slot F | F | nach Chris' Antwort **und** nach W1d (gleiche Zone) |
| 9 | Fahrplan Welle 1: **A3 Zeitdehnung** → **L0 HYROX/Hatz-Etikett** → **A4 Format-Weiche** | der Engine-Slot, den W gerade nicht hält | C, L0 in A-HUD | nach 3; HYROX geht erst live, wenn L0 auf `main` ist |
| 10 | **A5 Eiskunstlauf** → **L2 Bühnen** (mit A11) → **A8 Fechten** | Bühnen-Slot | B | sobald ein Engine-Slot frei ist **und** #1359 auf `main` ist (beide in Zone B) |
| 11 | **A6 Rangleiste** → **L1 Bahn-Etiketten** → **A7 Climbing** → **A9 Hatz** | Bahn-Slot | A-HUD | nach A4 |
| 12 | **A10 Staffel**, **L3 Arena/Breaking**, Spurt-Band, Kulissen-Politur Football/Hockey/TDM (E5) | frei | A-Boden / B / K | L3-Arena erst nach W2c; die E5-Politur erst, wenn die Disziplin gewertet ist |

**Engine-Regel (unverändert, nur ergänzt):** Höchstens zwei Agenten gleichzeitig an
`battle-mode.engine.js`, nie zwei in derselben Zone. **Solange W1 und W2 beide an der Engine
arbeiten, ruht der Fahrplan an der Engine.** Eine Ausnahme gibt es: Arbeitet W1 nur in
`battle-mode.rezepte.js` (Hockeys Rezept steht dort, nicht in der Engine), zählt W1 nicht als
Engine-Agent. Dann darf ein Fahrplan-Auftrag laufen (Zeile 9). Messläufe mit n=48 und zwei
Saatströmen laufen nie gleichzeitig auf derselben Maschine. Das ist die Chromium-Absturzfalle aus
3.3, und bei TDM dauerte ein einzelner Lauf schon einmal 11–13 Minuten.

---

## W. Oberste Priorität: Was auf dem Feld passiert, ist die Wertung

### W.0 Ausgangslage, nachgeprüft

Die Liga bucht eine Disziplin nur dann aus der Arena, wenn sie in `ARENA_RESOLVED_DISCIPLINE_IDS`
steht (`lib/battle/arena-resolved-disciplines.ts`). Dafür muss sie beide Pflichtabnahmen bestehen
oder für das verfehlte Kriterium auf Chris' Ausnahmeliste stehen. `tests/disziplin-abnahme-guard.test.ts`
erzwingt das. Alles andere bucht die **PPS-Duell-Brücke**: 2/1/0 aus einem Attribut-Score ohne
Simulation. Die Arena zeigt dann ein Spiel, das nicht zählt. Der Host blendet dazu den Hinweis
„nur Vorschau" ein (`arena-host-spielquelle-hinweis.ts`). Seit dem 27.10. ist die Brücke auch nach
Chris' eigener Leitlinie nur noch Notfall-Backup: „alle müssen organisch durchlaufen"
(`organisch-tdm-battlefield-ispy-27-10.md`).

| Disziplin | rho je Spiel | Pp (zwei Ströme) | angeschlossen? | Stand laut `disziplin-abnahme.json` | Art des Problems (meine Diagnose) |
|---|---:|---:|---|---|---|
| **Hockey** | 0,640 (Chris-Ausnahme) | **38,5 / 81,5** | ja (Feldspiel-Chassis, PPS-Referenz, Impact-Konfig) | frisch, n=24, 25.10. | **Rezept plus Messstabilität**, Mechanik als Rückfall |
| **Football** | 0,807 | **121,0 / 120,1** (nicht 64,6/61,7) | **nein**, nur Konfig und Referenz vorbereitet | frisch, n=48, 25.10. | **Zielkonflikt zwischen den beiden Abnahmen**, erst danach Mechanik |
| **TDM** | **0,324** (Saison 0,308) | 51,4 (alt, n klein) | **nein**, kein Headless-Einstieg | rho frisch 27.10., Pp alt | **Mechanik**: beide Spalten niedrig, vier Rezeptrunden gescheitert |
| **Battlefield-Duell** | 0,399 | 30,1 / 37,1 | nein | alt (15.10.) | **in der Liga nicht gebucht** (W.4) |

**Korrektur am Briefing:** Die Football-Zahl 64,6/61,7 ist ungültig. Sie wurde gegen
`BASIS_JE_DISC.football` gemessen, und das ist für Football der Spiel-Eignungs-Override, nicht die
Matrix. Gegen die Matrix nachgemessen ergab sich 121,0/120,1 (`stand-aller-disziplinen.md`
Abschnitt 14, Task #196, 25.10.). Der Kopfkommentar in `arena-resolved-disciplines.ts` nennt an
zwei Stellen noch die alte Zahl. Der Nachtrag im selben Kommentar und die Abnahmetabelle haben die
richtige.

### W.1 Hockey: Rezept und Messbasis, kein Neubau (Aufwand: 2–3 Sitzungen, davon viel Messzeit)

**Was für „nur Rezept" spricht:**
- Hockey ist angeschlossen. Chassis, PPS-Referenz und Impact-Konfig sind fertig.
- rho ist durch Chris' Ausnahme gedeckt (`ARENA_ABNAHME_AUSNAHMEN`, deckt nur `rho`). Scharf schalten
  heißt hier: eine Zeile in `ARENA_RESOLVED_DISCIPLINE_IDS`, wenn Pp unter 25 liegt.
- Hockey liegt nicht bei Null. Zwei Runden am 06.10. haben Pp schon von 52,1/46,1 auf 31,7/31,7
  gedrückt (n=6, `hockey-spirit-kanal-konzept-06-10.md`).
- Kein Attribut ist strukturell tot wie bei Football. Spirit hat einen Kanal (`ABSCHLUSS`), er ist nur
  zu schwach.

**Was dagegen spricht und deshalb zuerst geklärt wird:**
- **Die beiden Saatströme liegen 43 Pp auseinander (38,5 gegen 81,5).** Auf Strom 0 überwiegt Stamina
  (+11,4), auf Strom 1 Awareness (+28,6, Matrixgewicht 8), und Spirit fällt auf 0 %. Eine Messung, die
  je nach Strom eine andere Krankheit diagnostiziert, taugt nicht als Grundlage für eine Rezeptrunde.
  Die Abnahmetabelle vermutet selbst, dass Hockeys niedrige Torzahl die Einzelspiel-Budgetmessung
  instabil macht.
- Spirit (Matrix 12) hat seinen Hauptkanal verloren. `TEAMGEIST` wurde bei der
  Erfolgskurven-Migration aus der Trefferformel gestrichen. Die naheliegenden Hebel (`ABSCHLUSS`,
  `AUSDAUER`) sind gemessen und verworfen.

**Mein Urteil:** Hockey ist **überwiegend ein Rezept- und Messfall**. Die Mechanikoption K-Schock
liegt fertig konzipiert in der Schublade. Freigegeben ist sie ab jetzt (E11), gebaut wird sie nur,
wenn W1b die Schranke nicht schafft.

| Auftrag | Inhalt | Ort | Abnahme |
|---|---|---|---|
| **W1a Messbasis** | `messe-arena-einfluss.mjs hockey 48` mit drei Saatströmen (0, 10 000 000, 20 000 000). Falls die Ströme wieder mehr als 15 Pp auseinanderliegen, die Ursache klären: Ereigniszahl je Attribut, Torzahl je Spiel, Varianz von `einflussVon()` bei Hockey gegen Basketball. Ergebnis ist eine Messvorschrift für W1b (n, Ströme, gegebenenfalls Mittel über drei Ströme), die **vor** jeder Rezeptänderung feststeht. Kein Rezept anfassen. | Skripte, lesend | Bericht mit Attributtabelle je Strom; Vorschrift festgelegt |
| **W1b Rezeptrunde** | Spirit **dünn** über mehrere kleine Sub-Skills verteilen statt in einen großen (Basketball-Muster, `hockey-spirit-kanal-konzept-06-10.md` 1.2). Awareness dort zurücknehmen, wo W1a sie als Treiber zeigt. `AUFBAU`/`LAUFTEMPO` bleiben unangetastet (gerade kalibriert). | `battle-mode.rezepte.js` | Pp ≤ 25 auf **allen** Strömen der Vorschrift; rho je Spiel nicht unter 0,640 und Star Rang 1/erste zwei nicht unter 58 %/78 % (die Werte, die Chris abgenommen hat, dürfen nicht schlechter werden); Fingerabdruck nur für Hockey verändert |
| **W1c K-Schock** (nur wenn W1b scheitert) | Resilienz-Fenster nach Gegentor, Primärweg Spirit, Nebenweg Determination/Will, auf `ABWEHR`/Zweikampf begrenzt (Konzept 06.10., Abschnitt 3). | Zone F | wie W1b |
| **W1d scharf schalten** | `"hockey"` in `ARENA_RESOLVED_DISCIPLINE_IDS`, Abnahmetabelle, Guard-Test, PPS-Referenz neu ziehen. **Vorher die Anzeige-Treue für Hockey** (`miss-anzeige-treue-rest.mjs`, aus #1372) über 24 Saaten auf 0 Abweichungen. Hockey läuft mit `ZEIT_DEHNUNG` 2. | `lib/`, Skripte | Guard grün; Anzeige-Treue 0/24; `e2e-saisonende-am-save-abbild.ts` am Abbild grün |

### W.2 Football: ein Zielkonflikt, kein Rezeptfall (Aufwand: abhängig von Q-F, 2 bis 5+ Sitzungen)

Der Code-Kommentar nennt als Ursache „sechs der zwölf Matrixattribute tragen mechanisch nichts bei".
Das stimmt (spirit 25, awareness 11, will 10, stamina 6, charisma 4 lesen 0 %, `stand-aller-disziplinen.md`
14.3). Es ist aber nur die halbe Diagnose. Die andere Hälfte ist schwerer und steht in keinem der
Papiere ausdrücklich:

**Football hat zwei verschiedene Wahrheiten, und die beiden Pflichtabnahmen messen gegen
verschiedene davon.**
- **rho** misst gegen die Eignung, die der Kaderbildschirm zeigt und die KI kauft. Für Football ist
  das der **Override** (`spiel-eignung-overrides.ts`: power 22, health 18, speed 14, torment 12 …),
  den Chris am 05.09. bestätigt hat.
- **Pp** misst seit Task #196 gegen die **Matrix** (spirit 25, torment 16, health 14, awareness 11,
  will 10 …).
- **Die beiden Eignungen ordnen denselben Kader fast unabhängig voneinander.** Nachgerechnet auf den
  110 Spielern der Kader-Familie (`kaderfamilie-live-save.json`): **Spearman Override gegen Matrix
  = 0,427.** Das ist dieselbe Zahl, mit der der Override am 05.09. begründet wurde. Awareness
  korreliert sogar **negativ** mit der eigenen Matrix-Eignung (−0,336), speed ebenfalls (−0,44).

**Folge:** Eine Mechanik, die die Matrixgewichte durchreicht (Pp ≤ 25), ordnet die Spieler nach der
Matrix-Eignung. Gegen die angezeigte Override-Eignung kann sie dann höchstens etwa so gut ordnen,
wie die beiden Eignungen übereinstimmen, also weit unter 0,80. Umgekehrt ist das heutige Spiel
(rho 0,807 gegen den Override) zwangsläufig weit weg von der Matrix. **Unter den heutigen
Definitionen kann Football nicht beide Abnahmen bestehen, egal wie gut das Rezept ist.** Den
Rückweg „Minispiel zurück auf die Matrix" hat das Projekt schon einmal gemessen: rho 0,053
(`spiel-eignung-overrides.ts`, Kopfkommentar).

Das ist keine Frage der Matrix, die bleibt gesperrt. Es ist eine Frage des Overrides, und den
legitimiert CLAUDE.md ausdrücklich als „bewusste, dokumentierte Ausnahme je Disziplin" mit Chris'
Bestätigung. Deshalb ist das die eine Frage, die ich nicht selbst entscheide:

> **Q-F an Chris:** Football zeigt im Kader eine eigene Eignung (Override, seit 05.09. mit deinem
> Okay). Die Pflichtprüfung „kommen die Gewichte so raus" misst aber gegen die Matrix. Die beiden
> Eignungen haben nur 0,43 miteinander zu tun. Beides gleichzeitig ist nicht erreichbar.
> **(a) Empfohlen:** Für Football gilt der Override als „die vorgegebenen Gewichte", also auch für
> die Pp-Prüfung. Was du im Kader siehst, ist dann das, was das Spiel belohnen muss. Ein Spieler mit
> 80 Football-Eignung im Kader ist im Spiel einer der Besten.
> **(b)** Der Override fällt weg, und Football zeigt und spielt die Matrix (spirit 25 als
> schwerstes Attribut). Dafür muss die Football-Mechanik neu gebaut werden, und alle angezeigten
> Football-Eignungen in allen Saves ändern sich.

**Warum ich (a) empfehle:** Chris' Satz zur Matrixsperre handelt vom Spieler, „den ich mit einer
Stat von 80 reinschicke". Was der Manager sieht, ist die Override-Zahl. Unter (a) gibt es für
Football eine einzige Wahrheit für Anzeige, KI-Kauf, Spiel und beide Abnahmen. Unter (b) zahlt das
Projekt einen Mechanik-Neubau mit Zusatzrisiko: Awareness müsste gegen den echten Kader belohnt
werden, obwohl sie dort negativ mit der eigenen Eignung läuft. Dazu kämen eine Migration der
Anzeige und ein schon einmal gemessener Fehlschlag.

**Aufwand je Antwort:**
- **(a):** W3a misst Pp gegen den Override frisch (n=48, zwei Ströme). Am alten Stand lag die Zahl
  bei 64,6/61,7, nicht bei 121. Das Messwerkzeug braucht dafür nur einen Schalter
  „Override statt `PP_MATRIX_JE_DISC`". W3b ist eine Rezeptrunde nach dem Basketball-Vorbild, das
  von 43 auf 22,9/17,6 kam. W3c schaltet Football scharf: in `ARENA_ANGESCHLOSSENE` **und**
  `ARENA_RESOLVED`, Runner-Dispatch über das Feldspiel-Chassis, PPS-Referenz neu ziehen. Dazu kommt
  die Anzeige-Treue bei Faktor 1. **Etwa 2–3 Sitzungen.** Der Ausnahmeeintrag selbst braucht Chris'
  Wort in der Abnahmetabelle, dieselbe Regel wie bei `ARENA_ABNAHME_AUSNAHMEN`.
- **(b):** Nötig wäre ein neuer Kreditkanal für spirit/will/awareness/charisma/stamina. Das Projekt
  hat das am 04.09. selbst als „neunten Sub-Skill" vorhergesagt (`football-rezept-kalibrierung.md`
  Abschnitt 6). Primär- und Nebenweg nach der Leitlinie vom 21.09. Dazu kommen das Entfernen des
  Overrides und ein Plan für die geänderte Anzeige. **5 oder mehr Sitzungen, Ausgang offen.**

Bis Chris antwortet, wird an Football nicht gebaut. W3 belegt Zone F und kommt deshalb ohnehin
erst nach Hockey.

### W.3 TDM: Gefecht nach dem Battlefield-Muster statt freier Echtzeitkampf (Aufwand: 3–4 Sitzungen)

**Diagnose:** Beide Spalten sind niedrig (0,324 je Spiel, 0,308 Saison). Nach CLAUDE.md belohnt
die Mechanik also das Falsche. Am Mangel an Ereignissen liegt es nicht. Vier Rezeptumbauten sind
gescheitert, eine Chassis-Normierung wurde zurückgenommen (`tdm-pp-rezeptrunde-diagnose-02-10.md`).
Der beste dokumentierte Hebel, `persHandwerk` (Zusammenhalt/Bindung von der Persönlichkeit lösen),
hob rho nur auf 0,416/0,432. Dieselbe Empfehlung schreibt dazu, dass TDM im freien Kampf auch danach
„strukturell nicht" über 0,80 kommt, weil die Verlässlichkeit bei etwa 0,70 deckelt
(`arena-zielwahl-opus-empfehlung-02-10.md`, Satz 5). Zudem hat TDM keinen Headless-Einstieg. Selbst
ein bestandenes TDM ließe sich heute nicht buchen.

**Die Lösung liegt im Projekt schon vor, eine Disziplin weiter.** Battlefield hatte im freien
Kampf dieselbe Lage (0,399). Seit dem 02.11. wird der Battlefield-Pod als **Gefecht je Ort**
entschieden, nach Chris' Wahl des Mini-DM-Musters: deterministisch aus den Matrix-Kanälen,
Schlagwechsel je Ort, die Arena spielt das Ergebnis ab. Damit liegt rho bei 0,861–0,923 und Pp bei
4,8–20,2 auf zwei Strömen, ohne Ausnahme. Gezeigt = gebucht ist dabei per Bauart gegeben
(`bfPodReplaySchritt()` zieht kein `rr()`, bestätigt in #1372).

**Entschieden (E10):** TDM wird nach diesem Muster gebaut. Das ist genau, was Chris verlangt: Die
Arena zeigt das Spiel, das gezählt wird. Das sichtbare Format aus der Entscheidung vom 26.09.
bleibt: Respawn, kein Kill-Limit, 6 gegen 6, Sendedauer 3:00. **Veto bei Chris:** Wer lieber freien
Kampf will, nimmt damit in Kauf, dass TDM auf absehbare Zeit über die Brücke gebucht wird. Ich kenne
im freien Kampf keinen Weg über 0,80.

| Auftrag | Inhalt | Ort | Abnahme |
|---|---|---|---|
| **W2a Gefecht-Prototyp** | Eine reine Funktion `tdmGefecht(seiten, saat, jeSeite)` nach `bfffaGefecht()`, ohne Abspielen und ohne Buchung: Zeitachse mit Duellen (wer trifft auf wen, aus Rolle/Zielwahl), Schlagwechsel aus den Matrix-Kanälen, Respawn als Zeitstrafe, Ergebnis KO-Summe bei Zeitablauf, dazu ein Boxscore je Spieler. Bei Kadergrößen 2..6 keine stillen Rollenverluste (Lehre aus Spurt-F1 und Battlefield-`jeSeite`). Dazu ein Messskript nach `miss-battlefield-pod-abnahme`. **Erst die Zahlen, dann das Bild:** Besteht W2a nicht, wird kein Abspielen gebaut. | Zone K, additiv | rho je Spiel > 0,80 und Pp ≤ 25, je zwei Ströme, n=48, für jede Kadergröße 2..6; Spiegeltest ~50 %; bestehende Disziplinen bit-identisch (Fingerabdruck) |
| **W2b Abspielen und Runner** | Die Arena spielt das Gefecht ab (Muster `bfPodReplaySchritt`, kein `rr()` im Abspielschritt). Headless-Einstieg `spieleTdm()` mit `{seiten, boxscore}`, Menge `ARENA_KAMPF_DISCIPLINE_IDS` im Runner, PPS-Referenz. | K, Runner | Anzeige-Treue 24/24 (gezeigt = gebucht); Sendedauer 3:00 ±15 %; Bilder 30/75 % |
| **W2c scharf schalten** | `"tdm"` in `ARENA_ANGESCHLOSSENE` und `ARENA_RESOLVED`, Abnahmetabelle, Guard. | `lib/` | Guard grün; Abbild-E2E grün |

### W.4 Battlefield-Duell: wird in der Liga nicht gebucht, deshalb kein Bau (Aufwand: ½ Sitzung)

Battlefield steht in `VIERER_POD_DISCIPLINE_IDS`. In einem Battle-Save läuft es deshalb **als Pod**,
und der Pod ist seit dem 02.11. organisch gewertet (`BATTLEFIELD_POD_VORLAUF_AKTIV`, Gefecht je Ort,
beide Schranken regulär bestanden). Ein Duell entstünde nur an einem Spieltag ohne Pods, also in
einer Liga, deren Größe nicht durch 4 teilbar ist. Die gibt es nicht: `LEAGUE_SIZE = 16`
(`lib/season/league-split.ts`), und `mini-dm-pod-schedule.ts` hält fest, dass `LEAGUE_SIZE` und
`TEAM_COUNT_TOTAL` „fest auf Vielfache von 4 gesetzt" sind (Chris, 14.09.). Fällt der Vorlauf aus,
greift der **PPS-Pod**, nicht das Duell. Das ist der Notfall-Backup, den Chris am 27.10. zulässt.
**Die rho von 0,399 beschreibt also einen Pfad, den die Liga nicht benutzt.** Eine Mechanikrunde
dafür wäre Arbeit ohne Wirkung.

**Entschieden:** Ein kleiner Nachweis ohne Engine-Zeile (W0):
1. Ein Guard-Test: In einem Battle-Save mit Liga-Größe 16 bzw. 32 hat **jeder** Battlefield-Slot ein
   Pod, und kein Pfad bucht Battlefield über `battle-mode-pps-duell`.
2. Eine Abfrage am `live-save`-Abbild: Gibt es gebuchte Battlefield-Zeilen mit
   `resolutionSource: "pps_duell"`? Falls ja, ist das ein Fehlerbefund und kommt vor W2.
3. In der Abnahmetabelle wird der Eintrag `battlefield` als „Duell, außerhalb der Liga" markiert.
   Er zählt dann nicht mehr als offene Wertungsbaustelle.

Das Duell bleibt als Schaukampf im Mockup bestehen. Wird es irgendwann zum Liga-Format, braucht es
eine eigene Abnahme. Das einfachste wäre dann dasselbe Gefecht wie W2a.

### W.5 Was W für die übrigen Disziplinen heißt

- **Gezeigt = gebucht** ist mit #1372 für alle fünf Bahn-Duelle hergestellt: Spurt, Time-Trial,
  Climbing, Staffel und Takeshi gehen von bis zu 24/24 Abweichungen auf 0/24, Fingerabdruck und rho
  bit-identisch. Offen ist laut Folge-Agent die volle 24-Saaten-Messung für **Fechten und
  Gewichtheben**, die beiden gebuchten Nicht-Bahn-Disziplinen mit `ZEIT_DEHNUNG` ≠ 1. Die
  Code-Durchsicht in #1372 fand außerhalb von `stepSpurt()` keinen dt-skalierten `rr()`-Wurf. Ich
  erwarte deshalb 0/24. Zeigt die Messung doch Abweichungen, ist das ein eigener Fix-PR **vor**
  W1d, weil Hockey dasselbe Muster hat.
- **#1360** (Bühnen paaren nach Slot statt nach Kaderliste) gehört inhaltlich ebenfalls zu
  „Feld = Wertung": Gespielt wird dann die Paarung, die der Manager gesetzt hat. Laut PR-Text
  bleiben rho und Pp bit-identisch. Deshalb steht #1360 vorn in der Warteschlange.
- **Mini-DM** ist organisch (FFA-Motor, Chris' Freigabe vom 24.10.) und nicht Teil von W.

---

**Grundlage.** Drei Achsen, die der Koordinator am 09.11. selbst nachgespielt hat:

1. **Visuelle Tiefe:** übernommen aus `docs/design/kulissen-qualitaets-audit-08-11.md` (PR #1357),
   ergänzt um den Stand der offenen PRs #1359, #1362, #1363, #1364 und #1371.
2. **Interface-Lesbarkeit (neu):** Kann ein Zuschauer beim Hinsehen sagen, wer führt, wer gut und
   wer schlecht läuft und wie viel noch kommt?
3. **Zuschau-Dauer/Pacing (neu):** Wie lange dauert ein Spiel in echter Zeit, und passt das zur
   Disziplin?

Alle Zahlen zu Achse 2 und 3 habe ich selbst gemessen bzw. fotografiert (Abschnitt 1.2). Code
habe ich nicht geändert. PixelLab ist nicht angefasst, die Matrix auch nicht.

---

## 0. Kurzfassung

1. **Visuell ist die Hälfte der Arbeit schon gebaut, aber noch nicht gemergt.** Takeshi, Climbing,
   Spurt, Showcase und Breaking (Audit-Ränge 1, 2, 3, 5, 6) liegen in offenen PRs. Sie heben die
   Disziplinen von C auf etwa B bis B+. Danach bleiben visuell **Eiskunstlauf (C)** und
   **Fechten (B-)** übrig. An dieser Reihenfolge ändern die zwei neuen Achsen nichts. Sie rücken
   aber **hinter** die Lesbarkeits- und Pacing-Arbeit an den Bahn-Rennen, weil die billiger ist
   und mehr Disziplinen auf einmal hebt.
2. **Die Bühnen sind auf der Interface-Achse schon gut.** Jede Bühne hat ihre eigene Stand-Tafel:
   Eiskunstlauf „Zwischenstand", Showcase „Top 3 bisher", Gewichtheben „Duell 2 von 6",
   Speed-Schach mit Bewertungsbalken, Wettessen mit Zählern über jedem Esser. Dasselbe gilt für
   die Pod-Formate (Vier-Team-Tafel bei Takeshi, Staffel und Battlefield). **Die Lücke sitzt fast
   nur in den Einzelrennen auf der Bahn:** Spurt klassisch, Die Hatz, Climbing und mit
   Einschränkung Takeshi im Duell. Genau dort ist die Einzelplatzierung die Wertung („Punkte nach
   Rang"), und genau dort fehlt eine durchnummerierte Rangliste im Bild.
3. **Der größte Hebel ist eine generische Bahn-Rangleiste.** Sie entsteht aus der HYROX-Leiste
   (`zeichneHyroxRangleiste()`, PR #1369/#1371). Die Funktion ist zu etwa 80 % generisch. An HYROX
   hängen nur die Sortierung, die Statusspalte, die Kopfzeile und die Hervorhebung „im Bild". Wer
   diese vier Punkte als Parameter herauszieht, bekommt Spurt klassisch, Hatz und Climbing (Takeshi
   bewusst nicht, E3) für etwa 40–60 Zeilen je Disziplin. **Wichtig:** `bahnRangliste()` ist als
   Live-Sortierung nicht überall richtig. Bei Takeshi rutschen Ausgeschiedene nach vorn, bei HYROX
   war die Liste ein Spoiler, bei Climbing zählt die Höchstmarke. Der Sortierschlüssel muss
   deshalb ein Pflichtparameter sein (Abschnitt 3.1).
4. **Die Hatz hat drei Mängel, nicht zwei.** Das Pacing liegt bei 10:36 (zehn Läufer) bis 13:22
   (zwölf Läufer) statt 3 Minuten. Rangliste und Wellenzähler fehlen. Und das Wichtigste, im Code
   belegt: **die Positionen auf der Bahn tragen keinerlei Leistungsinformation.** Alle aktiven
   Läufer laufen im Gleichschritt (`u.pos = basis*0.92 + jitter`, der Versatz hängt an der
   Spieler-ID). „Wer gefährdet ist" kann man deshalb nicht einmal an der Bahnposition ablesen.
   HYROX hatte denselben Fehler und hat ihn mit dem „Fahrplan" (PR #1371, Stufe 1) gelöst. Dieses
   Muster ist der zweite wiederverwendbare Baustein.
5. **Pacing-Ausreißer, gemessen:** nach oben **Die Hatz** (stark) und der **Battlefield-Pod**
   (7:12, doppelt so lang wie das Duell, für dessen Länge der Faktor 5 einmal gesetzt wurde).
   Nach unten **Climbing** mit 0:48, das kürzeste Spiel aller zwanzig, obwohl seine
   Bahn-Geschwister Spurt und Staffel auf Chris' Wunsch auf etwa 3 Minuten gedehnt wurden. Lang,
   aber aus Chris' eigenen Vorgaben abgeleitet: Hockey 8:06, Gewichtheben 7:22, Basketball 6:08.
6. **Top-Niveau braucht eine vierte, nicht verhandelbare Achse: die Wertung.** Football, Hockey
   und TDM bestehen die Pflichtabnahme (rho/Pp) bis heute nicht. **Seit dem 10.11. ist das kein
   Nebenstrang mehr, sondern die oberste Priorität (Abschnitt W).**

**Reihenfolge in einem Satz (Stand 10.11., Abschnitt G):** Chris mergt #1370, #1372 und #1360.
Gleichzeitig starten Hockey (Messbasis, dann Rezept) und TDM (Gefecht-Prototyp) in zwei getrennten
Engine-Zonen. Football wartet auf Chris' Antwort zu Q-F. Das Battlefield-Duell bekommt nur einen
Nachweis. Der visuelle Fahrplan (Rahmen, Format-Weiche, Rangleiste, Etiketten, Bühnen) läuft in
dem Engine-Slot, den W gerade nicht braucht. Welle 0 (A1, A2) ist erledigt.

---

## 1. Bestandsaufnahme

### 1.1 Bewertungsmaßstab

| Achse | A | B | C |
|---|---|---|---|
| Visuell | Zeitfahren/TDM-Niveau oder besser (Audit-Skala) | saubere Sportübertragung ohne Atmosphäre-Extra | Textur-Tausch ohne Komposition, leer oder zu dunkel |
| Interface | Führung, gut/schlecht und Restlauf in ≤ 3 s ablesbar, durchgehend | zwei der drei Fragen beantwortet, oder nur über Umwege (DOM-Tabelle neben dem Bild, Zahlen über Köpfen ohne Sortierung) | Führung nur über nackte Position oder gar nicht ablesbar |
| Pacing | Sendedauer im vereinbarten Rahmen der Disziplin, Unterschiede ab dem ersten Fünftel sichtbar | Dauer knapp daneben oder erster Abschnitt undifferenziert | Faktor ≥ 2 daneben, oder das Bild zeigt lange nichts Unterscheidbares |

### 1.2 Wie gemessen wurde

**Dauer.** Ich habe `window.__arena.sondenLauf(n)` in Blöcken von 120 Ticks aufgerufen, bis
`window.__arena.vorbei()` wahr ist. Ein Tick entspricht bei Tempo 1× genau einer
Sechzigstelsekunde Zuschauzeit: `loop()` ruft je 1/60 echter Zeit `stepSim((1/60)/zeitFaktor())`
auf, `sondenLauf()` macht dasselbe ohne Wanduhr (Engine `:62152`, Spurt-Spitze). Ticks/60 ist
also die Sendedauer bei 1×, **ohne** Anpfiff-Countdown (1,5–3 s) und ohne Endstand-Nachlauf
(3,5 s). Gemessen wurde mit der Standard-Saat und dem Standard-Kader der Arena. Die Pods liefen
mit den vier Teams aus `data/generated/kaderfamilie-live-save.json`, wie in
`scripts/screenshot-kulisse.mjs --pod`. Engine-Stand ist die Spitze des Spurt-Stapels
(`claude/spurt-hyrox-routen-design-0911`, `14a18a72b`), die sonst auf dem Stand von `main` ist.
Takeshi und Climbing habe ich zusätzlich auf ihren PR-Zweigen gemessen und dieselben Werte
erhalten.

```js
// Kern der Sonde (Playwright, Seite /mockups/battle-mode.html)
A.setDisc(d);                      // ggf. vorher A.bahnFlags({spurtFormat:"hatz"}) bzw. A.bahnPodAnzeigen(d,pod)
let ticks=0; while(ticks<108000){ A.sondenLauf(120); ticks+=120; if(A.vorbei())break; }
return ticks/60;                   // Sendesekunden bei Tempo 1x
```

**Bilder.** Je Disziplin habe ich die Leinwand bei 30 % und 75 % der gemessenen Dauer
fotografiert, ebenfalls über `sondenLauf`, also deterministisch. Bei TDM habe ich zusätzlich in
Echtzeit über `scripts/screenshot-kulisse.mjs tdm - 60000` gegengeprüft. **Messfalle:** Im
Sonden-Modus stapeln sich in Kampf-Disziplinen die Treffer-Ringe zu einem Knäuel, in Echtzeit
nicht. Das ist ein Artefakt der Sonde und kein Befund.

### 1.3 Gemessene Sendedauer je Spiel (Tempo 1×)

| Disziplin (Format) | Chassis | `ZEIT_DEHNUNG` | Sendedauer | Bezugsgröße | Einordnung |
|---|---|---:|---:|---|---|
| Climbing | Bahn | 4,38 | **0:48** | Faktor war auf 60 s gerechnet | **Ausreißer nach unten** → E2: Ziel 1:30 |
| Showcase | Bühne | – | 1:00 | ~60 s Bühnen-Standard | ok |
| Eiskunstlauf | Bühne | – | 1:02 | ~60 s | ok (12 Elemente parallel je Paar, ~5 s je Element) |
| Wettessen | Bühne | – | 1:02 | ~60 s | ok |
| Speed-Schach | Bühne | – | 1:02 | ~60 s | ok |
| Tennis | Bühne | – | 1:02 | ~60 s | ok |
| Takeshi's Castle (Duell) | Bahn | 2,17 | 1:02 | ~60 s | ok |
| Takeshi's Castle (**Pod**, Liga) | Bahn | 2,17 | 0:56 | ~60 s | ok |
| I-Spy | Bühne | – | 1:04 | ~60 s | ok |
| Mini-DM (1-gegen-1-Ansicht) | Arena | 2,86 | 1:08 | – | gewertet wird das FFA (eigene Leinwand `#mdffaCv`), **nicht gemessen** |
| Fechten | Bühne | 1,62 | 1:38 | – | ok (~16 s je Bahn, 6 Bahnen) |
| Time-Trial | Bahn | 4,38 | 1:38 | Faktor auf 60 s gerechnet | leicht lang, unkritisch (gestaffelter Start) |
| Breaking | Bühne | – | 1:46 | – | ok (~10 s je Kampf) |
| TDM | Arena | 1,88 | 3:00 | Chris: „bis zum Ende spielen" | ok |
| Staffel (**Pod**, Liga) | Bahn | 14,65 | 2:58 | Chris: ~3 min | ok |
| Staffel (Duell) | Bahn | 14,65 | 3:20 | Chris: ~3 min | ok |
| Battlefield (Duell, ungewertet) | Arena | 5,00 | 3:28 | – | – |
| Spurt klassisch | Bahn | 11,14 | 3:36 | Chris 06.09.: ~3 min (damals 3:03 gemessen) | **+20 % Drift** → E2: zurück auf 3:00 |
| Spurt HYROX (Flag) | Bahn | 11,14 | 3:52 | E2: Ziel 3:30 | ok (+10 %, im Band) |
| Football | Feld | 1 | 4:44 | – | ok |
| Basketball | Feld | 1 | 6:08 | Chris: 4 × 1:30 | ok, so bestellt |
| **Battlefield (Pod, Liga)** | Arena | 5,00 | **7:12** | Faktor stammt vom Duell (41 Sim-s); der Pod läuft 86 Sim-s | **Ausreißer nach oben** → E2: Ziel 3:30 |
| Gewichtheben | Bühne | 4 | 7:22 | Chris' Zielspanne 4–8 s je Versuch (06.09.), daraus ~7,4 min | ok, aus Chris' Vorgabe |
| Hockey | Feld | 2 | 8:06 | Faktor 2 aus Chris' Hektik-Fund, „240 s werden rund 8 Minuten" | ok, aus Chris' Vorgabe |
| **Spurt „Die Hatz" (Flag)** | Bahn | 11,14 | **10:36** (10 Läufer) / **13:22** (12 Läufer, gerechnet) | ~3 min wie Spurt | **schwerer Ausreißer** → E2: 30 s je Welle, 3:00 bei 12 |

Die Hatz-Rechnung: `baueHatz()` (`:48581`) wirft je Welle zwei Läufer raus, bis vier übrig sind.
Die letzte Welle entscheidet Rang 1–4 auf einmal. Zwölf Läufer ergeben fünf Wellen à
`HATZ_WELLEN_DAUER=12` und vier Pausen à `HATZ_NEUORDNUNG_DAUER=3` (`:48548`), also 72 Sim-s ×
11,14 = 802 s. Zehn Läufer (Standardkader der Arena, eine Seite stellt nur vier) ergeben vier
Wellen und drei Pausen, also 57 Sim-s und gemessen 636 s. Die 13 Minuten des Koordinators gelten
für ein volles Feld.

**Abweichung zum Koordinator, wird von Auftrag A1 geklärt:** Er hat Takeshi mit ~100 s und HYROX mit ~5 min
gesehen, ich messe 62 s bzw. 3:52. Countdown und Nachlauf erklären zusammen nur ~6 s. Plausibel
sind ein anderer Kader oder eine andere Feldgröße. Die Sendedauer-Sonde aus Abschnitt 3.3 würde
das in einem Lauf klären.

### 1.4 Die drei Achsen je Disziplin

„Stand nach PR" heißt: bewertet auf dem Zweig des offenen PRs (fotografiert), nicht auf `main`.

| # | Disziplin | Visuell (Audit → Stand nach PR) | Interface | Pacing | Wertung (rho/Pp) |
|---:|---|---|---|---|---|
| 1 | TDM | A/B+ | **B**: Spielstand nur in der DOM-Scorezeile, im Bild kein Stand; Kämpfe ballen sich am Rand | A (3:00) | **nicht bestanden** (rho 0,324) → W.3 |
| 2 | Mini-DM (FFA) | A- | A- (laut Audit Tafeln sauber; FFA nicht selbst fotografiert) | nicht gemessen | FFA-Pfad, variabel-k unter Schranke |
| 3 | Battlefield (Pod) | A- | A-: Vier-Team-Tafel mit Rang und Punkten (`zeichneBfPodTafel`) | **C**: 7:12, und das Bild ändert sich zwischen 2:09 und 5:23 kaum | Pod gewertet (02.11.); das Duell wird in der Liga nicht gebucht (W.4) |
| 4 | Basketball | B+ | A- (Scorebug, Uhr, Viertel) | A (so bestellt) | gewertet |
| 5 | Football | B+ | A- (Scorebug) | A | **nicht bestanden** (Pp **121,0/120,1** gegen die Matrix; die 64,6/61,7 maßen gegen den Override) → W.2 |
| 6 | Hockey | B+ | A- (Scorebug) | A (so bestellt) | **nicht bestanden** (rho 0,64 durch Chris abgedeckt, Pp 38,5/81,5) → W.1 |
| 7 | Gewichtheben | A | A: „Duell 2 von 6", Versuchsreihe, Tafel „Nächster" | A (so bestellt) | gewertet |
| 8 | Showcase | C → **B+** (#1359) | A: „Top 3 bisher" plus „läuft" | A | gewertet |
| 9 | Eiskunstlauf | **C** (bestätigt: 90 % graues Eis, Tribüne als 8-%-Streifen) | A: Zwischenstand-Tafel, Wiederholung, „Platz 2" | A | gewertet |
| 10 | Breaking | C+ → **B** (#1359, Publikum und Pfeiler sichtbar) | A-: „Kampf 8 · noch 3:2 im Ring", Peinigt-/Erträgt-Kärtchen mit HP | A | gewertet |
| 11 | Wettessen | A+ | A: Zähler über jedem Esser, Führungszeile | A | gewertet |
| 12 | Speed-Schach | A | A: Bewertungsbalken, Uhren, Mini-Bretter mit Stand | A | gewertet |
| 13 | I-Spy | A- | **B**: Punkte und Fortschritt über jedem Kopf, aber unsortiert; Führung nur durch Vergleichen von zwölf Zahlen | A | gewertet |
| 14 | Tennis | A- | B+: „Platz 1 von 6 · Ballwechsel 3/10 · Siegchance", Bahnenreihe; Kopfzeile sehr klein | A | gewertet |
| 15 | Fechten | **B-** (bestätigt: untere 45 % leer) | B+: „Bahn 2 von 6", Ergebnis je Bahn, Mini-Bahnen unten | A | gewertet |
| 16 | Spurt klassisch (live) | C → **B-** (#1364: Bögen IN/FINISH, Lichtkegel, Tribüne; Band weiter zu 80 % blau) | **C+**: keine Rangliste im Bild; Teamstand „Punkte nach Rang (vorläufig)" und Läufertabelle nur im DOM neben dem Bild | B (+20 % Drift) | gewertet |
| 16a | Spurt HYROX (Flag) | **B+** (#1371, Halle) | **A** (Referenz) | A (3:52) | Format-Abnahme laut Format-Dokument |
| 16b | Spurt Hatz (Flag) | B- (wie klassisch) | **C**: kein Rang, kein Wellenzähler, Positionen im Gleichschritt (Abschnitt 2.1) | **C** (10:36–13:22) | Format-Abnahme laut Format-Dokument |
| 17 | Time-Trial | A- | A-: Hot-Seat, Zwischenzeiten, nummerierte Roster-Leiste 1–12 (`#ttroster`, DOM unter dem Bild) | B (1:38) | gewertet |
| 18 | Climbing | C → **B** (#1363: farbige Griffe, Spots, Sicherer am Boden) | **B-**: Höhendifferenz je Paar, „TOP 34,0 s · Platz 1", Stürze liegen sichtbar; keine Gesamtliste; im ersten Drittel kaum Unterschiede (Koordinator) | **B-** (0:48, kürzestes Spiel) | gewertet |
| 19 | Staffel (Pod) | B+ | A: Vier-Team-Tafel mit Fortschritt in %, Bein-Delta, `#bahnHud` | A | gewertet |
| 20 | Takeshi's Castle (Pod) | C → **B+** (#1362: Burgmauer, See mit Brücke, Wimpel) | B+ im Pod (Vier-Team-Tafel, „noch 16 im Rennen", Fallen-Banner); B im Duell (Burgpunkte nur je Team, Sterne je Name, keine Einzelliste) | A | gewertet |

### 1.5 Was die Tabelle sagt

- **Visuell bleiben nach dem Merge zwei echte Baustellen** (Eiskunstlauf C, Fechten B-) und eine
  Politur-Gruppe (Staffel, Feldspiele, Tennis, TDM-Basis, Spurt-Band). Die Audit-Reihenfolge
  „erst Eiskunstlauf, dann Fechten" bleibt richtig.
- **Interface: Das Muster der Lücke ist eindeutig.** Wo die Disziplin ein eigenes
  Stand-Element bekommen hat (alle Bühnen, alle Pods, Zeitfahren, HYROX), steht sie bei A/A-. Wo
  zwölf Einzelläufer frei auf einer Bahn laufen und die Einzelplatzierung direkt in die Wertung
  geht, fehlt es: Spurt klassisch, Hatz, Climbing. **Spurt klassisch ist dabei die wichtigste,
  weil sie die einzige davon ist, die heute im echten Spiel läuft.** Hatz und HYROX sind nur über
  `BAHN_FLAGS` erreichbar (`:44909`, „Die echte App setzt beides nie").
- **Pacing:** Drei Ausreißer, zwei davon sind nur Faktorfragen (Hatz, Battlefield-Pod), einer ist
  eine Geschmacksfrage mit Lesbarkeitsfolge (Climbing).

---

## 2. Befunde, die über das Audit hinausgehen

### 2.1 Die Hatz zeigt im Bild nichts von der Leistung

`baueHatz()` rechnet beim Bau des Rennens **alle** Ränge vorab aus (`u.hatzRang`). `stepSpurtHatz()`
(`:48611`) deckt sie je Welle nur noch auf. Die Bewegung dazwischen ist reine Kosmetik:

```js
const basis=w?(w.welle+frac)/gesamtWellen:1;
const jitter=((u.id*53)%37)/37*0.015;     // haengt an der Spieler-ID, nicht an der Leistung
u.pos=Math.max(0,Math.min(0.97, basis*0.92+jitter));
```

Alle aktiven Läufer bewegen sich also im Gleichschritt, gestreut nur nach ID. Die zwei, die der
Fegearm am Wellenende erwischt, sind vorher durch nichts im Bild erkennbar
(`alle-diszis-top-niveau-fahrplan-09-11/hatz-gleichschritt-30-75-prozent.jpg`: bei 30 % stehen
alle aktiven Läufer in einer Spalte am Balken). Das ist derselbe Befund wie HYROX 2.2 im
Hallen-Review („Live-Rangfolge = Endstand ab dem ersten Tick"), nur andersherum: HYROX zeigte
zu früh das Ergebnis, die Hatz zeigt es nie. **Ohne einen Fahrplan bringt eine Rangleiste für die
Hatz nichts**, weil sie nach Position sortieren müsste und die Position nichts aussagt.

### 2.2 `bahnRangliste()` taugt nicht überall als Live-Sortierung

`bahnRangliste()` (`:41401`) ist die Wertungs-Rangliste. Sie ist für das **Rennende** gebaut
(rho-/Pp-Sonden lesen sie dort). Live gibt es drei Fallen, die alle schon einmal aufgefallen und
jeweils lokal umgangen sind:

| Disziplin | Problem mit `bahnRangliste()` live | Lokale Umgehung heute |
|---|---|---|
| Takeshi | Ausgeschiedene bekommen `u.fertig=90+…` und rutschen nach vorn | Führung aus `burgwertung()` (`:43401`) in `updateHudBahn()` |
| HYROX | Unfertige nach `u.pos` ≈ 1/Zielzeit, Spoiler ab Tick 1 | eigene Sortierung in `zeichneHyroxRangleiste()` (`:49112`) nach `hyroxZustand(u).s` |
| Climbing | `u.pos` sinkt beim Abrutschen, gewertet wird `u.hoch` | Zweig `BA().climbing` in `bahnRangliste()` |
| Hatz | `u.pos` sagt nichts (2.1) | keine |

Daraus folgt eine Bauvorgabe für die generische Rangleiste: **Der Sortierschlüssel wird je
Disziplin übergeben, nicht aus `bahnRangliste()` geerbt.** `bahnRangliste()` selbst bleibt
unangetastet, sonst sind Wertung, rho und Pp betroffen.

### 2.3 Sim-Zeit-Konstanten mit Anzeigebedeutung

Im Hallen-Review stand schon ein Nebenbefund (2.4): `HYROX_CAM_SCHNITT_SEK=3,5` ist
Simulationszeit und ergibt bei `ZEIT_DEHNUNG.spurt=11,14` real ~39 s zwischen zwei
Kameraschnitten. Die Halle hat dafür eine eigene Konstante bekommen (`HYROX_HALLE_SCHNITT_SEK`,
`:48725`). Für die Bahn-Ansicht von HYROX und für jede künftige Konstante, die etwas Sichtbares
taktet (Wellendauer, Banner-Haltezeit, Kameraschnitt), gilt dasselbe. Wird der Faktor für die
Hatz geändert (Auftrag A3), ändern sich alle diese Zeiten automatisch mit. Das ist gewollt,
muss aber im Bild gegengeprüft werden.

### 2.4 Die vierte Achse: Wertung

**Abgelöst durch Abschnitt W (10.11.).** Die erste Fassung führte die Wertung als parallelen
„Strang M", ohne ihn auszuplanen. Seit Chris' Vorgabe vom 10.11. ist er der Hauptstrang und
heißt **Strang W**. Diagnose, Zahlen (mit der Football-Korrektur 121,0/120,1) und Aufträge stehen
dort. Die Folgerung für den visuellen Fahrplan gilt weiter: Politur bei Football, Hockey und TDM
ruht, bis die Disziplin gewertet ist (E5).

---

## 3. Wiederverwendbare Bausteine (die eigentlichen Hebel)

### 3.1 B1 — Generische Bahn-Rangleiste

**Was es gibt.** Für Ranglisten gibt es heute sieben eigene Lösungen:
`zeichneHyroxRangleiste()` (Leinwand, `:49112`), `#ttroster`/`renderZeitfahrenPanel()` (DOM,
`:54094`), `zeichneBahnPodTafel()` (Vier-Team-Tafel, `:59803`), `zeichneBfPodTafel()`
(`:52345`), `zeichneEisStand()` (`:34086`), die Showcase-Top-3 in `zeichneShowcase()` (`:33584`)
und `zeichneWettessenTafel()`. Die Bühnen- und Pod-Tafeln sind fertig und passen jeweils zu
ihrer Disziplin. **Sie zu vereinheitlichen empfehle ich ausdrücklich nicht**, das wäre Aufwand
ohne sichtbaren Gewinn.

**Was fehlt:** eine Liste für **Einzelrennen auf der Bahn**. Die HYROX-Leiste ist dafür die
richtige Vorlage: Kasten oben rechts, „1. Name … Status", Fertige grün, Zeilen im Kamerabild
hell, der Rest gedimmt, aber lesbar. An HYROX gebunden sind nur vier Stellen:

| Parameter | HYROX heute | Spurt klassisch | Hatz | Climbing | Takeshi (Duell; gestrichen, E3) |
|---|---|---|---|---|---|
| `sortierung(a,b)` | fertig nach Zeit, sonst `hyroxZustand(u).s` | fertig nach Zeit, sonst `u.pos` | aus dem Fahrplan (B4), Ausgeschiedene nach `hatzRang` unten | `u.hoch` (Höchstmarke) | `burgwertung(u)` |
| `status(u)` | L1/L2/TECH/KLET/KRAFT/✓ | Station 1–7 bzw. ✓/„liegt" | „W3", „GEFÄHRDET" (untere zwei), „RAUS", ✓ | Höhe in m / „TOP" / „STURZ" | „Falle 7/14" / „raus" |
| `kopf` | Zone der Nahkamera | „SPURT · Station 4/7" | „WELLE 3/5 · noch 8" | „ZEITLIMIT 0:32" | „Burgpunkte 24:15" |
| `imBild(u)` | `hyroxCamGruppe` | Kamerafenster `camX` | Kamerafenster | Kamerafenster `camY` | Kamerafenster `cam.zoom` |

**Aufwand:** Herauslösen plus HYROX auf die neue Funktion umstellen, pixelgleich per Screenshot-
Vergleich: etwa 120–180 Zeilen, eine halbe Sitzung. Danach je Disziplin 40–60 Zeilen
(Parameter, Platz im Bild prüfen, Überdeckung mit Kamera-Kennzeichnung und Zeitlimit-Kasten
vermeiden). **Wertungsneutral per Bauart**, weil nur gelesen und gezeichnet wird. Pflicht ist
trotzdem `scripts/pruefe-wertung-fingerabdruck.mjs` byte-identisch, wie in allen Kulissen-
Batches.

**Bauort:** auf der Spitze des Spurt-Stapels (#1371), weil `zeichneHyroxRangleiste()` erst dort
existiert. Das ist ein Grund mehr, den Stapel vorher zu mergen (Abschnitt 4.1).

### 3.2 B2 — Zeitdehnung je Format

`zeitFaktor()` (`:53021`) liest `ZEIT_DEHNUNG[disc]`. Ein Format (Hatz, HYROX, später Grube oder
Knockout) erbt damit den Faktor des klassischen Formats, obwohl seine Sim-Länge eine ganz andere
ist. Vorschlag: ein zweiter Schlüssel `ZEIT_DEHNUNG["spurt:hatz"]` mit Rückfall auf
`ZEIT_DEHNUNG[disc]`. Dasselbe gilt für den Battlefield-Pod (`"battlefield:pod"`). Die
Sandsack-Weiche `SANDSACK_PAR_SZENE` ist schon ein Einzelfall genau dieses Musters und würde
dabei mit aufgeräumt.

**Aufwand:** etwa 10–20 Zeilen. **Wertungsneutral:** Die Sonden (`serieVon`, `bahnSerie`,
`einflussVon`, `miss-alle-disziplinen.mjs`) laufen nie durch `loop()`/`zeitFaktor()`, so steht es
im Kommentar über der Tabelle (`:52894ff.`). Bei der Hatz ist es sogar trivial: Die Ränge stehen
nach `baueHatz()` fest, bevor der erste Tick läuft. Anders als bei der Staffel-Kalibrierung
(13,86 → 14,65) kann eine feinere dt-Teilung dort keine Zufallszüge verschieben.

**Korrektur zur ersten Fassung (beim erneuten Lesen des Tabellenkommentars):** „Wertungsneutral"
gilt für die **Buchung**, aber nicht automatisch für das **angezeigte** Rennen. Der Kommentar über
`ZEIT_DEHNUNG` belegt es an der Staffel selbst: Ein größerer Faktor teilt den Tick in kleinere
dt-Schritte und verschiebt damit „die genaue Abfolge der Zufallszüge (rr(), z. B.
Wechselpatzer/Windschatten-Wechsel)". Deshalb landete 13,86 nicht auf 3:00 und musste auf 14,65
nachkalibriert werden. Bei Formaten mit durchgehender Physik (Spurt klassisch, Climbing,
Battlefield-Pod) kann eine Faktoränderung deshalb auch die **gezeigte** Endrangfolge verändern.
Hatz und HYROX sind davon frei, weil ihr Ergebnis vorab feststeht. Jede Faktoränderung bekommt
darum zusätzlich die Anzeige-Treue-Prüfung aus Abschnitt 5, E2.

**Nachtrag 10.11. (#1372):** Die Sonde aus A1 hat gezeigt, dass die Abweichung schon **ohne**
Faktoränderung bestand: Spurt 24/24, Takeshi-Duell 24/24, Staffel-Duell 23/24, Climbing 22/24,
Staffel-Pod 10/24 Saaten. Ursache waren zwei dt-skalierte `rr()`-Würfe in `stepSpurt()`. #1372
lässt die Bahn-Physik in der Anzeige jetzt im festen 1/60-Takt der Buchung laufen
(`anzeigeSechzigstel()`). Danach liegen alle bei 0/24. **Für die Bahn ändert `ZEIT_DEHNUNG` damit
nur noch, wie viele Buchungs-Ticks je Echtzeit-Sekunde gezeigt werden, und nicht mehr das
Ergebnis.** A3 wird dadurch für Spurt und Climbing risikoarm. Die Anzeige-Treue-Prüfung bleibt
Pflicht, sollte dort aber trivial bestehen.

### 3.3 B3 — Sendedauer-Sonde mit Zielband

Die Sonde aus Abschnitt 1.2 als `scripts/miss-sendedauer.mjs [disziplin[:format]] …`, dazu
eine kleine Tabelle mit Zielbändern je Disziplin (entschieden in Abschnitt 5, E2). Ausgabe: Ist,
Band, Abweichung, **dazu die Anzeige-Treue** (Endrangfolge des angezeigten Laufs gegen die
gebuchte, siehe die Korrektur in 3.2). Zunächst als Bericht, nicht als harte CI-Schranke. **Warum ein Fundament:** Die Hatz
wäre damit am Tag ihres PRs aufgefallen. Die +20 % Drift bei Spurt klassisch (3:03 → 3:36,
seit dem 06.09. unbemerkt) und die Kürze von Climbing ebenso. Jede Formatvariante aus
`format-varianten-brainstorm-08-11.md` (14 Kandidaten) wird dieselbe Frage aufwerfen.

**Aufwand:** etwa 100–150 Zeilen Skript, keine Engine-Zeile. Die Bausteine (`sondenLauf`,
`vorbei`, `bahnFlags`, `bahnPodAnzeigen`, `battlefieldPodAnzeigen`) existieren alle. Achtung:
Chromium stürzt beim Laden der Seite gelegentlich ab („Page crashed"). Die Sonde braucht je
Disziplin einen frischen Browser und bis zu drei Wiederholungen.

### 3.4 B4 — Fahrplan für vorab berechnete Formate

HYROX Stufe 1 (`hyroxFahrplan()`, `:48842`, PR #1371, ~200 Zeilen) bildet ein vorab berechnetes
Ergebnis rho-neutral auf einen ehrlichen Zeitverlauf ab: Wer an einer Station verliert, verliert
dort sichtbar Zeit. **Dieselbe Idee braucht jedes Format, das sein Ergebnis beim Bau würfelt**:
heute die Hatz, demnächst die Kandidaten aus dem Format-Brainstorm (Grube, Knockout, Hai-Gasse).
Für die Hatz heißt das konkret: Die Wellen-Note aus `hatzWelleScore()` bestimmt die Position
innerhalb der Welle. Die zwei Schwächsten fallen im Lauf der Welle sichtbar nach hinten, bis der
Fegearm sie holt. Der Ausgang steht damit nicht ab Tick 1 fest im Bild (Rauschen innerhalb der
Welle, Aufholen möglich), aber wer gefährdet ist, sieht man.

Ich empfehle, die Lehre als Regel festzuhalten (Handbuch, nicht CLAUDE.md): **„Ein vorab
berechnetes Format braucht einen Fahrplan, sonst ist das Live-Bild entweder ein Spoiler oder
leer."**

### 3.5 Schon vorhanden und weiter nutzbar

- **„Rahmen statt Material"** (Audit Abschnitt 4) als Kulissenrezept für Eiskunstlauf und
  Fechten. Die Rohszenen liegen unter `public/szenen/<disziplin>/`. Neue PixelLab-Assets sind
  dafür nicht nötig.
- **Pod-Tafeln** (`zeichneBahnPodTafel`, `zeichneBfPodTafel`) für jedes künftige
  Vier-Team-Format.
- **Nahkamera-Muster** (HYROX #1369). Für Spurt klassisch, Climbing und Time-Trial gibt es
  bereits mitlaufende Kameras („Kamera 3.3×"). Das ist kein offener Hebel mehr, nur bei neuen
  Formaten mitzudenken.

---

## 4. Der Fahrplan: Auftragsliste für Bau-Agenten

Aufwand in **Sitzungen** (eine Sitzung ≈ ein Bau-Agent, ein PR; Bezugspunkte aus den echten
Engine-Diffs: Climbing-Wand 285 Zeilen, Takeshi 204, HYROX-Halle 368, Nahkamera 277,
HYROX-Fahrplan 196, Hatz-Format 238, Showcase/Breaking-Lichtfix 15). Die Zeilenzahlen sind
Schätzungen ±50 %.

### 4.1 P0 — Chris: Merge-Warteschlange (Empfehlung, keine Agentenarbeit)

Mergen ist Chris' eigene Handlung. **Neue Reihenfolge (10.11., E13), per Probe-Merge geprüft**
(`git merge-tree` gegen `origin/main` `972b970cb`, je Schritt auf das Ergebnis des vorigen):

| # | PR | Inhalt | Probe-Merge | Warum an dieser Stelle |
|---:|---|---|---|---|
| 1 | **#1370** | CLAUDE.md: PixelLab-Animationen nur mit Chris' Freigabe | sauber | nur Doku; die Regel soll gelten, bevor weitere Agenten starten |
| 2 | **#1372** | Anzeige-Treue-Fix (Bahn im 1/60-Takt) **plus** A1-Sonde (`miss-sendedauer.mjs`, `miss-anzeige-treue-rest.mjs`) | sauber, auch gegen jeden anderen PR dieser Liste einzeln | Korrektheit, oberste Priorität „Feld = Wertung"; Fingerabdruck und rho bit-identisch |
| 3 | **#1360** | Bühnen paaren nach dem gesetzten Slot | sauber nach 1–2 | ebenfalls „Feld = Wertung"; laut PR-Text rho/Pp bit-identisch |
| 4 | **#1364 → #1367 → #1368 → #1369 → #1371** | Spurt-Stapel (acht Commits, linear) | sauber nach 1–3 | Grundlage für A3/A4/A6/L0 |
| 5 | **#1359** | Showcase/Breaking-Kulisse | **Konflikt** nach 4, in `docs/design/arena-kulissen-im-motor-03-11.md` | braucht vorher einen Rebase |
| 6 | **#1362** | Takeshi-Kulisse | **Konflikt** mit #1359 (Ledger, `pixellab-requisiten/auswahl.json`, `scripts/pixellab-requisiten.py`) | Rebase nach 5 |
| 7 | **#1363** | Climbing-Kulisse | **Konflikt** mit #1362, auch in `battle-mode.engine.js`, dazu `public/sprites/arena/quellen.json` | Rebase nach 6 |

**Warum die Kulissen nach hinten rücken (Korrektur der ersten Fassung):** Die vier Kulissen-Zweige
(#1359, #1362, #1363 und #1364 an der Basis des Spurt-Stapels) schreiben alle in dieselben
Sammeldateien, vor allem `docs/design/arena-kulissen-im-motor-03-11.md`. Sie konfliktieren deshalb
**in jeder Reihenfolge** paarweise. Die Reihenfolge entscheidet also nicht, **ob** ein Rebase
nötig ist, sondern nur, **wie viele**. Erst die konfliktfreie Kette (1–4), dann die drei Kulissen
mit je einem kurzen Rebase: Das sind drei Rebases statt vier, und Strang W sowie A3/A4 hängen an
keinem davon. Der Rebase von #1359 bis #1362 betrifft nur Doku und JSON. Bei #1363 ist auch die
Engine dabei (Bühne bzw. A-Boden), das macht ein Agent im entsprechenden Slot.

Nicht in dieser Liste, weil nicht Teil dieses Fahrplans und von mir nicht bewertet: #1361
(Corsair), #1358 (Einsatzliste), #1354, #1352, #1350, #1328 und ältere.

**Entschieden: Bau-Agenten stapeln nicht auf ungemergte PRs.** Jeder Auftrag ab Welle 1 startet
erst, wenn die in seiner Zeile genannten PRs auf `main` sind, und zweigt von `main` ab. Welle 0
braucht keinen Merge. **Strang W braucht keinen der offenen PRs** und zweigt sofort von `main` ab.
Einzige Ausnahme ist W1d (Hockey scharf), das die Anzeige-Treue-Sonde aus #1372 nutzt.

### 4.2 Zonen in `battle-mode.engine.js`

Maßgeblich sind die **Funktionsnamen**. Die Zeilen gelten für `14a18a72b` (Spitze #1371) und
dienen nur der Orientierung. Nach den Merges verschieben sie sich.

| Zone | Funktionen | Zeilen (`14a18a72b`) |
|---|---|---|
| **B — Bühnen-Zeichnung** | `bodenBuehne`, `bodenTennis`, `bodenShowcase`, `bodenWettessen`, `bodenSchatzsuche`, `bodenHeben`, `bodenEis`, `zeichneBuehne`, `zeichneTennis`, `zeichneFechten`, `zeichneShowcase`, `zeichneEisstaub`, `zeichneEisStand`, `zeichneBreaking` | ~29 650–38 410 |
| **A-HUD — Bahn-Anzeige** | `updateHudBahn`; in `bauSpurt` nur Anzeige-Zustand; `baueHatz`/`stepSpurtHatz` (nur Bahnposition, nicht `hatzRang`); `hyroxFahrplan`, `zeichneHyroxRangleiste`, die neue B1-Funktion, `zeichneSpurt` | ~41 800–42 500 und ~47 385–52 340 |
| **A-Boden — Bahn-Kulisse** | `bodenArena`, `bodenHyroxHalle`, `bodenTakeshiRoute`, `bodenSpurt`, `bodenSpurtGerade`, `bodenZeitfahren`, `bodenWand`, `bodenSpurtOval` | ~43 245–44 900 |
| **C — Rahmen** | `ZEIT_DEHNUNG`, `zeitFaktor`, `loop`, `gebuchteSaatFuerAktuelleDisziplin` und die gebuchten Kontexte daneben, `reset` | ~52 950–56 500 |
| **F — Feldspiel-Wertung (Strang W)** | `FELDSPIEL_ART`, `bauFeldspiel`, `stepFeldspiel`/`stepFeldspielLive` und ihre Sub-Skill-Formeln; dazu die Hockey-/Football-Blöcke in `battle-mode.rezepte.js` (eigene Datei) | `main`: ~9 137, ~10 858, ~16 000–16 600 |
| **K — Arena-Kampf-Wertung (Strang W)** | `ARENA_ART`, `baueEinheit`, der Kampfteil von `stepSim`, `kampfSieger`, `MOTOREN.tdm`, `bfffaGefecht`/`bfPodReplaySchritt` (nur lesen bzw. als Vorlage), das neue `tdmGefecht` mit Abspielschritt, die Arena-`draw()` | `main`: ~8 764, ~38 333, ~39 524, ~50 846, ~56 077–56 400 |
| **Tabu für jeden Fahrplan-Agenten** | Bau und Motoren der Bühne (`bauBuehne` bis vor `bodenBuehne`, ~20 125–29 650), `MOTOREN`, die Physik in `stepSim`/`stepSpurt`, die Logik von `bahnRangliste()` (nur lesen), `BAHN_ART`, `BAHN_FLAGS`-Definition, `KULISSEN`/`kulisseWaehlen` (~42 505–42 600), die Zonen F und K (Strang W) | – |

**Slot-Regel (entschieden):**

1. **Höchstens zwei Fahrplan-Agenten gleichzeitig an der Engine:** Slot 1 arbeitet in C oder
   A-HUD, Slot 2 in B oder A-Boden. Nie zwei Agenten in derselben Zone.
2. A-HUD und A-Boden dürfen gleichzeitig laufen, weil ihre Funktionen getrennt liegen. Braucht
   ein Agent trotzdem eine Zeile in der fremden Zone, macht er sie **nicht** selbst, sondern
   meldet sie in seinem Bericht. Der nächste Auftrag in jener Zone nimmt sie mit.
3. **Strang W hat Vorrang (E8).** Jeder W-Agent an der Engine belegt einen der zwei Slots. Laufen
   W1 und W2 beide an der Engine, ruht der Fahrplan dort. Das Zwei-Agenten-Limit gilt für die
   ganze Datei. Arbeitet W1 nur in `battle-mode.rezepte.js`, belegt es keinen Engine-Slot.
4. Pflicht in jedem Engine-PR: `scripts/pruefe-wertung-fingerabdruck.mjs` byte-identisch; Bilder
   bei 30 % und 75 % der Sendedauer; ab Welle 1 ein Lauf von `miss-sendedauer.mjs` (A1) für die
   berührten Disziplinen.

### 4.3 Die Aufträge

In Klammern steht die Bezeichnung aus der ersten Fassung (P1–P4), damit ältere Verweise auffindbar
bleiben.

**Welle 0: erledigt (Stand 10.11.).** A1 liegt in #1372 (`scripts/miss-sendedauer.mjs`, Bericht
`docs/design/sendedauer-messung-09-11.md`). Es bestätigt die Dauern aus 1.3 und hat den
gezeigt≠gebucht-Fund geliefert (Nachtrag in 3.2). A2 liegt als Befund am Ende dieses Dokuments
(Ursache ist das `FIGUREN_WARTE_MS`-Zeitfenster bei Pods, kein Testkader-Artefakt). **Offen aus
A2:** ob das 4-s-Budget für Pods erhöht oder die Pod-Kader vorgeladen werden. Das ist ein kleiner
Fix ohne PixelLab in Zone C und wird an A3 angehängt (Abschnitt G, Zeile 9). Die
`haar`-Nachträge im Baukasten-Katalog `B_FIGUR` entfallen, weil der Rückfall nach dem Fix nicht
mehr zu sehen sein soll.

| Auftrag | Inhalt | Ort | Aufwand | Abnahme |
|---|---|---|---|---|
| **A1 Sendedauer- und Anzeige-Treue-Sonde** (B3) | `scripts/miss-sendedauer.mjs [disziplin[:format]] …` mit der Zielband-Tabelle aus E2. Je Lauf Ist, Band, Abweichung. Dazu die **Anzeige-Treue**: Endrangfolge des Laufs über `sondenLauf()` mit Faktor gegen die gebuchte Rangfolge, 24 Saaten. Abgedeckt: alle 20 Disziplinen, Pods, die Formate `spurt:hatz`/`spurt:hyrox` (bis zum Merge gegen die Spitze von #1371) und der Mini-DM-FFA (eigene Leinwand `#mdffaCv`). Je Disziplin ein frischer Browser, bis zu drei Wiederholungen (Absturzfalle aus 3.3). Ein Lauf mit Kaderfamilie klärt nebenbei die Koordinator-Abweichung (Takeshi ~100 s, HYROX ~5 min). | `scripts/`, Basis `main` | ~150 Zeilen, 1 Sitzung | Tabelle aller 20 plus Formate plus Pods im PR-Text; nur ein Bericht, keine CI-Schranke |
| **A2 Kahle Grundfiguren prüfen** | Treten die kahlen Grundfiguren aus den Pod-Bildern im echten Spiel auf (Abbild `live-save`, echte Kader) oder nur mit dem Testkader `kaderfamilie-live-save.json`? Welche Spieler sind betroffen, und welche Sprite-Zuordnung fehlt? **Nur lesen, kein PixelLab.** | lesend | ½ Sitzung | Bericht mit Spielerliste; eine Bestellung schlägt er höchstens vor, Chris gibt frei |

**Welle 1: A3, L0 und A4 nach #1372 und dem Spurt-Stapel bis #1371 auf `main`. A5 zusätzlich erst
nach #1359, weil beide Zone B anfassen. Alles nur in einem Engine-Slot, den Strang W gerade nicht
hält (G).**

| Auftrag | Slot / Zone | Inhalt | Aufwand | Abnahme |
|---|---|---|---|---|
| **A3 Rahmen I: Zeitdehnung je Format** (B2 + Faktoren) | Slot 1 / C | `zeitFaktor()` liest zuerst `ZEIT_DEHNUNG["<disc>:<format>"]`, sonst `ZEIT_DEHNUNG[disc]`. Pod-Schlüssel `battlefield:pod`. Startwerte: `spurt:hatz` **2,50**, `spurt:hyrox` **11,14** (festgeschrieben, damit die Korrektur von klassisch es nicht mitzieht), `spurt` **11,14 → ~9,3**, `climbing` **4,38 → ~8,2**, `battlefield:pod` **5 → ~2,4**. Jeder Wert wird mit A1 ins Band nachkalibriert, wie bei der Staffel (13,86 → 14,65). Die Sandsack-Weiche `SANDSACK_PAR_SZENE` nur dann mitnehmen, wenn sie trivial auf das neue Muster passt. | ~20 Zeilen, ½ Sitzung | Alle fünf im Band (E2); Anzeige-Treue-Regel (E2) eingehalten; `miss-alle-disziplinen.mjs 24 <diszi>` vorher und nachher identisch; Fingerabdruck; Bilder 30/75 % mit Blick auf Sim-Zeit-Konstanten (2.3) |
| **L0 HYROX/Hatz-Etikett** (Etiketten-Papier, Abschnitt 7) | Slot 1 / A-HUD, nach A3, **vor A4** | In Formaten, deren Schritt `u.plan` nicht liest (`bahnHyroxAktiv`, `bahnHatzAktiv`), entfallen Planzeile, Puste-Leiste und Ansage-Knöpfe (`rennplanMoeglich()`). Heute steht dort „Windschatten", obwohl es keinen Sog gibt. Das ist eine falsche Erklärung und geht deshalb nicht in die Liga. | ~20 Zeilen, ½ Sitzung | Fingerabdruck; Bild HYROX-Halle und Hatz ohne Planwort und Leiste |
| **A4 Rahmen II: Format-Weiche** (F1) | Slot 1 / C, nach A3 **und L0** | Siehe E1, „Bauvorgabe". Format im Spielplan-Slot, Plan-Tabelle `spurt: [hyrox, klassisch]`, Kanal `formatByDisciplineId` in Host und Headless-Runner, Engine liest ihn in Zone C und setzt `BAHN_FLAGS.spurtFormat` vor dem Bau. Abnahme-Einträge je Format, Guard-Test, Spielplan-Etikett. | ~150–250 Zeilen über lib/app/engine, 1 Sitzung | Bestehende Saves und die laufende Saison bit-identisch (kein `format` → klassisch); `e2e-saisonende-am-save-abbild.ts` am Abbild grün; `spurt:hyrox` in `disziplin-abnahme.json` mit frisch gemessenem rho/Pp (zwei Saatströme); Guard-Test schlägt fehl, wenn ein Planformat ohne Abnahme ist |
| **A5 Eiskunstlauf** (P3.1) | Slot 2 / B | „Rahmen statt Material" nach Audit 4.4: Waldsee-Horizont auf voller Höhe, Kür-Hallenrang mit Publikum, Spots auf die Läufer, Eis mit Spiegelung, Kufenspuren und Verlauf. Kulissenbild aus der vorhandenen Rohszene `public/szenen/eiskunstlauf/`. Zwischenstand-Tafel (`zeichneEisStand`) und Wiederholungsfenster bleiben unangetastet. Ein neuer Eintrag in `KULISSEN` kommt über die Kulissen-Daten, nicht über `kulisseWaehlen`. | ~300–450 Zeilen, 1 Sitzung | Audit-Note B+ an den fünf Merkmalen aus Audit Abschnitt 1; Fingerabdruck |

**Welle 2 — nach A4 bzw. A5 auf `main`**

| Auftrag | Slot / Zone | Inhalt | Aufwand | Abnahme |
|---|---|---|---|---|
| **A6 Bahn-Rangleiste B1, HYROX und Spurt klassisch** | Slot 1 / A-HUD | `zeichneHyroxRangleiste()` herauslösen in eine Funktion mit den Parametern `sortierung`, `status`, `kopf`, `imBild`, `ecke` (Tabelle 3.1). HYROX pixelgleich darauf umstellen (Screenshot-Vergleich). Als erster neuer Abnehmer kommt Spurt klassisch dazu: Sortierung fertig nach Zeit, sonst `u.pos`; Status Station n/7, ✓ oder „liegt"; Kopf „SPURT · Station 4/7". `bahnRangliste()` bleibt unangetastet. | ~200 Zeilen, 1 Sitzung | HYROX pixelgleich; Interface-Abnahme (4.5, Punkt 2) für Spurt klassisch; Fingerabdruck |
| **L1 Bahn-Etiketten** (Etiketten-Papier, Abschnitt 7) | Slot 1 / A-HUD, **direkt nach A6** | Nur der Name bleibt dauerhaft. Dazu höchstens eine Kopf-Ikone und Gedankenblasen bei Zustandswechseln (I1–I11). Gemeinsame `kopfIkone()`/`gedankenBlase()`, Hover/Fokus-Etikett, „?"-Legende, Drei-Stufen-Schalter. **Die Puste-Leiste wird gedimmt, solange sie voll ist** (Chris, 10.11.; Vorschlag des Papiers: 35 % Deckkraft, die Schwelle legt der Agent mit Bild fest, nicht unter 80 %). Die HYROX-Statusspalte der B1-Leiste bekommt dieselben Icons. | ~350–450 Zeilen, 1–1½ Sitzungen | Zählung aus Papier 1.5 erreicht (Spurt ≤ 12 + 3 Zeilen); jedes Icon einmal mit Erstauftritts-Wort im Bild; Fingerabdruck |
| **A7 Climbing an B1** | Slot 1 / A-HUD, nach **L1** | Sortierung `u.hoch`, Status Höhe in m/TOP, Sturz als Icon I3 statt Wort, Kopf „ZEITLIMIT 0:32". Mit dem neuen Faktor aus A3 prüfen, ob im ersten Drittel Unterschiede sichtbar sind. | ~60 Zeilen, ½ Sitzung | Interface- und Pacing-Abnahme (4.5) |
| **L2 Bühnen-Etiketten + A11** | Slot 2 / B, nach A5 | Eis nur Vorname, Punkte/„n/N" weg; I-Spy „Pkt"/„n/N" weg, dafür die „Top 3 bisher"-Ecke (früher A11); Heben, Schach, Tennis, Showcase nach Papier 7. Tennis-Kopfzeile größer (Rest von A11). | ~180–260 Zeilen, 1 Sitzung | Fingerabdruck; Bilder je Bühne; Zwischenstand-Tafeln unverändert |
| **A8 Fechten** (P3.2) | Slot 2 / B, nach L2 | Zuschnitt nach Audit 4.7: unter der Bahn Hofmauer mit Tor bzw. vordere Tribünenreihen und Kampfrichtertische. | ~120–200 Zeilen, ½ Sitzung | Audit-Note B+; Fingerabdruck |

**Welle 3**

| Auftrag | Slot / Zone | Inhalt | Aufwand | Abnahme |
|---|---|---|---|---|
| **A9 Hatz-Nacharbeit** (P2.4) | Slot 1 / A-HUD, nach A7 (also nach A6, L1 und A3) | Fahrplan B4: Die Wellen-Note aus `hatzWelleScore()` bestimmt die Position innerhalb der Welle, die zwei Schwächsten fallen im Lauf der Welle sichtbar zurück. `hatzRang` bleibt unangetastet. Dazu der Wellenzähler „WELLE 3/5 · noch 8 im Rennen", die Gefahrenmarke für die unteren zwei als **L1-Icon I4** (mit Gedankenblase „gefährdet" beim Eintritt) und die Leiste über B1 mit Status W/I4/I5/✓. Erwischte Läufer bekommen ihre vorhandene, charakterpassende `tod`-Animation, keine neue. **Erst wenn die Hatz alle fünf Punkte aus 4.5 erfüllt**, trägt derselbe PR sie in den Formatplan ein (E1: 2. Durchgang, saisonweise im Wechsel mit klassisch). | ~250–300 Zeilen, 1 Sitzung | Fünf Punkte aus 4.5; rho/Pp mit `miss-spurt-hatz-rangtreue.mjs`/`messe-spurt-hatz-einfluss.mjs` unverändert (0,840; 23,6/24,6); Abnahme-Eintrag `spurt:hatz` |
| **A10 Staffel-Politur** (P3.3) | Slot 2 / A-Boden | Bahnnummern, zweite Tribüne unten, Tageszeit-Ton in `bodenSpurtOval`. Darf neben A9 laufen, weil A-Boden und A-HUD getrennt liegen. | ~80–150 Zeilen, ½ Sitzung | Fingerabdruck; Bilder Pod und Duell |

**Welle 4 — frei einplanbar, je ein Slot**

| Auftrag | Slot / Zone | Inhalt | Aufwand |
|---|---|---|---|
| ~~A11 Bühnen-Interface-Politur~~ | – | **In L2 aufgegangen** (10.11.): Die I-Spy-Etiketten fallen nur weg, wenn die „Top 3 bisher"-Ecke gleichzeitig kommt. Getrennt gebaut, würde dieselbe Zeichenstelle zweimal angefasst. | – |
| **L3 Arena- und Breaking-Etiketten** | Slot 2 / B (Breaking); Arena-Teil in Zone K erst **nach W2c** | Arena „HEILER" → I12 Kreuz. Breaking „ERTRÄGT/PEINIGT" → I12 **Schild/Faust** (E12), 👑 → gezeichnete I8, Gefährdet-Icon I4 bei HP < 15 %. | ~80–120 Zeilen, ½ Sitzung |
| *(niedrig)* Spurt-Band (P3.4) | Slot 2 / A-Boden | Stationsumfeld im Belag, zweite Outdoor-Variante. Rückt nach hinten, weil klassisch nach E1 nur noch den 2. Durchgang bestreitet. | ~200 Zeilen, 1 Sitzung |
| **gestrichen bzw. zurückgestellt** | – | Takeshi-Duell an B1 (frühere P2.5, siehe E3). Kulissen-Politur Football/Hockey/TDM und der TDM-Spielstand im Bild: zurückgestellt, bis die Disziplin über Strang W gewertet ist (E5). Danach gehören sie in Welle 4. | – |

### 4.4 Zeitlinie (Stand 10.11.)

```
jetzt    Chris         Merges #1370 → #1372 → #1360
         Engine K      W2a TDM-Gefecht-Prototyp (Abnahme zuerst)          ─┐ Strang W,
         Engine F/Rez. W1a Hockey-Messbasis → W1b Rezept (→ W1c K-Schock)   ─┘ Vorrang (E8)
         ohne Engine   W0 Battlefield-Duell-Nachweis
danach   Chris         Spurt-Stapel #1364…#1371; dann Rebase + #1359 → #1362 → #1363
         Slot frei*    A3 Zeitdehnung (+ A2-Fix Figuren-Wartezeit) → L0 → A4 Format-Weiche
         K             W2b Abspielen/Runner → W2c TDM scharf
         F             W1d Hockey scharf → (Q-F beantwortet) W3 Football
später   A-HUD         A6 Rangleiste → L1 Etiketten → A7 Climbing → A9 Hatz
         B             A5 Eiskunstlauf → L2 Bühnen (mit A11) → A8 Fechten
         A-Boden/B/K   A10 Staffel · L3 Arena/Breaking (nach W2c) · Spurt-Band · E5-Politur
* „Slot frei": ein Engine-Slot, den W gerade nicht hält (G, Engine-Regel).
```

### 4.5 Was „fertig" heißt (Abnahme je Disziplin, verbindlich)

1. **Visuell:** Audit-Note B+ oder besser, gemessen an den fünf Merkmalen aus Audit Abschnitt 1.
2. **Interface:** An drei beliebigen Zeitpunkten (25/50/75 %) beantwortet ein Standbild ohne DOM:
   Wer führt (Name), wer liegt hinten bzw. ist gefährdet, wie viel kommt noch (Uhr, Runde, Welle,
   Bahn n/6).
3. **Pacing:** Sendedauer laut A1 im Zielband aus E2. Bei 20 % der Dauer sind schon sichtbare
   Unterschiede im Bild.
4. **Wertung:** organisch gewertet (rho > 0,80, Pp ≤ 25), unverändert die Pflicht aus CLAUDE.md,
   **je Format** gemessen.
5. **Bei jedem Schritt:** Fingerabdruck byte-identisch, wenn nur Anzeige geändert wurde.

### Strang W (früher „Strang M") — jetzt ausgeplant

Siehe Abschnitt W. Mini-DM variabel-k ist nicht mehr darin: Chris hat am 24.10. alle k freigegeben,
und der FFA-Motor bucht, was die Arena zeigt.

---

## 5. Entscheidungen (PM, 09.11.)

### E1 — Spurt-Format: HYROX im 1. Durchgang, klassisch im 2., Hatz nach der Nacharbeit

**Entschieden.** Das Format wird **fest im Saisonkalender** gewählt (Option A aus
`format-varianten-brainstorm-08-11.md` Abschnitt 6), und zwar über den Durchgang:

| Durchgang | Format | Ab wann |
|---|---|---|
| 1. Durchgang (und jede Saison ohne Durchgangs-Markierung, z. B. Manager Mode) | **HYROX** | ab der nächsten neu angelegten Saison, sobald A4 auf `main` ist |
| 2. Durchgang | **klassisch** | sofort mit A4 |
| 2. Durchgang, ab Abnahme der Hatz | **klassisch und Hatz saisonweise im Wechsel** | mit A9, erst wenn die Hatz alle fünf Punkte aus 4.5 erfüllt |

**Warum HYROX als Hauptformat (die erste Fassung hält der Nachprüfung stand):**

- HYROX besteht beide Pflichtabnahmen: rho/Spiel **0,895**, Pp **20,2/20,5** (zwei Saatströme,
  `spurt-format-hyrox-stationen-08-11.md`), und das schon im ersten Anlauf.
- Auf den drei Anzeige-Achsen ist HYROX bereits heute das beste Spurt-Format: visuell B+ (Halle),
  Interface A (es ist die Referenz, aus der B1 entsteht), Pacing 3:52, im Band (E2).
- HYROX ist das einzige Spurt-Format, das nach Chris' Leitlinie vom 21.09. gebaut ist:
  Stationsgruppen mit Primär- und Nebenweg. Jeder Spieler hat dort einen Weg, in irgendetwas gut
  zu sein.

**Warum klassisch bleibt und nicht abgelöst wird:** klassisch hat die höchste Rangtreue der drei
(0,910, Pp 19,4|14,9) und ist das Format, das die Manager seit September kennen. Der Abstand zu
HYROX (0,015) ist bei beiden Werten über 0,85 bedeutungslos. Der Grund für die Rangfolge ist also
nicht die Wertung, sondern das Bild. Klassisch bekommt mit A6 die Rangleiste und damit die
Interface-Lücke geschlossen.

**Warum die Hatz noch nicht:** Ihre Zahlen bestehen (0,840, Pp 23,6/24,6), liegen aber am
nächsten an beiden Schranken. Interface und Pacing stehen auf C (2.1, 1.3). Ein Format, das im
Bild nicht zeigt, wer gefährdet ist, und dreimal so lang läuft wie bestellt, geht nicht in die
Liga. Nach A9 kommt sie in den 2. Durchgang, im Wechsel mit klassisch. So läuft HYROX jede Saison,
und klassisch und Hatz laufen jede zweite.

**Warum Option A und nicht Hash (B) oder Liga-Einstellung (C):**

- In einer Battle-Mode-Saison läuft jede Disziplin zweimal (`getSeasonDisciplineRepeatCount` → 2).
  Der Spielplan markiert das schon heute je Slot mit `occurrenceInSeason: 1 | 2`, und die
  Spielplan-Übersicht zeigt daraus „2. Durchgang" (`season-matchday-fixtures-overview.ts`). Ein
  Format je Durchgang ist damit die natürliche Lesart von Chris' „pro season nur 2x". Es kostet
  kaum mehr als ein Hash, weil die Markierung schon existiert.
- Ein Hash kann in einer Saison zweimal dasselbe Format ziehen, und der Manager kann nicht planen.
- Eine Liga-Einstellung braucht eine Admin-Oberfläche. Ein Heimrecht-Wahlrecht wäre ein neuer
  Faktor in der Rangtreue, den erst jemand messen müsste, und die KI-Teams müssten mitwählen. Das
  bleibt eine mögliche spätere Übersteuerung über A, ist aber kein Teil dieses Fahrplans.

**Bauvorgabe für A4 (Format-Weiche):**

1. Das Format wird **beim Anlegen der Saison** in den Spielplan-Slot geschrieben (neues
   optionales Feld `format`, bestimmt aus einer Plan-Tabelle je Disziplin und `occurrenceInSeason`).
   Fehlt das Feld, gilt klassisch. Damit bleiben alle bestehenden Saves und die laufende Saison
   **bit-identisch**, ohne Migration, nach demselben Grundsatz wie `isDoubledBattleSeason`
   („keine stille Migration").
2. Host (`FoundationBattleArenaHost.tsx`) und Headless-Runner (`arena-headless-runner.ts`)
   reichen das Format auf demselben Weg wie `seedByDisciplineId` weiter (neu:
   `formatByDisciplineId`). **Gezeigt = gebucht** setzt voraus, dass beide dasselbe Format bauen.
3. Die Engine liest den Kanal in Zone C und setzt `BAHN_FLAGS.spurtFormat` vor dem Bau, ohne
   Kanal „klassisch". Den Mess-Schalter `window.__olyBahnFlags` benutzt die App dafür nicht. Er
   ist global, der Kanal gilt je Disziplin.
4. **Abnahme je Format:** `disziplin-abnahme.json` bekommt Einträge `spurt:hyrox` (und mit A9
   `spurt:hatz`), frisch gemessen mit den Format-Skripten in zwei Saatströmen. Der Guard-Test
   schlägt fehl, wenn ein Format im Plan keine bestandene Abnahme hat.
5. **Die Eignungszahl im Kaderbildschirm bleibt die Matrixzahl**, unabhängig vom Format
   (Matrix-Sperre). Sichtbar wird das Format nur als Etikett im Spielplan, z. B. „Spurt · HYROX",
   damit der Manager es vor dem Spieltag kennt.

Das Muster gilt später für jede Disziplin mit zweitem Format (Gewichtheben-Sandsack, Grube,
Durchbruch usw.). Es nimmt aber kein weiteres Format in den Plan auf, bevor dessen Stufe 3 (Bild,
HUD) steht und die fünf Punkte aus 4.5 erfüllt sind. Der Sandsack gehört nicht zu diesem
Fahrplan.

### E2 — Zielbänder der Sendedauer

**Entschieden. Regel:** Jede Disziplin und jedes Format hat einen Zielwert. Die Toleranz beträgt
**±15 %**. Ohne ausdrückliche Vorgabe von Chris dauert kein Spiel **kürzer als 0:50 oder länger
als 5:00**. Ausdrücklich vorgegeben sind Basketball (4 × 1:30), Gewichtheben (4–8 s je Versuch)
und Hockey (~8 min); diese drei bleiben, wie sie sind. Bei Ausscheidungsformaten wird die Dauer
**je Runde** festgelegt, nicht je Spiel, weil die Feldgröße die Rundenzahl bestimmt.

| Disziplin (Format) | Zielwert | Band (±15 %) | Ist (1.3) | Maßnahme (A3) |
|---|---:|---|---:|---|
| **Spurt klassisch** | 3:00 | 2:33–3:27 | 3:36 | `spurt` 11,14 → ~9,3. Chris hat ~3 min bestellt, die +20 % sind unbemerkte Drift |
| **Spurt HYROX** | 3:30 | 2:59–4:01 | 3:52 | keine; eigener Schlüssel `spurt:hyrox` = 11,14, damit die Korrektur von klassisch ihn nicht mitzieht |
| **Spurt Hatz** | 30 s je Welle, 7,5 s je Neuordnung; 3:00 bei 12 Läufern | 2:33–3:27 bei 12 | 10:36 / 13:22 | `spurt:hatz` = 11,14 × 180/802 = **2,50** |
| **Climbing** | 1:30 | 1:17–1:44 | 0:48 | `climbing` 4,38 → ~8,2 |
| **Battlefield-Pod** | 3:30 | 2:59–4:01 | 7:12 | `battlefield:pod` 5 → ~2,4 |
| Mini-DM-FFA | Ist = Ziel, sobald A1 gemessen hat | ±15 % | nicht gemessen | keine, solange in der Leitplanke |
| alle anderen (1.3) | Ist = Ziel | ±15 % | – | keine |

**Begründungen:**

- **Hatz 3:00 bei vollem Feld:** Die Hatz ist ein Spurt-Format und bekommt dieselbe Länge, die
  Chris für Spurt bestellt hat. Die Festlegung je Welle (30 s) heißt: Bei zehn Läufern dauert sie
  2:23. Das ist gewollt, denn weniger Läufer bedeuten weniger zu sehen. Die Ränge stehen nach
  `baueHatz()` fest, der Faktor ist dort deshalb ohne Risiko.
- **Battlefield-Pod 3:30:** Faktor 5 wurde für das Duell gesetzt (41 Sim-s → 3:28). Der Pod läuft
  86 Sim-s, und zwischen 2:09 und 5:23 ändert sich im Bild kaum etwas
  (`battlefield-pod-2-09-und-5-23.jpg`). Der neue Faktor ~2,4 liegt zwischen TDM (1,88) und
  Mini-DM (2,86). Die Arena bekommt also kein neues Hektik-Niveau, nur eins, das sie schon zeigt.
- **Climbing 1:30, nicht 3:00:** Chris' Begründung für Spurt („in Ruhe angucken und kleine
  Unterschiede erkennen") gilt für jedes Bahn-Einzelrennen. Mit ~8,2 liegt Climbing auf
  derselben Zeitlupenstufe wie Spurt klassisch (~9,3), und das erste Drittel wächst von 16 s auf
  30 s. 3:00 wären bei einer einzigen Wand Faktor 16 und zu viel Leerlauf.
- **HYROX 3:30 statt 3:00:** acht Stationen, Halle und Nahkamera-Schnitte brauchen mehr Zeit als
  eine Gerade. 3:52 liegt im Band. Misst A1 mit Kaderfamilie deutlich mehr (der Koordinator sah
  ~5 min), entscheidet das Band, nicht meine Einzelmessung: dann wird `spurt:hyrox` nachgezogen.

**Pflicht bei jeder Faktoränderung, die Anzeige-Treue** (siehe Korrektur in 3.2): A1 misst für
24 Saaten, ob die Endrangfolge des angezeigten Laufs der gebuchten entspricht, einmal vorher und
einmal nachher.

- War sie vorher gleich und weicht nachher ab, **ist die Änderung nicht erlaubt.** Dann wird der
  Faktor in kleineren Schritten gesucht oder der Fall an mich zurückgegeben.
- Weicht sie schon vorher ab, ist das ein eigener Befund (gezeigt ≠ gebucht) für Chris und ein
  eigenes Ticket. Die Faktoränderung darf trotzdem kommen, weil sie keine neue Art von Abweichung
  erzeugt.

### E3 — Takeshi bleibt teamzentriert, keine Einzelrangliste

**Entschieden: keine Einzelrangliste, P2.5 ist gestrichen.** In der Liga läuft Takeshi
ausschließlich als Vierer-Pod (`VIERER_POD_DISCIPLINE_IDS` in
`lib/season/season-discipline-schedule.ts`), und dort steht das Interface schon auf B+
(Vier-Team-Tafel, „noch 16 im Rennen", Fallen-Banner). Gewertet wird je Team
(`bahnTeamstand()` → `wertung:"burg"`). Eine Einzelliste würde eine Rangfolge zeigen, die nicht
die Wertung ist, und mit der Team-Tafel um dieselbe Bildecke konkurrieren. Die Einzelleistung ist
über die Sterne je Name schon sichtbar. Das Duell (Interface B) ist kein Liga-Format und bekommt
deshalb keinen Aufwand.

### E4 — Die Rangliste sitzt im Bild, auf der Leinwand

**Entschieden: Leinwand, oben rechts nach dem HYROX-Muster, Ecke als Parameter.** Technische
Begründung:

1. **Es ist die bestehende Architektur.** Sechs der sieben vorhandenen Ranglisten-Lösungen
   zeichnen auf die Leinwand (`zeichneHyroxRangleiste`, `zeichneBahnPodTafel`,
   `zeichneBfPodTafel`, `zeichneEisStand`, die Showcase-Top-3, `zeichneWettessenTafel`). Nur
   `#ttroster` ist DOM. Auf der Leinwand ist B1 **eine** Funktion in der Engine. Eine DOM-Leiste
   bräuchte dagegen einen neuen Zustandskanal von der Engine in die Seite und Änderungen an
   `/mockups/battle-mode.html` und `FoundationBattleArenaHost.tsx`, also genau die neue
   UI-Architektur, die dieser Fahrplan vermeiden soll.
2. **Nur die Leinwand ist automatisch abnehmbar.** Punkt 2 der Abnahme (4.5) verlangt ein
   Standbild ohne DOM. `sondenLauf`, `screenshot-kulisse.mjs` und alle Belegbilder fotografieren
   die Leinwand.
3. **Kleine Bildschirme:** Die Leinwand skaliert als Ganzes. Eine DOM-Leiste unter dem Bild landet
   unterhalb des sichtbaren Bereichs.

**Grenzen, die der Bau-Agent einhält:** höchstens zwölf Zeilen (mehr Läufer hat kein Feld), kein
Scrollen, keine Interaktion (die bräuchte DOM). Die Schriftgröße skaliert mit der Leinwandbreite
und unterschreitet die der HYROX-Leiste nicht. Die Ecke wird je Disziplin so gewählt, dass weder
Kamera-Kennzeichnung („Kamera 3.3×") noch Zeitlimit-Kasten verdeckt werden. **Bestehende
DOM-Tabellen bleiben** (Spurt-Läufertabelle, Teamstand, `#ttroster`): Sie sind die Detailansicht
und funktionieren. `#ttroster` wird nicht auf die Leinwand umgezogen, weil das Aufwand ohne
sichtbaren Gewinn wäre.

### E5 — Kulissen-Politur bei Football, Hockey und TDM ruht bis Strang W (früher M)

**Entschieden: zurückgestellt.** Alle drei bestehen die Pflichtabnahme nicht (2.4) und laufen in
Battle Mode über die PPS-Duell-Brücke statt über ihr Arena-Ergebnis. Eine Mechanikrunde wird
dort mit hoher Wahrscheinlichkeit Bau- und Zeichencode anfassen. Politur jetzt hieße Nacharbeit
und zusätzliche Merge-Last in einer Datei mit 63 000 Zeilen. Die zwei Engine-Slots sind auf
gewerteten Disziplinen mehr wert. **Ausnahmen:** Fehlerbehebungen und Chris' In-Game-Meldungen
(`bug-reports`) laufen davon unabhängig weiter. Sobald eine der drei die Abnahme besteht, geht
ihre Politur in Welle 4.

### E6 — PixelLab: nichts bestellt, die Hatz braucht keine neue Figur

**Entschieden (die Bedarfsfrage, nicht die Beschaffung):** Die Hatz geht **ohne** neue Figur
live. Tragend sind der Fahrplan (sichtbares Zurückfallen), die Gefahrenmarke, der Wellenzähler und
die vorhandenen, charakterpassenden `tod`-Animationen der Erwischten. Der prozedurale Fegearm
reicht dafür.

**Vorschlag an Chris, nicht bestellt:** Eine Fegearm-Figur mit Lauf- und Fang-Animation wäre eine
Aufwertung, wenn die Hatz im Spiel ist. Freigeben kann das nur Chris. Auch als PM gebe ich
PixelLab nicht frei.

**Kahle Grundfiguren:** Zuerst untersucht A2, ob sie im echten Spiel überhaupt auftreten. Ergibt
sich daraus ein Asset-Bedarf, geht er als Vorschlag an Chris.
**Nachtrag 10.11.:** A2 hat keinen Asset-Bedarf gefunden. Die Ursache ist das Ladezeitfenster
(siehe Befund unten), das Gegenmittel kommt mit A3 (Zone C).

### E8–E11 — Strang W

Begründungen stehen in Abschnitt W: E8 in W.0, E9 in W.1–W.4, E10 in W.3, E11 in W.1. Eine
Überlegung gilt für alle vier: **Ich ziehe die billige Klärung immer vor den teuren Bau.**
Konkret heißt das: Hockey misst erst und dreht dann am Rezept. TDM rechnet die Abnahme, bevor es
abspielt. Football fragt, bevor es baut. Beim Battlefield-Duell wird nachgewiesen statt gebaut.
In der Vergangenheit hat jede Wertungsrunde, die ohne diese Klärung angefangen hat, mindestens
eine Sitzung gekostet und dann als Diagnose geendet (Football 25.10., TDM 02.10., Hockey 06.10.).

### E12 — Etiketten: Reihenfolge und die offene Geschmacksfrage

**Reihenfolge.** Die Verbindung von A6 und L1 bestätige ich und schärfe sie: L1 kommt **unmittelbar
nach** A6 und **vor** A7 und A9. A6 baut die Leiste, die sagt, wer führt. Erst dann darf das
Etikett schrumpfen. A7 (Climbing) und A9 (Hatz) bringen neue Zustände (Sturz, gefährdet, raus).
Kämen sie vor L1, würden sie als Text gebaut und von L1 gleich wieder umgebaut. L0 ist dagegen
**kein** Teil der Etikettenarbeit im Sinne der Politur, sondern eine Fehlerbehebung: Es entfernt
eine falsche Erklärung und muss deshalb vor A4 auf `main` sein, also bevor HYROX in die Liga geht.
L2 schluckt A11, weil beide dieselbe Zeichenstelle bei I-Spy und Tennis anfassen.

**Puste-Leiste:** Chris hat entschieden, die volle Leiste wird gedimmt. Das baut L1.

**Breaking-Rollen-Icons: entschieden, Schild und Faust.** Drei Gründe:
1. Die Icons sind etwa 10 px groß. Eine Faust ist in dieser Größe eindeutig lesbar, eine
   Daumenschraube oder ein Folterwerkzeug nicht. Es würde ein Klumpen, den niemand erkennt.
2. Die Folter-Lesart (CLAUDE.md: Breaking ist Folter, nicht Breakdance) trägt Breaking schon über
   die Bühne, die Peinigt-/Erträgt-Kärtchen, den HP-Verfall und die Tod-Animationen. Das
   Rollen-Icon muss nur sagen, wer gerade dran ist, und das sagen Schild und Faust.
3. Q8 vom 13.10. hält fest, dass „drastischer" Chris' Entscheidung ist und nicht die
   Voreinstellung. Mit L3 als letztem Auftrag kann Chris das bis dahin jederzeit kippen. Der
   Tausch ist eine Zeichenfunktion, kein Umbau.

### E13 — Merge-Warteschlange

Siehe 4.1. Kern der Entscheidung: Korrektheit vor Kulisse (#1372 und #1360 nach vorn), dazu die
konfliktfreie Kette vor die Kette, die ohnehin Rebases braucht.

---

## 6. Was ich nicht geprüft habe

- **Mini-DM-FFA** habe ich weder gemessen noch fotografiert (eigene Leinwand, eigenes Skript
  `scripts/screenshot-mdffa-buehne.mjs`). Die Bewertung ist aus dem Audit übernommen.
- **Takeshi Kulissenvarianten** (Dschungel, Eisfestung) und alle Kulissenvarianten außer der
  jeweils per Hash gewählten habe ich nicht einzeln angesehen.
- **Echtes Spiel im Browser mit Login (Franky)**: nicht gemacht. Alle Bilder stammen aus
  `/mockups/battle-mode.html`, das laut `FoundationBattleArenaHost.tsx` dieselbe Hülle ist wie
  im Spiel.
- **rho/Pp der Formate Hatz und HYROX:** nicht nachgemessen. Stand siehe die jeweiligen
  Format-Dokumente.
- **Anzeige-Treue** (gezeigte gegen gebuchte Endrangfolge) habe ich für keine Disziplin gemessen.
  Das hat A1 nachgeholt (#1372, Nachtrag 3.2). Für Fechten und Gewichtheben steht die volle
  24-Saaten-Messung noch aus (W.5).
- **Dritte Fassung (10.11.):** Nicht selbst gemessen habe ich rho/Pp für Hockey, Football und TDM.
  Die Zahlen stammen aus `disziplin-abnahme.json`, die TDM-Pp ist alt und mit kleinem n gemessen.
  Selbst nachgerechnet habe ich die Spearman-Korrelation Override gegen Matrix für Football
  (0,427 auf 110 Spielern, `kaderfamilie-live-save.json`; dieselbe Zahl wie am 05.09.). Die
  Merge-Folge habe ich per `git merge-tree` geprüft, ohne Tests und ohne Build. **#1360 habe ich
  nicht fachlich geprüft**, die Aussage „rho/Pp bit-identisch" stammt aus seinem PR-Text. Dass
  Battlefield in der Liga nie als Duell gebucht wird, folgt aus `LEAGUE_SIZE` und der Pod-Menge im
  Code. Am Abbild nachgesehen ist es nicht, das macht W0.
- **Feldgröße im echten Spiel:** Für die Hatz-Rechnung nehme ich zwölf Läufer an
  (`BAHN_ART.spurt.jeSeite` = 6). Stellt ein Team weniger, wird die Hatz nach E2 kürzer.
- **Tempo 2×/4×:** Alle Dauern gelten bei 1×. Wer im Spiel standardmäßig vorspult, sieht
  entsprechend weniger. Das ändert an den Ausreißern nichts.

## A2: Kahle Platzhalterfiguren — Befund

Auftrag: reproduzieren, Ursache finden, und klären, ob es ein Artefakt des Test-/Mess-Kaders ist
oder ein echter Bug im echten Spiel. Rein lesend, kein PixelLab-Aufruf, kein Fix.

**Reproduziert.** `node scripts/screenshot-kulisse.mjs battlefield - 6000 <ziel> --pod` mit dem
Test-Kader `data/generated/kaderfamilie-live-save.json` (Vigilante Wranglers/Armageddon
Aftermath/Cold Steel/Dire Legion, Saat 42) liefert einen vollständigen Battlefield-Pod-Screenshot.
Bei zwei Läufen (früher Tick 0:01 und 0:06) zeigten **alle ~20 sichtbaren Kämpfer korrekt
geladene, individuelle PixelLab-Figuren** — darunter auch bewusst haarlose (z. B. „Midas", ein
Skelett-Design, bei dem Haarlosigkeit zum Charakter gehört, nicht die generische Platzhalterfigur).
Keine kahle Platzhalterfigur in meiner Reproduktion.

**Datenabdeckung ist vollständig, nicht das Problem.** Geprüft gegen `lib/data/figurenSprites.ts`
(`getFigurSpriteForPlayer()`, Regex `^player-\d+-(.+)$`) und den Index
`data/generated/figuren-sprites.json` (360 Einträge):
- Alle 110 Spieler aus dem Standard-Test-Kader (`kaderfamilie-live-save.json`, 5 Paarungen) haben
  einen Treffer — 110/110.
- Alle 328 Spieler aus dem erweiterten Test-Kader (`kaderfamilie-arena-erweitert.json`, 32 echte
  Teams komplett) haben ebenfalls einen Treffer — 328/328.
- Beide Kader stammen laut eigenem `hinweis`-Feld **nicht** aus einer synthetischen Mischung,
  sondern wurden „über `buildArenaTeam()`" aus einem echten `live-save`-Abbild gezogen — derselben
  Brücke, die auch der echte Arena-Host benutzt (`scripts/ziehe-kader-familie.ts`). Die
  fantasievoll klingenden Namen („Draco", „Lava Golem", „Seraph-11") sind keine Test-Artefakte,
  sondern die echten, vom Spiel selbst generierten Spielernamen.
- `data/generated/figuren-sprites.json` hat exakt 360 Einträge — das deckt sich mit der Zahl der
  Spieler im erweiterten Kader (328) plus Reserve und bestätigt den Verdacht: die 360 exportierten
  PixelLab-Figuren sind erkennbar genau für den **aktuell aktiven Liga-Kader** (alle 32 Teams
  dieses Spielstands) gebaut, nicht für einen Bruchteil davon. Ein Test-Kader-Artefakt im Sinne
  „Testkader hat Spieler-IDs, für die nie eine Figur vorgesehen war" liegt **nicht** vor.

**Die eigentliche Ursache steht bereits im Code dokumentiert, als Kommentar zu einem früheren,
beinahe identischen Fund.** `public/mockups/battle-mode.engine.js` (Zeilen um `FIGUREN_WARTE_MS`,
Fund vom 03.11.), wörtlich: „Chris sah bei 0:06 fünf Kämpfer noch als Baukasten-Platzhalter — die
PixelLab-Bilder laden asynchron, und `zeichneSprite()` zeichnet bis dahin den Baukasten." Das ist
exakt das Symptom, das die PM-Recherche jetzt wieder in Pod-Screenshots sah: ein Spieler MIT
zugeordneter Figur (Datenlage korrekt) zeigt trotzdem kurzzeitig den alten, handgepflegten
„Baukasten"-Platzhalter (das LPC-Baukastensystem von vor den PixelLab-Figuren), solange dessen
Bild noch über das Netz lädt. Der Fix vom 03.11. (`FIGUREN_WARTE_MS = 4000`) lässt den ersten
Kampf-Tick erst laufen, wenn entweder alle Grundposen geladen sind oder 4 Sekunden Wanduhrzeit
vergangen sind — „langsames Netz, fehlende Datei: dann wie bisher" (= Baukasten-Rückfall bleibt
möglich, wenn das Laden länger als 4 s dauert).

**Warum der Baukasten-Rückfall ausgerechnet „kahl" aussieht:** Der Baukasten-Katalog `B_FIGUR`
(dieselbe Datei, Namen wie „Draco" sind Schlüssel) ist ein manuell gepflegter Katalog aus der
Zeit vor den PixelLab-Figuren. Stichprobe über die 40 Spieler der ersten beiden Paarungen des
Test-Kaders: 13 Namen fehlen komplett in `B_FIGUR` (z. B. „Sir Percival", „Suzuna", „Genta",
„Hargorin Todbringer" — generische Default-Figur), und von den gefundenen Einträgen haben weitere
13 **kein** `haar`-Attribut gesetzt (z. B. „Draco", „Lava Golem", „Krolach", „Seraph-11" — oft
by design, weil es Drachen/Golems/Konstrukte sind, aber eben auch ohne Haar-Layer). Zusammen über
60 % der Stichprobe landen im Baukasten-Rückfall ohne jedes Haar — **das** ergibt den „kahlen"
Eindruck, nicht ein fehlendes PixelLab-Asset.

**Kein Testkader-Artefakt — ein echter, aber bereits teilweise behobener Zeitfenster-Bug im
echten Spiel.** Die Begründung:
1. `public/mockups/battle-mode.engine.js` ist keine Test-Fixture, sondern derselbe Motor, den die
   echte App lädt (`app/foundation/battle-arena/FoundationBattleArenaHost.tsx` und ein gutes
   Dutzend weiterer `lib/`-Module binden exakt diese Datei ein, s. Quellen-Grep unten).
2. Die Datenabdeckung ist für den echten, aktiven Kader vollständig (s. oben) — das Problem ist
   nicht „fehlende Figur", sondern „Figur noch nicht fertig geladen, als das Spielfeld gezeichnet
   wurde".
3. **Pods sind hier strukturell anfälliger als Duelle, für die `FIGUREN_WARTE_MS` ursprünglich
   kalibriert wurde**: ein Battlefield-Pod zeigt 3–4 Teams gleichzeitig (in meiner Stichprobe 20
   Kämpfer), ein normales 1v1-Duell nur 2 Kader — das sind grob 3–4× so viele gleichzeitige
   Bildanfragen (pro Figur ~12 Dateien: vier Grundposen plus Animationsstreifen), die sich die
   wenigen parallelen HTTP-Verbindungen eines Browsers teilen müssen. Das 4-Sekunden-Budget wurde
   am Duell-Fall gemessen und validiert, nicht am Pod-Fall.
4. Dass meine eigene Reproduktion (lokaler Node-Static-Server auf `127.0.0.1`, praktisch
   latenzfrei) keine kahlen Figuren zeigte, spricht nicht gegen den Bug, sondern bestätigt die
   Diagnose: er ist netzwerk-/lastabhängig, und ein lokaler Loopback-Server ohne echte Latenz ist
   der denkbar güns­tigste Fall. Die PM-Recherche dürfte über die echte App (echter Server, echte
   Netzwerklatenz, kälterer Browser-Cache beim ersten Aufruf einer Sitzung) gelaufen sein — genau
   die Bedingungen, unter denen das 4-Sekunden-Budget eher reißt.

**Betroffener Kreis, grob geschätzt:** potenziell jeder Spieler in jedem Pod-Format
(Battlefield-Pod, Mini-DM-FFA-Pod, Bahn-Pod), nicht auf eine Teilmenge eingegrenzt — es trifft
zufällig, wessen Bild beim ersten Tick noch nicht fertig geladen ist, nicht eine fest bestimmte
Spielergruppe. Am sichtbarsten bei Spielern, deren Baukasten-Rückfall ohnehin kein Haar hat
(s. oben, >60 % der Stichprobe) — bei den übrigen fiele derselbe Rückfall vermutlich weniger auf,
weil der Baukasten dort wenigstens eine Frisur zeigt, auch wenn Hautfarbe/Ausrüstung dann falsch
wären. Am ehesten beim allerersten Aufruf einer Sitzung (kalter Cache) und bei Pods mit vielen
Teams/großen Kadern.

**Kein Fix in diesem Auftrag.** Falls das angegangen wird: naheliegende Stellschrauben sind ein
höheres `FIGUREN_WARTE_MS` speziell für Pod-Formate (mehr gleichzeitige Downloads brauchen mehr
Zeit), ein serverseitiges Vorab-Preload der Pod-Kader-Bilder vor dem ersten Tick, oder — unabhängig
von der Ladezeit — ein `haar`-Nachtrag in den betroffenen `B_FIGUR`-Einträgen, damit der
Baukasten-Rückfall selbst (der ja laut Kommentar bewusst als kurze Übergangsanzeige vorgesehen
ist) nicht komplett haarlos aussieht, falls er doch einmal zu sehen ist. Das ist ein Vorschlag,
keine Freigabe — Chris entscheidet, ob und wie das angegangen wird.

## Quellen

- `docs/design/kulissen-qualitaets-audit-08-11.md` (visuelle Achse, PR #1357)
- `docs/design/spurt-hyrox-routen-design-opus-09-11.md` (Fahrplan, Befunde 2.2/2.4; Zweig von
  #1371)
- `docs/design/spurt-format-die-hatz-08-11.md`, `docs/design/spurt-format-hyrox-stationen-08-11.md`
- `docs/design/format-varianten-brainstorm-08-11.md` (Abschnitt 6: Formatwahl)
- `docs/design/bahn-pod-vier-teams-01-11.md`, `docs/design/stand-aller-disziplinen.md`
- `data/generated/disziplin-abnahme.json`, `lib/battle/arena-resolved-disciplines.ts`,
  `lib/season/season-discipline-schedule.ts` (`VIERER_POD_DISCIPLINE_IDS`)
- Strang W (10.11.): `docs/design/organisch-tdm-battlefield-ispy-27-10.md`,
  `docs/design/stand-aller-disziplinen.md` Abschnitt 14 (Football-Pp-Korrektur),
  `docs/design/hockey-spirit-kanal-konzept-06-10.md`, `docs/design/tdm-pp-rezeptrunde-diagnose-02-10.md`,
  `docs/design/arena-zielwahl-opus-empfehlung-02-10.md`, `docs/design/battlefield-pod-ffa-02-11.md`,
  `lib/player-generator/spiel-eignung-overrides.ts`, `lib/season/league-split.ts` (`LEAGUE_SIZE`),
  `lib/season/mini-dm-pod-schedule.ts`, `lib/foundation/battle-arena/arena-host-spielquelle-hinweis.ts`
- PR #1372 (`claude/anzeige-treue-fix-0911`): `docs/design/sendedauer-messung-09-11.md`, Commits
  `a66cb12ef` (Fix) und `5fa5d1105` (Rest-Sonde)
- `docs/design/spieler-labels-weniger-text-10-11.md` (Branch `claude/spieler-labels-weniger-text-1011`)
- Engine-Zeilen in diesem Dokument beziehen sich, wo nicht anders gesagt, auf
  `public/mockups/battle-mode.engine.js` am Stand `14a18a72b` (Spitze #1371). Auf `main` liegen
  dieselben Funktionen an anderen Zeilen (z. B. `ZEIT_DEHNUNG` `:51787`, `zeitFaktor` `:51852`,
  `bahnRangliste()` `:41383`, `zeichneBahnPodTafel()` `:58614`, `sondenLauf` `:60881`); die
  Hatz-/HYROX-Funktionen gibt es nur auf dem Spurt-Stapel.
- Belegbilder: `docs/design/alle-diszis-top-niveau-fahrplan-09-11/` (Hatz im Gleichschritt,
  HYROX-Leiste als Referenz, Battlefield-Pod bei 2:09 und 5:23, Eiskunstlauf Ist-Stand)

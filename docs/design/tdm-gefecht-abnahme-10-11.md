# TDM-Gefecht — Mess-/Prototyp-Schritt nach dem Battlefield-Muster (10.11.)

Chris, wörtlich: **„Das was auf dem Feld passiert soll auch das in den Stats sein! Und das in
jeder Disziplin!"** TDM läuft produktiv weiterhin über die PPS-Duell-Brücke
(`lib/battle/arena-resolved-disciplines.ts`, Kopfkommentar) — der echte Zweikampf
(`build()`/`stepSim()`, `ARENA_ART.tdm`) misst rho je Spiel nur 0,324–0,404, weit unter der
CLAUDE.md-Schranke von 0,80.

**Dieser Auftrag ist NUR der Mess-/Prototyp-Schritt.** Nichts hiervon ist in die Buchung, die
Arena-Anzeige oder einen bestehenden Spielpfad eingehängt. Das Verdrahten ist, falls die Abnahme
besteht, ein eigener Folgeauftrag.

## 1. Vorbild: `bfffaGefecht()` (Battlefield-Pod, 02.11.)

`public/mockups/battle-mode.engine.js`, dokumentiert in `docs/design/battlefield-pod-ffa-02-11.md`
Abschnitt 7: ein **vorab entschiedenes Gefecht** statt einer Tick-Simulation in Echtzeit. Jedes
Matrixgewicht bekommt einen benannten Kanal (Budget-Methode), jeder Kanal liest
`E + kappa·(a − E)` (Menge aus der Eignung, Form aus dem Profil), Würfel kommen aus einem Hash je
(Saat, Kämpfer, Takt, Zweck) (`mdffaZufall`). Battlefield bestand damit beide Pflichtkriterien:
rho 0,861–0,923, Pp 4,8–20,2 (k=2..6).

## 2. Was für TDM übernommen ist, was nicht

**TDM ist, anders als Battlefield, "reines Deathmatch"** — das sagt der Kommentar an
`ARENA_ART.tdm` selbst, ebenso der Kommentar bei `ARENA_DOMINATION`: „TDM und Mini-DM bleiben
reines Deathmatch". Übernommen: die Kanal-Architektur, der Hash-Zufall, die Takt-Struktur mit
gleichzeitigen Schlägen, letzter Atem, Seiten-Ausscheiden. **Nicht übernommen:** Orte,
Kontrollpunkte, Eroberung, Rotation — TDM hat keine Geometrie, es gibt nur die zwei Seiten, die
sich gegenseitig abschlachten, bis eine am Boden liegt oder die Zeit abläuft.

Die Rollen sind **fest** (`SLOTS_JE_DISC.tdm`, sechs Stück: Vanguard, Skirmisher, Shotcaller,
Hold Line, Rally Point, Breaker), unabhängig von der Kadergröße k — derselbe Pfad, den Mini-DM vor
seiner Sechs-Rollen-Erweiterung hatte. TDM braucht keine eigene `*_SLOTS_JE_K`-Tabelle, weil die
Matrix unverändert bleibt (kein Eintrag in `spiel-eignung-overrides.ts`).

## 3. Die neun Kanäle

TDMs Matrixgewichte (`BASIS_JE_DISC.tdm`, bit-identisch zur gesperrten Matrix
`official-discipline-weights.ts` — TDM hat KEINEN Override):

| Attribut | Gewicht | Kanal |
|---|---:|---|
| Power | 28 | **Wucht** (mit Torment) — Schadenshöhe je Treffer |
| Health | 20 | **Stand** — Lebenspunkte |
| Stamina | 14 | **Ausdauer** — Wucht lässt spät weniger nach |
| Spirit | 12 | **Deckung** — mindert jeden erlittenen Treffer |
| Charisma | 10 | **Befehl** — eigener Wucht-Multiplikator (es gibt keine Eroberung, auf die Charisma sonst ginge) |
| Determination | 6 | **Letzter Atem** — ein tödlicher Treffer lässt einmal stehen |
| Intelligence | 6 | **Schwachstelle** — Zielwahl trifft den angeschlagensten Gegner statt zufällig |
| Awareness | 2 | **Treffer landen** |
| Torment | 2 | Wucht (mit Power) |

Kalibrierung (`TDM_GEFECHT_GRUND`), Ausgangswerte 1:1 von `BF_FFA_GRUND` übernommen: kappa 0,12,
kappaWege 0,25, Spreizung 3; Hebel Stand 6,5, Wucht 4, Treffer 4, Deckung 6, Ausdauer 5,
Schwachstelle 1,5, Atem 5, Befehl 4; 20 Takte; Wertung 15 je K.o., 2 je Takt auf den Beinen.

## 4. Implementierung (additiv)

`public/mockups/battle-mode.engine.js`, direkt nach `bfffaFuerGebautenPod()`:

- `TDM_GEFECHT_GRUND`/`tdmGefechtGrund()`/`TDM_GEFECHT` — Parameter, dieselbe Bauart wie
  `BF_FFA_GRUND`/`BFFFA`.
- `tdmKaempfer(p,side,slotId,slotDef,idx)` — die neun Kanäle, Zeile für Zeile wie
  `bfffaKaempfer()`/`mdffaKaempfer()`.
- `tdmSchlagwechsel(kaempfer,saat,N)` — der Kern: Zielwahl, gleichzeitige Schläge, letzter Atem,
  Seiten-Ausscheiden. Kein `rr()`, kein Zustand außerhalb der Argumente.
- `tdmGefecht(seiten,saat,jeSeite)` — **die in der Aufgabe verlangte Funktion.** Baut die
  Kämpfer aus den Spielerlisten, ruft `tdmSchlagwechsel()`, liefert Platzierung (über die
  bestehende `bfPodPlatzierungAus()`), Anteil und rohe Wertung je Kämpfer — dasselbe Format wie
  `bfPodLauf()`s "gefecht"-Zweig.
- `tdmGefechtSonde(kader,opt)` — Rangtreue-Sonde, Vorbild `battlefieldPodSonde()`. Paare statt
  Vierergruppen (TDM ist zweiseitig).
- `tdmGefechtEinfluss(n,plus,saatVersatz,mutatorModus,jeSeite)` — Pp-Sonde, Vorbild
  `battlefieldPodEinfluss()`. Braucht, anders als Battlefields Vier-Team-Pod, **keine**
  Zusatzteams: SQUAD/OPP sind schon die zwei TDM-Seiten.
- `tdmGefechtParameter(neu)` — Kalibrier-Sonde, Vorbild `battlefieldPodParameter()`.

Alle vier neuen Einstiege sind unter `window.__arena` registriert, **ausschließlich** für die
Mess-/Kalibrierskripte dieses Prototyps — kein bestehender Aufrufer liest sie.

Kein bestehender Bezeichner wurde geändert; jede aufgerufene Funktion (`slotAufschlag`,
`mitAufschlag`, `betroffeneAttribute`, `gewichtet`, `formVon`, `stufenWert`, `eigHebung`,
`eigMutator`, `gehoben`, `mdffaZufall`, `mdffaFormkartenFuer`, `bfPodPlatzierungAus`,
`normalisiereSaat`) stand vorher schon im Motor.

## 5. Fingerabdruck-Beleg

`node scripts/pruefe-wertung-fingerabdruck.mjs`, GESAMT-Hash über 69 Einträge (`spiele` für alle
20 Disziplinen × 3 Saaten, `disziplinProbe` für TDM/Mini-DM/Battlefield, `spieleArenaDomination`,
`spieleBahnPod`, `spieleBattlefieldPod`):

| Lauf | GESAMT |
|---|---|
| Base-Commit `972b970cb` (Worktree-Basis, unverändert) | `a6493301291e` |
| Nach diesem Block (additiv) | `a6493301291e` |

**Identisch.** Die neue Funktion berührt keinen bestehenden Spielpfad.

## 6. Messung

Werkzeug: `scripts/miss-tdm-gefecht-abnahme.mjs [Gefechte je Paar] [--je-seite=2..6]
[--paare=n] [--kontrolle] [--pp[=n]] [--pp-je-seite=k] [--nur-pp]`.

**Messaufbau rho:** kaderfest, die zehn echten Team-Kader der Kader-Familie
(`data/generated/kaderfamilie-live-save.json`), 30 der 45 möglichen Paare, gleichmäßig gestreut,
je 4 Gefechte und Saatstrom, zwei Saatströme (0 und 10 000 000). Gemessen wird wie bei
`disziplinProbe`: `eig` ohne Mutator gegen `wert` (Anteil am Gesamtbeitrag) über alle 2k Kämpfer.

**Messaufbau Pp:** Budget-Methode, Pflicht nach CLAUDE.md, `--nur-pp --pp=48 --pp-je-seite=2..6`
— derselbe Umfang wie Battlefields erfolgreiche Abnahme. Gemessen sind SQUAD/OPP, Hebung +15.

**rho je Gefecht** (kaderfest, zehn Kader der Familie, 30 der 45 Paare, 4 Gefechte je Paar und
Strom):

| k | rho/Gefecht Median (Strom 0 / 1) | Mittel (0 / 1) | min..max | Paare < 0,80 | Saison | Star#1 | Star ≤2 | Star letzt | Paare ≥15 richtig | Ende „allein"/„zeit" | Takte (Dauer) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | **0,808 / 0,818** | 0,781 / 0,793 | 0,48..0,93 | 14/30 · 14/30 | 0,838 / 0,829 | 65,0 / 63,3 % | 91,7 / 85,8 % | 0,0 / 0,0 % | 90,8 / 91,3 % | 65,8/34,2 · 68,3/31,7 | 15,3 / 15,4 |
| 3 | **0,814 / 0,810** | 0,781 / 0,787 | 0,52..0,92 | 14/30 · 14/30 | 0,830 / 0,826 | 70,0 / 60,0 % | 92,5 / 87,5 % | 0,0 / 0,0 % | 90,9 / 91,2 % | 66,7/33,3 · 66,7/33,3 | 15,2 / 15,4 |
| 4 | **0,810 / 0,816** | 0,780 / 0,789 | 0,46..0,92 | 13/30 · 15/30 | 0,854 / 0,861 | 65,0 / 62,5 % | 93,3 / 89,2 % | 0,0 / 0,0 % | 90,6 / 90,9 % | 63,3/36,7 · 60,8/39,2 | 15,6 / 15,8 |
| 5 | **0,817 / 0,829** | 0,790 / 0,797 | 0,54..0,94 | 12/30 · 13/30 | 0,880 / 0,883 | 60,8 / 65,0 % | 88,3 / 90,0 % | 0,0 / 0,0 % | 92,2 / 92,6 % | 64,2/35,8 · 63,3/36,7 | 15,5 / 15,8 |
| 6 | **0,825 / 0,811** | 0,798 / 0,805 | 0,61..0,93 | 13/30 · 14/30 | 0,857 / 0,851 | 70,8 / 61,7 % | 91,7 / 95,8 % | 0,0 / 0,0 % | 92,8 / 92,7 % | 65,0/35,0 · 61,7/38,3 | 15,9 / 16,1 |

Rohdaten: `data/generated/tdm-gefecht-abnahme.json`. **Alle zehn Werte (fünf Kadergrößen × zwei Saatströme) liegen über der
0,80-Schranke** — dieselbe Median-Kennzahl, mit der Battlefields Abnahme gemessen wurde. Das
„angestrebte" 0,85 wird knapp verfehlt (Bereich 0,81–0,83), anders als bei Battlefield
(0,86–0,92). Der Mittelwert liegt durchweg unter dem Median (0,78–0,81) — es gibt, wie bei
Hockey/Basketball nach CLAUDE.md beschrieben, viele knappe Paare, die kein Motor der Welt
verlässlich ordnen soll; die ehrlicheren Zahlen bestätigen das: der eignungsbeste Spieler
(„Star") landet in KEINEM der rund 1200 gemessenen Gefechte auf dem letzten Platz, steht in
60–71 % auf Rang 1 und in 86–96 % unter den ersten zwei. Paare mit ≥15 Eignungspunkten Abstand
werden zu 91–93 % richtig geordnet (etwas niedriger als Battlefields 99,5–99,8 %, aber klar über
Zufall). Die Gefechte enden zu 60–68 % durch Ausscheiden einer Seite, der Rest durch Zeitablauf
bei 20 Takten — ein Kampf braucht damit realistisch EIN Spiel, kein Saison-Mittel (CLAUDE.md).

**Pp-Abweichung** (Budget-Methode, `--nur-pp --pp=48 --pp-je-seite=2..6`, SQUAD/OPP, Hebung +15 —
derselbe Umfang wie Battlefields Abnahme):

| k | Strom 0 | Strom 10 000 000 |
|---|---:|---:|
| 2 | 16,1 | 16,1 |
| 3 | 16,5 | 16,3 |
| 4 | 13,5 | 14,0 |
| 5 | 15,0 | 16,5 |
| 6 | 14,6 | 14,7 |

**Alle zehn Werte liegen klar unter der Schranke von 25**, in beiden Saatströmen, für jede
Kadergröße. Typisches Profil (k=4, Strom 0): Power 26,1, Health 16,5, Charisma 14,6, Stamina 12,9,
Spirit 12,8, Intelligence 6,1, Determination 5,9, Awareness 3,2, Torment 1,8, Speed/Dexterity/Will
0 — gegen die Matrix 28/20/14/12/10/6/6/2/2/0/0/0. Power liest leicht UNTER seinem Matrixgewicht
(26 gegen 28), Charisma und Health leicht DARÜBER (14–17 gegen 10/20) — die typische
Slot-Aufschlag-Verschiebung, die auch bei den anderen Disziplinen auftritt, weit innerhalb der
25-Pp-Schranke. Speed/Dexterity/Will messen korrekt 0 (sie wiegen in der TDM-Matrix nichts).

Rohdaten: `data/generated/tdm-gefecht-pp-abnahme.json`.

## 7. Kalibrierung — nicht nötig

**Beide Pflichtkriterien bestehen bereits mit den Ausgangswerten**, 1:1 von `BF_FFA_GRUND`
(Battlefields kalibriertem Gefecht) übernommen — keine einzige Konstante wurde für TDM
nachjustiert. Ein kurzer Sweep (`tdmGefechtParameter`, n=4×30 Paare, k=4 und k=6) hat trotzdem
geprüft, ob sich der Abstand zum „angestrebten" 0,85 günstig schließen lässt:

| Variante | k=4 Median | k=6 Median |
|---|---:|---:|
| Baseline (kappa 0,12 / kappaWege 0,25 / Spreizung 3) | 0,810 | 0,825 |
| kappa 0,08 | 0,809 | 0,818 |
| Spreizung 4 | 0,797 | 0,798 |
| kappa 0,08 + Spreizung 4 | 0,786 | 0,795 |
| kappa 0,10 / kappaWege 0,20 | 0,809 | 0,826 |

**Keine der vier Varianten übertrifft die Baseline spürbar** (die beste, kappa 0,10/kappaWege
0,20, liegt bei k=6 nur 0,001 darüber, bei k=4 leicht darunter) — mehr Eignungsgewicht
(niedrigeres kappa) oder mehr Spreizung verschlechtert rho sogar, statt es zu heben. Das deckt
sich mit dem Befund bei Mini-DM/Battlefield: Diese Kanal-Architektur hat ihr Optimum in der Nähe
der übernommenen Werte, und eine erzwungene Jagd auf 0,85 hätte hier begonnen, die Schranke von
0,80 selbst zu gefährden. Da die Pflichtschranke (>0,80, Median, beide Ströme, alle fünf
Kadergrößen) bereits sicher erreicht ist, wurde die Baseline unverändert gelassen — Budget-Methode
heißt auch, nicht an einem Rezept zu drehen, das schon hält.

## 8. Antwort an Chris

**Das Gefecht-Muster trägt für TDM — beide Pflichtkriterien bestehen, ohne Kalibrierung, bei allen
fünf Kadergrößen und beiden Saatströmen.** rho je Spiel liegt bei 0,808–0,829 (Median), über der
0,80-Schranke, wenn auch unter dem angestrebten 0,85 (Battlefield schaffte 0,86–0,92). Die
Pp-Abweichung liegt bei 13,5–16,5, weit unter der 25-Schranke.

Das ist ein **klares Ja** auf die Frage „trägt das Muster für TDM grundsätzlich": der Umbau von
reiner Attribut-Formel/Echtzeit-Tick-Simulation auf ein vorab entschiedenes Gefecht mit benannten
Kanälen funktioniert hier genauso wie bei Mini-DM und Battlefield, sogar mit den Battlefield-Werten
unverändert übernommen. TDM ist bewusst einfacher als Battlefield (keine Orte, keine Eroberung,
kein Zweckbündnis) — und genau das reine Zwei-Seiten-Deathmatch ordnet trotzdem zuverlässig nach
Eignung.

Dieser Auftrag ist der Mess-/Prototyp-Schritt — die Funktion ist additiv im Motor, an keinem
Buchungs- oder Anzeigepfad angeschlossen. Der Fingerabdruck (Abschnitt 5) belegt, dass nichts
Bestehendes sich geändert hat. Ob TDM damit produktiv auf dieses Gefecht umgestellt wird (Motor-
Anbindung über `MOTOREN.tdm`/Headless-Runner, Abgleich mit der PPS-Brücke,
`ARENA_RESOLVED_DISCIPLINE_IDS`-Eintrag, Anzeige in der Arena) ist der Folgeauftrag, den die
Aufgabe ausdrücklich NICHT verlangt hat.

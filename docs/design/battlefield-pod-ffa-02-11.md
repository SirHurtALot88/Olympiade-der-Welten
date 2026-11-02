# Battlefield als echtes Vier-Team-FFA in der Arena (02.11.)

Chris, wörtlich: **„nein auch bei battlefield reicht kein hinweistext! da sollen 4 teams gleichzeitig
FFA machen"**.

Seit `1dcf3823` (01.11.) bucht die Liga Battlefield als Vierergruppe (Pod, 2-1-0-0). Die Arena
zeigte trotzdem weiter ein Zwei-Team-Duell, darüber stand nur ein Hinweistext. Jetzt kämpfen alle
vier Pod-Teams **gleichzeitig im selben Echtzeitkampf** um die drei Orte Nord, Mitte und Süd. Der
Motor ist derselbe, der Kampf ist sichtbar. Die Buchung läuft weiter über den PPS-Pod. Warum das
so bleibt, steht in Abschnitt 4.

> **Stand 02.11. abends — überholt durch Abschnitt 7.** Chris hat Option 2 aus Abschnitt 6
> gewählt (Mini-DM-Muster). Der Pod wird jetzt als **ein deterministisches Gefecht je Ort**
> entschieden, die Arena spielt es mit allen vier Teams gleichzeitig ab, und die Liga **bucht genau
> dieses Gefecht**. Abschnitte 1–6 beschreiben die erste Runde (freier Echtzeitkampf, nur Anzeige)
> und bleiben als Befund stehen; der Echtzeit-Pod ist als `{echtzeit:true}` weiter als Kontrolle
> erreichbar.

## 1. Was gebaut ist

### Motor (`public/mockups/battle-mode.engine.js`)

Das Kampf-Chassis (TDM, Mini-DM, Battlefield) kennt für Battlefield jetzt **N Seiten**:

- **`bfPodKader`** ist nur während eines `build()` gesetzt, sonst `null`. **`KP.pod`** trägt den
  gebauten Pod durch das Spiel: Seitenzahl und Ausscheidezeit je Team. `KP` wird von
  `MOTOREN[d].sichern()/zurueck()` mitgeführt. Ein headless Pod-Lauf mitten in einem sichtbaren
  Duell (oder umgekehrt) vertauscht deshalb keinen Zustand.
- **Aufstellung `bfPodHome`:** vier Ecken. Seite 0 steht oben links, 1 oben rechts, 2 unten
  links, 3 unten rechts. Reihe 0 steht vorn, Reihe 2 hinten. Die Anordnung ist spiegelbildlich um
  die Mittellinie wie die Orte. Damit hat jedes Team dieselbe Geometrie: einen nahen Ort, den es
  sich mit dem Nachbarn auf seiner Höhe teilt, die Mitte und einen fernen Ort.
- **`bfPodBau`:** Jedes Team geht denselben Weg wie die Heimseite im Duell. Es gilt die
  Aufstellung des Managers, ohne Aufstellung spielen die besten k nach echter Eignung. Die Rollen
  passen genau zu dieser Kopfzahl (`BATTLEFIELD_SLOTS_JE_K`), ebenso Reihe und Befehl.
- **Verallgemeinert auf N Seiten**, für N=2 mit exakt denselben Zahlen wie vorher:
  - `kpPraesenzAm`/`kpTick`: Besitz wechselt nur, wenn genau eine Seite am Ort steht. Bei zwei
    oder mehr Seiten ist der Ort umkämpft. Dort zählen die Störer aller übrigen Seiten.
  - `dominationZielWahl`: „vorn" heißt jetzt vorn gegen den besten Gegner.
  - Weiter verallgemeinert: `aktualisiereFuehrung`, Rückzug, Blickrichtung und Eigenbewegung (Seite
    0/2 links, 1/3 rechts) sowie das Punktelimit.
- **Neu im Pod:**
  - `bfPodAusscheiden`: Ein Team, das komplett liegt, ist raus. Seine Orte fallen auf neutral
    zurück.
  - `bfPodPlatzierung`: ordnet die Teams auf Platz 1 bis N und vergibt 2-1-0-0. Die Sieg-Wege
    zählen in derselben Reihenfolge wie im Duell: zuerst das letzte Team, das noch steht, dann
    die Kontrollpunkt-Punkte, dann die Zahl der Lebenden, zuletzt der spätere Ausscheidezeitpunkt.
    Wer auf allen Schlüsseln gleich liegt, teilt sich Platz und Punkte.

### Anzeige

- **Teamfarben:** Seite 0/1 behalten Orange/Türkis (`--home/--away`), Seite 2/3 werden Grün und
  Violett. Die Farben gelten für Ring, Name, Ziellinie, Orte, Eroberungsring und Ticker.
- **Vier-Team-Tafel** oben auf der Leinwand (`zeichneBfPodTafel`): Sie zeigt je Team den
  aktuellen Platz, den Namen, die Punkte und die Lebenden als Punkte, in der Mitte die Uhr. Der
  DOM-Bug kennt nur Heim und Gast und ist im Pod ausgeblendet.
- **Endstand:** vier Tabellen, links die Teams 0 und 2, rechts 1 und 3, jede mit Platz und
  Teamfarbe. Die Siegzeile nennt die ganze Platzierung. Die Kaderleiste ist genauso geteilt, mit
  Farbstreifen je Team.
- Im Pod gibt es **keinen Aufklärungsnebel und keine Zielansage**. Beide gelten aus Sicht von
  „Seite 0 gegen Seite 1".

### Host (`app/foundation/battle-arena/FoundationBattleArenaHost.tsx`)

- `getPodForTeam(gameState, heimTeamId, matchdayId, "battlefield")` ist dieselbe Funktion, mit
  der Resolve die Gruppe bucht.
- Der Host lädt die vier Kader nach und reicht `echterKader.battlefieldPod` an den Motor:
  - die Teams in Pod-Reihenfolge,
  - k aus dem Spielplan-Slot (`resolvePodPlayerCountForMatchday`),
  - eine reproduzierbare Saat (`buildBattlefieldPodMatchSeed`),
  - die echte Aufstellung je Team.
- Ohne Pod an diesem Spieltag bleibt alles beim Duell.
- Eine Zeile über der Arena nennt die vier Teams der gebuchten Gruppe.

### Einstiege (`window.__arena`)

| Einstieg | Zweck |
|---|---|
| `spieleBattlefieldPod(teams, saat, platzJeTeam, {formSaat, jeSeite})` | Produktionsform wie `spieleBahnPod`/`miniDmFfaEvent`: `teams[s] = {side, name, punkte, lebend, rausT, eventPlatz, ligaPunkte}`, Boxscore je Kämpfer mit `side` |
| `battlefieldPodSonde(kader, {gruppen, n, versatz, jeSeite, mutatoren})` | Rangtreue-Sonde, gleiche Größen wie `disziplinProbe` |
| `battlefieldPodEinfluss(extraTeams, n, plus, versatz, modus, jeSeite)` | Pp-Sonde, rechnet wie `einflussVon`. Gemessen werden SQUAD/OPP, zwei Familien-Teams stellen das Feld |
| `battlefieldPodAnzeigen(pod)` / `battlefieldPodStand()` | Pod in der sichtbaren Arena ohne Host (Standalone, Tests, Screenshots); `null` schaltet zurück |

## 2. Das Duell bleibt bit-identisch

Harte Nebenbedingung des Auftrags. Dreifach geprüft:

1. `tests/battlefield-pod-ffa.test.ts` hält sha256-Fingerabdrücke von zwei Läufen. Der erste ist
   `spieleArenaDomination("battlefield", saat, {jeSeite: k})` für k=2/4/6 mit je zwei Saaten. Der
   zweite ist `disziplinProbe` für tdm, mini-dm und battlefield, die dasselbe Chassis teilen.
   Gezogen sind die Abdrücke am Engine-Stand **vor** dem Umbau (`2b474c58`, in einer Kopie
   ausgeführt) und nach dem Umbau unverändert.
2. Ein breiterer Abgleich lief vor und nach jeder Änderungsrunde mit identischem Ergebnis:
   `spieleArenaDomination` für k=2..6 mit je vier Saaten und zwei Kadern, dazu `disziplinProbe`
   für alle drei Kampf-Disziplinen.
3. Ein Pod-Lauf hinterlässt nichts im Duell-Zustand. Ein eigener Test prüft das: Er vergleicht
   `spieleArenaDomination` vor und nach zwei Pod-Läufen.

Die bestehenden Battlefield-Tests bleiben grün:
- `battlefield-domination-chromium`
- `battlefield-rollen-je-kadergroesse`
- `vierer-pod-battlefield`
- `arena-host-spielquelle-hinweis`
- `arena-seed-identitaet`
- `mini-dm-pod-*`

## 3. Messung

Werkzeug: `scripts/miss-battlefield-pod-ffa-abnahme.mjs [kämpfe je Gruppe] [--je-seite=2..6]
[--gruppen=n] [--kontrolle] [--pp[=n]] [--pp-je-seite=k] [--nur-pp]`.

**Messaufbau:**
- Kaderfest: die zehn echten Team-Kader der Kader-Familie
  (`data/generated/kaderfamilie-live-save.json`).
- 20 der 210 möglichen Vierergruppen, gleichmäßig gestreut, je 2 Kämpfe und Saatstrom.
- Zwei Saatströme (0 und 10 000 000), Formkarten und Mutatoren je Kampf.
- Gemessen wird wie bei `disziplinProbe`: `eig` ohne Mutator gegen `MOTOREN.battlefield.wert()`
  (Anteil am Gesamtbeitrag) über alle 4k Kämpfer.

Rohdaten: `data/generated/battlefield-pod-ffa-abnahme.json`.

| k | rho je Kampf, Median (Strom 0 / 1) | Gruppen < 0,80 | Saison | Star Rang 1 | Star ≤ 2 | Paare ≥ 15 richtig | Team-rho (Eignung ↔ Platz) | eignungsbestes Team auf Platz 1 | Ende „letztes Team steht" |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 0,256 / 0,125 | 20/20 · 20/20 | 0,60 / 0,50 | 28 / 15 % | 35 / 33 % | 71 / 68 % | 0,18 / −0,04 | 28 / 23 % | 90 / 93 % |
| 3 | 0,199 / 0,243 | 20/20 · 20/20 | 0,29 / 0,33 | 13 / 15 % | 23 / 33 % | 63 / 65 % | 0,11 / 0,24 | 23 / 38 % | 80 / 93 % |
| 4 | 0,269 / 0,244 | 20/20 · 20/20 | 0,36 / 0,33 | 18 / 3 % | 25 / 5 % | 65 / 68 % | 0,21 / 0,16 | 33 / 23 % | 60 / 70 % |
| 5 | 0,272 / 0,231 | 20/20 · 20/20 | 0,29 / 0,29 | 5 / 5 % | 10 / 8 % | 62 / 63 % | 0,19 / 0,13 | 30 / 25 % | 50 / 50 % |
| 6 | 0,228 / 0,188 | 20/20 · 20/20 | 0,19 / 0,20 | 8 / 3 % | 10 / 3 % | 61 / 62 % | −0,07 / 0,07 | 18 / 28 % | 30 / 35 % |

Zufall wäre beim Team-rho 0 und beim eignungsbesten Team auf Platz 1 genau 25 %.

**Kontrolle Duell**, gleiche Kader und gleiche Kopfzahl (`disziplinProbe("battlefield", {jeSeite})`
auf den fünf Familienpaarungen), rho je Spiel im Median:

| k=2 | k=3 | k=4 | k=5 | k=6 |
|---|---|---|---|---|
| 0,817 | 0,690 | 0,414 | 0,404 | 0,153 |

Beide Saatströme ergaben hier dieselben Zahlen. Die Kontrolle zählt deshalb nur als ein Strom; der
Grund ist nicht untersucht.

**Was die Zahlen sagen:**

1. **Der sichtbare Vier-Team-Kampf ordnet Spieler kaum nach Eignung.** rho je Kampf liegt
   zwischen 0,13 und 0,27, keine einzige Gruppe erreicht 0,80. Das Duell auf demselben Chassis war
   schon schwach (seit Monaten bekannt, Kopfzeile 0,399). Bei k=2/3 verliert der Pod gegenüber dem
   Duell klar, bei k=6 liegen beide gleich schlecht.
2. **Auf Teamebene ist er fast eine Lotterie.** Team-rho liegt zwischen −0,07 und 0,24, das
   eignungsstärkste Team gewinnt in 18 bis 38 % der Kämpfe (Zufall: 25 %).
3. **Ursache.** Je kleiner der Kader, desto öfter entscheidet das letzte stehende Team (k=2: über
   90 %), und wer zuletzt steht, ist eine Abnutzungsfrage. Wer stark ist und zur umkämpften Mitte
   geht, wird von drei Seiten getroffen, wer ausweicht, überlebt. Das ist der bekannte
   „Dritte-Partei"-Effekt jedes FFA. Mini-DM hat am 13.10. genau deshalb das Echtzeit-FFA verlassen
   (rho 0,40) und ist auf den Schlagwechsel umgestiegen (`mini-dm-4-team-ffa-recherche-06-09.md`,
   Kopfkommentar an `mdffaSchlagwechsel`).

**Pp (Budget-Methode, Pflicht):** `--nur-pp --pp=8 --pp-je-seite=4`. Gemessen sind SQUAD und OPP
(je 4) in einem Vier-Team-Kampf mit zwei Familien-Teams als Feld, Hebung +15.
- Strom 0: **32,1 Pp**. Spirit 16, Intelligence 16, Awareness 16, Power 13, Health 10, Charisma 10,
  Torment 9, Determination 8.
- Strom 10 000 000: **102 Pp**. Torment 36, Spirit 31, Intelligence 20, Stamina 12, alles übrige 0.
- Beide Ströme verfehlen die Schranke von 25 Pp.

Die Spannweite zwischen den Strömen zeigt: Bei 8 Läufen dominiert das Rauschen des FFA. Der
Kampf ist so laut, dass ein Attribut +15 im Einzelkampf kaum gegen den Zufall ankommt. Das passt
zu rho je Kampf um 0,2. Läufe mit n=24 würden die Zahl stabilisieren, kosten aber rund 5 Stunden
je Strom (ein Vier-Team-Kampf rechnet 2 bis 4 s). Weil der Kampf nicht bucht, ist das in dieser
Runde nicht gefahren worden. Für die Buchungsfähigkeit (Abschnitt 6) wäre es Pflicht.

## 4. Einordnung: was das für Buchung und Ausnahme heißt

- **Die Buchung bleibt beim PPS-Pod.** Battlefield steht weiter nicht in
  `ARENA_RESOLVED_DISCIPLINE_IDS`. `mini-dm-pod-resolve.ts` wertet den Pod über den Eignungs-Score,
  und der hat rho je Pod 0,64 bis 0,85 (k=2..6, `battlefield-pod-abnahme.json`). Den neuen Kampf als
  Wertung zu nehmen, hieße rho 0,13 bis 0,27 und eine Team-Platzierung nahe dem Zufall. Das
  verbietet die Pflichtabnahme aus CLAUDE.md, und Chris hat es nicht verlangt.
- **Chris' Ausnahme für k=2..6 ergibt weiter Sinn und bleibt unverändert.** Sie gilt
  ausdrücklich nur für den PPS-Pod. `season-discipline-schedule.ts` sagt selbst: „Ein künftiger
  echter Battlefield-Motor … braucht eine eigene, neue Abnahme; diese Ausnahme geht nicht
  automatisch auf ihn über." Der echte Motor ist jetzt da, seine Abnahme steht oben, und er fällt
  durch. An der Buchung ändert sich nichts. Die Tabellenzahlen bleiben gültig.
- **Gezeigt ≠ gebucht.** Das war für Battlefield schon im Duell so: Die Arena war Vorschau, gebucht
  wurde über die PPS-Brücke. Das bleibt so. Die bestehende Zeile „wird … als 4-Team-Gruppe (Pod)
  gewertet, nicht per Arena — hier nur Vorschau" steht deshalb weiter, sie stimmt.
  - Neu ist nur: Die Vorschau zeigt jetzt dieselben vier Teams wie die Buchung, statt Heim gegen
    einen Fixture-Gegner, der oft gar nicht im Pod ist.
  - Wegen der niedrigen Team-Treue wird der sichtbare Sieger aber oft ein anderer sein als der
    gebuchte. Laut Messung stimmt der Sieger in nur etwa einem Drittel der Kämpfe mit dem
    eignungsstärksten Team überein, und nach Eignung bucht der PPS-Pod.

## 5. Takeshi's Castle und Staffel

Beide laufen seit `d79196de` (01.11.) im Motor als **echtes N-Team-Rennen**. Vier Teams starten
auf derselben Strecke, mit Bahn je Läufer, Remplern „jeder gegen jeden", Gedränge und Wechseln
(`bahnPodKader`, `__arena.spieleBahnPod`). Das ist dem gewünschten „alle gleichzeitig" schon näher
als Battlefield vor diesem Umbau: Es gibt keine Aggregation, alle laufen wirklich gleichzeitig.

Zwei Dinge fehlen dort noch, beide stehen in `docs/design/bahn-pod-vier-teams-01-11.md`
Abschnitt 4:
- **Anzeige:** Die Bahn-Zeichnung ist noch zweiseitig, der Pod läuft nur headless.
- **Liga-Verdrahtung:** Beide stehen nicht in `VIERER_POD_DISCIPLINE_IDS`.

Die Pp-Kalibrierung der beiden (`podRezept`, Gedränge-Dichte) bearbeitet parallel ein zweiter
Agent. Diese Runde hat dort bewusst nichts angefasst.

## 6. Offen

**Entscheidung für Chris:** Soll der sichtbare Vier-Team-Kampf eines Tages auch zählen?
Dann braucht er eine eigene Kalibrierrunde. Ehrliche Einschätzung, gestützt auf die
Mini-DM-Erfahrung (dort scheiterte das Echtzeit-FFA genau so):

1. **Kleine Hebel, etwa 1 Tag, Wirkung unsicher.**
   - Ranking ohne Vorrang „letztes Team steht", nur nach Punkten. In derselben Stichprobe (k=4)
     brachte das Team-rho 0,22 statt 0,21, also praktisch nichts.
   - Im Pod keine Bedrohungs-Zielwahl mehr, damit die Starken nicht gemeinsam gejagt werden.
   - Ausgeschiedene Teams zählen weniger.
   - Erwartung: Team-rho vielleicht 0,3 bis 0,4, Spieler-rho unverändert niedrig.
2. **Strukturell, 3 bis 5 Tage.** Der Pod-Kampf würde nach dem Mini-DM-Muster entschieden:
   ein deterministisches Gefecht je Ort aus den Matrix-Kanälen, das die Arena nur noch
   **abspielt** (Ergebnis zuerst, Bild danach). Das ist der einzige Weg, der im Projekt schon
   einmal von 0,40 auf über 0,80 geführt hat. Danach kämen Headless-Runner, Vorlauf und der
   Motor-Vorrang im Pod-Resolve wie bei Mini-DM.
3. **Oder bewusst so lassen.** Die Arena ist die Vorschau eines Vier-Team-Kampfes, gebucht wird
   über den PPS-Pod. Das ist der heutige Stand und braucht keine weitere Arbeit.

**Pp:** Die Messung steht in Abschnitt 3: 32 und 102 Pp bei n=8, beide über der Schranke von 25.
Ein Rezept-Tuning für den Pod lohnt erst, wenn Option 1 oder 2 gewählt ist, weil das Rauschen des
FFA vorher jedes Rezeptsignal überdeckt.

**Takeshi/Staffel sichtbar machen:** Die Bahn-Zeichnung müsste vier Seiten können (Bahnen, HUD,
Banner). Das ist eigene Arbeit, siehe Abschnitt 5.

## 7. Gefecht je Ort nach dem Mini-DM-Muster — gezeigt = gebucht (02.11. abends)

Chris' Entscheidung nach Abschnitt 6: Option 2. Der Vier-Team-Pod wird nicht mehr im freien
Echtzeitkampf entschieden, sondern wie Mini-DM seit 13.10.: **Ergebnis zuerst, Bild danach.**

### 7.1 Was Mini-DM gelöst hat, und was davon hier übernommen ist

Mini-DMs Echtzeit-FFA stand bei rho 0,40 je Runde. Die Diagnose im Kopfkommentar an
`mdffaSchlagwechsel()` nennt drei Ursachen, die beim Battlefield-Echtzeit-Pod genauso auftraten
(Abschnitt 3, Punkt 3):

1. **Geometrie als Lotterie.** Wer in die umkämpfte Mitte läuft, bekommt von allen Seiten Feuer.
2. **Profil statt Summe.** `aufEignung()` normiert nur LP/ANG/VER; der Kampf misst Begegnungen von
   Profilen, nicht die gewichtete Summe der Matrix.
3. **Ein eigenes System neben der Matrix.** Chris am 13.10.: „auch das FFA soll nach den
   gewichtungen geschehen die vorgegeben sind!“

Mini-DMs Antwort war ein **geometriefreier Schlagwechsel in Takten**: jeder Stehende wählt ein Ziel
und schlägt einmal zu, gleichzeitig auf dem Stand vom Taktbeginn; **jedes Matrixgewicht hat genau
einen benannten Kanal**, dessen Stärke sein Gewicht ist; jeder Kanal liest `E + kappa·(a − E)`
(Menge aus der Eignung, Form aus dem Profil); Würfel kommen aus einem Hash je (Saat, Kämpfer, Takt,
Zweck), damit eine Pp-Hebung bei einem Kämpfer die übrigen Würfe nicht verschiebt. Genau das ist
übernommen — verteilt auf drei Orte statt auf einen Ring.

### 7.2 Die Mechanik (`bfffaGefecht()`, `public/mockups/battle-mode.engine.js`)

- **Belegung aus der Rolle, symmetrisch.** Jedes Team hat einen Heimort (Seite 0/1 Nord, 2/3 Süd,
  dieselbe Geometrie wie `bfPodHome`), die Mitte und einen Fernort. Morale Anchor und Commander
  halten den Heimort, Siege Core und Field Control gehen in die Mitte, Disruptor und Spotter zum
  Fernort — das steht so in den Rollentexten. Weil alle vier Teams bei gleichem k dieselben Rollen
  haben, steht an jedem Ort jedes anwesende Team mit gleich vielen Köpfen.

  | k | Heimort | Mitte | Fernort |
  |---|---|---|---|
  | 2 | Morale Anchor | Siege Core | — |
  | 3 | Morale Anchor | Siege Core, Field Control | — |
  | 4 | Morale Anchor, Commander | Siege Core, Field Control | — |
  | 5 | Morale Anchor, Commander | Siege Core, Field Control | Disruptor |
  | 6 | Morale Anchor, Commander | Siege Core, Field Control | Disruptor, Spotter |

- **Je Ort ein Schlagwechsel**, alle drei Orte im selben Takt (20 Takte zu 4 Kampfsekunden). Ziel
  ist ein Gegner am selben Ort. Bei gleichmäßiger Zielwahl bekommt jeder im Mittel **einen** Angriff
  je Takt ab, egal ob zwei oder vier Teams am Ort stehen — das nimmt der Mitte die
  Dritte-Partei-Lotterie, ohne sie aus dem Spiel zu nehmen.
- **Kontrollpunkte nach der `kpTick`-Regel**, je Takt statt je Bild: Besitz wechselt nur, wenn genau
  ein Team am Ort steht; Halten drängt fremden Fortschritt zurück; Disruptoren stören an umkämpften
  Orten; Besitz zahlt 8 Punkte je Takt (= 2 je Kampfsekunde wie im Duell); 150 Punkte beenden.
  Ein ausgeschiedenes Team verliert seine Orte.
- **Rotation:** Ist ein Ort sicher (eigener Besitz, kein Gegner, kein fremder Fortschritt), bleibt
  ein Halter (Morale Anchor zuerst) und der Rest rückt zum nächsten umkämpften Ort nach, Mitte zuerst
  (ein Takt Weg).
- **Platzierung** über dieselbe Regel wie bisher (`bfPodPlatzierungAus()`, von `bfPodPlatzierung()`
  mitbenutzt): letztes Team steht > Kontrollpunkt-Punkte > Lebende > später raus; im Gefecht
  zusätzlich die Summe der Kampfrichterwertung als fünfter Schlüssel, damit gezeigt und gebucht ohne
  Gleichstand dieselben 2-1-0-0 sind.

**Die neun Kanäle** (Stärke = Matrixgewicht, `hebel` gleicht nur aus, wie stark eine Mechanik auf
die Wertung durchschlägt):

| Attribut | Gewicht | Kanal |
|---|---:|---|
| Charisma | 20 | **Befehl**: Wucht des Angriffs, Eroberungstempo, Gutschrift fürs Halten |
| Intelligence | 16 | **Lage lesen**: Schwachstelle (schlägt dorthin, wo einer wackelt), Positionierung (von zwei Angreifern kommt nur einer an) |
| Spirit | 16 | **Zusammenhalt**: Deckung, mindert jeden erlittenen Treffer |
| Torment | 12 | Wucht |
| Power | 10 | Wucht |
| Awareness | 10 | Treffer landen |
| Health | 8 | Stand |
| Determination | 4 | Letzter Atem (ein tödlicher Treffer lässt einmal stehen) |
| Stamina | 4 | Ausdauer (Wucht lässt spät weniger nach) |

**Wertung je Kämpfer** (Kampfrichter): verursachter Schaden + 15 je K.o. + 12 je ganzer Eroberung
(anteilig) + Halten (3 je Takt am eigenen Ort, geteilt durch die Halter, mal Befehl) + 2 je Takt auf den Beinen. Gemeldet wird wie bisher
der Anteil am Gesamtbeitrag (Summe 100 über alle 4k Kämpfer); die Spieler-PP lesen den rohen Wert.

**Kalibrierung** (`BF_FFA_GRUND`): kappa 0,12, kappaWege 0,25, Spreizung 3; Hebel Stand 6,5, Wucht 4,
Treffer 4, Deckung 6, Ausdauer 5, Schwachstelle 1,5, Positionierung 1,5, Atem 5, Erobern 4. Der Sweep
(20 Gruppen × 2, Pp n=48/96): Intelligence las mit Hebel 3 zu viel (21 % bei Gewicht 16), Charisma zu
wenig (16 %), solange eine Eroberung eine feste Gutschrift zahlte — erst seit das Halten mit dem Befehl
wächst, trägt Charisma über seine eigene Mechanik. Mit kappa = 0 (reine Eignung) liegt die k=2-Pp-
Messung bei 18/17,5 — das ist der Boden aus Slot-Aufschlag und Stichprobe; die Kalibrierung liegt
darunter.

### 7.3 Abnahme

Werkzeug: `scripts/miss-battlefield-pod-ffa-abnahme.mjs 4 --je-seite=2..6 --gruppen=30 [--kontrolle]
[--pp=48 --pp-je-seite=2..6]`, kaderfest (zehn Kader der Familie, 30 der 210 Vierergruppen, je
4 Kämpfe und Strom), zwei Saatströme. Rohdaten: `data/generated/battlefield-pod-gefecht-abnahme.json`.

| k | rho je Kampf, Median (Strom 0 / 1) | Gruppen < 0,80 | Saison | Star Rang 1 | Star ≤ 2 | Paare ≥ 15 richtig | Team-rho | bestes Team 1. / ≤ 2. |
|---|---|---|---|---|---|---|---|---|
| 2 | **0,873 / 0,861** | 4 · 7 von 30 | 0,98 / 0,96 | 53 / 53 % | 86 / 83 % | 99,7 % | 0,68 / 0,63 | 63 / 60 % · 92 / 88 % |
| 3 | **0,881 / 0,874** | 3 · 4 | 0,97 / 0,96 | 42 / 44 % | 74 / 66 % | 99,7 % | 0,62 / 0,62 | 41 / 43 % · 91 / 89 % |
| 4 | **0,885 / 0,864** | 3 · 5 | 0,95 / 0,94 | 56 / 51 % | 79 / 78 % | 99,5 % | 0,67 / 0,66 | 53 / 44 % · 92 / 90 % |
| 5 | **0,919 / 0,920** | 0 · 0 | 0,97 / 0,96 | 40 / 52 % | 71 / 78 % | 99,8 % | 0,75 / 0,74 | 60 / 58 % · 98 / 96 % |
| 6 | **0,922 / 0,923** | 0 · 0 | 0,98 / 0,98 | 64 / 68 % | 86 / 88 % | 99,8 % | 0,84 / 0,79 | 80 / 75 % · 98 / 97 % |

Zum Vergleich der Echtzeit-Pod (Abschnitt 3): rho je Kampf 0,13–0,27, bestes Team auf Platz 1 in
18–38 %. Das Duell auf demselben Chassis (Kontrolle, unverändert): 0,82 / 0,69 / 0,41 / 0,40 / 0,15.

**Pp (Budget-Methode, Pflicht)**, `--nur-pp --pp=48 --pp-je-seite=2..6`, Messpersonen SQUAD/OPP wie
`einflussVon`, zwei Familien-Teams als Feld, Hebung +15:

| k | Strom 0 | Strom 10 000 000 |
|---|---:|---:|
| 2 | 20,2 | 15,9 |
| 3 | 9,8 | 5,0 |
| 4 | 11,0 | 10,0 |
| 5 | 8,7 | 8,0 |
| 6 | 4,8 | 5,4 |

Alle unter 25. Typisches Profil (k=4, Strom 0): Intelligence 17,4, Charisma 17,2, Spirit 14,0,
Torment 12,9, Awareness 12,1, Power 10,4, Health 8,7, Stamina 3,7, Determination 3,6 — gegen die
Matrix 16/20/16/12/10/10/8/4/4. Bei k=2 misst die Sonde nur vier Personen; dort streut sie am
stärksten.

**Beide Pflichtkriterien regulär bestanden, ohne Ausnahme.** Chris' Ausnahme für k=2/3 vom 01.11.
galt dem PPS-Pod und wird für den Motor nicht gebraucht.

### 7.4 Anzeige: die Arena spielt das Gefecht ab

- `bfPodAnzeigeBauen()` baut den Pod wie bisher (vier Teams, Aufstellung, Formkarten aus der
  Pod-Saat) und rechnet danach **dasselbe** Gefecht wie die Buchung (`bfffaFuerGebautenPod()`).
- `stepSim()` leitet im Pod auf `bfPodReplaySchritt()` um (nur wenn `KP.pod.replay` gesetzt ist —
  das Duell erreicht den Zweig nie). Zuerst laufen alle vier Teams aus ihren Ecken an ihre Orte
  (6 Kampfsekunden), danach je Takt: Schläge über den Takt verteilt mit Spur in Teamfarbe und
  Schadenszahl, „ausgewichen“/„stellt sich klug“/„letzter Atem“, K.o. über `schalteAus()` (Ticker,
  Highlights, Endstand-Statistik), Eroberungsbalken gleitend, Punkte gleitend, Ticker für
  Eroberungen und Ausscheiden.
- Der Endstand der Arena ist **exakt** der gebuchte: Test „das Replay in der Arena endet exakt im
  gebuchten Endstand“ (k=2/4/6, Platz, Punkte, Lebende, Ligapunkte).
- Der Host-Hinweis sagt für Battlefield jetzt „wird als 4-Team-Gruppe (Pod) gewertet — aus genau
  dem Gefecht, das die Arena hier zeigt“ ohne „nur Vorschau“; fiel das Gefecht aus und wurde per PPS
  gebucht, steht das dort.

### 7.5 Liga-Kette (wie Mini-DM)

| Baustein | Datei |
|---|---|
| Runner, ein Chromium-Lauf je Spieltag | `runBattlefieldPodFixtures()` in `lib/battle/arena-headless-runner.ts` |
| Spieltag: Pods, k, Mutatoren, Teilnahme, Spieler-PP | `runBattlefieldPodMatchday()` in `lib/resolve/battlefield-pod-matchday.ts` |
| Buchungsformel (Platz aus dem Motor, 2-1-0-0, 0-10-Wert, `quelle: "ffa"`) | `berechneBattlefieldPodOverride()` in `lib/resolve/mini-dm-pod-resolve.ts` |
| Motor-Vorrang je Pod, PPS-Pod als Rückfall | `berechneMiniDmPodOverrides({ battlefieldRohdatenByPodId })`, `legacy-matchday-resolve-engine.ts` |
| Vorlauf (Semaphor, eine Wiederholung, Eingabe-Hash) | `lib/battle/arena-vorlauf-service.ts`, `berechneBattlefieldPodEingabeHash()` |
| Rollout-Schalter | `BATTLEFIELD_POD_VORLAUF_AKTIV` (`arena-resolved-disciplines.ts`), Server-Notschalter `OLY_BATTLEFIELD_POD_VORLAUF=aus` |
| Referenz (M90, Spieler-PP-Perzentile je k) | `data/generated/battlefield-pod-referenz.json`, `scripts/ziehe-battlefield-pod-referenz.mjs` |

Gezeigt = gebucht hängt an identischen Eingaben: dieselbe Saat (`buildBattlefieldPodMatchSeed()` +
`seedZuZahl()`), dasselbe k (`resolvePodPlayerCountForMatchday()`), dieselbe Aufstellung je Team
(`buildArenaAufstellung()`), derselbe Mutator-Wurf (`resolveMatchdayMutatorTraitsForDiscipline()` im
Vorlauf, `buildMatchdayMutatorTraitsBySide()` im Host), Formkarten aus der Pod-Saat. Ein Pod, in dem
ein Team gar keine Battlefield-Aufstellung hat, wird nicht aus dem Motor gebucht (dort kämpfte ein
Ersatzkader) und fällt mit Warnung auf den bisherigen Pfad zurück. Spieler-PP bekommen nur
aufgestellte Spieler.

### 7.6 Duell unverändert

Die Fingerabdrücke aus `tests/battlefield-pod-ffa.test.ts` (Duell `spieleArenaDomination` k=2/4/6
und `disziplinProbe` für TDM/Mini-DM/Battlefield) sind unverändert grün; der Gefecht-Code wird nur
mit `KP.pod` erreicht.

### 7.7 Offen

- **Optik.** Bei k=6 stehen 24 Figuren auf einer 470 px hohen Fläche um drei Orte; das ist lesbar,
  aber eng. Die Schläge sind eine Spur je Angriff und Takt (rund 20 s Sendezeit je Takt bei 1x);
  wer es lebendiger will, kann je Angriff mehrere kosmetische Treffer zeigen, ohne am Ergebnis etwas
  zu ändern.
- **Team-Ebene.** Das eignungsbeste Team gewinnt in 41–80 % (in den ersten zwei: 87–98 %, Letzter:
  höchstens 2,5 %). Das ist ein Vier-Team-Wettbewerb mit echtem Gegenspiel, keine Lotterie mehr
  (Echtzeit: 18–38 %), aber auch kein Abziehbild der Eignung wie der PPS-Pod.
- **Referenz neu ziehen**, wenn `BF_FFA_GRUND` geändert wird (`scripts/ziehe-battlefield-pod-referenz.mjs`).

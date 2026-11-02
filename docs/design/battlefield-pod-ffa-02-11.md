# Battlefield als echtes Vier-Team-FFA in der Arena (02.11.)

Chris, wörtlich: **„nein auch bei battlefield reicht kein hinweistext! da sollen 4 teams gleichzeitig
FFA machen"**.

Seit `1dcf3823` (01.11.) bucht die Liga Battlefield als Vierergruppe (Pod, 2-1-0-0). Die Arena
zeigte trotzdem weiter ein Zwei-Team-Duell, darüber stand nur ein Hinweistext. Jetzt kämpfen alle
vier Pod-Teams **gleichzeitig im selben Echtzeitkampf** um die drei Orte Nord, Mitte und Süd. Der
Motor ist derselbe, der Kampf ist sichtbar. Die Buchung läuft weiter über den PPS-Pod. Warum das
so bleibt, steht in Abschnitt 4.

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

__PP__

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

**Pp:** Die Messung (Budget-Methode) steht oben. Sie ist Pflicht, auch wenn der Kampf nicht
bucht. Ein Rezept-Tuning für den Pod lohnt erst, wenn Option 1 oder 2 gewählt ist.

**Takeshi/Staffel sichtbar machen:** Die Bahn-Zeichnung müsste vier Seiten können (Bahnen, HUD,
Banner). Das ist eigene Arbeit, siehe Abschnitt 5.

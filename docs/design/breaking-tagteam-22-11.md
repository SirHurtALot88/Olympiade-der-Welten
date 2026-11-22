# Breaking als Tag-Team-1v1 — Konzept und Mockup (22.11.)

**Reine Konzeptrunde. Kein Engine-Code geändert, nichts bestellt, nichts gemessen.**
Auftrag (Arbeitsliste 21.11., Welle 4), Chris wörtlich: „Breaking: Tag-Team-1v1 (Tekken/Street-Fighter-Art,
Ein- und Auswechseln, jeder kommt dran), HP/DMG je Spieler und Waffe unterschiedlich.“

Breaking bleibt, was es ist: ein **Folter-/Aushalte-Zweikampf** (einer fügt Schmerz zu, der andere hält aus,
dann Wechsel, bis einer aufgibt) — kein Breakdance.

- Mockup (klickbar): `public/mockups/breaking-tagteam-22-11.html`
- Aufnahmen: `docs/design/breaking-tagteam-22-11/` (1920×1080, 2560×1440, 1710×1112)

Die Zahlen im Mockup kommen aus einer **Schau-Simulation** im Mockup selbst (Startwerte dieses Papiers, echte
Attribute aus `data/generated/oly-player-attributes.json`, Beispielkader). Sie sind keine Messung und ersetzen
keine. Alles, was unten „Startwert“ heißt, ist ein Vorschlag für die erste Messreihe.

---

## 1. Ist-Stand (gelesen, nicht geändert)

| Baustein | Stand im Motor (`public/mockups/battle-mode.engine.js`) |
|---|---|
| Format | **Gauntlet** seit 22.09. (`BUEHNE_ART.breaking.gauntlet`, `baueGauntlet()`): Slot 1 gegen Slot 1, der Sieger bleibt mit seinen HP stehen, bis ein Team aufgebraucht ist |
| HP / Schaden | `GAUNTLET_HP_MAX=400` für **alle gleich**; Schaden 10 (hält) / 24 (bricht ein), für alle gleich |
| Peiniger | wirkt nur mit ±5 % (`GAUNTLET_PEINIGER_DECKEL`); ±20 % maß 0,784 und fiel durch |
| Geräte | zehn Geräte in drei Familien (`FOLTER_GERAETE`: Zermürbung → NERVEN, Hieb → TECHNIK, Wucht → SPITZENMOMENT), als Leiter je Bout, nicht je Spieler |
| Rollenwechsel | nach **jedem** Anschlag (Ping-Pong). Phasen von 4 Anschlägen maßen am 14.10. 0,825 statt 0,795 (`breaking-phasen-peiniger-konzept-14-10.md`), wurden aber nicht gebaut |
| Wert je Spieler | `u.summe` = Punkte nur aus dem **Aushalten** |
| Abnahme | rho je Spiel 0,867 (n=24) / 0,868 (n=48), Pp 14,3 / 13,9 (`stand-aller-disziplinen.md`) |

Drei Schwächen des Gauntlets, die das Tag-Team gezielt angeht:

1. **Nicht jeder kommt dran.** Späte Slots des Siegerteams kämpfen oft gar nicht — ihr Wert ist dann 0, egal
   wie gut sie sind.
2. **HP und Schaden sind für alle gleich.** Ein Tank und ein Magier haben denselben Vorrat; das Gerät hängt
   am Zug im Bout, nicht am Spieler.
3. **Der Peiniger ist fast wirkungslos**, weil sein Schaden nur dem Gegner schadet, ihm selbst aber nicht
   gutgeschrieben wird. Deshalb kostete jedes Prozent Peiniger-Wirkung bisher Rangtreue.

---

## 2. Die Regeln

### 2.1 Aufbau

- 6 gegen 6 (wie heute, `jeSeite:6`). Je Team steht **einer im Ring**, fünf stehen auf der Bank.
- Die Einsatzliste legt Startspieler und Reihenfolge (Slot 1–6) fest. Slot 6 ist der **Anker** (Chris'
  Slot-6-Dramaturgie vom 22.09. bleibt): die KI hebt ihn sich im Umlauf bis zuletzt auf.

### 2.2 Ein Gang = zwei Phasen

- **Phase 1:** A peinigt, B hält aus. **Phase 2:** B peinigt, A hält aus. Das ist Chris' Wunsch vom 13.10.
  („Spieler 1 greift erst an, der andere muss es ertragen, dann der Wechsel“) und der am 14.10. gemessene
  Gewinner (Phasen statt Ping-Pong).
- Die Phasenlänge kommt vom **Gerät des Peinigers** (3, 4 oder 5 Anschläge, Abschnitt 3.3).
- Je Anschlag würfelt der Aushaltende wie heute: **hält** (wenig Schaden) oder **bricht ein** (viel Schaden).
  Die Formel dafür bleibt die bestehende aus `gauntletRunde()`.

### 2.3 Wechselfenster

Nach jedem Gang dürfen **beide Teams gleichzeitig und verdeckt** wechseln. Wechsel mitten in einer Phase gibt
es nicht — das hält den Ablauf vorab berechenbar (Spieltag ohne Live-Eingabe, mehrspielertauglich).

Drei Regeln sorgen für „jeder kommt dran“ und gegen Mauern:

| Regel | Inhalt | Zweck |
|---|---|---|
| **Umlauf** | Niemand kommt ein zweites Mal rein, bevor alle lebenden Teamkollegen einmal dran waren. | Jeder der zwölf steht garantiert im Ring. |
| **Standzeit** | Höchstens 2 Gänge am Stück, dann Pflichtwechsel (außer er ist der Letzte). | Kein Dauerbrenner, Rhythmus wie im Tag-Team-Prügler. |
| **Eskalation** | Mit jedem Umlauf liegt die nächste Stufe des Geräts auf dem Tisch (I, II, III; Startwert Schaden ×1 / ×1,4 / ×1,9). | Der Kampf endet durch Aufgabe, nicht durch die Uhr. |

### 2.4 Bank und erholbare HP

Wer auf der Bank steht, erholt sich — aber nur den **erholbaren** Teil des Schadens (im Balken schraffiert rot,
wie die „roten Leben“ der Tag-Team-Prügler):

- Wucht und Hieb: die Hälfte des Schadens ist erholbar.
- Zermürbung: nichts davon ist erholbar (das ist ihr Profil, Abschnitt 3.3).
- Erholung je Gang auf der Bank: 6 % der Maximal-HP × (0,5 + AUSDAUER/200), gedeckelt auf den erholbaren Vorrat.

### 2.5 Aufgabe und Ende

- HP 0 → der Spieler ist raus („GIBT AUF“ oder „GEBROCHEN“, Beschriftung wie heute aus NERVEN).
- Der Nächste kommt nach Umlauf-Regel rein und **hält zuerst aus**; der Sieger behält die Peiniger-Rolle und
  verschnauft kurz (bestehendes `gauntletVerschnaufen`, nur auf erholbare HP).
- **Ende:** ein Team ist komplett gebrochen. Notbremse nach dem dritten Umlauf: dann entscheidet die Zahl der
  Gebrochenen, bei Gleichstand der Rest-HP-Anteil des Teams. Ein Remis bleibt möglich, wenn beides gleich ist.

### 2.6 Was die Schau-Simulation zeigt (keine Messung)

Acht Probeläufe im Mockup: rund 210–225 Anschläge und 26–29 Gänge je Kampf (der Gauntlet braucht heute rund
300 Anschläge), 5 von 8 Kämpfen endeten durch Aufgabe, 3 durch die Notbremse. Jeder Spieler hatte mindestens
einen Einsatz. **Auffällig:** die Aufgaben ballen sich im letzten Umlauf (erste Aufgabe erst nach 65–90 % des
Kampfs). Das ist als Dramaturgie brauchbar (Abtasten → Zermürben → Zusammenbruch), aber die Eskalationskurve
ist die zentrale Stellschraube der Kalibrierung — sie entscheidet, ob der mittlere Umlauf spannend ist.

---

## 3. HP, Schaden, Waffe — woher sie kommen

Die Matrix (`lib/player-generator/official-discipline-weights.ts`, **nur gelesen**) für Breaking:
Wille 28, Qual 22, Gesundheit 18, Kraft 10, Entschlossenheit 10, Ausdauer 8, Geschick 2, Intelligenz 2.

Es wird **kein neues Rezept** gebaut. Alle Kanäle lesen die bestehenden Teilwerte aus
`BUEHNE_ART.breaking.rezept`:

| Teilwert (besteht) | Rezept | Neue Aufgabe im Tag-Team |
|---|---|---|
| NERVEN | Gesundheit 52, Wille 42, Intelligenz 6 | **Maximal-HP**; Konter gegen Zermürbung |
| TECHNIK | Qual 63, Entschlossenheit 37 | **Schaden als Peiniger** (Hauptanteil); Konter gegen Hieb |
| SPITZENMOMENT | Kraft 54, Wille 46 | Schaden als Peiniger (Nebenanteil); Konter gegen Wucht |
| GRUNDLAGE | Gesundheit 34, Wille 32, Qual 19, Ausdauer 15 | Aushalte-Punkte je Anschlag (wie heute) |
| AUSDAUER | (besteht) | Erholung auf der Bank, Ermüdung bei langer Standzeit |
| WAGNIS, PUBLIKUM | (bestehen) | unverändert (Provokation, kleiner Punktezuschlag) |

### 3.1 HP je Spieler

`hpMax = 150 + 1,5 × NERVEN` (Startwert). Mit den echten Kadern: rund 240 (Lady Mournvale, Gesundheit 29) bis
275 (Vorrak, Gesundheit 97). Der Gesundheits-Riese hält sichtbar länger durch — das ist der Kanal, über den
Gesundheit 18 und ein Teil von Wille 28 ankommen.

### 3.2 Schaden je Spieler

`Peinigerwert = 0,6 × TECHNIK + 0,4 × SPITZENMOMENT`, Schadensfaktor `1 + 0,30 × (Peinigerwert − 50)/100`,
gedeckelt auf **±15 %** (Startwert; Messreihe 5 / 10 / 15, Abschnitt 6). Darüber kommen Qual 22 und Kraft 10 an.

**Warum das diesmal gehen kann, obwohl ±20 % im Gauntlet durchfiel:** dort schadete der Peiniger nur dem
Gegner, ohne dass es in seinen eigenen Wert einging — reines Rauschen für die Rangtreue. Im Tag-Team wird der
**zugefügte Schaden dem Peiniger gutgeschrieben** (Abschnitt 5). Ob das trägt, entscheidet die Messung, nicht
dieses Papier.

### 3.3 Die Waffe: Leibgerät nach Klassenfarbe

Jeder Spieler bringt **sein** Gerät mit. Es hängt an der Klassenfarbe (dieselbe Zuordnung wie bei den
Formkarten):

| Klassenfarbe | Klassen | Leibgerät (Familie) | Anschläge je Phase | hält / bricht ein | erholbar | trifft beim Gegner |
|---|---|---|---:|---:|---:|---|
| Rot | Berserker, Warlord, Tank | Vorschlaghammer (**Wucht**) | 3 | 14 / 34 | 50 % | SPITZENMOMENT |
| Grün | Sprinter, Rogue, Charger | Peitsche (**Hieb**) | 4 | 10 / 24 | 50 % | TECHNIK |
| Blau | Mage, Overseer, Templar | Daumenschraube (**Zermürbung**) | 5 | 8 / 19 | 0 % | NERVEN |
| Gelb | Bard, Hero, Badass, Tactician | **Wahlgerät**: nimmt die Familie, die den Gegner am schwächsten trifft | wie gewählt | −10 % | wie gewählt | schwächster Kanal |

Wichtig, und der Grund für die Zahlen:

- **Das Budget je Phase ist für alle Geräte gleich** (rund 68–72 Schaden bei 50 % Halten). Die Waffe ändert
  das **Profil**, nicht die Stärke: wenige schwere Schläge, viele kleine, erholbar oder nicht, und welcher
  Teilwert des Gegners dagegenhält. Sonst wäre die Klasse ein Kanal neben der Matrix, und die Pp-Abnahme kippt.
- Die drei Familien und ihre Konter-Teilwerte gibt es bereits (`GAUNTLET_FAMILIE_GEWICHT=0,35`). Neu ist nur,
  dass das Gerät am **Spieler** hängt statt an der Leiter im Bout.
- Die **Rasse** wirkt nur optisch (Dämon: das Brandeisen glüht, Konstrukt: Zange statt Daumenschraube).
  Keine Werte.
- „Waffe“ heißt im Bild außerdem: die Figur schlägt mit **ihrer eigenen Angriffsanimation** (Schwert, Klaue,
  Blitz). Das ist von Figur zu Figur verschieden und kostet nichts.

### 3.4 Mehrere Wege zum Erfolg

| Weg | Wer | Wie er gewinnt |
|---|---|---|
| **Hauptweg: der Stoiker** | Wille, Gesundheit | hält fast jeden Anschlag, großer HP-Vorrat, sammelt Aushalte-Punkte |
| Nebenweg: der Peiniger | Qual, Kraft | hält mäßig aus, bricht aber in seinen Phasen den Gegner — Wert über zugefügten Schaden |
| Nebenweg: der Dauerläufer | Ausdauer | erholt sich auf der Bank schneller und kommt im zweiten Umlauf fast frisch zurück |
| Nebenweg: der Konter | passender Teilwert | wird gezielt gegen eine Gerätefamilie eingewechselt, gegen die er hoch hält |

Ein Spieler ohne Wille, aber mit Qual 96 (Chain) ist damit kein Ausfall mehr, sondern ein Spezialist. Die
Nebenwege sind bewusst schlechter gestellt als der Hauptweg: Wille bleibt mit 28 das schwerste Attribut, weil
**jeder** ausgehaltene Anschlag ihn würfelt.

---

## 4. Die KI-Wechsellogik

Vollständig deterministisch aus dem Zustand, **kein eigener Zufallswurf** (wichtig für den Fingerabdruck und
für gezeigt = gebucht). Geprüft wird im Wechselfenster in dieser Reihenfolge:

1. **Pflicht:** Standzeit 2 Gänge erreicht → raus.
2. **Schutz:** unter 25 % HP und noch jemand auf der Bank → raus (er kommt im nächsten Umlauf wieder).
3. **Konter:** das Gerät des Gegners trifft einen Teilwert unter 62, und auf der Bank steht ein erlaubter
   Spieler mit mindestens +10 auf diesem Teilwert → wechseln.
4. sonst: stehen bleiben.

**Wer kommt rein:** unter den nach Umlauf-Regel Erlaubten der mit dem besten Wert aus „Konter-Teilwert gegen
das gegnerische Gerät“ und HP-Anteil; der Anker (Slot 6) wird zurückgehalten, solange noch ein anderer
erlaubt ist; Gleichstand → Slot-Reihenfolge.

**Mensch:** entscheidet in der Einsatzliste, nicht live — Reihenfolge und eine **Team-Vorlage** nach dem Muster
`STRATEGIE_VORLAGEN` (Wettessen-Pilot 17.11.): „Durchwechseln“ (jeder 1 Gang), „Stehen lassen“ (2 Gänge),
„KI“. Das ist delegierbar wie die übrige Einsatzliste (`isBereichDelegiert`), braucht keinen neuen Schreibweg
und hält keinen Spieltag an.

---

## 5. Punkte, Ergebnis, PP

- **Anzeige im Kopf:** Gebrochene Gegner, z. B. „6 : 3“.
- **Team-Ergebnis (E1):** wie bei jeder Begegnung über `ergebnisSkalaVersionFuer(gameState)`; Rohwert ist der
  Abstand der Gebrochenen, Rest-HP-Anteil als Feinwert. Die Arena zeigt „6 : 3 → 8 : 4“. Die E1-Anker müssen
  für Breaking neu kalibriert werden (`werte-ergebnisskala-aus.ts --schreibe-kalibrierung`).
- **Wert je Spieler** (das, woran rho gemessen wird, heute `u.summe`):

  `Leistung = Aushalte-Punkte (wie heute je ausgehaltenem Anschlag) + k × zugefügter Schaden`

  Startwert `k` so, dass der Peiniger-Anteil im Mittel rund ein Drittel der Leistung ausmacht (Matrix: Qual +
  Kraft = 32 von 100). `k` ist die zweite große Stellschraube neben dem Peiniger-Deckel.
- **PP:** über die C2-Skala (`ppSkalaModus(gameState)`), Bester um 5. `data/generated/breaking-pps-referenz.json`
  muss nach der Formatumstellung neu geschrieben werden (`werte-pp-skala-aus.mjs --schreibe-kalibrierung`),
  sonst stimmt gezeigt = gebucht nicht.
- Form, Moral, Formkarten, Mutator, Verletzung (50 % in der Verletzungs-Disziplin) wirken wie bisher auf die
  Eignung und bleiben unberührt.

---

## 6. Anzeige (Mockup)

| Bereich | Inhalt |
|---|---|
| Kopf links/rechts | Lebensbalken des Aktiven im Prügler-Aufbau: Name, Klasse in Klassenfarbe, Gerät mit „Anschläge × Schaden“, Rolle (PEINIGT / HÄLT AUS), HP mit erholbarem Anteil (rot schraffiert), Standzeit-Pips, Schaden, Einsätze |
| Kopf Mitte | Stand der Gebrochenen, Gang, Umlauf |
| Bankleisten | fünf Karten je Team: Porträt, HP, Zustand (wartet / nächster / war dran / erholt sich / gebrochen), Kante in Gerätefarbe |
| Ring | die zwei Aktiven groß, Bank als kleinere Figuren am Rand, Geräte-Plakette, Rollenmarken, Schadenszahlen |
| unten links | „Gerät trifft Kanal“: die drei Teilwerte des Aushaltenden, der getroffene hervorgehoben, Halte-Chance |
| unten Mitte | Phasenleiste: Anschläge beider Phasen als Kästchen (hält / bricht ein), danach die Raute fürs Wechselfenster |
| unten rechts | Verlauf |
| Einblender | Wechselfenster mit Grund je Team, „GIBT AUF“ / „GEBROCHEN“, Endstand-Tabelle (sortierbar im Bau) |

**Figuren, nur Bestand:** Peiniger `angriff-east`, Aushaltender `treffer-east` (gespiegelt für rechts),
Aufgabe `tod-east` (letztes Bild bleibt stehen), Ein-/Auswechseln `walk-east`, Bank `south`. Keine neue
Animation, keine neue Figur.

**Kulisse:** das Mockup nutzt `public/sprites/kulissen/breaking/brutal.jpg`. Die stammt aus der alten Szenen-HTML
und wirkt bei voller Bildgröße grob — nach der Remake-Regel (17.11.) braucht Breaking eine **neue PixelLab-Arena**
(Folterkeller mit Tiefe, Fackellicht, Bank-Podeste links und rechts). Vorschlag, nicht bestellt:

| Posten | Schätzung |
|---|---:|
| Kulisse Folterkeller, 2 Varianten (Standard, brutal) | 6–8 Generationen |
| Geräte als Requisiten (Vorschlaghammer, Peitsche, Daumenschraube + je Stufe II/III, 9 Stück) | 9–12 |
| Bank-Podest, Pranger/Streckbank als Ringmöbel, Blut-/Schweiß-Effekt | 4–6 |
| Stilproben, Ausschuss | 5 |
| **Summe** | **rund 25–30** |

Die Geräte-Zeichen im Mockup sind SVG-Platzhalter.

**Abgleich der Bildschirme** (selbst angesehen): 1920×1080 und 2560×1440 ohne Scrollen, ohne Überlappung;
1710×1112 nutzt die zusätzliche Höhe (die Bühne wächst, HUD bleibt an den Rändern). Bekannte Schwächen des
Mockups: die alte Kulisse ist grob aufgezogen; die Bankfiguren stehen eng und
überlappen sich; lange Namen werden in den Bankkarten gekürzt.

---

## 7. Risiko für rho und Pp, Messplan

### 7.1 Einschätzung

| Änderung | Wirkung auf rho je Spiel | Wirkung auf Pp |
|---|---|---|
| Jeder kommt dran (Umlauf) | **hebt** — heute haben ungenutzte Späte den Wert 0 | neutral |
| Phasen statt Ping-Pong | **hebt** — am 14.10. gemessen: 0,825 statt 0,795 (Phase 4) | war unauffällig |
| HP aus NERVEN | unklar: mehr Validität (Gesundheit/Wille), aber kürzere Kämpfe für Schwache = weniger Ereignisse | zieht Gesundheit/Wille hoch — prüfen, Gesundheit darf nicht über 18 + Toleranz laufen |
| Peiniger ±15 % mit Gutschrift | **größtes Risiko**: im Gauntlet fiel ±20 % durch. Gutschrift im eigenen Wert ist die Gegenmaßnahme | sollte Qual/Kraft **näher** an die Matrix bringen (heute eher zu schwach) |
| Leibgerät nach Klasse | kleines Rauschen durch Paarungen; Budget gleich, Familiengewicht bleibt 0,35 | Klasse ist kein Matrix-Attribut — Budgetgleichheit ist Pflicht |
| KI-Wechsel (Schutz/Konter) | unklar: Schutz verlängert Starke, Konter verteilt Einsatzzeit ungleich | klein |
| Eskalation je Umlauf | senkt die Ereigniszahl im dritten Umlauf | neutral |

Ausgangslage ist komfortabel (0,867, Pp 14), aber die Spannweite über die Paarungen liegt bei Breaking bei
0,16–0,29. **Eine einzelne n=24-Messung reicht nicht** (Befund vom 14.10.).

### 7.2 Messplan (vor jedem Bau im echten Motor)

Wie am 14.10.: **Wegwerf-Kopie** der Engine mit additivem Schalter, erst danach der echte Bau.

1. **Nullprobe:** Schalter aus → muss 0,867 / 0,868 und den Fingerabdruck bit-gleich treffen.
2. **Stufe 1 — nur Format:** Tag-Team mit gleichen HP, Peiniger ±5 %, ohne Leibgerät. Trennt die Wirkung von
   Umlauf und Phasen von allem anderen.
3. **Stufe 2 — HP aus NERVEN.**
4. **Stufe 3 — Peiniger 5 / 10 / 15 %** jeweils mit drei Werten für `k` (Gutschrift).
5. **Stufe 4 — Leibgerät**, danach die KI-Regeln einzeln (Schutz an/aus, Konter an/aus).
6. **Stufe 5 — Eskalationskurve** (drei Kurven), Ziel: 70 % der Kämpfe enden durch Aufgabe, erste Aufgabe im
   zweiten Umlauf.

Je Stufe: `scripts/miss-alle-disziplinen.mjs 48 breaking` (n=48, nicht 24) in **zwei Saatströmen** und
`scripts/messe-arena-einfluss.mjs breaking 48` plus `messe-arena-einfluss-zweiter-saatstamm.mjs`.
Mit `OLY_FORM_MODUS=echt` gegenprüfen (wie bei der TDM-Abnahme).

**Abnahme:** rho je Spiel ≥ 0,75 hart, Ziel > 0,80, und **nicht unter dem heutigen Stand minus 0,02** (wer 0,867
hat, soll nicht für ein Format auf 0,78 fallen); Pp ≤ 25 hart, Ziel < 15, in beiden Saatströmen; dazu Star auf
Rang 1/2 und Paartreue ab 15 Punkten Abstand. Fällt eine Stufe durch, bleibt sie aus — das Format selbst
(Stufe 1) ist der Kern, alles andere ist Zugabe.

### 7.3 Fingerabdruck, Schutzsumme, Rückweg

Muster Hockey-Torwart / Climbing-Canyon / Battlefield:

- `spiele breaking 1|7|42` und `disziplinProbe breaking` bewegen sich → **neues GESAMT**, in `CLAUDE.md` und
  `data/generated/` festhalten; alle anderen Zeilen müssen byte-gleich bleiben.
- Das alte Format bleibt als Rückweg geschützt: drei Zeilen `spiele breaking/gauntlet 1|7|42` mit eigener Summe
  **`BREAKING-GAUNTLET`** außerhalb von GESAMT (erste Zeile = heutiger Wert).
- Motor-Vorgabe `breakingFormat:"tagteam"`, Stempel je Spieltag `seasonState.breakingFormat`
  (`lib/resolve/breaking-format.ts`, Vorbild `climbing-format.ts`): gebuchte Spieltage behalten ihr Format,
  Umstellung ab dem nächsten gewerteten Spieltag.
- Rückweg-Schalter `OLY_BREAKING_FORMAT=alt` (`deploy/hetzner/.env`, Compose reicht ihn durch).
- Das Format reist im Kader-Umschlag (`formatByDisciplineId.breaking`) zu Host, Chromium-Runner und Node-Motor
  und steht im Eingabe-Hash des Vorlaufs.

---

## 8. Bau-Hinweise für Sonnet (erst nach Chris' „bau das“ und bestandener Messung)

1. **Neben** `baueGauntlet()` eine `baueTagTeam(art, mine, gegner)` schreiben, Weiche über das Format — den
   Gauntlet nicht umbauen, er ist der Rückweg.
2. `gauntletRunde()` unverändert wiederverwenden (Halte-Wurf, Aushalte-Punkte). Das Gerät kommt als
   `{stufe, familie, provoziert}` wie heute hinein; `stufe` ist jetzt die Umlauf-Stufe, `familie` das Leibgerät.
3. **Kein neues Feld an Spielerobjekten**, das der Fingerabdruck anderer Disziplinen sieht — Zustände des
   Tag-Teams (erholbar, dran, Standzeit) am Teilnehmer `u` wie `u.hp` heute, oder in modulweiten Maps.
4. **Kein `rr()` in der KI-Wechsellogik.** Genau ein Wurf je Anschlag, wie heute.
5. Jede Runde trägt wie heute ihren Stand mit (`hpVor`, `hpNach`, `gegnerN`, dazu `rolle`, `gang`, `umlauf`,
   `erholbar`, `wechselGrund`), damit die Anzeige chronologisch enthüllen kann.
6. Klassenfarbe aus derselben Quelle wie die Formkarten-Farbregel lesen (eine Wahrheit), nicht neu tippen.
7. Anzeige neu bauen (eigene Komponente im Stil des Mockups), `zeichneBreaking()` nicht flicken. Schrift über
   die Tokens, Klassen in Klassenfarbe, Endtabelle sortierbar, Rang 1 = Bester.
8. Mehrspieler: Team aus `activeManagerTeamId`, die Team-Vorlage je Team im Spielstand, Schreibweg über den
   bestehenden Einsatzlisten-Pfad (`authorizeServerRoomWrite`).
9. Abschluss: Abgleich „Mockup | App“ bei 1920×1080 und 2560×1440 mit Liste drin / angepasst / fehlt;
   `tests/formkarten-alle-disziplinen.test.ts` und die Rangtreue-Schranke müssen grün bleiben.

---

## 9. Offene Fragen an Chris

1. **Waffe = Leibgerät nach Klassenfarbe** (Rot Wucht, Grün Hieb, Blau Zermürbung, Gelb Wahlgerät), fest je
   Spieler — oder soll der Manager das Gerät je Spieler in der Einsatzliste **wählen** dürfen? (Empfehlung:
   fest; wählbar wäre ein weiterer Taktik-Knopf und ein weiterer Kanal neben der Matrix.)
2. **Wechsel nur im Fenster nach jedem Gang, vorab über Reihenfolge und Team-Vorlage** — oder willst du im
   Spiel **live** selbst abklatschen können? (Empfehlung: vorab; live bräuchte eine Eingabe während der Arena
   und hält im Mehrspieler den Spieltag an.)
3. **Darf Breaking dafür eine neue PixelLab-Arena und Geräte-Requisiten bekommen** (rund 25–30 Generationen,
   keine Figuren, keine Animationen)? Die heutige Kulisse ist alt und fällt gegen die neuen Arenen ab.

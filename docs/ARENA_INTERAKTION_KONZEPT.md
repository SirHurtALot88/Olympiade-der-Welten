# Interaktion in Bühne und Bahn — ein Konzept, kein Code

Stand: 24.08.2026. Entstanden aus Chris' Beobachtung, dass Bühne-Disziplinen sich wie
„nur Rumstehen" anfühlen — jeder wird unabhängig bewertet, es gibt keinen Berührungspunkt
zwischen Konkurrenten. Ausgearbeitet zusammen mit Fable (auf dessen ausdrücklichen Wunsch
hinzugezogen), an zwei von Chris genannten Fällen: **Breaking** (Schmerz aushalten,
Folter-Thematik) und **Eiskunstlauf**. Dazu ein zweiter Strang: Bahn soll zoombar werden,
mit echten Lanes und einem Preis fürs Überholen.

**Dies ist ein Konzeptdokument, kein implementierter Code.** Die andere Sitzung baut zur
selben Zeit live an `battle-mode.html` (drei Motoren fertig — Kampf, Bahn, Bühne —, ein
vierter „Feldspiel" im Bau). Um nicht in dieselbe Datei zu schreiben, während dort aktiv
gearbeitet wird, liegt das hier als eigenständiges Dokument vor. Umsetzung folgt, sobald
der aktuelle Stand dort ruht.

---

## Die Grundidee: keine neuen Werte, nur eine neue Lesart

Die Battle Arena hat bereits fünf Kampfwerte, jeder ein gewichtetes Rezept über dieselben
zwölf Attribute (`lib/battle/…`, im Mockup ab `const REC.power` — siehe
`docs/BATTLE_ARENA_UEBERGABE.md`):

```
ANG (Angriff)      power 62 · charisma 18 · determination 12 · torment 8
VER (Verteidigung) health 46 · power 38 · spirit 16
LP  (Lebenspunkte)  health 52 · stamina 34 · power 14
TMP (Tempo)         speed 46 · dexterity 24 · stamina 16 · awareness 14
AUS (Ausdauer)       stamina 52 · determination 26 · power 22
```

Schaden im Kampf-Motor: `Basisschaden × (ANG/50) × 100/(100+VER)`. Trefferchance beim
Tackle im Bahn-Motor (`battle-mode.html:4428`): `stark = WUCHT/(WUCHT+ROBUST)` — ein
Muster, das schon zweimal im Code steht, bevor dieses Konzept überhaupt entstand.

**Der Vorschlag: Bühne bekommt eine Störung, die exakt dieselben fünf Werte wiederverwendet
— nur mit neuer Bedeutung.** ANG wird zum Sabotage-Wurf, VER/LP zur Resilienz dagegen, TMP
zum Ausweichen/Wegkommen (genau Chris' Vorgabe für Eiskunstlauf: „speed wie schnell man weg
kommt"), AUS zum Durchhalten. Keine sechste Wertefamilie — dieselbe Formel, anders gelesen.
Das hält die Regel „keine erfundenen Werte" ein: die *Bausteine* sind alle schon belegt,
erfunden sind nur die Zahlen, die sie zusammenfügen (unten einzeln markiert).

---

## Bühne: die Störung als geteilter Zustand

Bisher entstehen Bühne-Punkte als fertige Blöcke je Durchgang (Gelingen/Misslingen über
sieben Rollen: GRUNDLAGE, SPITZENMOMENT, TECHNIK, PUBLIKUM, NERVEN, AUSDAUER, WAGNIS —
diese Rollen sind aus der PR-Beschreibung von #656 übernommen; **der Code dazu liegt nicht
im geprüften Stand, nur die Namen**). Damit gibt es nichts, das ein Gegner einem wegnehmen
könnte. Der Vorschlag macht daraus einen **Strom über Zeit**:

- **Störwurf** — Trefferchance = `ANG_Störer / (ANG_Störer + TMP_Ziel)`, dasselbe Muster
  wie der Tackle im Bahn-Motor.
- **Aussetzer** — bei Treffer ruht der Punktezuwachs des Ziels für
  `T = T_basis × 100/(100+VER_Ziel)` — derselbe Mitigations-Term wie beim Kampfschaden,
  nur auf Zeit statt HP angewandt. VER 40 → 71 % der Basiszeit; VER 80 → 56 %.
- **Fassung (aus LP)** — Pool `LP × 10`. Treffer ziehen `Basisschaden × (ANG/50)` ab;
  unter 50 %/25 % Fassung sinkt die Gelingenschance der verbleibenden Durchgänge um
  10/20 Prozentpunkte.
- **Budget (aus AUS)** — Störversuche kosten den Störer selbst (eigene Performzeit,
  eigene Fassung). Budget = `⌊AUS/25⌋` Versuche je Auftritt.

### Breaking, durchgerechnet

Eine passive Schmerzquelle tickt 8 Fassung/Sekunde gegen jeden Teilnehmer — das ist der
Kern der Disziplin, kein Gegnerzutun nötig. Gegner können nachlegen: Basisschaden 30,
ANG 55 → 33 Schaden. VER wirkt hier **nicht** als Schadensreduktion, sondern verdoppelt
sich in der Erholungszeit: nach einem Treffer tickt der Schmerz `4 s × 100/(100+VER)`
zusätzlich (VER 40 → 2,9 s Nachwirkung, VER 80 → 2,2 s). Sieger: wer am längsten steht.
Zwischenwertung: Haltungspunkte pro Sekunde.

### Eiskunstlauf, durchgerechnet

Kür bleibt eine Elementfolge (Durchgänge wie bisher). Ein Störer mit ANG 60 greift ein
Ziel mit TMP 45 an: Trefferchance `60/(60+45) ≈ 57 %`. Bei Treffer misslingt das laufende
Element automatisch, der Punktestrom ruht `3 s × 100/(100+VER_Ziel)` (VER 50 → 2 s). Der
Preis für den Störer: sein **eigener** nächster Durchgang bekommt −15 Prozentpunkte
Gelingenschance — er hat seine eigene Kür für den Angriff unterbrochen.

### Der Balance-Anker

Erwartungsnutzen des Störens = Trefferchance × entgangene Gegnerpunkte, gegen einen fixen
eigenen Preis. Ziel: Stören lohnt sich gezielt gegen den Führenden, nicht flächendeckend —
sonst wird Bühne zu einem Kampf-Motor im Kostüm, und das ist ausdrücklich nicht die Absicht.

---

## Bahn: Lanes, Überhol-Ökonomie, Kamera

**Ein Überraschungsbefund beim Nachsehen:** ein Großteil dessen, was Chris sich wünscht,
existiert bereits, nur unsichtbar. `battle-mode.html:4273`:

```js
const SCHATTEN_ABSTAND=0.062, SCHATTEN_TEMPO=1.045, SCHATTEN_SPAREN=0.66;
```

Windschatten gibt heute schon +4,5 % Tempo und −34 % Kraftverbrauch. Ein Bahnwechsel
kostet schon Zeit (`0.55 − WENDIGKEIT×0.0022` Sekunden), Tempo (`quer=0.94` während des
Wechsels) und hat einen Cooldown (1,6 s) — und verlässt man den Windschatten fürs
Überholen, entfällt der Kraft-Rabatt sofort. Das *ist* im Kern schon „Abstand halten beim
Überholen kostet etwas".

**Was fehlt, ist genau eine Sache: die Kollisionszone.** Solange zwei Läufer nebeneinander
liegen (`|Δpos| < 0.01`, Nachbarbahn), sollte für beide ein erhöhtes Stolperrisiko gelten,
und der Überholer bekommt in diesem Fenster keinen Windschatten. Damit wird „früh mit
Abstand vorbeiziehen" gegen „bis zur Zielgeraden dranbleiben" eine echte Entscheidung mit
Zeitkosten auf beiden Seiten — nicht nur ein Nebeneffekt der bestehenden Formel.

**Lane-Vergabe** ist heute starr (`i*2`/`i*2+1`, `battle-mode.html` nahe `bauSpurt`).
Vorschlag: nach Setzliste (Saison-Eignung), beste Läufer auf die Mittelbahnen 3–6, wie in
der echten Leichtathletik. Eine offene Frage an Chris: nach Setzliste oder ausgelost?

**Kamera.** Der entscheidende Punkt: `pos` läuft bereits normalisiert 0..1, `HUERDEN` sind
Streckenbrüche — beides bleibt unverändert, die Simulation merkt vom Zoomen nichts. Nur
das Zeichnen wechselt von `x = 80 + pos×strecke` auf eine Welt→Schirm-Transformation:

```
worldX  = pos × STRECKE_M
screenX = (worldX − cam.x) × pxProMeter × cam.zoom
```

`bahnY(b)` und `BAHNEN=8` bleiben unangetastet — Fable schlägt vor, **nur horizontal** zu
zoomen, damit die Lanes vertikal immer lesbar bleiben. Auto-Kamera: verfolgt den
Schwerpunkt der Spitzengruppe, `zoom = clamp(min, sichtbareBreite / (Feldspreizung +
Puffer))`, geglättet per Lerp. Längere Strecken werden dann eine reine Konstante
(`STRECKE_M` hoch, mehr Hürden) statt eines Eingriffs in die Mechanik.

---

## Die drei noch unzugeordneten Disziplinen (kurz)

- **Speed-Schach** passt direkt zur neuen Bühne-mit-Störung: die gegnerische Bedenkzeit
  *ist* der LP-Pool, jeder Zug ein Störwurf gegen sie — der geteilte Zustand kommt gratis
  mit.
- **Tennis** ist Feldspiel pur: Ballwechsel = Ballbesitz-Zyklus, Winner = Abschluss,
  Fehler = Ballverlust — passt in den vierten Motor, sobald der steht.
- **I-Spy** eher als Bühne mit knapper Ressource statt Angriff: ein begrenzter
  Fund-Pool, wer zuerst findet, nimmt dem anderen das Ziel weg. Interaktion ohne
  Störwurf — ein dritter Interaktionstyp neben „stören" und „Ball wegnehmen".

---

## Was hier erfunden ist (Kennzeichnungspflicht)

Nichts davon ist aus einer Quelle abgeschrieben — Kalibriermasse, die beim Bauen justiert
werden muss:

| Wert | Zahl | 
|---|---|
| Basis-Störschaden (Bühne) | 30 |
| `T_basis` (Aussetzer-Grundzeit) | 3–4 s, disziplinabhängig |
| Störbudget | `⌊AUS/25⌋` |
| Fassungspool | `LP × 10` |
| Fassungs-Schwellen | 50 % / 25 % → −10/−20 Pp Gelingenschance |
| Kollisionsfenster (Bahn) | `|Δpos| < 0.01` |
| Eigenpreis fürs Stören (Eiskunstlauf) | −15 Pp auf den nächsten eigenen Durchgang |

## Offen — mit Chris zu klären

1. Lassen sich Bühne-Punkte wirklich auf einen zeitlichen Strom umstellen, oder müssen
   Durchgänge hart blockweise bleiben? Falls Letzteres: Störung wird gröber — „ein
   Durchgang des Ziels misslingt" statt Sekunden-Aussetzer.
2. Die sieben Bühne-Rollen (GRUNDLAGE…WAGNIS) sind nur als Namen bekannt, nicht als Code —
   vermutlich dockt NERVEN am sinnvollsten an den Fassungsverlust an, aber das muss am
   echten Bühne-Code (sobald gemergt) geprüft werden, nicht geraten.
3. Lane-Vergabe: Setzliste oder Los?
4. Verlässt der Störer sichtbar seine Position während des Angriffs (Lesbarkeit fürs
   Publikum), oder ist es ein reiner Fernwurf?
5. Soll die Kamera je doch vertikal mitzoomen, oder bleiben die Lanes fix?

## Quellen

Recherchiert als Vergleichspunkt, nicht als Bauplan — die eigene Formel bleibt eigen:

- [Poise/Interruption-Systeme in Soulslikes](https://gamerant.com/soulslike-games-best-stagger-mechanics/) — Vorbild für „Fassungspool, der bei Unterschreiten die Erfolgschance senkt statt sofort auszuschalten"
- [Interruption Resistance, Genshin Impact Wiki](https://genshin-impact.fandom.com/wiki/Interruption_Resistance)
- [Windschatten/Blocken in Rennspielen](https://drivingfast.net/slipstream-overtaking/) — Vorbild für die Kollisionszone beim Überholen
- [Racecraft: Überholen in der Kurve](https://drivingfast.net/racecraft-overtaking-on-a-corner/)

Figur-Skating-Spiele mit Rivalen-Sabotage wurden gesucht und **nicht gefunden** — echter
Eiskunstlauf ist kontaktfrei, kein Vorbild existiert. Das ist also eine eigene Erfindung
fürs fiktive Universum der Olympiade, nicht aus einem Vorbild übernommen — sollte bei der
Umsetzung entsprechend benannt bleiben.

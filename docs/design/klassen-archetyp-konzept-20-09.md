# Klassen/Skills für Kampfdisziplinen — Konzept (Backlog #156)

Reine Recherche/Konzeptarbeit, kein Code angefasst. Auftrag: Chris will (1) dass ein
Assassine und ein Tank bei gleichem Gesamtwert grundverschieden aussehen und trotzdem
vergleichbar stark sind, und (2) dass Team-Zusammensetzung ein echter taktischer Faktor
wird — eine Mono-Tank- oder Mono-Assassinen-Aufstellung soll gegen ein ausgewogenes Team
eine ausnutzbare, aber keine tödliche Schwäche haben.

Betroffen: die vier Kampfdisziplinen im gemeinsamen Chassis
(`public/mockups/battle-mode.engine.js`) — TDM, Mini-DM, Battlefield, dazu das
Gewichtheben-Duell, das denselben Motor nutzt.

---

## 0) Ist-Zustand — was es wirklich gibt, nicht was es scheint zu geben

Drei Systeme im Repo tragen das Wort „Archetyp" oder „Klasse". Sie sind **nicht
miteinander verbunden**, und keines davon tut heute das, was Chris will.

### 0.1 Persönlichkeit — reines Verhalten, keine Werte

`battle-mode.engine.js:4690-4827` (`PERS`, `PERSORD`, `PERSZIEL`, `HALTUNG`, `ZUSAMMEN`,
`BINDUNG`). Sechs Persönlichkeiten (Bollwerk, Draufgänger, Duellant, Schleicher,
Beschützer, Opportunist) steuern **ausschließlich Verhalten**: welchen Befehl sie von
sich aus wählen (`PERSORD`), wen sie angreifen (`PERSZIEL`: Bedrohung, Schwächster,
Nächster, hintere Reihe, Speerspitze, Schild), wie formationstreu sie bleiben (`form`),
wie oft sie das Ziel wechseln (`opp`) und wann sie sich zurückziehen (`selb`). Keine
dieser Größen verändert LP/ANG/VER/TMP/AUS oder irgendein Basisattribut. Das ist die
Schicht „WIE er sich verhält" — funktioniert und bleibt unangetastet.

### 0.2 Slot-Profile — Eignung für einen Platz, kein Charakter

`battle-mode.engine.js:4828-4956` (`SLOTS_JE_DISC`, `BASIS_JE_DISC`), berechnet von
`scripts/generiere-arena-daten.ts` aus `lib/lineups/matchday-slot-roles.ts`. Jeder Slot
(Vanguard, Skirmisher, Shotcaller, Holdline, Breaker, …) trägt ein `profil` — eine
Gewichtung der elf Attribute (Power, Health, Stamina, Spirit, Charisma, Determination,
Intelligence, Awareness, Torment, Dexterity, Will, Speed). `gewichtet(a, profil)`
(`battle-mode.engine.js:5084-5086`) bildet daraus einen gewichteten Mittelwert über die
**bereits vorhandenen, für den Spieler unveränderlichen** Basisattribute:

```js
function gewichtet(a,profil){ let s2=0,w=0;
  for(const k in profil){const g=profil[k]||0; if(g>0&&a[k]!=null){s2+=g*a[k];w+=g;}}
  return w?s2/w:0; }
```

`slotAufschlag()` (`battle-mode.engine.js:5091-5097`) vergleicht diesen Wert gegen den
Wert desselben Spielers im **Grundprofil der Disziplin** (`BASIS_JE_DISC`), skaliert mit
Faktor 2,2 und begrenzt auf ±8,5. Das ist die Schicht „WO er am besten steht" — sagt,
für welchen Platz ein gegebener Spieler mit seinen gegebenen Attributen am besten
passt. Es verändert **nichts an den Attributen selbst**, nur die Eignungszahl für einen
Platz.

### 0.3 Der Platzhalter, den Chris angesprochen hat

`battle-mode.engine.js:4682-4688`, wörtlich im Code:

> „Sie sind Klassenwerte — solange kein Spieler einem Archetyp zugeordnet ist, tragen
> alle denselben Platzhalter (Fighter: 15 % und 30 %), so wie beim Kit."

```js
const PLATZHALTER_ARCHETYP={name:"Fighter", stunResist:15, knockbackResist:30};
const betWiderstand=(u)=>(u.stunResist??PLATZHALTER_ARCHETYP.stunResist)/100;
const stossWiderstand=(u)=>(u.knockbackResist??PLATZHALTER_ARCHETYP.knockbackResist)/100;
```

Das ist der einzige Ort, an dem der Kampfmotor heute überhaupt nach einer
Spieler-Klasse fragt — und die Antwort ist für **jeden** Spieler dieselbe Konstante.
**Es gibt aktuell keine echte Klassen-/Archetyp-Zuordnung pro Spieler.** Bestätigt.

### 0.4 Drei Halbsysteme, die schon existieren und genau hierfür gebaut wurden

Das ist der wichtigste Befund dieser Recherche, weil er die Optionen unten stark
einschränkt: es muss nichts von Grund auf neu erfunden werden, es gibt bereits drei
unfertige, unverbundene Teile.

**a) `lib/battle/archetype-registry.ts`** — 35 Kampf-Archetypen, wörtliche Abschrift von
Chris' Klassenkarten (`hp`, `atk`, `def`, `spd`, `stunResist`, `knockbackResist`, `mana`,
`stamina`). Diese Daten zeigen bereits genau die Statur-Gegensätze, die Chris will —
zum Beispiel:

| Archetyp | Rolle | HP-Spanne | DEF-Spanne | SPD-Spanne | stunResist | knockbackResist |
|---|---|---:|---:|---:|---:|---:|
| Bullbreaker | TANK | 210–390 | 56–104 | 91–169 | 40 % | 40 % |
| Fighter (Platzhalter) | TANK | 161–299 | 49–91 | 105–195 | 15 % | 30 % |
| Rogue | ASSASSIN | 133–247 | 11–20 | 122–228 | 5 % | 0 % |

Rogue hat mehr Angriff und mehr Tempo als Bullbreaker, aber ein Fünftel der
Verteidigung und **null** Rückstoßwiderstand. Das ist kein Vorschlag — das steht schon
so in den Karten, von Chris selbst geliefert, und liegt seit dem 02.09. ungenutzt im
Repo (`kit` ist bewusst leer, „kommt später von Chris"). Diese Datei beantwortet die
Statur-Frage; sie ist nur an keiner Stelle mit einem Spieler verknüpft.

**b) `lib/battle/subclass-archetypes.ts`** — ordnet jeder der 56 im Spielstand
vorkommenden Unterklassen (Warrior, Trickster, Assassin, Mage, …) eine **Menge**
möglicher Archetypen zu, nach Chris' eigener Regel „bei Unsicherheit mehrere zuweisen,
nicht raten". Für viele Spieler ist die Menge inzwischen durch Bildbefunde (Dropbox)
auf ein bis vier Kandidaten verengt. Was fehlt: die letzte Auswahl **eines** Archetyps
aus der Menge, deterministisch pro Spieler. Diese Datei ist für Skills/Kit gedacht
(„Zwischen Klassen und Archetypen … passen sie inhaltlich" — Kommentar Zeile 9), nicht
für Attributverteilung — aber genau ihr Ergebnis (ein Archetyp je Spieler) ist die
Voraussetzung, um `PLATZHALTER_ARCHETYP` durch echte Werte zu ersetzen.

**c) `lib/player-generator/player-generator-archetypes.ts`** — ein drittes, wieder
anderes Archetyp-Konzept (`mage`, `beast`, `rogue`, `tank`, `warrior`, `social_icon`,
`construct`, `undead`, `nature`, …), jedes mit `attributeBias` (z. B. Tank:
`{health:+10, stamina:+9, will:+7, speed:-6, charisma:-4}`) und `axisBias`. Wichtig:
das ist ein **Erzeugungs-Parameter**, kein persistiertes Spielerfeld. Geprüft in
`lib/data/olyDataTypes.ts:752` — `preferredArchetype` steht im `PlayerGeneratorInput`
(einer Steuerungs-Eingabe für den Generator), nicht im `Player`-Objekt, das später
gelesen wird. Es beeinflusst also **wie** ein neuer Spieler gewürfelt wird, sagt aber
danach nirgendwo mehr „dieser Spieler IST ein Tank". Der Bias selbst ist zudem additiv
und nicht nachweislich summen-erhaltend — genau die Stelle, an der ohne Nacharbeit ein
Tank am Ende einfach mehr Gesamtpunkte hat als ein Rogue, nicht nur anders verteilte.

**Fazit Ist-Zustand:** Es gibt Kartendaten, die die gewünschte Statur-Vielfalt bereits
enthalten (a), eine Zuordnungslogik, die fast bis zum Spieler durchgezogen ist (b), und
einen Attribut-Bias-Mechanismus, der schon während der Generierung greift, aber nicht
persistiert und nicht summen-neutral ist (c). Keins davon ist an die Eignungsformel der
Arena angeschlossen. Die Aufgabe ist eher „drei Halbteile zusammenschließen und dabei
die Summen-Invarianz erzwingen" als „ein viertes System neu bauen".

### 0.5 Der Maßstab, an dem jede Option gemessen wird

Aus `stand-aller-disziplinen.md` (aktuellster Stand) und
`docs/design/arena-zielwahl-umsetzung.md` (Messung vom 02./03.09., Kader
`kaderfamilie-live-save.json`, n=24, kaderfest):

| Disziplin | rho je Spiel | Spannweite (Kader) | rho Saison | Status |
|---|---:|---:|---:|---|
| TDM | 0,113–0,253 | 0,269–0,387 | 0,070–0,217 | durchgefallen |
| Mini-DM | 0,094–0,269 | 0,697–0,802 | 0,071–0,500 | durchgefallen |
| Battlefield | 0,325–0,387 | 0,595–0,662 | 0,595–0,619 | durchgefallen |

(Zwei Zeitpunkte, daher Spannen — die genaue Zahl schwankt mit Kader und Commit-Stand,
der Befund nicht: **alle drei Arena-Disziplinen liegen weit unter der 0,80-Schranke aus
CLAUDE.md**, mit einer Kader-Spannweite, die oft größer ist als der Median selbst. Ein
Klassensystem trifft hier also nicht auf eine funktionierende Mechanik, die man nicht
kaputt machen darf, sondern auf eine, die schon kaputt ist — das senkt die Hürde für
„darf nicht schlechter werden" nicht, es erhöht aber den Anspruch an „muss wirklich
helfen", weil ein weiterer gescheiterter Anlauf hier besonders teuer wäre.

Zwei bereits gescheiterte Anläufe an einem verwandten Mechanismus
(`docs/design/arena-zielwahl-umsetzung.md`, automatische Bedrohungs-Zielwahl statt
Geometrie) zeigen konkret, woran es hängt:

- Beide Varianten waren kaderfest **schlechter** als der unveränderte Stand (TDM
  unbewegt, Mini-DM/Battlefield nach unten, teils außerhalb der eigenen
  Kader-Spannweite — also keine Messungenauigkeit, sondern eine echte Verschlechterung).
- Ursache vermutet: ein rein additiver Score ohne Bezug zur Position/Geometrie erzeugt
  am Kampfbeginn ein Array-Reihenfolge-Patt, das bei wenigen Kämpfern pro Seite
  (Mini-DM/Battlefield: 4, TDM: 6) überproportional wirkt.
- Der Bericht selbst empfiehlt: nicht die nächste Parametervariante auf demselben
  Ansatz, sondern zuerst eine eigene kleine Sonde bauen, um die eigentliche Ursache zu
  sehen, bevor man an der Gesamtzahl weiterrät.

Diese Lehre gilt für ein Klassensystem umso mehr — es ist ein größerer Eingriff als
eine reine Zielwahl-Änderung (siehe Abschnitt 3).

---

## 1) Entwurfsoptionen

Die zentrale Falle bei allen dreien: `gewichtet()` ist ein einfacher gewichteter
arithmetischer Mittelwert über **Rohpunkte** verschiedener Attribute — ohne jede
Normierung auf deren natürliche Spannweite. Ein Slot-Profil, das stark auf zwei
Attribute konzentriert ist (z. B. Vanguard: Power 33,4 + Health 23,4 von 100), bevorzugt
strukturell jedes Statur-Template, das genau in diesen zwei Attributen hoch ist —
unabhängig davon, ob das Template insgesamt „ausgewogen" oder „spitz" ist. Das ist an
sich beabsichtigt (Eignung soll Passung zeigen), wird aber zur strukturellen
Bevorzugung, sobald **eine ganze Klasse** systematisch auf denselben zwei, drei
Attributen hoch angelegt ist und diese Attribute in überproportional vielen
Slot-Profilen hoch gewichtet sind. Jede Option unten muss das explizit ansprechen, sonst
wiederholt sie den Fehler, den CLAUDE.md für die Disziplin-Eignung selbst schon einmal
dokumentiert (Abschnitt „Dieselbe Eignungslücke saß in ALLEN VIER Chassis").

### Option A — Attribut-Umverteilung am festen Gesamtwert (Statur-Templates)

Jede Klasse (z. B. Assassine, Tank, Bruiser, Support/Caster, Ranged) bekommt ein
**Umverteilungs-Templat**: einen Vektor von Anteilen über die elf Attribute, der sich zu
1 summiert (nicht zu addierenden Boni, sondern zu Anteilen). Ein Spieler behält seine
**eigene Attributsumme** (die Summe, die seinen „Gesamtwert" ausmacht), aber sie wird
nach dem Templat der Klasse umverteilt statt gleichmäßig/zufällig zu bleiben:

```
neuerWert[attribut] = summe(spieler) * templatAnteil[klasse][attribut]
                       * (1 + individuelleStreuung)
```

**Warum das strukturell fair bleiben kann:** die Summen-Erhaltung ist hier kein
Tuning-Ziel, sondern eine Konstruktionseigenschaft — zwei Spieler mit derselben Summe
haben nach der Umverteilung IMMER wieder dieselbe Summe, egal wie extrem das Templat
ist. Das beantwortet Chris' erste Anforderung direkt und beweisbar, nicht durch
Nachjustieren.

**Die eigentliche Gefahr liegt danach, in der Eignungsformel.** Ein reiner
Summen-Erhalt verhindert nicht, dass `gewichtet()` eine Klasse bevorzugt. Gegenmittel,
alle aus der Praxis anderer Systeme:

- **Populationsbezogene Normierung (z-Score) vor der Gewichtung.** Statt Rohpunkte zu
  gewichten, wird jedes Attribut zuerst gegen den Mittelwert/die Streuung ALLER Spieler
  in diesem Attribut normiert. Verhindert, dass ein Attribut mit größerer natürlicher
  Spannweite (z. B. Power) automatisch mehr Gewicht im Mittelwert hat als eines mit
  kleinerer (z. B. Determination), unabhängig von der Klasse.
- **Normierte Sub-Scores statt eines einzelnen Mittelwerts.** Statt eines gewichteten
  Mittels über alle Attribute eines Slots: für jedes vom Slot genutzte Attribut einen
  eigenen 0–1-Score gegen die POPULATION dieses Attributs bilden, dann diese Scores
  mitteln (geometrisch, nicht arithmetisch). Ein geometrisches Mittel bestraft
  „eine Null unter lauter Zehnen" stärker als ein arithmetisches — das verhindert, dass
  ein Assassine mit Health nahe am Minimum trotzdem als „passend" für einen Slot
  durchgeht, der (auch) Health verlangt, nur weil sein Power-Wert das ausgleicht.
- **Rollen-Skalen wie bei Eslabong** (bereits Vorbild im Code, s.
  `battle-mode.engine.js:4728-4730`: „DREI FUENFERSKALEN statt Zahlenschieber"): eine
  Klasse wird nicht über Rohattribute verglichen, sondern über 3–5 benannte Stufen pro
  Achse (z. B. „Statur: Leicht/Mittel/Schwer"), die selbst bereits normiert sind, weil
  sie über Quantile der Population definiert werden statt über absolute Werte.

Diese drei Gegenmittel sind kombinierbar und ändern **nur die Eignungsformel**, nicht
den Umverteilungsmechanismus — sie sind der Teil, der eine strukturelle Schieflage
zwischen Klassen verhindert, unabhängig davon, welche konkreten Templates man wählt.

**Kosten/Risiko:** größter Eingriff der drei Optionen. Ändert `p.a` (die Basisattribute),
die laut `BASIS_JE_DISC`-Kommentar (`battle-mode.engine.js:4853`) in **alle zwanzig
Disziplinen** einfließen, nicht nur in die Arena — genau die Stelle, an der laut
CLAUDE.md schon einmal eine „Eignungslücke … in ALLEN VIER Chassis" saß, weil eine
Änderung an gemeinsam genutzten Attributdaten sich lautlos über Disziplinen hinweg
ausbreitet. Eine Umverteilung dürfte deshalb nur für die Arena-Sicht der Attribute
gelten (eine Kopie, keine Mutation der persistierten `p.a`), sonst verändert ein
Kampf-Klassensystem nebenbei Hockey, Basketball und alle anderen Disziplinen.

### Option B — Kampfwert-Overlay nur in der Arena (Statur bleibt bei den Attributen unberührt)

Statt die elf Basisattribute anzufassen, bekommt jeder Spieler einen Klassen-Multiplikator
**ausschließlich** auf die vier abgeleiteten Kampfwerte (LP, ANG, VER, TMP, AUS) und auf
`stunResist`/`knockbackResist` — angewendet NACH `mische()`/der Eignungsberechnung, nur
innerhalb der vier Kampf-Chassis. Die Multiplikatoren werden direkt aus den bereits
authored Kartenspannen in `archetype-registry.ts` abgeleitet (kein neuer erfundener
Wert): z. B. Verhältnis von Bullbreaker-DEF zu Rogue-DEF, normiert über alle 35
Archetypen, statt einer einzelnen willkürlichen Zahl.

**Vorteil:** schließt exakt die im Code dokumentierte Lücke
(`PLATZHALTER_ARCHETYP`, Abschnitt 0.3) und nichts sonst. Rührt `p.a` nicht an — per
Konstruktion unmöglich, dass eine andere Disziplin betroffen ist, weil die Änderung
gar nicht an der Stelle sitzt, die andere Disziplinen lesen. Kleinster Blast-Radius
aller drei Optionen.

**Nachteil:** erfüllt Chris' ersten Punkt nur teilweise. Die elf Basisattribute eines
80er-Assassinen und eines 80er-Tanks blieben identisch — nur die *im Kampf sichtbare*
Statur unterscheidet sich (mehr/weniger Leben, mehr/weniger Widerstand). Das ist
näher an „Ausrüstung"/„Kampfstil" als an „grundverschiedenes Attributprofil". Wer
außerhalb der Arena auf die Spielerkarte schaut, sieht keinen Unterschied.

### Option C — Verzahnung der drei bestehenden Halbsysteme (empfohlene Zielarchitektur)

Kombiniert (a)/(b)/(c) aus Abschnitt 0.4, statt ein viertes System zu bauen:

1. **`subclass-archetypes.ts` deterministisch schließen.** Aus der Kandidatenmenge je
   Spieler wird — seedbasiert, damit reproduzierbar — genau EIN Archetyp gewählt. Das
   ist keine neue Datenquelle, nur der letzte Schritt einer bereits laufenden Arbeit.
2. **Diesen einen Archetyp für `stunResist`/`knockbackResist` einsetzen** (löst
   `PLATZHALTER_ARCHETYP` ab; das ist Option B, aber nur als erster Baustein, nicht als
   Endzustand).
3. **`player-generator-archetypes.ts`s `attributeBias` bei der Generierung anwenden,
   aber summen-erhaltend nachrüsten** (Option A, doch nur beim WÜRFELN neuer Spieler,
   nicht rückwirkend auf den ganzen Bestand — vermeidet den ALLE-VIER-CHASSIS-Fehler,
   weil es nicht die Eignungsformel ändert, sondern nur, wie ein Attributsatz zum
   ersten Mal entsteht). Für bestehende Spieler bräuchte es einen separaten,
   ausdrücklich gekennzeichneten Nachzieh-Schritt (nicht Teil dieses Konzepts).
4. **Einen `klassenAufschlag()` analog zu `slotAufschlag()`** (`battle-mode.engine.js:
   5091-5097`) in `aufEignung` einführen — dieselbe, bereits produktiv laufende und
   bislang nicht als rho-Ursache aufgefallene Normierungslogik (`gewichtet()` gegen
   Klassenprofil minus `gewichtet()` gegen Grundprofil, skaliert, geklammert), nur mit
   einem Klassen- statt einem Slot-Profil als zweitem Kanal. Die z-Score-/Sub-Score-
   Normierung aus Option A gehört auch hierher, weil dasselbe `gewichtet()` betroffen
   ist.

**Warum das der richtige Zielzustand ist:** jeder Baustein existiert schon, ist bereits
von Chris oder einer früheren Runde geprüft (die Kartendaten sind Abschrift, die
Unterklassen-Zuordnung ist mit Bildbefunden abgesichert), und der einzige wirklich neue
Code ist die Verzahnung selbst plus die Normierung in `gewichtet()`. Das ist der
kleinste Diff, der beide Chris-Anforderungen trifft — Statur UND Eignung ändern sich,
aber über Mechanismen, die im Repo schon einmal für gut befunden wurden.

---

## 2) Team-Konter-Play — welcher Mechanismus das ist, nicht nur dass er sein soll

Chris verlangt ausdrücklich eine Simulations-Folge, keine Behauptung. Drei Hebel liegen
bereits im Motor und sind nicht erfunden, aber **keiner davon ist gemessen** — das muss
vor jeder Festlegung passieren:

1. **Rückstoß-/Betäubungswiderstand als hartes Gefälle.** Mit echten Archetyp-Werten
   (Abschnitt 0.4a) hat eine Mono-Assassinen-Aufstellung team-weit 0–5 %
   Rückstoßwiderstand, eine Mono-Tank-Aufstellung 30–40 %. Wenn Rückstoß/Betäubung im
   Kampf tatsächlich Handlungsfähigkeit kostet (laut Kommentar Zeile 4683 „Beide wirken
   jetzt"), ist ein Team aus lauter Assassinen gegen jede Fokus-/Crowd-Control-lastige
   Aufstellung strukturell verwundbarer — das ist eine Eigenschaft der bereits
   vorliegenden Kartendaten, keine neue Erfindung. Zu prüfen: wie oft Betäubung/Rückstoß
   im aktuellen Motor überhaupt ausgelöst wird und wie stark der Effekt tatsächlich
   durchschlägt (kann trivial klein sein, wenn CC selten prozt).
2. **`bedrohungVon`-Fokussierung** (`dmg+heal*0,6+ko*120`, s.
   `arena-zielwahl-umsetzung.md`). Eine Mono-DPS/Assassinen-Aufstellung baut Schaden
   schneller auf als ein gemischtes Team und würde — WENN Zielwahl zuverlässig auf
   Bedrohung konvergiert — schneller zum gemeinsamen Fokusziel des Gegners werden.
   Genau diese Zielwahl-Änderung ist aber zweimal gescheitert (Abschnitt 0.5) und liefert
   heute überwiegend geometrische, nicht bedrohungsbasierte Ziele. Dieser Hebel ist also
   an eine ANDERE, noch ungelöste Baustelle gekoppelt — ein Klassensystem sollte sich
   nicht darauf verlassen, dass Bedrohungs-Fokussierung funktioniert, solange sie es
   nachweislich nicht tut.
3. **Tempo/Reichweite bei Verfolgen/Flanke.** Ein Mono-Tank-Team mit durchgehend
   niedrigem Speed braucht länger für `flanke`/`verfolgen` (Backrow erreichen), ein
   gemischtes Team mit ein bis zwei schnellen Flankern (Skirmisher-Slot,
   hohe Speed/Dexterity) kommt schneller durch. Das ist im bestehenden Slot-/
   Order-System bereits angelegt (`ORDERS`, Zeile 4694 ff.) und bräuchte nur die
   Klassen-Streuung, um sichtbar zu werden.

**Empfehlung für diesen Abschnitt:** vor jeder Festlegung eine eigene, kleine Sonde
bauen — eine 5×Assassine-vs-5×Tank-vs-balanciert-Matchup-Serie, nach demselben Muster
wie die bestehenden `scripts/miss-hockey-archetypen.mjs` / `miss-gewichtheben-
archetypen.mjs`, gemessen über die M0-Kaderfamilie. Nur wenn diese Sonde einen echten,
reproduzierbaren Effekt zeigt (Gewinnrate, nicht nur Anekdote), wird der Mechanismus
committet. Chris selbst verlangt „nicht zwingend verlieren, aber verwundbar" — das ist
eine Größenordnungsfrage (z. B. Mono-Tank verliert gegen balanciert vielleicht 35–45 %
statt 50 %), die nur eine Messung beantworten kann, keine Spezifikation vorab.

---

## 3) rho-Risiko und ein stufenweiser Einführungsplan

**Warum das größer ist als die gescheiterte Zielwahl-Änderung:** die Zielwahl-Änderung
rührte eine einzige Funktion an (`chooseTarget`/`bedrohungVon`) und blieb trotzdem
kaderfest schlechter. Ein Klassensystem berührt potenziell drei Stellen gleichzeitig
(Attributgenerierung, Eignungsformel, Kampfwerte) — jede davon einzeln bereits riskant
genug, um beim ersten Anlauf zu scheitern; alle drei gleichzeitig zu ändern würde bei
einer Regression nicht mehr erkennen lassen, welcher Teil sie verursacht hat.

**Stufenplan, jede Stufe einzeln gegen `data/generated/kaderfamilie-arena-erweitert.json`
mit `scripts/miss-alle-disziplinen.mjs` gemessen, bevor die nächste beginnt:**

- **Schritt 0 — nur messen, nichts ändern.** Die Konter-Play-Sonde aus Abschnitt 2 gegen
  den UNVERÄNDERTEN Motor bauen, mit der vorhandenen Unterklassen-Vielfalt als
  Behelfs-„Klasse" (kein Code-Eingriff). Zeigt, ob Team-Zusammensetzung heute schon
  irgendein Signal hat, oder ob man bei null anfängt. Kostet nur eine Messsonde, kein
  Motor-Commit, also kein rho-Risiko.
- **Schritt 1 — `PLATZHALTER_ARCHETYP` ablösen, sonst nichts.** Aus
  `subclass-archetypes.ts` einen Archetyp je Spieler deterministisch auflösen und in
  `stunResist`/`knockbackResist` einsetzen (Option B als Baustein von Option C). Keine
  Attributänderung. Erwartung: TDM/Mini-DM/Battlefield bewegen sich nur, wenn CC im
  Kampf tatsächlich relevant oft greift — alle 16 Nicht-Arena-Disziplinen müssen
  bit-identisch bleiben (Regressionsnachweis wie in `arena-zielwahl-umsetzung.md`
  Abschnitt 2, Basketball/Gewichtheben unverändert).
- **Schritt 2 — `klassenAufschlag()` in `aufEignung` einführen**, inklusive der
  z-Score-/Sub-Score-Normierung aus Abschnitt 1, weiterhin ohne `p.a` anzufassen.
  Getrennt von Schritt 1 messen, damit ein rho-Ausschlag eindeutig zuordenbar ist.
- **Schritt 3 — erst danach, nur wenn 1+2 kaderfest nicht schlechter sind:**
  summen-erhaltende Attribut-Umverteilung bei der NEU-Generierung (Option A/C Punkt 3),
  zunächst nur für neu erzeugte Spieler, nicht rückwirkend auf den Bestand. Erneuter
  voller Lauf über alle zwanzig Disziplinen — das ist der Schritt, der laut Abschnitt 0.4c
  am ehesten unbeabsichtigt in andere Disziplinen durchschlägt, weil er `p.a` betrifft.

Jede Stufe hat ein eigenes Abbruchkriterium: verschlechtert sich TDM/Mini-DM/Battlefield
kaderfest gegenüber der eigenen Kader-Spannweite (nicht nur gegenüber dem Median — die
Lehre aus `arena-zielwahl-umsetzung.md` ist ausdrücklich, dass eine Spannweiten-Bewegung
ohne Medianbewegung trotzdem eine reale Verschlechterung sein kann), wird NICHT committet
und ehrlich als „versucht, gemessen, nicht besser" dokumentiert — genau wie bei den
beiden Zielwahl-Anläufen.

---

## 4) Empfehlung

**Zielarchitektur: Option C** (Verzahnung der drei bestehenden Halbsysteme) — nicht,
weil sie am elegantesten wäre, sondern weil sie der einzige Weg ist, der beide
Chris-Anforderungen trifft, ohne eine vierte, konkurrierende Datenquelle einzuführen.
Option A allein wäre der direktere Treffer für Anforderung 1, trägt aber das größte
`p.a`-Risiko; Option B allein ist sicher, trifft Anforderung 1 aber nur oberflächlich.

**Kleinstmöglicher erster Schritt, isoliert messbar:** Schritt 1 aus Abschnitt 3 —
`subclass-archetypes.ts` auf eine deterministische 1:1-Zuordnung schließen und
`PLATZHALTER_ARCHETYP` in `battle-mode.engine.js:4686` durch die echten
`stunResist`/`knockbackResist`-Werte aus `archetype-registry.ts` ersetzen. Das ist:

- ein dokumentierter, von Chris selbst benannter TODO, kein neuer Entwurf,
- ohne jede Berührung von `p.a`, also ohne Ausbreitungsrisiko in die anderen 16
  Disziplinen,
- mit `scripts/miss-alle-disziplinen.mjs` sofort und eindeutig gegen die
  M0-Kaderfamilie messbar,
- und die einzige Voraussetzung, die alle drei weiteren Schritte (Klassenaufschlag,
  Konter-Play-Sonde, Attribut-Umverteilung) ohnehin brauchen — jede spätere Stufe
  braucht ein „welcher Archetyp ist dieser Spieler" als Eingabe.

Erst nach dieser Messung entscheiden, ob Schritt 2 (Klassenaufschlag in der
Eignungsformel) überhaupt etwas bewegt, bevor der größere Schritt 3 (Attribut-
Umverteilung) überhaupt geplant wird.

# Gameplay- und Design-Review (22.11.) — greifen die Systeme ineinander?

Anlass, Chris: „Greifen alle Systeme sauber ineinander, wo könnte man etwas besser machen, wo ist Verbesserungspotential?“
Diese Review nimmt die **Spieler- und Design-Sicht** ein (Entscheidungen, Spielschleifen, Spannung, Verständlichkeit,
Motivation, Mehrspieler). Die Technik (Soll/Ist mit Zahlen) misst eine zweite Review parallel.

**Wie gelesen wurde.** CLAUDE.md vollständig, `arbeitsliste-21-11.md`, `seiten-umbau-fahrplan-18-11.md`, die Konzepte und
Mockups vom 17.–22.11., der Spielablauf im Code (`lib/foundation/game-flow-controller.ts`, `foundation-takt-plan.ts`,
`EinsatzlisteModern.tsx`, `lib/season/title-race.ts`, `lib/ui/game-encyclopedia.ts`, `lib/lineups/strategie-vorlagen.ts`),
drei App-Aufnahmen (Startseite, Einsatzliste, Nach dem Spieltag) und alle 94 In-Game-Meldungen auf `origin/bug-reports`
(30.07. bis 19.11.). **Nicht gespielt:** kein Dev-Server, kein Live-Test, nichts gemessen. Wo eine Aussage nur auf einer
Aufnahme oder einem Doku-Stand beruht, steht „prüfen“ dabei. Am Spiel wurde nichts geändert, nichts bestellt.

---

## 1. Kurzfazit

Das Fundament ist ungewöhnlich solide: Wertung, Anzeige und Buchung hängen an einer Wahrheit, die Disziplinen belohnen
nachweisbar verschiedene Attribute, und Finanzen, Vorstand, Training und Belastung sind als Systeme durchdacht. Die
Systeme greifen **rechnerisch** ineinander, aber **für den Spieler spürbar** noch zu wenig: die Kette „ich entscheide
etwas → ich sehe, was es gebracht hat“ reißt an mehreren Stellen ab. Am Spieltag entscheidet der Manager im Kern nur, wer
wo steht, wie hart gespielt wird und welche zwei Karten liegen; eine Spielweise (Taktik) gibt es bisher nur als
abgeschalteten Pilot für eine Disziplin. Weil die Rangtreue bewusst hoch ist (Ziel über 0,80) und Form und Moral
zusammen höchstens ±2,7 % bewegen, kommt die Spannung nicht aus dem Zufall und muss deshalb aus **sichtbaren
Zielkonflikten** kommen — genau die sind in der Oberfläche noch versteckt. Der Saisonbogen hat gute Bausteine (zwei
Ligen, Auf-/Abstieg, Pause, Vorstand), aber kaum inszenierte Momente: Halbzeit, Schlussspurt und Saisonende sind
Verwaltung statt Höhepunkt. Für mehrere Saisons fehlt ein Motor, der die Liga in Bewegung hält (kein Alter, Draft nur
in Saison 1), und für drei Menschen fehlt das, was einen gemeinsamen Abend trägt: Vergleich, Derby, gemeinsames Zusehen.
Der häufigste Frust in Chris' Meldungen ist dabei kein Designproblem im engeren Sinn, sondern **Zahlen, die an zwei Stellen
verschieden sind**, und ein **Ablauf, der hängt** — beides zerstört Vertrauen schneller, als neue Systeme es aufbauen.

---

## 2. Stärken — das muss bleiben

1. **Gezeigt = gebucht als Kulturregel.** Formkarten über eine einzige Funktion, Skalen als Stempel im Spielstand statt
   als Serverschalter, Fingerabdruck für die Wertung. Das ist die Voraussetzung dafür, dass ein Managerspiel überhaupt
   lesbar ist, und der Grund, warum sich die übrigen Befunde gezielt beheben lassen.
2. **Die Einsatzliste erklärt die Disziplin.** „Was hier zählt“ mit Gewicht je Attribut, „Beste Kandidaten“, Rolle des
   Platzes, Belastung des Platzes, erwartete Spanne gegen den Gegner (Aufnahme
   `einsatzliste-arena-fixes-21-11/einsatzliste-md12-basketball-1920.png`). Das ist das beste Onboarding-Werkzeug der App.
3. **Die Startseite sagt die Lage in einem Satz.** „13. in Liga 2 · 5 Pkt hinter Aufstiegsplatz 3“, „Punkte heute bis 4“,
   Kaderstärke-Rang je Disziplin als Kachelleiste. Genau so denkt ein Manager.
4. **Duell-Wertung 2/1/0 plus Ergebnisskala 7 : 4.** Sofort verständlich, vergleichbar über zwanzig völlig verschiedene
   Disziplinen, und der Abstand bleibt als Verhältnis erhalten.
5. **Die gesperrte Matrix mit Durchreichepflicht.** Jedes Attribut wiegt über alle Disziplinen 166/167 Punkte, und die
   Pp-Prüfung erzwingt, dass ein 80er-Wert auch oben ankommt. Damit gibt es wirklich mehrere Kaderprofile, die tragen.
6. **Formkarten als Saisonhaushalt.** Pflicht-Minuskarten, Farbregel, Captain: eine der wenigen Entscheidungen, die über
   den einzelnen Spieltag hinausreicht. Chris' frühe Meldungen (31.07., 19.08.) zeigen, dass er hier taktisch denkt.
7. **Belastung, Resistenz und Pause.** Erschöpfung zwingt zur Rotation, die Pause nach Spieltag 10 gibt der Saison zwei
   Hälften. Das ist der stärkste Grund, mehr als acht Spieler zu halten.
8. **Vorstand wie im Football Manager.** Keine Geldstrafen, Freigabe-Quote, zwei Töpfe, Gespräch mit Bitte und Zusage.
   Das ist ein Gegenüber statt einer Regelwand.
9. **Training auf Ziel-Disziplin mit Primär- und Nebenweg**, je Spieltag gebucht und verfolgbar. Entwicklung wird damit
   eine Richtung, die man wählt, statt eines Reglers.
10. **Delegation je Bereich.** „Mensch überschreibt, KI respektiert das“ ist die richtige Antwort auf drei Menschen mit
    verschieden viel Lust auf Details.

---

## 3. Befunde, nach Wirkung aufs Spielerlebnis

Aufwand: **S** unter einem Tag, **M** ein bis drei Tage, **L** mehr. Jeder Befund ist als **Fehler/Lücke** (etwas
Vorhandenes stimmt nicht oder fehlt gegenüber der eigenen Vorgabe) oder **Verbesserungsidee** (funktioniert, könnte
besser sein) markiert.

### 3.1 Zahlen, die an zwei Stellen verschieden sind — Fehler/Lücke, M

**Beleg.** Rund jede sechste der 94 Meldungen hat dieses Muster: Tagesrang gegen Saisonrang (31.07., 04.08., 19.08.,
22.08.), GuV im Saisonstand gegen Finanzen (04.08.), Verkauf gegen Marktwert +10,7 gegen +9,3 (14.08.), Netto/Saison gegen
Forecast im Profil (14.08.), Basketball 9,1 in der Arena gegen 9,9 im Saisonstand (14.08.), Form +18,4 bei lauter
negativer Form (14.08.), OVR je Spieltag gegen OVR überall (04.08.), Score gegen PP (`pp-analyse-21-11.md`).

**Problem.** Jede einzelne Abweichung ist klein, zusammen lehren sie den Spieler, keiner Zahl zu trauen. Dann lohnt es
sich nicht mehr, über Entscheidungen nachzudenken.

**Vorschlag.** Das Muster „eine Wahrheit“ der Formkarten auf die fünf Kernzahlen ausdehnen: Rang, Punkte, Kasse/GuV,
Marktwert/Verkaufspreis, PP. Je Zahl eine Lesefunktion und ein Wächtertest, der zwei Seiten gegeneinander prüft. Dazu
einen Standardbaustein „so setzt sich die Zahl zusammen“ beim Überfahren (Chris hat ihn am 04.08. und 25.08. selbst
verlangt).

### 3.2 Der Spieltag hat zu viele Schritte und zu viel Leerlauf — Fehler/Lücke, M

**Beleg.** `game-flow-controller.ts` führt je Spieltag zwölf Schritte: letzten Spieltag prüfen, Training prüfen,
Transfers, Einsatzliste, Formkarten, bestätigen, Arena, Reveal, Ergebnisse, Saisonstand, Gebäude, weiter. Meldungen
„Flow hängt bei Training prüfen“ (19.08., 22.08.), „Spieltag hängt“ (31.07.), „Punkte nicht gebucht“ (14.08., 22.08.).
`spieltag-tempo-21-11.md`: Abgabe 9–17 s, Arena-Vorlauf 34–39 s, Wertung 13,6 s auf dem Live-Abbild.

**Problem.** Zwanzigmal je Saison. Schritte ohne Entscheidung (Training prüfen, wenn sich nichts geändert hat; Saisonstand
prüfen; Reveal) sind Klickarbeit, und Wartezeit ohne Inhalt fühlt sich doppelt so lang an.

**Vorschlag.** (a) Eine Zielzeit je Spieltag festlegen (Frage 1) und den Ablauf daran messen. (b) Schritte nur zeigen,
wenn es etwas zu entscheiden gibt: Training erscheint nur bei Anlass (Wunsch, Überlastung, Decke erreicht, Verletzter
zurück), sonst gilt der Plan weiter. (c) „Nach dem Spieltag“ ersetzt „letzten Spieltag prüfen“, „Ergebnisse“ und
„Saisonstand prüfen“ als ein einziger Halt. (d) Die Wartezeit des Vorlaufs mit der Arena-Vorstellung und der
Gegneranalyse füllen, statt eine Ladeanzeige zu zeigen.

### 3.3 Der Manager kann nicht entscheiden, WIE gespielt wird — Verbesserungsidee, L (Mockup nötig)

**Beleg.** Einsatzliste: Platz, Einsatzstufe (Schonen/Normal/Vollgas), zwei Formkarten, Captain. Spielweisen gibt es nur
für Wettessen und nur hinter `OLY_STRATEGIE_VORLAGEN` (Standard AUS, `lib/lineups/strategie-vorlagen.ts`). Form bewegt
±2 %, Moral ±0,7 % (`form-moral-17-11.md` Abschnitt 7). Daneben stehen die Knöpfe „Auffüllen“ und „Optimieren“.

**Problem.** Bei hoher Rangtreue und kleinen Modifikatoren ist die beste Aufstellung meist eindeutig, und ein Knopf
findet sie. Dann ist die Einsatzliste eine Bestätigung, keine Entscheidung. Die Rangtreue soll nicht sinken (Vorgabe);
also muss die Entscheidung aus Zielkonflikten kommen, bei denen es kein eindeutiges Optimum gibt.

**Vorschlag, zwei Stufen.**
- *Kurz (M):* „Optimieren“ liefert nicht eine Aufstellung, sondern **zwei bis drei benannte Pläne** mit erwarteter
  Wirkung, weil die Konflikte schon existieren: beide Disziplinen ausgeglichen / D1 opfern, D2 sichern / heute schonen
  für den nächsten Spieltag (Belastung) / Minuskarte heute loswerden. Der Spieler wählt eine Absicht, nicht 16 Plätze.
- *Lang (L):* Spielweisen für alle Disziplinen ausrollen, nach dem Wettessen-Muster: sie ändern, **was** die Spieler tun,
  nie **wie gut** — damit bleibt die Eignung die Wahrheit, und der Manager bekommt trotzdem eine Handschrift (Pressing
  oder Konter im Hockey, früher Wechsel im Breaking-Tag-Team, Risiko-Route im Climbing). Jede Vorlage braucht rho- und
  Pp-Abnahme und eine neue Fingerabdruck-Zeile.

### 3.4 Die Wirkung der eigenen Entscheidung wird nach dem Spiel nicht gezeigt — Verbesserungsidee, S–M

**Beleg.** Vor dem Spiel zeigt die Einsatzliste „erwartet 23–56“ und „Karten fürs Team ±0,0 · Alle · Farbe · Form“.
„Nach dem Spieltag“ (`nach-dem-spieltag-18-11/app-nach-dem-spieltag-1920.png`) zeigt Form-Meldungen und Moral, aber
nicht, was Karte, Einsatzstufe, Captain und Aufstellung gebracht haben.

**Problem.** Die Schleife Entscheidung → Wirkung schließt sich nicht. Der Spieler lernt nicht, ob Vollgas den Sieg
gebracht hat oder nur die Verletzung.

**Vorschlag.** In „Nach dem Spieltag“ je Disziplin eine Zeile „Deine Entscheidungen“: erwartet 39 → gespielt 44; davon
Karte +8, Vollgas +2, Form −1, Erschöpfung −2; Preis: zwei Spieler über 65 Erschöpfung. Alle Werte liegen aus der Buchung
vor (dieselbe Zerlegung wie die Karten-Wirkung). Knappe Niederlagen bekommen den Satz „mit Karte X wäre es ein Remis
gewesen“ nur, wenn er aus der Buchung stimmt.

### 3.5 Der Saisonbogen hat keine inszenierten Momente — Lücke und Idee, S–M

**Beleg.** `lib/season/title-race.ts` hebt Titelkandidaten nur am letzten Spieltag hervor und rechnet mit 12 × 3,3 = 39,6
möglichen Punkten je Spieltag — der Faustzahl der alten Rang-Punkte-Wertung. Im Battle-Spielstand gilt die Duell-Wertung
mit höchstens 4 Punkten je Spieltag (`battle-mode-pps-duell.ts`). **Prüfen:** mit der alten Obergrenze wäre praktisch
jedes Team „im Rennen“, die Anzeige sagt dann nichts. Ein Aufstiegs- oder Abstiegsrennen wird gar nicht gerechnet, und
die Rechnung trennt nicht nach Liga. Die Pause nach Spieltag 10 ist eine Marke und ein Postfach-Eintrag
(`saisonpause-21-11.md`), kein Moment.

**Problem.** Mit zwei Ligen und drei Auf-/Absteigern haben fast alle Teams bis zum Schluss etwas zu gewinnen oder zu
verlieren — das Spiel zeigt es nur nicht.

**Vorschlag.** (a) Rennen-Rechnung auf Duellpunkte und je Liga umstellen, drei Rennen statt einem: Titel, Aufstieg,
Abstieg; sichtbar ab etwa Spieltag 15 („rechnerisch noch möglich“ wird mit 4 Punkten je Spieltag von selbst eng).
(b) Halbzeitbericht in der Pause: Tabelle, Rennen, Vorstand-Zwischenstand, Sponsor-Zwischenstand, bester und
schlechtester Kaderteil, „das brauchst du in der Rückrunde“. (c) Vor jedem Spieltag ein Satz zum Einsatz: „Sieg heute =
Aufstiegsplatz“, „Direktduell gegen den Tabellennachbarn“.

### 3.6 Das Saisonende ist Verwaltung statt Höhepunkt — Lücke, M (Mockup nötig)

**Beleg.** `FoundationSeasonFinalePanel.tsx` ist das alte Panel (Fahrplan Nr. 9: kein Mockup). Die Kette laut
`abnahme-saison-19-11.md`: „Abrechnung buchen → Verträge öffnen → Saisonwechsel prüfen → Neue Saison starten“. Chris,
22.08.: „es müsste irgendwie noch mehr eigene Team-Highlights geben, wenn man in die neue Season kommt … Spotlight“;
08.08.: keine Medaillen nach Saison 1; 14.08.: Auszeichnungen (MVP, All-Stars je Achse, Most Improved) mit Icons im Profil.

**Problem.** Der Moment, an dem zwanzig Spieltage Arbeit belohnt werden, besteht aus vier Buchungsknöpfen. Ohne
Abschluss fehlt der Grund, die nächste Saison anzufangen.

**Vorschlag.** Saisonende als geführte Sendung in fünf Tafeln: Endstand mit Auf-/Abstieg → Auszeichnungen (Liga und
eigenes Team) → Vorstand und Sponsor rechnen ab (Ziele, Vertrauen, Budget der nächsten Saison) → Entwicklung des eigenen
Kaders (wer hat sich verbessert, wer hat die Decke erreicht) → Verträge und Fenster. Die Daten existieren fast alle; es
fehlt die Bühne.

### 3.7 Über mehrere Saisons fehlt ein Motor, der die Liga bewegt — Verbesserungsidee, L (Grundsatzfrage)

**Beleg.** Chris, 18.11.: kein Alter (`training-modern-18-11.md` 7a). Der Draft ist der Kaderaufbau von Saison 1; danach
gibt es das Fenster vor der Saison mit einem Spielerpool, keinen Handel zwischen Teams und keinen Handel in der Saison
(`transferfenster-gemeinsam-18-11.md`). Training bringt im Schwerpunkt im Median +2,4 je Saison, Rohdiamanten bis +7,7
(`training-je-spieltag-18-11.md`). **Prüfen:** im Code wurde kein Weg gefunden, auf dem neue Spieler in die Welt kommen
oder alte sie verlassen.

**Problem.** Ohne Abgang und Zugang nähern sich alle Spieler ihrer Decke, die Kader erstarren, und ab Saison 3 oder 4 ist
die Rangfolge der Teams weitgehend fest. Das zweite Draft-Erlebnis — für viele der beste Moment des Spiels — kommt nie.

**Vorschlag (zur Entscheidung, Frage 3).** Ein jährlicher kleiner Nachwuchs-Draft vor dem Fenster: schwächere Teams
picken zuerst (hält die Liga offen, belohnt Scouting), dazu ein sanfter Abgang ohne Alter (Karriereende nach einer Zahl
von Saisons oder Einsätzen, oder Verschleiß der Decke). Neue Spieler brauchen Portrait und Figur: **freigabepflichtig**
(PixelLab-Sperre für neue Charaktere; frei sind nur Figuren des eigenen Kaders).

### 3.8 Für drei Menschen fehlt das Gemeinsame — Lücke und Idee, S–L

**Beleg.** `mehrspieler-delegation-18-11.md`: ein Raum kennt Host plus **einen** Gast (M10) und wartet auch auf Schritte,
die ein Mensch delegiert hat (M11) — beide dort als offen geführt, **prüfen**. Im Code findet sich kein Manager-Vergleich
und keine Kennzeichnung direkter Duelle zwischen Menschen. „Anstupsen“ ist im Inbox-Entwurf vorgesehen. Chris, 14.08.:
„Wenn man mehrere Teams spielt und Lineup speichert, wird jedes Mal neu berechnet?“

**Problem.** Die Mechanik ist mehrspielerfähig, das Erlebnis ist es noch nicht: jeder sieht sein Team, niemand sieht den
anderen. Rivalität entsteht aus Vergleich und aus direkten Duellen, die man zusammen ansieht.

**Vorschlag.** (a) M10/M11 schließen, bevor Ramona dazukommt (Lücke, M–L). (b) Manager-Leiste auf der Startseite: je
Mensch Rang, Punkte, Serie, „bereit / stellt auf / abwesend, KI übernimmt“ (S). (c) Direktduelle im Spielplan und in der
Einsatzliste als Derby markieren und in der Arena zuerst zeigen (S). (d) Nach dem Spieltag ein Satz zum Mitspieler:
„Franky verliert Hockey 3 : 7 und fällt auf Platz 5“ (S). (e) Reihenfolge im Fenster klären, wenn zwei Menschen
denselben Spieler wollen (Frage 4).

### 3.9 Vorstandsziele wirken früh „verfehlt“ und teils unerreichbar — Fehler/Lücke, M

**Beleg.** Startseite, Spieltag 7 (`startseite-neu-18-11/app-mitte-1920x1080.png`): „Board-Ziel verfehlt: Cash-Reserve
von 17,5 M halten · aktuell 7,1“ und „Formkarten-Ausbeute: Ligarang in den oberen …“; unter dem Hauptknopf steht
„Mindestens ein Board-Ziel ist verfehlt“. Meldungen: zwei widersprüchliche Rangziele (31.07.), Entwicklungsziel mit 20
Spielern und +6 Marktwert unerreichbar (19.08.), erfülltes Gebäudeziel nicht als erledigt gezeigt (19.08.). Der
Office-Neubau vom 21.11. prüft Widersprüche bei der Vergabe.

**Problem.** Ein Ziel, das nach einem Drittel der Saison endgültig verloren ist, motiviert nicht mehr; ein Ziel, das
niemand erreichen kann, ist eine Strafe mit Verzögerung.

**Vorschlag.** (a) Status in drei Stufen bis zum Stichtag: auf Kurs / gefährdet / verfehlt erst am Ende; Haltungsziele
(Kasse halten) werden am Stichtag oder als Anteil der Spieltage gemessen. (b) Jeder Zieltyp bekommt einen Messlauf mit 32
KI-Teams; ein Ziel, das unter etwa 25 % oder über 80 % der Teams erfüllen, ist falsch geeicht. (c) Jedes Ziel nennt den
Hebel („so erreichst du es“) und springt dorthin.

### 3.10 Verletzungen sind häufig und kurz — Rauschen statt Drama — Verbesserungsidee, M (Wertung, Freigabe)

**Beleg.** `saisonpause-21-11.md`: „Jede Verletzung dauert in dieser Engine genau einen Spieltag“; Korridor 150–200 je
Saison, also fünf bis sechs je Team. In der Aufnahme „Nach dem Spieltag“ sind fünf von elf Spielern verletzt. Chris,
10.08.: „zu einfach, auch mit 9 Spielern Verletzungen zu vermeiden“; 14.08.: 34 Verletzungen an einem Spieltag. Der
Inbox-Entwurf zeigt bereits einen „Rückkehr-Spieltag“.

**Problem.** Eine Verletzung, die immer genau einen Spieltag kostet, ist eine Steuer auf Vollgas, kein Rückschlag mit
Geschichte. Es gibt kein „unser Star fehlt drei Wochen, wer springt ein“, und kein Comeback.

**Vorschlag (zur Entscheidung, Frage 5).** Bei gleicher Gesamt-Ausfallzeit weniger, dafür gestaffelte Verletzungen (ein
bis drei Spieltage, selten länger), Schwere aus Erschöpfung und Einsatzstufe. Das gibt dem Reha-Zentrum einen Zweck
(Meldung 04.08.: Gebäude brauchen einen richtigen Zweck) und der Kaderbreite einen Wert.

### 3.11 Scouting-Nebel und exakte Werte widersprechen sich — Verbesserungsidee, M

**Beleg.** Vorgabe: Marktwert immer exakt. `ki-nebel-21-11.md`: „Bewusst exakt: die vier Achsen-Summen, Marktwert und
Gehalt.“ Meldung 19.11.: im Draft fehlen Attributbereiche, Filter greifen deshalb nicht.

**Problem.** Wer Marktwert, Gehalt und vier Achsen-Summen exakt sieht, kennt die Qualität eines Spielers schon recht
genau; der Nebel verdeckt dann nur die Verteilung auf einzelne Attribute. Scouting-Gebäude und Scouting-Entscheidungen
verlieren ihren Wert.

**Vorschlag.** Marktwert bleibt exakt (Vorgabe). Scouting deckt das auf, was der Marktwert **nicht** verrät: Decke und
Potenzial, Resistenz je Belastungsart, Eigenwilligkeit in Verhandlungen, Team-Fit, Trainierbarkeit in eine
Ziel-Disziplin. Dann kauft man mit Scouting nicht „bessere Zahlen“, sondern weniger Risiko.

### 3.12 Jede Disziplin zählt gleich und kommt nur zweimal — Identität wird nicht belohnt — Verbesserungsidee, S–M

**Beleg.** 20 Disziplinen, je zwei Auftritte je Saison, je Duell 2/1/0. Die Startseite zeigt schon den Kaderstärke-Rang
je Disziplin.

**Problem.** Die Mechanik belohnt Breite gleichmäßig. Ein Kader, der in drei Disziplinen überragt, bekommt dafür nichts
Eigenes — „mehrere Wege zum Erfolg“ gilt für Spieler, noch nicht für Vereine.

**Vorschlag.** Disziplin-Wimpel: das beste Team je Disziplin und Liga über die Saison (Duellpunkte, dann Verhältnis)
bekommt einen Wimpel in Teamprofil und Historie, eine kleine Prämie und zählt für passende Vorstands- und Sponsorziele
(„hole zwei Wimpel im Bereich POW“). Kostet keine Wertungsänderung.

### 3.13 Erklärung hinkt den Mechaniken hinterher — Fehler/Lücke, S–M

**Beleg.** `lib/ui/game-encyclopedia.ts` hat keinen Eintrag zu Duellpunkten, Kaderstärke, Resistenz, Auf-/Abstieg,
Vorstands-Freigabe als Quote, Ergebnisskala, Farbregel oder Halbautomatik, führt aber noch XP, Setpoints, Bracket und
Powers; der Eintrag „Punkte“ beschreibt die alte Rang-Punkte-Wertung. Schrittnamen im Ablauf mischen Sprachen:
„Season-Briefing lesen“, „Matchday 1 starten“, „Reveal laufen lassen“, „Facilities prüfen“. In der Einsatzliste stehen
„FREMD ½“, „Schraffur = Unsicherheit der Schätzung“ und „der Motor nimmt ihn nur bei voller, eindeutiger Besetzung“.
Ein geführter Einstieg wurde im Code nicht gefunden.

**Problem.** Chris kennt die Begriffe, weil er sie mitentwickelt hat. Franky und Ramona nicht.

**Vorschlag.** (a) Lexikon auf den Stand der Mechaniken bringen, alte Einträge raus (S). (b) Schrittnamen und
Kurzbezeichnungen einheitlich deutsch, Motor-Sprache aus den Hinweisen entfernen (S). (c) „Erste Saison“-Begleiter im
Taktgeber-Aufklapper: je Schritt ein Satz, **warum** er wichtig ist, abschaltbar (M). (d) Ein Blatt „So gewinnst du
einen Spieltag“ mit fünf Regeln (Eignung, Platz, Belastung, Karten, Captain).

### 3.14 Meldungen zu Form und Moral wirken teils unplausibel — Fehler/Lücke, S (prüfen)

**Beleg.** Aufnahme „Nach dem Spieltag“ vom 18.11.: ein Team auf Rang 13 von 16 mit 4-1-7 zeigt bei fast allen Spielern
„Team spielt um Titel/Meisterschaft +12“; Zeilen „Verletzt: 10 Punkte Abzug auf die Form“ stehen neben positiven Werten
(+11, +10). CLAUDE.md: Anzeigen dürfen eine Verletzung nicht als bloßen Formabzug darstellen. **Prüfen**, ob das seit dem
18.11. behoben ist.

**Problem.** Ein Grund, der sichtbar nicht stimmt, entwertet auch die richtigen Gründe.

**Vorschlag.** Moral-Gründe an die Liga-Lage binden (Titel, Aufstieg, Mittelfeld, Abstieg je Liga), den stärksten Grund
mit Vorzeichen passend zum gezeigten Wert wählen, Verletzung als „fehlt an Spieltag N“ zeigen.

### 3.15 Die Startseite spricht fast nur in Warnungen — Verbesserungsidee, S

**Beleg.** Dieselbe Aufnahme: das Feld „Entscheidungen“ besteht aus zwei roten und einer gelben Vorstandszeile, darunter
zwei Hinweise; der Fußstreifen meldet zwei Niederlagen.

**Problem.** Ein Team im unteren Drittel bekommt jeden Spieltag bestätigt, dass es schlecht läuft — und keinen Anlass zur
Freude, obwohl es ihn gibt (Tsubaki Cleaning: Leistung 65 gegen erwartete 39).

**Vorschlag.** Ein fester Platz für das Beste des letzten Spieltags aus Sicht des eigenen Teams: Leistung über Erwartung,
Serie, erster Sieg in einer Disziplin, Trainingssprung, Rang-Gewinn. Entscheidungen bleiben, bekommen aber ein
Gegengewicht.

### 3.16 Finanzen sind in der Saison Zuschauersache — Verbesserungsidee, S–M

**Beleg.** Kein Handel in der Saison; Finanzen je Spieltag werden seit 22.11. gebucht (`finanzen-je-spieltag-22-11.md`);
Prämien und Verlängerung in der Saison sind neu (`office-vorstand-21-11.md`, `verlaengerung-in-saison-21-11.md`).

**Problem.** Zwischen Spieltag 1 und 20 gab es bisher keine Geldentscheidung mit sportlicher Folge. Die neuen Hebel
(Siegprämie, Verlängerung, Gebäude, Vorstandsgespräch) ändern das, wenn ihre Wirkung sichtbar wird.

**Vorschlag.** Jeder Geldhebel zeigt seine sportliche Folge am Ort der Entscheidung und danach im Spieltagsbericht:
Siegprämie → Moral der Betroffenen, Heimsieg → Einnahmen und Fan-Stimmung, Gebäude → Erholung oder Trainingszuwachs je
Spieltag. Eine Zeile „dieser Spieltag: +X C“ auf der Startseite.

---

## 4. Top 5 — wenig Aufwand, viel Wirkung

| # | Vorschlag | Befund | Aufwand | Warum zuerst |
|---|---|---|---|---|
| 1 | **„Deine Entscheidungen“ in Nach dem Spieltag:** erwartet → gespielt, zerlegt nach Karte, Einsatzstufe, Form, Erschöpfung | 3.4 | S–M | Schließt die Kernschleife; macht jede bestehende Mechanik spürbar, ohne eine neue zu bauen |
| 2 | **Drei Rennen je Liga (Titel, Aufstieg, Abstieg) auf Duellpunkten, dazu Halbzeitbericht in der Pause** | 3.5 | S–M | Gibt 20 Spieltagen einen Bogen; behebt zugleich die veraltete Obergrenze im Titelrennen |
| 3 | **Lexikon und Sprache nachziehen**, Motor-Jargon raus, ein „Warum“-Satz je Schritt im Taktgeber | 3.13 | S | Voraussetzung dafür, dass Franky und Ramona ohne Chris spielen können |
| 4 | **Manager-Leiste und Derby-Marke** für die Menschen im Spielstand | 3.8 b–d | S | Macht aus drei Einzelspielen ein gemeinsames; reine Anzeige |
| 5 | **Vorstandsziele: „auf Kurs / gefährdet“ statt früh „verfehlt“, dazu ein Platz für das Beste des Spieltags** | 3.9 a, 3.15 | S | Ändert den Ton der meistbesuchten Seite von Mahnung zu Lage |

Als sechster Punkt, wenn Platz ist: benannte Aufstellungspläne hinter „Optimieren“ (3.3, kurz, M).

---

## 5. Größere Ideen für später

| # | Idee | Befund | Mockup nötig? | Hinweis |
|---|---|---|---|---|
| 1 | **Spielweisen für alle Disziplinen** (Verhalten, nicht Stärke) | 3.3 | ja | Wertungsrelevant: rho- und Pp-Abnahme je Vorlage, Opus-Review, neue Fingerabdruck-Zeilen |
| 2 | **Saisonende als Sendung** mit Auszeichnungen, Abrechnung, Entwicklung, Fenster | 3.6 | ja (Fahrplan Nr. 9 fehlt ohnehin) | Award-Icons im Spielerprofil und Trophäenschrank gleich mitdenken |
| 3 | **Nachwuchs-Draft je Saison und sanfter Abgang** | 3.7 | ja, plus Grundsatzentscheidung | Neue Spieler brauchen Portrait und Figur: **freigabepflichtig** |
| 4 | **Disziplin-Wimpel und Vereinsidentität** (Rekorde je Disziplin, Wimpel in Historie, passende Ziele) | 3.12 | klein, als Teil von Teamprofil/Historie | Keine Wertungsänderung |
| 5 | **Spielabend-Modus für drei:** gemeinsame Sendung der Direktduelle, Tempo-Vorwahl, Bereit-Anzeige, Anstupsen | 3.8 | ja | Setzt M10/M11 voraus |

---

## 6. Offene Fragen an Chris

1. **Wie lange soll ein Spieltag dauern, und wie viel einer Saison soll an einem Abend zu schaffen sein?** Davon hängt
   ab, wie viele Halte der Ablauf haben darf und wie viel Arena gezeigt wird.
2. **Bleibt die Saison ganz ohne Kaderbewegung, oder soll die Pause nach Spieltag 10 ein kleines Fenster bekommen**
   (z. B. ein Zugang und ein Abgang je Team)? Das wäre der stärkste Hebel für Comebacks, widerspricht aber der
   Entscheidung vom 18.11.
3. **Wie soll die Welt über fünf und mehr Saisons in Bewegung bleiben, wenn es kein Alter gibt?** Jährlicher
   Nachwuchs-Draft, Karriereende nach Einsätzen, sinkende Decke — oder bewusst eine feste Besetzung?
4. **Spielen die Menschen in derselben Liga, und was gilt im Fenster, wenn zwei denselben Spieler wollen?** Wer zuerst
   klickt, feste Reihenfolge nach Tabellenplatz oder verdecktes Gebot?
5. **Dürfen Verletzungen seltener, dafür länger werden** (ein bis drei Spieltage bei gleicher Gesamt-Ausfallzeit)?
   Das ändert die Wertung und braucht deine Freigabe.

---

## 7. Grenzen dieser Review

- Gelesen, nicht gespielt. Aussagen zur gefühlten Dauer und zum Tempo stützen sich auf `spieltag-tempo-21-11.md` und
  Chris' Meldungen, nicht auf eigene Messung.
- Die drei App-Aufnahmen stammen vom 18. und 21.11.; einzelne Beobachtungen daraus (3.9, 3.14, 3.15) können inzwischen
  behoben sein.
- Die Punkte „kein Zugang neuer Spieler“ (3.7), „Titelrennen mit alter Obergrenze“ (3.5) und „Raum kennt nur einen Gast“
  (3.8) sind aus Code und Doku abgeleitet und als „prüfen“ markiert.
- Balance-Zahlen (rho, Pp, Finanz-Korridore) sind hier nur als Rahmen zitiert; ihre Prüfung gehört zur Technik-Review.

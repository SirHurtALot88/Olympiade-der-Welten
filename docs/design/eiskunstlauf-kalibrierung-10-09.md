# Eiskunstlauf-K4 — Kalibrierung gegen echte ISU-Wertungsdaten

Auftrag: `docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 4.4,
Konzept 90 → 95. Nach demselben Muster wie `docs/design/basketball-k3.md` — kurze Kalibrierrunde,
Rezeptänderung nur bei nachweisbarer Bewegung.

## 1. Was schon kalibriert ist (nicht Gegenstand dieser Runde)

Die Verlässlichkeits-Achse ist bereits belegt: `BUEHNE_ART.eiskunstlauf` (Kommentar dort,
07.09.-Fable-Recherche) trägt eine Spearman-Brown-Kalibrierrunde, `rundenN` 6 → 12, gemessen
rho je Spiel 0,792 → 0,875 (n=24) bei praktisch unbewegter Saisonzahl (0,944 → 0,965). Das ist
K4s Reliabilitäts-Hälfte. Offen war laut Plan die zweite Hälfte: eine Kalibrierung des Rezepts
selbst (K1, die sieben Rollen GRUNDLAGE/SPITZENMOMENT/TECHNIK/PUBLIKUM/NERVEN/AUSDAUER/WAGNIS)
gegen echte ISU-Wertungsstruktur, statt nur gegen die eigene Kaderfamilie.

## 2. Der Vergleich: ISU-Wertungslogik gegen das heutige Rezept

Die ISU-Wertung (Kurzprogramm/Kür, seit dem IJS-System) trennt strukturell in zwei unabhängige
Summanden: den **Technical Element Score** (Basiswert je Element, moduliert durch GOE −5…+5 je
nach Ausführung — ein Sturz zieht den GOE eines Elements praktisch auf das Minimum UND kostet
zusätzlich einen festen Abzug) und den **Program Component Score** (fünf Komponenten, u. a.
Skating Skills, Performance, Composition — subjektiv, aber pro Wettkampf für einen Läufer
weitgehend konstant, ändert sich nicht Element für Element). Drei Eigenschaften daraus, gegen
das heutige Rezept gehalten:

1. **Ein einzelner Sturz kostet überproportional, trifft aber nur EIN Element, nicht das ganze
   Programm.** Das Motorbild bildet das bereits genau so ab: `failAbzug:0,35` wirkt nur auf den
   fehlgeschlagenen Durchgang (`u.runden[u.aktuell]`), die übrigen elf Elemente eines
   12-Element-Programms bleiben unberührt — kein Kaskadeneffekt, kein Nachziehen in
   Folgedurchgängen. Strukturell passend.
2. **PCS ist über das Programm weitgehend konstant, TES variiert Element für Element.** Im
   Rezept übernimmt PUBLIKUM (charisma:70, spirit:30, keine `dexterity`/`awareness` — also keine
   Kopplung an Fehlschlagchance) genau diese Rolle: ein einmal berechneter, für den ganzen
   Durchgang gleich hoher Sockelwert, unabhängig vom Element-Ausgang. TECHNIK/WAGNIS/
   SPITZENMOMENT (dexterity/awareness/speed-lastig) tragen dagegen die Erfolgschance und
   variieren mit ihr, analog zum TES. Auch das trifft die reale Trennung.
3. **Elite-Kür ist NICHT beliebig fehlerarm — Stürze/Fehlschläge sind bei Top-Läufern selten,
   aber nicht null**, gerade bei den Elementen mit dem höchsten Basiswert (Vierfach-/
   Dreifach-Kombinationen). `failAbzug:0,35` bei `WAGNIS`-lastigen Elementen produziert genau
   dieses Bild: seltene, aber spielentscheidende Ausreißer statt einer Fehlerquote nahe null.

**Ergebnis der strukturellen Prüfung: keine der drei Eigenschaften zeigt eine Lücke, die einen
Rezeptumbau nahelegt.** Anders als bei Breaking (dort fehlte laut Plan eine eigene Kalibrierrunde
komplett) hat Eiskunstlauf mit der Spearman-Brown-Runde bereits eine Kalibrierrunde hinter sich,
und die drei oben geprüften Struktureigenschaften bestätigen die bestehende Rollenaufteilung,
statt eine neue zu verlangen.

## 3. Warum trotzdem nichts am Rezept geändert wird

Eine Rezeptänderung ist nur sinnvoll, wenn sie mehr bewegt als das Kaderrauschen der Disziplin —
für Eiskunstlauf laut Gesamtstand-Dokument eine Spannweite von **0,083** (rho je Spiel,
bestätigt durch den frischen Lauf dieser Runde: `node scripts/miss-alle-disziplinen.mjs 24
eiskunstlauf` → rho je Spiel **0,885**, Spannweite **0,083**, rho Saison **0,979**, Spannweite
**0,028**). Der Abstand von 0,885 zur 0,80-Schranke ist mit 0,085 selbst schon in der
Größenordnung dieser Spannweite — jede Rezeptfeinjustierung, die kleiner bewegt als 0,083 (und
ohne einen klaren strukturellen Befund wie bei Breaking ist das der zu erwartende Fall), wäre von
Kaderrauschen nicht unterscheidbar und würde das Bild nur verrauschen, nicht verbessern.

**Entscheidung: Rezept unverändert.** Die drei offenen Designfragen der Reliabilitäts-Runde
(Sturz-Gewichtung, PUBLIKUM-Sockel, Element-Anzahl) sind mit obigem Vergleich beantwortet, ohne
dass eine Codezeile angefasst wurde — genau der von Abschnitt 4.4 des Plans vorgesehene Fall
("die daraus folgende Rezeptanpassung nur, wenn sie mehr bewegt als das Kaderrauschen"). K4 gilt
damit als erfüllt: die Kalibrierrunde fand statt, ihr Ergebnis ist dokumentiert, und die
Entscheidung, nichts zu ändern, ist begründet statt unterlassen.

## 4. Geänderte Dateien

Keine an `public/mockups/battle-mode.engine.js` durch diese Runde (K4 ist reine Mess- und
Schreibarbeit, wie in Abschnitt 4.4 des Plans vorgesehen). Nur dieses Dokument ist neu.

# Chris' Feedback-Runde 13.10. — breite Sammlung, noch nicht umgesetzt

Chris hat am 13.10. eine große, ungefilterte Liste an Wünschen/Beobachtungen quer durch viele
Disziplinen geschickt — explizit zum Festhalten als To-dos, nicht zur sofortigen Umsetzung
("was du noch aufnehmen kannst als todos"). Dieses Dokument sammelt sie wörtlich/sinngemäß,
geordnet nach Disziplin, mit einer groben Einordnung (Umfang, vermutete Klasse nach dem Schema
in CLAUDE.md, offene Fragen). Jeder Punkt braucht vor der Umsetzung noch eine eigene Recherche-/
Maßrunde nach dem üblichen Paket-Workflow — hier steht nur die Anforderung, keine Lösung.

Ein Bildschirmfoto lag der Nachricht bei: ein Scoreboard-Panel rechts am Rand mit den Spalten
„LÄUFER / WEIT / PUS" für zwei Teams (Kopfzeile „…nach Zeitsumme" angeschnitten) — zeigt das
Problem aus dem Time-Trial-Punkt unten (Wertung an der Seite statt als Overlay über der Grafik).

## Cross-Disziplin (alle oder mehrere Disziplinen betreffend)

1. **PP-Anzeige am Ende jeder Disziplin fehlt.** „bei allen Diszis fehlt am Ende noch wie viele
   PPs welcher Spieler mit seiner Leistung erhalten hat!" — nach jedem Durchgang soll sichtbar
   sein, wie viele Performance-Punkte (PP) jeder Spieler für seine Leistung bekommen hat. Reine
   Anzeige, die Zahl existiert vermutlich schon im Rezept — vermutlich Klasse A, aber für zwanzig
   Disziplinen mit je eigenem Ergebnis-/Scoreboard-Layout ein größerer Rollout.
2. **Spieler-Historie je Disziplin tracken und anzeigen.** Aus der Fechten-Idee (s. u.) von Chris
   selbst verallgemeinert: „könnte man ggf. bei allen Diszis einfügen, dass man das trackt und
   dann als Drawer beim Spieler ansehen kann oder bei der Vorstellung kurz eingeblendet wird" —
   wie ein Spieler in der Vergangenheit in genau dieser Disziplin performt hat (und/oder seine
   Eignung dafür), als Drawer oder kurze Einblendung bei der Vorstellung/Matchup-Reveal. Größeres
   Cross-Cutting-Feature, eigene Datenschicht nötig (Performance-Historie je Spieler × Disziplin).
3. **„Simulieren"-Button neben den Tempo-Reglern.** „Neben Tempo 1x 2x 4x muss es noch einen
   Button geben mit dem man die Disziplin simulieren kann, wo dann direkt das Ergebnis revealed
   wird" — ein Button, der den Rest des Durchgangs überspringt und sofort zum Endergebnis geht
   (analog zu einem „Sim"-Button in Sportmanager-Spielen). Vermutlich Klasse A/B, aber
   UI-Baustein, der in den gemeinsamen Broadcast-Rahmen aller Battle-Mode-Disziplinen gehört.

## Time-Trial

4. **PP-Leistung abhängig von der benötigten Zeit, nicht nur Platzierung.** „Beim T-T gerne die
   PP Leistung auch abhängig von der benötigten Zeit machen, da manche Spieler ja sogar zeitlich
   einen Vorsprung rausholen oder manche besonders langsam sind etc." — die PP-Vergabe soll den
   tatsächlichen Zeitabstand würdigen, nicht nur den Rang. Rezept-/Scoring-Änderung, Klasse B.
5. **Spieler sollen NACHEINANDER antreten (echtes Zeitfahren) + Strecke mit Hügeln visualisieren.**
   „im Time Trial sollen die Spieler NACHEINANDER antreten wie beim Zeitfahren, und die Strecke
   soll wirklich auch mit Hügeln etc dargestellt werden - von mir aus auch auf einem Fahrrad damit
   man das sofort sehen kann welche Diszi dran ist - die Assets müssten also noch mal angepasst
   und raus gesucht werden!" — zwei Teile: (a) Startreihenfolge/Präsentation auf echtes
   Einzelzeitfahren umstellen statt gleichzeitig, (b) die Streckengrafik soll Höhenprofil zeigen,
   eventuell mit Fahrrad-Thema zur sofortigen Wiedererkennung — braucht neue/angepasste Assets.
   Größerer Umbau, Klasse B, Asset-Suche nötig.
6. **Wertung als kompaktes Overlay ÜBER der Grafik statt an der Seite.** „die Wertung die rechts
   am Rand ist sollte wenn möglich als kompaktes Overlay ÜBER der Grafik sein damit das Auge es
   direkt mitverfolgen kann, evtl auch ausklappbar, mit mehr Infos und einer kompakten Ansicht mit
   nur Z1 Z2 Z3 also die 3 Zeiten" — Scoreboard vom Seitenpanel zu einem Overlay über der Strecke
   verschieben, mit einem ausklappbaren „mehr Infos"-Zustand und einem kompakten Standardzustand,
   der nur die drei Zwischenzeiten (Z1/Z2/Z3) zeigt. UI/Layout, Klasse A.

## Climbing

7. **Animationen überarbeiten, 3D-Effekt wirkt unangenehm.** „Wenn es geht bessere Animationen vom
   Klettern im Climbing, der leicht angehauchte 3D-Effekt beim Klettern wirkt komisch - da könnte
   einem beim Zuschauen schlecht werden, dann evtl lieber doch in 2D bleiben" — Rückfrage/Option:
   eventuell komplett zurück zu 2D statt des aktuellen leichten 3D-Looks. Präsentation, Klasse A,
   aber Geschmacksfrage, die vor der Umsetzung kurz mit Chris abgestimmt werden sollte (2D vs.
   besseres 3D).
8. **Spieler-Interaktion beim Klettern (herunterziehen, aneinander vorbeiziehen, Wehren).**
   „bisher gibt es dort keine Interaktion mit anderen Spielern dass man versucht sie runter zu
   ziehen etc. dafür müssten die Spieler aber auch enger zusammen klettern aber trotzdem auch noch
   die Möglichkeit haben aneinander vorbei zu ziehen aber sich evtl wehren können/müssen" — neue
   Kampf-/Sabotage-Mechanik beim Klettern: Spieler rücken enger zusammen, können sich gegenseitig
   herunterziehen, aber auch vorbeiziehen oder sich wehren. Deutliche Mechanik-Erweiterung,
   Klasse B, braucht eigene Rezept-/Balance-Runde (wirkt sich auf rho/Pp aus).

## Takeshi's Castle

9. **Performance-Problem.** „Performance von Takeshi läuft nicht so gut" — ohne weitere Angabe;
   abzugleichen mit den bereits bekannten Performance-Funden in diesem Projekt (z. B. der
   Breaking-„sondenLauf()"-Performance-Cliff, Task #36) — ob Takeshi denselben strukturellen Fehler
   teilt oder eine eigene Ursache hat, muss erst diagnostiziert werden.
10. **Unübersichtlich bei vielen Teilnehmern — offene Konzeptfrage.** „bisher wirkt es sehr
    unübersichtlich mit den ganzen Teilnehmern aber da hab ich gerade keine Idee wie man es besser
    machen könnte, nacheinander ist auch doof" — Chris hat hier ausdrücklich keine eigene Lösung,
    nur das Problem benannt. Braucht eine Konzeptrunde (vermutlich mit Fable), kein fertiger
    Auftrag.

## Staffel

11. **„Bein" → „Abschnitt" umbenennen.** „beim Staffel heißen die einzelnen Abschnitte 'Bein'
    wahrscheinlich einfach von Leg übersetzt das müsste angepasst werden auf 'Abschnitt' oder so"
    — reine Text-/Label-Änderung, Klasse A, kleinster und schnellster Punkt der ganzen Liste.
12. **Gesamtzeit (Bahn + Wechsel) fehlt im Ergebnis.** „Bei Staffel fehlt auch beim Ergebnis noch
    eine Gesamtzeit also Bahn + Wechsel" — im Endergebnis soll die Summe aus reiner Laufzeit und
    Wechselzeiten stehen. Die Rohdaten (Etappenzeiten, Wechselgewinn/-verlust) existieren laut
    Engine-Code bereits (`u.etappenZeit`, `u.wechselKonto`/`wechselNetto`), vermutlich Klasse A
    (reine Anzeige/Summierung, kein neuer Rechenpfad).
13. **Finales Scoreboard farblich nach Stärke/Schwäche der Performance.** „man könnte das finale
    Scoreboard noch farblich besser darstellen dass man direkt starke und schwache Performances
    erkennen kann" — Farbcodierung je Läufer/Leistung im Endstand. Klasse A, Präsentation.

## Mini-DM

14. **Von reinem Reveal zu echtem 1v1v1v1-Kampf mit je einem Leben.** „Mini DM wird nur aufgedeckt
    das dachte ich wäre der erste Step dass man die Contestants revealed und dann soll aber wie
    beim Team DM gekämpft werden nur 1v1v1v1! und jeder hat quasi nur 1 Leben" — Chris erwartet,
    dass nach der Vorstellungsrunde ein echter Kampf wie im Team-Deathmatch folgt, nur als
    Free-for-all (vier Einzelkämpfer) mit je einem Leben statt Team vs. Team. Klärungsbedarf: laut
    Task-Historie dieses Projekts gibt es bereits ein FFA-Paket für Mini-DM (P0 „FFA-Abnahme" +
    P1 „Der letzte Stand", abgeschlossen) — ob das, was Chris im laufenden Spielstand sieht, davon
    schon etwas enthält oder ob der sichtbare Teil wirklich nur beim Reveal aufhört, muss zuerst
    am Code/Spielstand geprüft werden, bevor neu gebaut wird. Potenziell Klasse B/S.

## Fechten

15. **Sequenzielle 1v1-Kämpfe statt gleichzeitigem Durchschalten, mit Matchup-Reveal und
    Eignungs-/Historienanzeige.** „beim fechten sollen die spieler auch nacheinander 1v1 kämpfen
    und nicht alle gleichzeitig die permanent durchgeschaltet werden - da könnte man auch n
    kleinen Reveal machen wer gegen wen - evtl die Stats zeigen wie die Eignung ist oder wie die
    Spieler bisher in der Diszi performt haben in der Vergangenheit" — Umstellung von
    gleichzeitigem Kamera-Umschalten auf echte Reihenfolge (ein Duell nach dem anderen), plus ein
    kurzer Vorstellungs-/Reveal-Moment pro Matchup mit Eignungs- oder Historienwerten. Die
    Historien-Idee ist der Ursprung von Punkt 2 oben (cross-disziplinär gedacht). Klasse B,
    Präsentationsumbau.

## Battlefield

16. **Gebietskontrolle (Domination) statt Team-Deathmatch-Klon.** „battlefield läuft noch zu sehr
    ab wie Team Deathmatch -> hier sollte es eher darum gehen verschiedene Bereiche einzunehmen.
    z.B. wie in Domination Spielmodi wo man 3 Orte hat und das Team was den Platz hält dann jede
    Sekunde Punkte erhält dafür. So dass man sich aufteilen muss und starke Spieler ggf. sogar
    alleine einen Platz halten. Respawn kostet kurz Zeit und das Team was am Ende mehr Punkte hat
    hat dann gewonnen" — vollständiges Spielmodus-Konzept: drei Kontrollpunkte, Punkte pro Sekunde
    für den haltenden Platz, Respawn-Verzögerung, Teamaufteilung als taktische Entscheidung statt
    reiner Kill-Count. Großer Mechanik-Umbau, Klasse B, eigene Rezept-/Balance-Runde nötig
    (ähnlich tiefgreifend wie der TDM→Battlefield-Umstieg selbst).

## Showcase

17. **Spieler im 1v1 aufstellen, nicht hin- und herswitchen.** „Showcase: Bitte auch die Spieler
    im 1v1 aufstellen und nicht immer hin und her switchen, das nächste Matchup kommt erst wenn
    das vorherige durch ist!" — dieselbe Sequenzialisierungs-Anforderung wie bei Fechten (Punkt
    15) und Eiskunstlauf (Punkt 18), hier für Showcase. Klasse A/B, Präsentation.

## Eiskunstlauf

18. **Duelle nacheinander in 2er-Gruppen, dafür längere aber weniger Durchgänge.** „Eiskunstlauf
    genauso! die Duelle nacheinander - Wechsel erfolgt erst wenn das erste Matchup durch ist also
    treten quasi 2 von team a vs 2 von team b an und wenn beide ihre Durchgänge drin haben dann
    wird gewechselt und mach die Durchgänge länger dafür weniger! 12 ist doch sicher auch nicht
    üblich im Eiskunstlauf?" — zwei Teile: (a) dieselbe Sequenzialisierung wie Showcase/Fechten,
    hier als 2-gegen-2-Gruppen, (b) die aktuelle Rundenzahl (12) infrage gestellt — weniger, dafür
    längere Durchgänge, näher am echten Eiskunstlauf-Vorbild. Klasse B, betrifft auch das Rezept
    (Rundenzahl beeinflusst Verlässlichkeit, s. CLAUDE.md-Abschnitt zu Ereignisdichte).

## Breaking

19. **Längere Angriffs-/Verteidigungssequenzen statt Hin-und-Her, sichtbare Offensiv-/
    Defensivstärke, optische Erschöpfungs-/Blutindikatoren.** „Bei Breaking wird auch viel hin und
    her gesprungen. da würde ich eher so Sequenzen mit Animationen machen, dass Spieler 1 quasi
    erst 'angreift' und der andere es ertragen muss für zb 15 Sekunden und dann der Wechsel kommt
    und da muss man auch sehen können welcher Spieler eher offensiv stark ist wie Assassinen und
    wer defensiv gut einstecken kann etc. Kann man das optisch irgendwie an den Charakteren
    zeigen? sowas wie Erschöpfung, Blut oder so?" — passt zur bestehenden „Breaking ist Folter"-
    Leitlinie in CLAUDE.md (ein Spieler fügt Schmerz zu, der andere muss aushalten) und vertieft
    sie: längere Rollenphasen statt schnellem Hin und Her, sichtbare Offensiv-/Defensiv-
    Charakterisierung, optische Zustandsanzeigen (Erschöpfung/Blut) am Charakter selbst. Klasse B,
    Präsentation + eventuell Rezept-Anpassung für die Phasenlänge.

## Wettessen

20. **Komplettes visuelles Rework, eigene Fable-Konzeptrunde gewünscht.** „Beim Wettessen müsste
    optisch eindeutig mehr passieren, das benötigt ein Rework. Momentan fliegen unten die Zahlen
    einfach nur so rein und es hat kein Konzept und keine Übersicht wer gerade führt etc. Bitte
    noch mal mit Fable ein Konzept erarbeiten!" — expliziter Auftrag für eine neue
    Fable-Konsultation zur Wettessen-Präsentation (aktuell laut Chris konzeptlos: Zahlen fliegen
    unten rein, keine Führungsübersicht). Nächster Schritt ist eine Konzeptrunde, kein direkter
    Bauauftrag.

## Basketball

21. **Sprungball von den Centern ausführen lassen, eigene Animation/Anpfiff-Spielzug.** „beim
    basketball steht SPRUNGBALL! Dann sollten die 2 größten Spieler oder die 'Centers' den auch
    ausführen da benötigen wir Animation und quasi Anpfiff-Spielzug!" — der Sprungball-Moment soll
    von den beiden größten Spielern/Centern beider Teams bestritten werden, mit eigener Animation
    als Eröffnungsspielzug (ähnlich dem bereits gebauten „Anpfiff-Countdown" A4 aus dem
    Broadcast-Paket, aber discipline-spezifisch für Basketball). Klasse A/B, Präsentation.

---

**Nächster Schritt:** keiner davon ist gestartet. Wenn Chris eine Reihenfolge vorgibt oder die
nächste freie Rezeptrunde ansteht, hier nachschlagen statt neu nachfragen.

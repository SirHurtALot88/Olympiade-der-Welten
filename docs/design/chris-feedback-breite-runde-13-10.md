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

## Basketball (Fortsetzung, zweite Nachricht)

22. **Zu wenig Tempowechsel, zu wenig Passspiel, Spieler ballen sich zusammen statt sich zu
    verteilen.** „beim basketball wird zu wenig mal tempo raus genommen, gepasst, in den raum
    gelaufen usw, spieler bieten sich nicht an, alle laufen immernoch auf einem haufen sehr viel
    rum!" — ergänzt Punkt 21 (Sprungball) um eine grundsätzlichere Beobachtung zum laufenden Spiel:
    fehlendes Freilaufen/Anbieten, fehlende Tempo-Variation, Spieler bleiben zu sehr geklumpt.
    Klasse B, betrifft die Bewegungs-/Entscheidungslogik im Feldspiel-Chassis.

## Football

23. **Richtiger Kickoff mit Animation fehlt; Grundmechanik wirkt wie reines Gerangel.** „Football
    benötigt auch einen richtigen Kickoff mit Animationen etc! bisher wird da nur gerangelt, es
    geht gar nicht richtig voran, der quarterback muss ja normal den ball bekommen, die anderen
    spieler vom gegner wollen hin und die defender blocken -> da muss auch mal geworfen werden
    oder dass es diese goalkicks gibt - die kenne ich die regeln nicht! bitte anpassen" — Chris
    kennt die genauen Football-Regeln selbst nicht vollständig (meint mit „Goalkicks" vermutlich
    Punts oder Field Goals), aber der Kernpunkt ist klar: der QB soll den Snap regulär bekommen,
    Pässe sollen tatsächlich geworfen werden, Verteidiger sollen blocken statt dass alles im
    Gerangel steckenbleibt. Braucht zuerst eine Regel-/Mechanik-Recherche (ähnlich den früheren
    Football-Rezeptrunden, s. `docs/design/football-rezept-kalibrierung.md`), dann Anpassung.
    Klasse B, möglicherweise größerer Umbau der Spielzug-Engine.

## Eishockey

24. **Bully (Face-off) in der Mitte als Start fehlt; vermutlich zu wenig Passspiel.** „Eishockey
    ebenso das muss in der mitte mit dem bully anfangen! und auch dort wird wahrscheinlich mehr
    gepasst als es das bei uns wird - bitte prüfen und ggf. anpassen" — (a) jeder
    Spielabschnitt/jedes Anspiel soll mit einem Bully in der Mitte starten (wie der bereits
    gebaute Basketball-Sprungball, Punkt 21, bzw. das noch zu bauende Football-Kickoff, Punkt 23),
    (b) Passhäufigkeit gegen echtes Eishockey validieren. Klasse A/B.

## Tennis

25. **Auch nacheinander (1v1) statt Hin-und-Her-Switchen zeigen; Ballflug/Schlagvielfalt näher ans
    echte Tenniserlebnis; optische Bugs.** „tennis ist cool, bitte aber auch NACHEINANDER machen!
    also 1v1 wird gezeigt nicht immer das hin und her was du immer machst und die bälle sollen
    nicht immer in die mitte fliegen, verschiedene schläge, spielbälle etc sollen gespielt werden,
    der ball muss anders fliegen, auch mal ins aus, spieler in bewegung, mal erreichen sie den
    ball mal nicht, bitte mehr ans ECHTE tennis erlebnis anpassen! optisch auch noch einige bugs
    die gefixt werden müssen!" — dieselbe Sequenzialisierungs-Anforderung wie Fechten/Showcase/
    Eiskunstlauf (Punkte 15/17/18), hier für Tennis, plus eine eigene, umfangreichere
    Präsentations-/Ballphysik-Wunschliste (Schlagvielfalt, Ball ins Aus, variable Ballwege,
    Lauf-/Erreichbarkeits-Varianz) und unbenannte visuelle Bugs. Klasse B.

## Schach

26. **Auch 1v1 nacheinander zeigen.** „schach bitte auch im 1v1 nacheinander zeigen!" — dieselbe
    Sequenzialisierungs-Anforderung (s. Punkte 15/17/18/25) für Schach. Klasse A/B.

## Cross-Disziplin: Spieler-Historie (Konkretisierung von Punkt 2)

27. **Kampf-Spielerprofil/Laufbahn-Panel als Vorbild für alle Disziplinen, mehrere Saisons
    getrackt, speichereffizient.** Chris hängte das bestehende Kampf-Spielerprofil an (Reiter
    „SPIELERPROFIL" mit „KAMPFWERTE" links — LP/ANG/VER/TMP/AUS, Veranlagung — und „LAUFBAHN"
    rechts — Einsätze, Ausschaltungen, Ausgefallen, Verhältnis, Schaden ausgeteilt/genommen,
    Assists, Verletzungen, Spieler des Spieltags, dazu „STÄRKSTE DISZIPLINEN"; die UI trägt bereits
    den Hinweis „Laufbahn-Zahlen sind Beispiele — die Erfassung gibt es noch nicht"). Wörtlich:
    „Habe noch mal das kampf spielerprofil angehangen, sowas hätt ich gern im drawer für JEDE
    disziplin wenn das geht müsste natürlich über mehrere seasons dann getrackt werden, überlege
    mal bitte wie das speicherplatz spart aber wir trotzdem auf die Daten zugreifen können, dann
    auch im normalen season flow in seinem Spielerprofil wenn man die Diszis anklickt zb dass dann
    so ein Stat Panel einklappbar ausfährt" — konkretisiert Punkt 2 (Cross-Disziplin:
    Spieler-Historie) deutlich: (a) Vorbild ist das bestehende Kampf-Laufbahn-Panel, (b) muss
    über mehrere Saisons persistiert werden, (c) braucht ein speicherplatzschonendes Datenmodell
    (z. B. Aggregate statt Einzelereignisse — zu entscheiden), (d) Zugriffspunkt ist ein
    ausklappbares Stat-Panel im normalen Spielerprofil bei Disziplin-Klick, nicht nur ein
    Vorstellungs-Overlay. Größtes Cross-Cutting-Feature der ganzen Liste, Klasse S.

## I-Spy

28. **Spieler-Interaktion, Gedanken-/Tätigkeits-Icons, exklusive Fundorte, Zuschauer-Transparenz
    über Hinweisstärke, offener statt gezonter Raum.** „bei I Spy wäre es noch gut wenn die
    Spieler miteinander interagieren können und müssen, wenn man mit ner Lupe überm kopf sieht
    dass sie gerade analysieren oder suchen Also dass man wie so sprechblasen verschiedene Icons
    hat um zu sehen was der Spieler gerade denkt und tun will! und dass an jedem Ort wo man suchen
    kann nur 1 Spieler stehen darf, wenn ein gegner hin will muss er ihn weg schubsen oder warten
    bis der fertig ist Für den Zuschauer sollte erkennbar sein, wo die fettesten Hinweise sind
    damit man mitfiebern kann welche Geheimnisse stark sind und welche vllt ein dickes Schloss
    haben aber wenig bringen - und man müsste erkennen welcher Main Skill benötigt wird Der Raum
    sollte nicht getrennt sein und alle Spieler können sich ÜBERALL hin bewegen!" — fünf Teile:
    (a) sprechblasenartige Zustands-/Absichtsicons je Spieler (z. B. Lupe = analysiert/sucht),
    (b) Fundorte exklusiv — nur 1 Spieler gleichzeitig, Verdrängung durch Wegschubsen oder Warten,
    (c) Zuschauer sehen die Stärke/den Ertrag eines Hinweises vorab (Spannungsaufbau: dickes
    Schloss kann trotzdem wenig bringen), (d) Zuschauer sehen den benötigten Main-Skill je
    Hinweis, (e) der Raum ist aktuell offenbar in Zonen getrennt — soll stattdessen durchgängig
    begehbar sein. Mehrteilige Mechanik-Erweiterung, Klasse B, eigene Konzeptrunde sinnvoll (I-Spy
    hatte schon mehrere verworfene Mechanik-Versuche, s. Abschnitt 7 in `stand-aller-disziplinen.md`).

## Formkarten — zwei Korrektheitsfragen, beide jetzt geklärt (13.10., Code direkt verifiziert)

29. **„+4 vs +8" in der Vorschau — KEIN Bug, erwarteter Jitter.** „bei der vorschau steht, dass
    manche spieler +4 form und manche +8 form haben. das kann nicht sein! Wenn man eine +4 als
    team spielt wird das genauso berechnet wie bisher auch! also mal hat einer dann +2,6 und
    einer +5,4 oder so das geht! aber nicht mal +4 mal +8 usw" — am Code verifiziert
    (`distributePerPlayerFormShares`/`seededFormJitter`, `lib/lineups/legacy-lineup-modifiers.ts`
    Z. 872-941): jeder Spieler bekommt den flachen Kartenwert PLUS einen deterministischen
    (seed-basierten) Jitter von bewusst bis zu **±4** („Der Jitter ist bewusst NICHT zero-sum").
    Bei einer „+4"-Karte reicht die mögliche Spanne also rechnerisch von 0 bis +8 — ein Spieler
    am oberen Rand dieser Spanne zeigt eben „+8", obwohl die Karte „+4" war. Das ist exakt
    dieselbe Mechanik, die Chris selbst als in Ordnung beschreibt („+2,6 und +5,4"), nur an den
    äußeren Rändern der Spanne, die bis zu doppelt so hoch wie der Kartenwert reichen kann — kein
    zweiter, falsch vermischter Kartenwert. Falls dir die Spanne zu groß/verwirrend vorkommt, ist
    das kein Bug-Fix, sondern eine Balancing-Frage (`jitterMax` ist ein einstellbarer Parameter,
    Standard 4).
30. **Flacher Attribut-Bonus vs. gleichmäßiger Eignungs-Bonus — geklärt, echte Lücke in VIER
    Chassis bestätigt, in DREI bereits geschlossen.** „was die Attribute angeht müssten die so
    gesteigert werden dass in der Eignung eine +4 raus kommt wenn der Spieler +4 hat. Das ist
    nicht das gleiche wie alle Attribute +4 […] Das müsstest du mal messen!" — Chris' Sorge ist
    berechtigt, aber nur für einen Teil der Disziplinen, und steht im Code bereits explizit als
    offene Frage an ihn (`battle-mode.engine.js`, Kommentar bei der Staffel-Kopplung: „Spurt/
    Zeitfahren behalten ihre alte Kopplung 'Rezept gibt Form UND Menge, Eignung nur Anzeige',
    das ist eine offene Frage an Chris (Bericht Teil 6, Frage 1)", plus ein zweiter, ausführlicher
    Kommentarblock „ZWEI KOPPLUNGEN, BEIDE VERTRETBAR" direkt daneben — ebenda bei `bauBuehne`
    und `bauFeldspiel`: „DIESELBE LUECKE WIE IM FELDSPIEL, hier nie geschlossen").
    **Bereits reconciled (Simulation liefert nachweislich einen zur Eignung proportionalen
    Effekt):** Arena/TDM (`aufEignung()` skaliert die Kampfwerte proportional zur Eignung — der
    Mechanismus, der extra dafür gebaut wurde, um genau diese Doppelzählung zu vermeiden),
    Staffel und Takeshi's Castle (beide haben ein eigenes `f=eigW/m`-Rescaling, siehe
    `art.staffel`/`art.mengeAusEignung` im Code — für Staffel Teil der O7-Pp-Rezeptrunde,
    für Takeshi aus der Recherche vom 05.09. mit echter Messung: 0,697→0,689 **wenn man naiv
    koppelt** (schlechter!), aber 0,896 mit der richtigen Kopplungsart plus nachgezogenen
    Budgets, s. `docs/design/staffel-offene-fragen-plus-takeshis-castle-05-09.md`).
    **Nicht reconciled, Chris' Sorge trifft hier zu:** Feldspiel (alle Mannschaftssport-
    Disziplinen) und Bühne (alle sieben Bühnen-Disziplinen) — ihre Durchgangspunkte entstehen
    laut Code-Kommentar „aus den Sub-Skills (R2), nicht aus `eig`"; Zeitfahren und Climbing —
    dieselbe alte Kopplung wie Spurt vor seinem Hindernislauf-Umbau. **Für Spurt selbst
    unklar:** sein rho-Problem wurde 2026-09 durch einen Mechanik-Umbau gelöst (nicht durch
    diese Kopplung), das sagt aber nichts darüber, ob speziell der Formkarten-Anteil dort
    matrixtreu ankommt — nie isoliert gemessen.
    **Wichtig, am Code nachvollzogen:** der Formbonus geht nicht einfach „verloren" in diesen vier
    Chassis — er fließt über `mitAufschlag()` tatsächlich in die Rohattribute, die die Simulation
    liest, nur eben nicht über eine zur Eignung proportionale Skalierung, sondern direkt auf eine
    disziplinspezifische Teilmenge der Attribute (`betroffeneAttribute()`). Ob diese Teilmenge im
    Ergebnis näherungsweise matrixtreu ist oder nicht, lässt sich nicht aus dem Code allein sagen
    — das ist der Teil, der laut Projekt-Konvention (nie eine quantitative Behauptung nur aus dem
    Code ableiten) tatsächlich **gemessen** werden muss: `messe-arena-einfluss.mjs` je Disziplin,
    mit isoliertem Formkarten-Delta (ein Spieler +4, sonst alles gleich), für Feldspiel, Bühne,
    Zeitfahren, Climbing und zum Vergleich Spurt — gegen Arena/Staffel/Takeshi als bereits
    bestätigt funktionierende Referenz. **Das ist eine Design-Entscheidung, keine reine
    Bugfrage** — der Code behandelt die fehlende Kopplung ausdrücklich NICHT als Fehler
    („Das ist kein Fehler: die Eignung ist selbst eine gewichtete Summe derselben Attribute. Wer
    sie [...] zusätzlich anlegte, zählte sie doppelt."), sondern als bewusste Alternative mit
    einer eigenen Konsequenz: auf der Bahn/im Feldspiel/auf der Bühne entscheidet dann nicht der
    Disziplinrang (Eignung), sondern nur die Rohattribute, aus denen er entsteht — zwei Spieler
    mit identischen Attributen performen dort gleich, selbst wenn einer in der Diszi-Eignung auf
    Rang 6 und der andere auf Rang 20 steht. Chris muss entscheiden, ob er das für Feldspiel/
    Bühne/Zeitfahren/Climbing genauso will wie für Arena/Staffel/Takeshi, oder ob der aktuelle
    Unterschied bewusst bleibt.

---

**Nächster Schritt:** keiner davon ist gestartet. Punkt 30 (Formkarten-Kopplung) ist die einzige
Design-Entscheidung in dieser Liste, die Chris' Wahl zwischen zwei vertretbaren Optionen braucht,
nicht nur Umsetzung — s. Chat vom 13.10. Wenn Chris eine Reihenfolge vorgibt oder die nächste
freie Rezeptrunde ansteht, hier nachschlagen statt neu nachfragen.

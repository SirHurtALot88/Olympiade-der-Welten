// ===================================================================================
// GEMEINSAMER HELFER FUER PLAYWRIGHT-SKRIPTE, DIE DIE ARENA PER #play STARTEN.
//
// Seit dem Sendungsrahmen-Paket (07.10., Klasse T, von Chris freigegeben, docs/design/
// broadcast-d7-a4-fable-empfehlung-02-10.md) hat die Arena drei Wandzeit-Bausteine:
//   A4  Anpfiff-Countdown: nach dem ERSTEN #play-Klick eines Spiels laeuft bei Tempo 1× ein
//       1,5-3 s langes Startritual, BEVOR `running` wahr wird.
//   D7  Finale in Echtzeit: in den letzten 30 Zuschau-Sekunden eines knappen Feldspiels
//       faellt das wirksame Tempo von 2×/4× auf 1×.
//   Nachlauf: das Endstand-Overlay erscheint 3,5 s nach dem Schlusspfiff (Bahn/Buehne/
//       Feldspiel), nicht mehr im selben Frame.
//
// Ein Skript, das nach #play FEST wartet, um den Spielstart abzuwarten, misst seit A4 den
// Countdown mit. Zwei Wege, beide ausdruecklich (nie automatisch ueber navigator.webdriver,
// sonst saehen Agenten-Screenshots etwas anderes als Chris):
//   1. warteAufAnpfiff(seite) -- wartet auf den vom Motor ausgewiesenen Zustand "laeuft und
//      erster Tick ist durch" (window.__arena.anpfiffStatus()). Funktioniert mit UND ohne
//      Countdown; der Countdown bleibt sichtbar, wenn man ihn sehen will.
//   2. sendungsrahmenAus(seite, {...}) -- schaltet die Bausteine fuer diese Seite ab (nicht in
//      localStorage), fuer Sonden, die das alte, sofortige Verhalten brauchen (feste Spielzeit
//      nach dem Klick, Endstand im selben Frame wie `done`, 4× ohne Finale-Bremse).
// ===================================================================================

// Wartet, bis das Spiel nach einem #play-Klick wirklich laeuft: `running` ist wahr UND
// mindestens ein loop()-Tick ist gelaufen UND der A3-Stinger-Wischer (der das Ende des
// Countdowns ueberdeckt, 450 ms) ist wieder weg -- oder das Spiel ist schon vorbei.
// Ueberbrueckt einen laufenden Anpfiff-Countdown (bis zu 3 s bei 1×) automatisch.
export async function warteAufAnpfiff(seite, { timeout = 15000 } = {}) {
  await seite.waitForFunction(() => {
    const a = window.__arena;
    if (!a || typeof a.anpfiffStatus !== "function") return true; // aeltere Engine: kein Countdown
    const s = a.anpfiffStatus();
    return s.done || (s.laeuft && s.ticks > 0 && !s.stinger);
  }, null, { timeout, polling: 50 });
}

// Schaltet die Wandzeit-Bausteine fuer DIESE Seite ab. Standard: alle drei aus. Einzelne
// gezielt an lassen: sendungsrahmenAus(seite, { countdown: false }) laesst den Countdown an.
// Muss NACH dem Laden der Seite (window.__arena vorhanden) und VOR #play laufen.
export async function sendungsrahmenAus(seite, { countdown = true, finale = true, nachlauf = true } = {}) {
  return seite.evaluate(({ countdown, finale, nachlauf }) => {
    const a = window.__arena;
    if (!a) return null;
    if (countdown && a.anpfiffCountdown) a.anpfiffCountdown(false);
    if (finale && a.finaleEchtzeit) a.finaleEchtzeit(false);
    if (nachlauf && a.endstandNachlauf) a.endstandNachlauf(false);
    return {
      anpfiffCountdown: a.anpfiffCountdown ? a.anpfiffCountdown() : null,
      finaleEchtzeit: a.finaleEchtzeit ? a.finaleEchtzeit() : null,
      endstandNachlauf: a.endstandNachlauf ? a.endstandNachlauf() : null,
    };
  }, { countdown, finale, nachlauf });
}

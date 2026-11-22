// MESS-HAKEN fuer die Formkarten-Farbregel (docs/design/form-moral-17-11.md Abschnitt 6).
//
// Der Motor zieht in `zieheFormkarten()` (Modus "echt", nur Abnahmemessung) je Seite einen Kartenwert
// ueber `zieheFormSzenarioEcht(saat, [SQUAD, OPP])` -- fuer JEDEN Spieler der Seite derselben. Fuer
// die neue Farbregel braucht die Messung denselben Kartenzug, aber je Spieler bewertet. Der Motor
// wird NICHT veraendert: scripts/miss-formkarten-farbregel.mts misst eine Kopie von public/mockups,
// in der genau eine Zeile (der Aufruf von zieheFormSzenarioEcht) auf `window.__formHook` umgeleitet ist.
//
// `erzeugeFormHook` ist SELBSTSTAENDIG (keine Fremdbezuege), damit es per `.toString()` in die Seite
// getragen werden kann. Es spiegelt den Zug aus dem Motor Zeichen fuer Zeichen (gleiche Zufallsfolge)
// und bewertet jede Karte dann nach `regel` ("alt" = der heutige Wert, alle gleich, x2 bei Farbgleichheit).
// tests/form-moral-modifikator.test.ts prueft, dass die Bewertung mit lib/lineups/formkarten-farbregel.ts
// uebereinstimmt.
export function erzeugeFormHook(cfg) {
  const ANDERE = { red: ["green", "blue", "yellow"], green: ["red", "blue", "yellow"], blue: ["red", "green", "yellow"], yellow: ["red", "green", "blue"] };
  return function formHook(saat, seiten) {
    const z0 = (saat ^ 0x5bd1e995) >>> 0;
    let z = z0;
    const r = (n) => { z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff; return (z >>> 16) % n; };
    let y = (z0 ^ 0x9e3779b9) >>> 0;
    const farbwahl = (n) => { y = (Math.imul(y, 1664525) + 1013904223) >>> 0; return (y >>> 16) % n; };
    const K = cfg.K || [0, 2, 4, 8], STUFEN = ["schonen", "normal", "push"];
    const karte = () => {
      const wert = K[r(4)];
      const passend = r(4) === 0;
      const farbe = passend ? cfg.dFarbe : (cfg.dFarbe ? ANDERE[cfg.dFarbe][farbwahl(3)] : null);
      return { wert, passend, farbe };
    };
    const m = new Map();
    for (const kader of seiten) {
      const k1 = karte();
      k1.wert *= r(2) === 0 ? 1 : -1;
      const karten = [k1];
      if (r(2) === 0) karten.push(karte());
      const int = STUFEN[r(3)];
      for (const p of kader) {
        let form;
        if (cfg.regel === "alt") {
          form = karten.reduce((a, k) => a + k.wert * (k.passend ? 2 : 1), 0);
        } else {
          const spielerFarbe = cfg.klassenFarbe[p.c] || null;
          // Plus/Minus (22.11.): Gegenfarbe tritt nur ein, wenn cfg.regel.gegen gesetzt ist (sonst Zeichen fuer Zeichen wie vorher).
          const GEGEN = { red: "blue", blue: "red", green: "yellow", yellow: "green" };
          const stufe = (cfg.stufe && cfg.stufe[p.n]) || 0;
          form = karten.reduce((a, k) => {
            const v = k.wert;
            if (!v) return a;
            const alle = v * (k.passend ? cfg.regel.allePassend : cfg.regel.alleFremd);
            if (!k.farbe || k.farbe !== spielerFarbe) {
              const gegen = cfg.regel.gegen && spielerFarbe && GEGEN[k.farbe] === spielerFarbe ? -v * cfg.regel.gegen : 0;
              return a + alle + gegen;
            }
            const hebel = v > 0 && stufe > 0 ? 1 + cfg.hebel * stufe : 1;
            return a + alle + v * cfg.regel.traeger * hebel;
          }, 0);
          form = Number(form.toFixed(1));
        }
        m.set(p.n, { form, int });
      }
    }
    return m;
  };
}

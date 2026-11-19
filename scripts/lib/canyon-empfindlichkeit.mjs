// SCHNELLE Pp-SCHAETZUNG FUER DAS CLIMBING-FORMAT "CANYON" (Bau 18.11.) -- Kalibrierhilfe, KEIN Ersatz fuer
// die Abnahme mit einflussVon() (scripts/miss-climbing-canyon.mjs --pp).
//
// Idee: mit `mengeAusEignung` sind die acht Sub-Skills eines Kletterers auf seine Eignung normiert. Hebt man
// ein Attribut a um x, aendert sich Sub-Skill k (linearisiert, flaches Profil) um x * (r_ka + w_a - rquer_a)/100
// (r = Rezept, w = Matrix, rquer = Mittel des Rezepts ueber die acht Sub-Skills). Traegt Sub-Skill k den
// Zeitanteil c_k (Summe 1), ist der Anteil von a an der Wirkung  sum_k c_k r_ka + w_a - rquer_a ; bei gleich-
// verteiltem c (je 1/8) also genau w_a. Die Messung schaetzt c_k direkt: Seite 0 bekommt Sub-Skill k um +6
// angehoben (`canyonParameter({diagPlus})`), gemessen wird, wie viel schneller Seite 0 gegenueber Seite 1 wird.
export async function canyonEmpfindlichkeit(seite, familie, { n = 8, plus = 6 } = {}) {
  return seite.evaluate(([n, fam, plus]) => {
    const A = window.__arena;
    const K = ["ANTRITT", "ENDTEMPO", "TECHNIK", "WENDIGKEIT", "STEHEN", "WUCHT", "ROBUST", "GLEICHGEWICHT"];
    const differenz = (diag) => {
      A.canyonParameter({ diagPlus: null });
      if (diag) A.canyonParameter({ diagPlus: diag });
      const x = A.disziplinProbe("climbing", { n, kaderFamilie: fam, canyonDiag: true });
      const rennen = (x.varianten || [{ spiele: x.spiele }]).flatMap((v) => v.spiele.map((s) => s.canyon).filter(Boolean));
      let summe = 0;
      for (const r of rennen) {
        const m = (s) => { const l = r.laeufer.filter((q) => q.seite === s); return l.reduce((a, q) => a + q.zeit, 0) / l.length; };
        summe += (m(1) - m(0)) / ((m(0) + m(1)) / 2);
      }
      return summe / rennen.length;
    };
    const basis = differenz(null);
    const wirkung = {};
    for (const k of K) wirkung[k] = differenz({ [k]: plus }) - basis;
    A.canyonParameter({ diagPlus: null });
    return { basis, wirkung };
  }, [n, familie, plus]);
}

export function canyonPpSchaetzung(wirkung, rezept, matrix) {
  const K = Object.keys(wirkung);
  const summe = K.reduce((a, k) => a + Math.max(0, wirkung[k]), 0) || 1;
  const c = Object.fromEntries(K.map((k) => [k, Math.max(0, wirkung[k]) / summe]));
  const attr = [...new Set(K.flatMap((k) => Object.keys(rezept[k] || {})).concat(Object.keys(matrix)))];
  const anteil = {};
  let pp = 0;
  for (const a of attr) {
    const rq = K.reduce((s, k) => s + ((rezept[k] || {})[a] || 0), 0) / K.length;
    anteil[a] = K.reduce((s, k) => s + c[k] * ((rezept[k] || {})[a] || 0), 0) + (matrix[a] || 0) - rq;
    pp += Math.abs(anteil[a] - (matrix[a] || 0));
  }
  return { c, anteil, pp };
}

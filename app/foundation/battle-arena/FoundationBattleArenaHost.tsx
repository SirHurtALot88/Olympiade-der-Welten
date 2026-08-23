"use client";

/**
 * BATTLE ARENA — der Entwurf des Battle Mode, im Spiel sichtbar.
 *
 * Warum hier und nicht nur als Link: Die Frage, die der Entwurf beantworten
 * soll, ist "wie fuehlt sich das im Spiel an?". Die laesst sich nur
 * beantworten, wenn er dort steht, wo die echte Arena steht — im selben
 * Rahmen, in derselben Navigation, mit demselben Weg dorthin.
 *
 * Warum ein `iframe` und keine React-Komponente: Der Entwurf ist ein in sich
 * geschlossenes Dokument mit eigenen Farben, eigener Typografie und eigenem
 * Canvas-Kampf. Direkt eingebettet wuerden seine Stile mit denen der Anwendung
 * kollidieren — in beide Richtungen. Der Rahmen kapselt beides sauber ab, und
 * die Datei bleibt genau die, die auch als Artefakt veroeffentlicht wird: eine
 * Quelle, kein zweiter Stand, der auseinanderlaeuft. Genau das war der Punkt:
 * Pfeile, Skills und Assets sollen nicht zweimal entstehen.
 *
 * Es ist ausdruecklich KEIN Spielbestandteil: nichts hier liest oder schreibt
 * einen Spielstand. Die Werte im Entwurf sind fest hinterlegte Kopien echter
 * Kaderwerte, damit er ohne Server und ohne Save funktioniert.
 */
export default function FoundationBattleArenaHost() {
  return (
    <section className="panel" aria-label="Battle Arena — Entwurf">
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 4px" }}>Battle Arena — Entwurf</h2>
        <p className="muted" style={{ margin: 0, maxWidth: "70ch" }}>
          Ein Entwurf zum Anschauen und Zerreden, noch keine Implementierung. Aufstellung mit
          Reihen, Persönlichkeiten und Befehlen; darunter ein 6-gegen-6-Kampf, der aus genau
          diesen Werten gerechnet wird — kein einziger Kampfwert ist erfunden, alle stammen aus
          den zwölf Attributen. Nichts davon berührt deinen Spielstand.
        </p>
      </header>
      <iframe
        src="/mockups/battle-mode.html"
        title="Battle Arena — Entwurf"
        style={{
          width: "100%",
          height: "min(1400px, 180vh)",
          border: "1px solid var(--border, #2A3546)",
          borderRadius: 10,
          background: "transparent",
          display: "block",
        }}
      />
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        Lässt sich auch direkt öffnen unter <code>/mockups/battle-mode.html</code>.
      </p>
    </section>
  );
}

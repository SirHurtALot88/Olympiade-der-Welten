"use client";

/**
 * ENTWURFS-ANSICHT — zeigt das Battle-Mode-Mockup im Spiel, damit man es zu zweit
 * anschauen und besprechen kann, ohne dass jemand einen Link braucht.
 *
 * Warum ein `iframe` und keine React-Komponente: Das Mockup ist ein in sich
 * geschlossenes Dokument mit eigenen Farben, eigener Typografie und eigenem
 * Canvas-Kampf. Direkt eingebettet wuerden seine Stile mit denen der Anwendung
 * kollidieren — in beide Richtungen. Der Rahmen kapselt beides sauber ab, und
 * die Datei bleibt genau die, die auch als Artefakt veroeffentlicht wird: eine
 * Quelle, kein zweiter Stand, der auseinanderlaeuft.
 *
 * Es ist ausdruecklich KEIN Spielbestandteil: nichts hier liest oder schreibt
 * einen Spielstand. Die Werte im Mockup sind fest hinterlegte Kopien echter
 * Kaderwerte, damit der Entwurf ohne Server und ohne Save funktioniert.
 */
export default function FoundationMockupHost() {
  return (
    <section className="panel" aria-label="Battle-Mode-Entwurf">
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 4px" }}>Battle Mode — Entwurf</h2>
        <p className="muted" style={{ margin: 0, maxWidth: "70ch" }}>
          Ein Mockup zum Anschauen und Zerreden, keine Implementierung. Aufstellung mit Reihen,
          Persönlichkeiten und Befehlen; darunter eine Arena, die den Kampf aus genau diesen Werten
          rechnet. Nichts davon berührt deinen Spielstand.
        </p>
      </header>
      <iframe
        src="/mockups/battle-mode.html"
        title="Battle-Mode-Entwurf"
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

/**
 * ARENA-DATEIEN VORLADEN, WAEHREND DER VORLAUF RECHNET (18.11., Chris' Live-Befund "lange Wartezeit
 * nach Einsatzliste abgeben, bis die Arena erscheint").
 *
 * Bis hierher begann der Browser erst NACH dem Vorlauf, die Arena zu laden: Huelle
 * (`/mockups/battle-mode.html`), dann Stylesheet und die Motor-Skripte -- allein
 * `battle-mode.engine.js` ist rund 5 MB. Die Wartezeit des Vorlaufs (Server rechnet den Spieltag)
 * und die Ladezeit der Arena (Browser holt die Dateien) liefen damit hintereinander statt
 * nebeneinander. Diese Funktion holt die Dateien schon waehrend des Wartens als `rel=prefetch` in
 * den HTTP-Cache; der Host (`FoundationBattleArenaHost`) haengt spaeter dieselben URLs ein und
 * bekommt sie aus dem Cache. Reine Ladeoptimierung, kein Spielzustand, idempotent je Seite.
 */

let gestartet = false;

/** Liest aus der Huelle dieselben Verweise, die der Host einhaengt (Stylesheets und Skripte). */
export function arenaVerweiseAusHuelle(html: string, basis: string): string[] {
  const verweise: string[] = [];
  const muster = /<(?:link[^>]*rel=["']stylesheet["'][^>]*href|script[^>]*src)=["']([^"']+)["']/gi;
  for (const treffer of html.matchAll(muster)) {
    try {
      verweise.push(new URL(treffer[1], basis).toString());
    } catch {
      // ungueltiger Verweis: auslassen, der Host meldet ihn ohnehin selbst
    }
  }
  return [...new Set(verweise)];
}

export function vorladeArenaDateien(): void {
  if (gestartet || typeof window === "undefined" || typeof document === "undefined") return;
  gestartet = true;
  void fetch("/mockups/battle-mode.html", { cache: "no-cache" })
    .then(async (antwort) => {
      if (!antwort.ok) throw new Error(`Huelle ${antwort.status}`);
      const verweise = arenaVerweiseAusHuelle(await antwort.text(), antwort.url);
      for (const href of verweise) {
        if (document.querySelector(`link[data-oly-arena-vorladen="${CSS.escape(href)}"]`)) continue;
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = href;
        link.setAttribute("data-oly-arena-vorladen", href);
        document.head.appendChild(link);
      }
    })
    .catch(() => {
      // Vorladen ist nur eine Abkuerzung: schlaegt es fehl, laedt der Host spaeter wie bisher.
      gestartet = false;
    });
}

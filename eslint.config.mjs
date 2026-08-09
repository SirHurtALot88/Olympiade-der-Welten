/**
 * ESLint-Flat-Config — die erste Lint-Konfiguration dieses Repos überhaupt.
 *
 * Ausgangslage (August 2026): `npm run lint` stand zwar in package.json, aber es gab
 * keine Config — der Befehl war faktisch tot. Diese Datei stellt ihn wieder her, mit
 * einer bewussten Zwei-Klassen-Politik:
 *
 *   1. `react-hooks/rules-of-hooks` ist FEHLER und muss es bleiben. Bedingte Hooks
 *      sind keine Stilfrage: Sie lassen React beim nächsten Prop-Kipp mit
 *      "Rendered more/fewer hooks than during the previous render" abstürzen.
 *      Der Bestand wurde auf null Verstöße gebracht (FoundationTeamsDetailPanel,
 *      PlayerDetailDrawer) — jeder neue Verstoß bricht `npx eslint .` sofort.
 *
 *   2. Alles, was beim Scharfschalten im Bestand bereits HUNDERTFACH feuerte
 *      (v. a. die neuen Compiler-Regeln von eslint-plugin-react-hooks v6/v7 wie
 *      `refs` und `set-state-in-effect`, dazu no-explicit-any & Co.), steht auf
 *      "warn": sichtbar beim Linten, aber kein roter Exit. Der Berg ist echt,
 *      aber er ist Bestand — ihn pauschal zum Fehler zu machen hieße nur, dass
 *      niemand mehr lintet. Abbau gerne schrittweise; wer eine Regel abgeräumt
 *      hat, darf sie hier hochstufen.
 *
 * Empfohlene Regeln, die im Bestand NICHT feuern (z. B. `react-hooks/purity`,
 * `react-hooks/set-state-in-render`, `react/jsx-key`), bleiben absichtlich auf
 * ihrer Fehler-Voreinstellung: Sie fangen echte Bugs, und es gibt keinen
 * Bestand, der sie entwerten würde.
 */
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      // Build-Artefakte.
      ".next/**",
      "apps/**/dist/**",
      "apps/**/.next/**",
      // Retool-Exporte (Golden-Master-Referenzen): kein echtes JavaScript,
      // die *.state.js-Dateien sind für den Parser Syntaxfehler.
      "references/**",
      // UX-Audit-Ablage: Screenshots/Notizen, kein Produktivcode.
      "tmp-ux-audit/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    name: "oly/bestand-auf-warnung",
    rules: {
      // ── Die eine unverhandelbare Fehler-Regel ────────────────────────────
      // (steht schon per recommended auf "error", hier nur explizit, damit
      // niemand sie versehentlich über eine spätere Schicht abschwächt)
      "react-hooks/rules-of-hooks": "error",

      // ── Neue react-hooks-Compiler-Regeln (v6/v7) mit großem Bestand ─────
      // Stand der Erstmessung: refs 107×, set-state-in-effect 83×,
      // preserve-manual-memoization 6×, use-memo/static-components/globals je 1×.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/globals": "warn",

      // ── Übriger Bestand, der sonst den Exit-Code rot machen würde ───────
      // (Zählung Erstmessung in Klammern)
      "@typescript-eslint/no-explicit-any": "warn", // 25×
      "react/no-unescaped-entities": "warn", // 19×
      "prefer-const": "warn", // 18×
      "@typescript-eslint/no-require-imports": "warn", // 5×
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn", // 5×
      "@typescript-eslint/ban-ts-comment": "warn", // 1× (@ts-nocheck in FoundationTeamsDetailPanel)
      "@typescript-eslint/triple-slash-reference": "warn", // 1×
      "@next/next/no-assign-module-variable": "warn", // 1×
    },
  },
];

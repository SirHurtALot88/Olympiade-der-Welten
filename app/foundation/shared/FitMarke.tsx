import { de } from "@/app/foundation/transfermarkt-modern/tm-format";

/** Team-Fit zum gewählten Team als kleine Marke (Zahl, kein Buchstabe); Mercenaries tragen ihre Ausnahme sichtbar. */
export function FitMarke({ item }: { item: { fit?: number | null; mercenary?: boolean | null; teamContextAvailable?: boolean } }) {
  if (item.fit == null) return item.mercenary ? <span className="tag go" title="Mercenary: von der Fit-Regel ausgenommen">Merc</span> : null;
  const art = item.fit > 0 ? "g" : item.fit < 0 ? "w" : "";
  const zahl = `${item.fit > 0 ? "+" : ""}${de(item.fit, 1)}`;
  return (
    <>
      <span className={`tag ${art}`} title={`Team-Fit zu deinem Kader: ${zahl}${item.fit < 0 ? " (negativ, normalerweise ausgeblendet)" : ""}`} data-testid="fit-marke">Fit {zahl}</span>
      {item.mercenary ? <span className="tag go" title="Mercenary: von der Fit-Regel ausgenommen">Merc</span> : null}
    </>
  );
}

/** Eigene Fit-Spalte (Chris 21.11.): die Zahl, grün positiv, rot negativ; Mercenaries tragen „Merc“. */
export function FitZelle({ item }: { item: { fit?: number | null; mercenary?: boolean | null } }) {
  const merc = item.mercenary ? <span className="tag go" title="Mercenary: von der Fit-Regel ausgenommen">Merc</span> : null;
  if (item.fit == null) return <span className="ft" data-testid="fit-zelle">{merc ?? <b className="t" style={{ color: "var(--stumm)" }}>—</b>}</span>;
  const farbe = item.fit > 0 ? "var(--gut, #5fd68a)" : item.fit < 0 ? "var(--warn, #ff7a6e)" : "var(--stumm)";
  const zahl = `${item.fit > 0 ? "+" : ""}${de(item.fit, 1)}`;
  return (
    <span className="ft" data-testid="fit-zelle" title={`Team-Fit zu deinem Kader: ${zahl}. Wirkt auf Wechselwille und Forderung in der Verhandlung.`}>
      <b className="t" style={{ color: farbe }}>{zahl}</b>
      {merc}
    </span>
  );
}

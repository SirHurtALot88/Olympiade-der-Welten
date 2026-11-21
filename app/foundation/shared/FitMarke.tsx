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

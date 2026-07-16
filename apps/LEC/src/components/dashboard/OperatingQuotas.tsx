import type { OperatingQuotas as Quotas } from "@/lib/dashboard/viewModel";
import { formatPercent } from "@/lib/format";

interface Props {
  quotas: Quotas;
}

export function OperatingQuotas({ quotas }: Props) {
  return (
    <div className="card" style={{ padding: "15px 16px 14px" }}>
      <div
        className="lab"
        style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginBottom: 11 }}
      >
        Betriebs-Quoten <span style={{ color: "var(--faint)" }}>· 365 Tage vs. Ziel</span>
      </div>
      <QuotaRow
        label="Warenquote"
        value={quotas.warenquote}
        target={quotas.targetWarenquote}
      />
      <div style={{ marginTop: 12 }}>
        <QuotaRow
          label="Betriebsausgaben"
          value={quotas.betriebsausgabenquote}
          target={quotas.targetBetriebsausgabenquote}
        />
      </div>
    </div>
  );
}

function QuotaRow({ label, value, target }: { label: string; value: number; target: number }) {
  const color = value <= target ? "var(--good)" : value <= target * 1.15 ? "var(--warn)" : "var(--crit)";
  return (
    <div className="quota">
      <div className="qrow">
        <span className="qk">{label}</span>
        <span className="qv">{formatPercent(value)}%</span>
        <span className="qt">Ziel ≤ {formatPercent(target)}%</span>
      </div>
      <div className="qbar">
        <i style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
        <b style={{ left: `${Math.min(100, target * 100)}%` }} />
      </div>
    </div>
  );
}

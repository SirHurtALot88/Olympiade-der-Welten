import type { ActionLogEntry } from "@/types/game";

type ActionLogProps = {
  entries: ActionLogEntry[];
};

export function ActionLog({ entries }: ActionLogProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Aktionslog</h2>
      </div>
      <ul className="action-log">
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <li key={entry.id}>
              <span className="action-turn">Turn {entry.turnNumber}</span>
              <p>{entry.message}</p>
            </li>
          ))}
      </ul>
    </section>
  );
}

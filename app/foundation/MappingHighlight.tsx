"use client";

type MappingWarning = {
  type: string;
  message: string;
};

export function MappingHighlight({ warning }: { warning: MappingWarning }) {
  return (
    <div className={`mapping-warning mapping-warning-${warning.type}`}>
      <strong>{warning.type}</strong>
      <span>{warning.message}</span>
    </div>
  );
}

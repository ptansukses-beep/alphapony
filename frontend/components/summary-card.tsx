import { biasLevelClassName, biasLevelLabel, directionClassName, directionLabel } from "@/lib/format";
import type { BiasLevel, Direction } from "@/lib/api-types";

type SummaryCardProps = {
  eyebrow: string;
  direction: Direction;
  biasLevel?: BiasLevel;
  value: string;
  meta: string[];
  lines: string[];
};

export function SummaryCard({
  eyebrow,
  direction,
  biasLevel,
  value,
  meta,
  lines
}: SummaryCardProps) {
  const toneClass = biasLevel ? biasLevelClassName(biasLevel) : directionClassName(direction);
  const toneLabel = biasLevel ? biasLevelLabel(biasLevel) : directionLabel(direction);

  return (
    <div className="panel summary-card">
      <div className={`signal-tag ${toneClass}`}>
        {eyebrow} · {toneLabel}
      </div>
      <div className={`summary-value ${toneClass}`}>{value}</div>
      <div className="summary-meta">
        {meta.map((item) => (
          <span key={item} className="meta-pill">
            {item}
          </span>
        ))}
      </div>
      <ol className="summary-list">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </div>
  );
}

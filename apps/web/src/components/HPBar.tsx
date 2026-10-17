import { hpTone } from "@/lib/parsed";

export function HPBar({
  current,
  max,
  compact = false,
}: {
  current: number;
  max: number;
  compact?: boolean;
}) {
  const tone = hpTone(current, max);
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  return (
    <div className="hp-bar" data-compact={compact || undefined}>
      <div className="hp-bar__label">
        <span>HP</span>
        {!compact ? (
          <span className="hp-bar__nums">
            {current}/{max}
          </span>
        ) : null}
      </div>
      <div className="hp-bar__track" role="meter" aria-valuenow={current} aria-valuemin={0} aria-valuemax={max}>
        <div
          className="hp-bar__fill"
          data-tone={tone}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

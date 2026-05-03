import { formatBytes } from "../lib/api";

type Props = {
  label: string;
  used: number;
  limit: number | null;
  formatter?: (n: number) => string;
};

export function UsageBar({ label, used, limit, formatter }: Props) {
  const fmt = formatter ?? ((n: number) => n.toLocaleString());
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const danger = pct >= 90;
  const warn = pct >= 70;

  return (
    <div className="bg-surface-light rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-text-muted">
          {fmt(used)}
          {limit !== null ? (
            <>
              {" "}
              / <span className="text-text">{fmt(limit)}</span>
            </>
          ) : (
            " (no limit)"
          )}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              danger ? "bg-danger" : warn ? "bg-yellow-500" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export const formatStorage = formatBytes;

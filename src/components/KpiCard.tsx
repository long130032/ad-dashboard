import { Sparkline } from './Sparkline'

export function KpiCard({
  label,
  value,
  sub,
  tone = 'ink',
  spark,
  sparkColor,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'ink' | 'bad' | 'warn' | 'ok' | 'brand'
  spark?: (number | null)[]
  sparkColor?: string
}) {
  const toneCls =
    tone === 'bad'
      ? 'text-bad'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'ok'
          ? 'text-ok'
          : tone === 'brand'
            ? 'text-brand'
            : 'text-ink'
  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-line shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_6px_20px_rgba(16,24,40,0.08)] transition-shadow duration-200 px-5 pt-4 pb-3">
      <div className="text-[12px] font-medium text-muted tracking-wide">{label}</div>
      <div className={`mt-2 text-[28px] leading-none font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-faint">{sub}</div>}
      {spark && (
        <div className="mt-auto pt-3 -mb-1">
          <Sparkline data={spark} color={sparkColor ?? '#6d5cf5'} />
        </div>
      )}
    </div>
  )
}

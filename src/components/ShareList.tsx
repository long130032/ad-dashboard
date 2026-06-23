import { wan } from '../lib/format'

// 紫阶:排名越前越深,顺带表达占比强弱
const SHADES = ['#6d5cf5', '#8275f3', '#9a8ef5', '#b3aaf8', '#ccc6fa', '#e2defc']

export function ShareList({
  data,
  total,
}: {
  data: { name: string; value: number }[]
  total: number
}) {
  return (
    <div className="space-y-3.5">
      {data.map((d, i) => {
        const p = total ? d.value / total : 0
        return (
          <div key={d.name}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="flex items-baseline gap-2 min-w-0">
                <span className="w-4 shrink-0 text-[11px] tabular-nums text-faint">{i + 1}</span>
                <span className="truncate text-[13px] text-ink">{d.name}</span>
              </span>
              <span className="shrink-0 text-[13px] tabular-nums">
                <span className="font-medium text-ink">{wan(d.value)}</span>
                <span className="ml-1.5 text-faint">{(p * 100).toFixed(1)}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(p * 100, 1.5)}%`, background: SHADES[Math.min(i, SHADES.length - 1)] }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

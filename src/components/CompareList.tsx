import { pct } from '../lib/format'

// 双指标对照:每项上下两根条——消耗占比(紫)/激活占比(青),都按"占全盘"算。
// 紫条明显长过青条 = 吃钱比例 > 产出(激活)比例,相对低效,一眼可辨。
export function CompareList({
  data,
  totalC,
  totalA,
}: {
  data: { name: string; 消耗: number; 激活: number }[]
  totalC: number
  totalA: number
}) {
  const c = totalC || 1
  const a = totalA || 1
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const cp = (d.消耗 || 0) / c
        const ap = (d.激活 || 0) / a
        return (
          <div key={d.name}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="w-4 shrink-0 text-[11px] tabular-nums text-faint">{i + 1}</span>
                <span className="truncate text-[13px] text-ink">{d.name}</span>
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted">
                消耗 {pct(cp)} · 激活 {pct(ap)}
              </span>
            </div>
            <div className="space-y-1 pl-6">
              <CmpBar w={cp} color="#6d5cf5" />
              <CmpBar w={ap} color="#22b8cf" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CmpBar({ w, color }: { w: number; color: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
      <div className="h-full rounded-full" style={{ width: `${Math.max(w * 100, 1.5)}%`, background: color }} />
    </div>
  )
}

import { useState } from 'react'
import { useFilters, type DateRange } from '../store/filters'

/** 'yyyy-mm-dd' 字符串日期算术(按 UTC,避开时区偏移)。 */
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}
const clampMin = (day: string, min: string) => (day < min ? min : day)

const PRESETS = [
  { label: '近7天', days: 7 },
  { label: '近14天', days: 14 },
  { label: '近30天', days: 30 },
]

export function DateFilter() {
  const { dateRange, setDateRange, dateBounds, hasDaily } = useFilters()
  const [open, setOpen] = useState(false)

  // 没有按天表:降级为静态标识,不可交互
  if (!hasDaily || !dateBounds) {
    return (
      <span
        className="h-9 inline-flex items-center rounded-lg border border-line bg-canvas px-3 text-[12px] text-faint"
        title="上传「按天」账户报表后可按日期筛选"
      >
        📅 整段
      </span>
    )
  }

  const { min, max } = dateBounds
  const presetRange = (days: number): DateRange => ({ start: clampMin(addDays(max, -(days - 1)), min), end: max })
  const eq = (a: DateRange | null, b: DateRange | null) =>
    (!a && !b) || (!!a && !!b && a.start === b.start && a.end === b.end)
  const matchedPreset = PRESETS.find((p) => eq(dateRange, presetRange(p.days)))
  const isCustom = !!dateRange && !matchedPreset

  const seg = (active: boolean) =>
    `h-9 px-3 text-[13px] transition-colors first:rounded-l-lg ${
      active ? 'bg-brand-soft text-brand font-medium' : 'text-muted hover:text-ink hover:bg-canvas'
    }`

  return (
    <div className="relative flex items-center">
      <div className="flex items-center rounded-lg border border-line bg-white overflow-hidden divide-x divide-line">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => setDateRange(presetRange(p.days))} className={seg(matchedPreset === p)}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setDateRange(null)} className={seg(!dateRange)}>
          全部
        </button>
        <button onClick={() => setOpen((o) => !o)} className={`${seg(isCustom)} last:rounded-r-lg`}>
          自定义 ▾
        </button>
      </div>

      {open && (
        <CustomPopover
          min={min}
          max={max}
          initial={dateRange ?? { start: min, end: max }}
          onApply={(r) => {
            setDateRange(r)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function CustomPopover({
  min,
  max,
  initial,
  onApply,
  onClose,
}: {
  min: string
  max: string
  initial: DateRange
  onApply: (r: DateRange) => void
  onClose: () => void
}) {
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const invalid = start > end

  const input =
    'h-9 rounded-lg border border-line bg-white px-2 text-[13px] text-ink outline-none focus:border-brand'

  return (
    <>
      {/* 点击外部关闭 */}
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-11 z-20 flex items-center gap-2 rounded-xl border border-line bg-white p-3 shadow-lg">
        <input type="date" min={min} max={max} value={start} onChange={(e) => setStart(e.target.value)} className={input} />
        <span className="text-faint">—</span>
        <input type="date" min={min} max={max} value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
        <button
          disabled={invalid}
          onClick={() => onApply({ start, end })}
          className="h-9 rounded-lg bg-brand px-3 text-[13px] font-medium text-white disabled:opacity-40"
        >
          应用
        </button>
      </div>
    </>
  )
}

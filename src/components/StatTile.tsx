import type { ReactNode } from 'react'
import { StatusBadge } from './StatusBadge'

// 业务页通用统计卡:与总览 KpiCard 同款外壳(2xl 圆角·柔阴影·hover 微浮)。
// 头部可用「状态徽标」或「文字标签」;传 onClick 即变可点选(active 高亮),用作筛选卡。
export function StatTile({
  label,
  badge,
  value,
  sub,
  active,
  onClick,
}: {
  label?: string
  badge?: string
  value: ReactNode
  sub?: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  const cls = `block w-full text-left rounded-2xl border bg-white px-5 pt-4 pb-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(16,24,40,0.08)] ${
    active ? 'border-brand ring-2 ring-brand/15' : 'border-line'
  }`
  const inner = (
    <>
      {badge ? (
        <StatusBadge value={badge} />
      ) : (
        <div className="text-[12px] font-medium text-muted tracking-wide">{label}</div>
      )}
      <div className="mt-2 text-[24px] leading-none font-semibold tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-faint">{sub}</div>}
    </>
  )
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

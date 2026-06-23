import type { ReactNode } from 'react'

export function Card({
  title,
  extra,
  className = '',
  children,
}: {
  title?: ReactNode
  extra?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-line shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_6px_20px_rgba(16,24,40,0.08)] transition-shadow duration-200 ${className}`}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {extra}
        </div>
      )}
      <div className={title ? 'px-5 pb-5' : 'p-5'}>{children}</div>
    </div>
  )
}

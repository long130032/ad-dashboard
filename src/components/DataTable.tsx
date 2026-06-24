import { useState, type ReactNode } from 'react'

export type Col<T> = {
  key: string
  label: string
  align?: 'left' | 'right'
  sortable?: boolean
  sortVal?: (r: T) => number | string
  render: (r: T) => ReactNode
}

export function DataTable<T>({
  cols,
  rows,
  initialSort,
  onRowClick,
  maxHeight,
}: {
  cols: Col<T>[]
  rows: T[]
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  onRowClick?: (r: T) => void
  /** 设置后:表格区域限高滚动,表头 sticky 吸顶。 */
  maxHeight?: number
}) {
  const [sort, setSort] = useState(initialSort)

  const sorted = (() => {
    if (!sort) return rows
    const col = cols.find((c) => c.key === sort.key)
    if (!col?.sortVal) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.sortVal!(a)
      const vb = col.sortVal!(b)
      return va < vb ? -dir : va > vb ? dir : 0
    })
  })()

  const toggle = (c: Col<T>) => {
    if (!c.sortable) return
    setSort((s) =>
      s?.key === c.key ? { key: c.key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: c.key, dir: 'desc' },
    )
  }

  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-[13px] border-collapse">
        <thead className={maxHeight ? 'sticky top-0 z-10 bg-white' : undefined}>
          <tr className="text-muted border-b border-line">
            {cols.map((c) => (
              <th
                key={c.key}
                onClick={() => toggle(c)}
                className={`font-medium py-2 px-3 whitespace-nowrap ${maxHeight ? 'bg-white' : ''} ${c.align === 'right' ? 'text-right' : 'text-left'} ${
                  c.sortable ? 'cursor-pointer select-none hover:text-ink' : ''
                }`}
              >
                {c.label}
                {sort?.key === c.key && (sort.dir === 'desc' ? ' ↓' : ' ↑')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-line/60 hover:bg-canvas/60 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`py-2 px-3 whitespace-nowrap tabular-nums ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="py-10 text-center text-muted">
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

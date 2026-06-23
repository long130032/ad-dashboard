import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

export type FilterKey = '优化师' | '项目' | '媒体'
type Dims = Partial<Record<FilterKey, string>>
type Options = Record<FilterKey, string[]>
type Meta = { uploaded_at: string | null; has_data: boolean }
export type DateRange = { start: string; end: string }
type DateBounds = { min: string; max: string }

type Ctx = {
  /** 传给各页 useApi 的参数包:维度筛选 + (选了窗口时)起始/截止。 */
  filters: Dims & { 起始?: string; 截止?: string }
  setFilter: (k: FilterKey, v: string | undefined) => void
  clear: () => void
  options: Options
  meta: Meta
  refresh: () => void
  // 日期筛选
  dateRange: DateRange | null
  setDateRange: (r: DateRange | null) => void
  dateBounds: DateBounds | null
  hasDaily: boolean
}

const FilterCtx = createContext<Ctx | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [dims, setDims] = useState<Dims>({})
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [options, setOptions] = useState<Options>({ 优化师: [], 项目: [], 媒体: [] })
  const [meta, setMeta] = useState<Meta>({ uploaded_at: null, has_data: false })
  const [dateBounds, setDateBounds] = useState<DateBounds | null>(null)

  const refresh = () => {
    api<Meta>('meta').then(setMeta).catch(() => {})
    api<Options & { 日期范围: DateBounds | null }>('filters')
      .then((f) => {
        setOptions({ 优化师: f.优化师, 项目: f.项目, 媒体: f.媒体 })
        setDateBounds(f.日期范围)
      })
      .catch(() => {})
  }
  useEffect(refresh, [])

  const setFilter = (k: FilterKey, v: string | undefined) =>
    setDims((f) => ({ ...f, [k]: v || undefined }))

  const filters = dateRange ? { ...dims, 起始: dateRange.start, 截止: dateRange.end } : dims

  return (
    <FilterCtx.Provider
      value={{
        filters,
        setFilter,
        clear: () => setDims({}),
        options,
        meta,
        refresh,
        dateRange,
        setDateRange,
        dateBounds,
        hasDaily: dateBounds != null,
      }}
    >
      {children}
    </FilterCtx.Provider>
  )
}

export const useFilters = () => {
  const c = useContext(FilterCtx)
  if (!c) throw new Error('useFilters outside provider')
  return c
}

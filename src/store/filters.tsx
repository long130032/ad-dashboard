import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

export type FilterKey = '优化师' | '项目' | '媒体'
type Filters = Partial<Record<FilterKey, string>>
type Options = Record<FilterKey, string[]>
type Meta = { uploaded_at: string | null; has_data: boolean }

type Ctx = {
  filters: Filters
  setFilter: (k: FilterKey, v: string | undefined) => void
  clear: () => void
  options: Options
  meta: Meta
  refresh: () => void
}

const FilterCtx = createContext<Ctx | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>({})
  const [options, setOptions] = useState<Options>({ 优化师: [], 项目: [], 媒体: [] })
  const [meta, setMeta] = useState<Meta>({ uploaded_at: null, has_data: false })

  const refresh = () => {
    api<Meta>('meta').then(setMeta).catch(() => {})
    api<Options>('filters').then(setOptions).catch(() => {})
  }
  useEffect(refresh, [])

  const setFilter = (k: FilterKey, v: string | undefined) =>
    setFilters((f) => ({ ...f, [k]: v || undefined }))

  return (
    <FilterCtx.Provider value={{ filters, setFilter, clear: () => setFilters({}), options, meta, refresh }}>
      {children}
    </FilterCtx.Provider>
  )
}

export const useFilters = () => {
  const c = useContext(FilterCtx)
  if (!c) throw new Error('useFilters outside provider')
  return c
}

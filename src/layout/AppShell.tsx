import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useFilters, type FilterKey } from '../store/filters'
import { DateFilter } from './DateFilter'

const NAV_MAIN = [
  { to: '/', label: '总览', end: true },
  { to: '/projects', label: '项目分析' },
  { to: '/media', label: '媒体分析' },
  { to: '/team', label: '团队分析' },
  { to: '/accounts', label: '账户问题' },
]
const NAV_DATA = [
  { to: '/detail', label: '数据明细' },
  { to: '/import', label: '数据导入' },
  { to: '/config', label: '口径设置' },
]

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-[14px] transition-colors ${
          isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-muted hover:bg-canvas hover:text-ink'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function FilterSelect({ k }: { k: FilterKey }) {
  const { filters, setFilter, options } = useFilters()
  return (
    <select
      value={filters[k] ?? ''}
      onChange={(e) => setFilter(k, e.target.value)}
      className="h-9 rounded-lg border border-line bg-white px-3 text-[13px] text-ink min-w-[112px] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
    >
      <option value="">全部{k}</option>
      {options[k].map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

export function AppShell() {
  const { meta, filters, clear } = useFilters()
  const active = !!(filters.优化师 || filters.项目 || filters.媒体)
  // 媒体页:取数不吃任何筛选,整条筛选栏在这页禁用置灰,避免"选了没反应"的误导
  const onMedia = useLocation().pathname === '/media'

  return (
    <div className="flex h-full">
      {/* 左导航 */}
      <aside className="w-[224px] shrink-0 bg-white border-r border-line flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-white text-[13px] font-bold">投</div>
          <span className="text-[15px] font-semibold text-ink">投放看板</span>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-faint tracking-wider">分析</div>
          {NAV_MAIN.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
          <div className="px-3 pt-5 pb-1 text-[11px] font-medium text-faint tracking-wider">数据</div>
          {NAV_DATA.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
      </aside>

      {/* 右侧 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部筛选栏 */}
        <header className="h-14 shrink-0 bg-white border-b border-line flex items-center gap-2 px-6">
          <fieldset
            disabled={onMedia}
            title={onMedia ? '媒体分析按整个时间段统计,筛选在这页不生效' : undefined}
            className={`flex items-center gap-2 border-0 p-0 m-0 min-w-0 ${onMedia ? 'opacity-50' : ''}`}
          >
            <FilterSelect k="优化师" />
            <FilterSelect k="项目" />
            <FilterSelect k="媒体" />
            <DateFilter />
            {active && (
              <button onClick={clear} className="text-[13px] text-muted hover:text-ink px-2 transition-colors">
                清除
              </button>
            )}
          </fieldset>
          <div className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            {meta.has_data ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                数据截至 {meta.uploaded_at}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-faint" />
                未导入数据
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

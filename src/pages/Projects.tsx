import { Card } from '../components/Card'
import { DataTable, type Col } from '../components/DataTable'
import { StatTile } from '../components/StatTile'
import { StatusBadge } from '../components/StatusBadge'
import { ShareList } from '../components/ShareList'
import { useApi } from '../lib/useApi'
import { dec, money, num, pct, wan } from '../lib/format'
import { useFilters } from '../store/filters'
import { Loading } from './Overview'

type Proj = {
  创量项目: string
  状态建议: string
  消耗: number
  占比: number
  账户数: number
  有消耗账户数: number
  CTR: number | null
  CPC: number | null
  CVR: number | null
  CPA: number | null
}

const ORDER = ['主力', '潜力', '需关注', '低消耗', '问题']

export function Projects() {
  const { filters } = useFilters()
  const { data, loading } = useApi<{ rows: Proj[] }>('projects', {
    优化师: filters.优化师,
    媒体: filters.媒体,
  })
  if (loading || !data) return <Loading />

  const counts = ORDER.map((s) => {
    const sub = data.rows.filter((r) => r.状态建议 === s)
    return { s, n: sub.length, 消耗: sub.reduce((acc, r) => acc + r.消耗, 0) }
  })
  const 总 = data.rows.reduce((acc, r) => acc + r.消耗, 0)

  const cols: Col<Proj>[] = [
    { key: '创量项目', label: '项目', render: (r) => <span className="text-ink">{r.创量项目}</span> },
    { key: '状态建议', label: '状态', render: (r) => <StatusBadge value={r.状态建议} /> },
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => money(r.消耗) },
    { key: '占比', label: '占比', align: 'right', sortable: true, sortVal: (r) => r.占比, render: (r) => pct(r.占比) },
    { key: '账户数', label: '账户数', align: 'right', sortable: true, sortVal: (r) => r.账户数, render: (r) => num(r.账户数) },
    { key: '有消耗账户数', label: '有消耗', align: 'right', sortable: true, sortVal: (r) => r.有消耗账户数, render: (r) => num(r.有消耗账户数) },
    { key: 'CTR', label: 'CTR', align: 'right', render: (r) => pct(r.CTR, 2) },
    { key: 'CPC', label: 'CPC', align: 'right', render: (r) => dec(r.CPC) },
    { key: 'CVR', label: 'CVR', align: 'right', render: (r) => pct(r.CVR, 2) },
    { key: 'CPA', label: 'CPA', align: 'right', render: (r) => dec(r.CPA, 1) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {counts.map((c) => (
          <StatTile key={c.s} badge={c.s} value={num(c.n)} sub={`消耗 ${wan(c.消耗)}`} />
        ))}
      </div>
      <Card title="项目消耗占比 Top10" extra={<span className="text-[12px] text-muted">按消耗金额</span>}>
        <ShareList data={data.rows.slice(0, 10).map((r) => ({ name: r.创量项目, value: r.消耗 }))} total={总} />
      </Card>
      <Card title="项目表现" extra={<span className="text-[12px] text-muted">CPA 仅同项目内参考</span>}>
        <DataTable cols={cols} rows={data.rows} initialSort={{ key: '消耗', dir: 'desc' }} />
      </Card>
    </div>
  )
}

import { Card } from '../components/Card'
import { DataTable, type Col } from '../components/DataTable'
import { StatTile } from '../components/StatTile'
import { CompareList } from '../components/CompareList'
import { useApi } from '../lib/useApi'
import { dec, money, num, pct, wan } from '../lib/format'
import { useFilters } from '../store/filters'
import { Loading } from './Overview'

type Row = {
  优化师: string
  消耗: number
  占比: number
  账户数: number
  转化: number
  激活: number
  CPA: number | null
  问题账户数: number
  问题账户消耗: number
  主转化目标: string | null
}

export function Team() {
  const { filters } = useFilters()
  const { data, loading } = useApi<{ rows: Row[] }>('team', { 项目: filters.项目, 媒体: filters.媒体 })
  if (loading || !data) return <Loading />
  const 总 = data.rows.reduce((s, r) => s + r.消耗, 0)
  const 总激活 = data.rows.reduce((s, r) => s + (r.激活 || 0), 0)
  const 总问题账户 = data.rows.reduce((s, r) => s + r.问题账户数, 0)
  const 总浪费 = data.rows.reduce((s, r) => s + r.问题账户消耗, 0)

  const cols: Col<Row>[] = [
    { key: '优化师', label: '优化师', render: (r) => <span className="text-ink font-medium">{r.优化师}</span> },
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => money(r.消耗) },
    { key: '占比', label: '占比', align: 'right', render: (r) => pct(r.占比) },
    { key: '账户数', label: '账户数', align: 'right', render: (r) => num(r.账户数) },
    { key: '问题账户数', label: '问题账户', align: 'right', sortable: true, sortVal: (r) => r.问题账户数, render: (r) => num(r.问题账户数) },
    { key: '问题账户消耗', label: '其中浪费', align: 'right', render: (r) => money(r.问题账户消耗) },
    { key: '主转化目标', label: '主目标', render: (r) => r.主转化目标 ?? '—' },
    { key: 'CPA', label: 'CPA', align: 'right', render: (r) => <span className="text-muted">{dec(r.CPA, 1)}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="总消耗" value={wan(总)} sub={`${num(data.rows.length)} 位优化师`} />
        <StatTile label="问题账户" value={num(总问题账户)} sub="有消耗但白花的钱" />
        <StatTile label="浪费金额" value={wan(总浪费)} sub={`占总盘 ${pct(总 ? 总浪费 / 总 : null)}`} />
        <StatTile label="激活数" value={num(总激活)} sub="深层产出·量级参考" />
      </div>
      <Card title="团队 消耗 vs 激活" extra={<span className="text-[12px] text-muted">紫=消耗占比 · 青=激活占比</span>}>
        <CompareList
          data={data.rows.map((r) => ({ name: r.优化师, 消耗: r.消耗, 激活: r.激活 }))}
          totalC={总}
          totalA={总激活}
        />
      </Card>
      <Card title="优化师明细" extra={<span className="text-[12px] text-muted">CPA 目标不同·勿直接横比</span>}>
        <DataTable cols={cols} rows={data.rows} initialSort={{ key: '消耗', dir: 'desc' }} />
      </Card>
    </div>
  )
}

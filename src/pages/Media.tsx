import { Card } from '../components/Card'
import { DataTable, type Col } from '../components/DataTable'
import { StatTile } from '../components/StatTile'
import { CompareList } from '../components/CompareList'
import { useApi } from '../lib/useApi'
import { dec, money, num, pct, wan } from '../lib/format'
import { Loading } from './Overview'

type Row = {
  媒体: string
  消耗: number
  占比: number
  账户数: number
  转化: number
  激活: number
  CTR: number | null
  CPC: number | null
  CVR: number | null
  CPA: number | null
}

export function Media() {
  const { data, loading } = useApi<{ rows: Row[] }>('media')
  if (loading || !data) return <Loading />
  const 总消耗 = data.rows.reduce((s, r) => s + r.消耗, 0)
  const 总激活 = data.rows.reduce((s, r) => s + (r.激活 || 0), 0)

  const cols: Col<Row>[] = [
    { key: '媒体', label: '媒体', render: (r) => <span className="text-ink font-medium">{r.媒体}</span> },
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => money(r.消耗) },
    { key: '占比', label: '占比', align: 'right', render: (r) => pct(r.占比) },
    { key: '账户数', label: '账户数', align: 'right', render: (r) => num(r.账户数) },
    { key: 'CTR', label: 'CTR', align: 'right', render: (r) => pct(r.CTR, 2) },
    { key: 'CPC', label: 'CPC', align: 'right', render: (r) => dec(r.CPC) },
    { key: 'CVR', label: 'CVR', align: 'right', render: (r) => pct(r.CVR, 2) },
    { key: 'CPA', label: 'CPA', align: 'right', render: (r) => <span className="text-muted">{dec(r.CPA, 1)}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="text-[12px] text-faint">媒体数据为整段口径,不随顶部日期筛选变化。</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.rows.map((r) => (
          <StatTile
            key={r.媒体}
            label={r.媒体}
            value={wan(r.消耗)}
            sub={`占比 ${pct(r.占比)} · ${num(r.账户数)} 个账户`}
          />
        ))}
      </div>
      <Card title="媒体 消耗 vs 激活" extra={<span className="text-[12px] text-muted">紫=消耗占比 · 青=激活占比</span>}>
        <CompareList
          data={data.rows.map((r) => ({ name: r.媒体, 消耗: r.消耗, 激活: r.激活 }))}
          totalC={总消耗}
          totalA={总激活}
        />
      </Card>
      <Card title="媒体明细" extra={<span className="text-[12px] text-muted">CPA 目标不同·勿直接横比</span>}>
        <DataTable cols={cols} rows={data.rows} initialSort={{ key: '消耗', dir: 'desc' }} />
      </Card>
    </div>
  )
}

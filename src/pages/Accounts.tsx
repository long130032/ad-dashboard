import { useState } from 'react'
import { Card } from '../components/Card'
import { DataTable, type Col } from '../components/DataTable'
import { StatTile } from '../components/StatTile'
import { StatusBadge } from '../components/StatusBadge'
import { useApi } from '../lib/useApi'
import { money, num, wan } from '../lib/format'
import { useFilters } from '../store/filters'
import { Loading } from './Overview'

type Acct = {
  优化师: string
  创量项目: string
  媒体: string | null
  账户名称: string
  问题类型: string
  消耗: number
  点击数: number
  转化数: number
  激活数: number
  浪费金额: number
  病灶: string
  建议: string
}
type Resp = {
  total: number
  counts: Record<string, { 账户数: number; 消耗: number }>
  rows: Acct[]
}

const TABS = ['全部', '有消耗无产出', '成本偏高', '起量中', '零消耗', '正常']
const CARD_ORDER = ['有消耗无产出', '成本偏高', '起量中', '零消耗', '正常']

export function Accounts() {
  const { filters } = useFilters()
  const [tab, setTab] = useState('全部')
  const { data, loading } = useApi<Resp>('accounts', {
    优化师: filters.优化师,
    项目: filters.项目,
    媒体: filters.媒体,
    问题类型: tab === '全部' ? undefined : tab,
    起始: filters.起始,
    截止: filters.截止,
  })

  const cols: Col<Acct>[] = [
    { key: '优化师', label: '优化师', render: (r) => r.优化师 },
    { key: '创量项目', label: '项目', render: (r) => <span className="text-ink">{r.创量项目}</span> },
    { key: '账户名称', label: '账户', render: (r) => <span className="text-muted">{r.账户名称}</span> },
    { key: '问题类型', label: '类别', render: (r) => <StatusBadge value={r.问题类型} /> },
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => money(r.消耗) },
    { key: '转化数', label: '转化', align: 'right', render: (r) => num(r.转化数) },
    { key: '激活数', label: '激活', align: 'right', render: (r) => num(r.激活数) },
    {
      key: '浪费金额',
      label: '白花的钱',
      align: 'right',
      sortable: true,
      sortVal: (r) => r.浪费金额,
      render: (r) => (r.浪费金额 > 0 ? <span className="font-semibold text-bad">{money(r.浪费金额)}</span> : <span className="text-faint">—</span>),
    },
    { key: '病灶', label: '病灶', render: (r) => <span className="text-risk">{r.病灶 || '—'}</span> },
    { key: '建议', label: '处理建议', render: (r) => <span className="text-muted">{r.建议 || '—'}</span> },
  ]

  const counts = data?.counts ?? {}

  return (
    <div className="space-y-4">
      {/* 5 类健康分布计数卡(点击筛选) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {CARD_ORDER.map((t) => {
          const c = counts[t] ?? { 账户数: 0, 消耗: 0 }
          const on = tab === t
          return (
            <StatTile
              key={t}
              badge={t}
              value={num(c.账户数)}
              sub={`消耗 ${wan(c.消耗)}`}
              active={on}
              onClick={() => setTab(on ? '全部' : t)}
            />
          )
        })}
      </div>

      <Card
        title={
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1 text-[13px] transition-colors ${
                  tab === t ? 'bg-brand-soft text-brand font-medium' : 'text-muted hover:text-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        }
        extra={<span className="text-[12px] text-muted">{data ? `${data.total} 个账户·按白花的钱排序` : ''}</span>}
      >
        {loading || !data ? (
          <Loading />
        ) : (
          <DataTable cols={cols} rows={data.rows} initialSort={{ key: '浪费金额', dir: 'desc' }} />
        )}
      </Card>
    </div>
  )
}

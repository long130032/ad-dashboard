import { Card } from '../components/Card'
import { DataTable, type Col } from '../components/DataTable'
import { useApi } from '../lib/useApi'
import { dec, num } from '../lib/format'
import { useFilters } from '../store/filters'
import { Loading } from './Overview'

type Row = {
  优化师: string
  创量项目: string
  媒体: string | null
  账户名称: string
  转化目标: string | null
  问题类型: string
  消耗: number
  展示数: number
  点击数: number
  转化数: number
}

const HEADERS = ['优化师', '创量项目', '媒体', '账户名称', '转化目标', '问题类型', '消耗', '展示数', '点击数', '转化数']

function exportCsv(rows: Row[]) {
  const lines = [HEADERS.join(',')]
  for (const r of rows as any[]) {
    lines.push(HEADERS.map((h) => `"${r[h] ?? ''}"`).join(','))
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '数据明细.csv'
  a.click()
}

export function Detail() {
  const { filters } = useFilters()
  const { data, loading } = useApi<{ total: number; rows: Row[] }>('accounts', filters)
  if (loading || !data) return <Loading />

  const cols: Col<Row>[] = [
    { key: '优化师', label: '优化师', render: (r) => r.优化师 },
    { key: '创量项目', label: '项目', render: (r) => r.创量项目 },
    { key: '媒体', label: '媒体', render: (r) => r.媒体 ?? '—' },
    { key: '账户名称', label: '账户', render: (r) => <span className="text-muted">{r.账户名称}</span> },
    { key: '转化目标', label: '目标', render: (r) => r.转化目标 ?? '—' },
    { key: '问题类型', label: '状态', render: (r) => r.问题类型 },
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => dec(r.消耗, 0) },
    { key: '展示数', label: '展示', align: 'right', render: (r) => num(r.展示数) },
    { key: '点击数', label: '点击', align: 'right', render: (r) => num(r.点击数) },
    { key: '转化数', label: '转化', align: 'right', render: (r) => num(r.转化数) },
  ]

  return (
    <Card
      title="数据明细"
      extra={
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted">{data.total} 行</span>
          <button onClick={() => exportCsv(data.rows)} className="rounded-lg border border-line px-3 py-1 text-[13px] text-ink hover:bg-canvas">
            导出 CSV
          </button>
        </div>
      }
    >
      <DataTable cols={cols} rows={data.rows} initialSort={{ key: '消耗', dir: 'desc' }} />
    </Card>
  )
}

import {
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { DataTable, type Col } from '../components/DataTable'
import { StatTile } from '../components/StatTile'
import { StatusBadge } from '../components/StatusBadge'
import { Sparkline } from '../components/Sparkline'
import { useApi } from '../lib/useApi'
import { dec, money, num, pct, wan } from '../lib/format'
import { CHART } from '../lib/palette'
import { useFilters } from '../store/filters'
import { Loading } from './Overview'

type Proj = {
  创量项目: string
  状态建议: string
  消耗: number
  占比: number
  账户数: number
  CPA: number | null
  转化: number
  白花的钱: number
  白花钱比例: number | null
  主要在投: string | null
  spark: number[] | null
  消耗变化: number | null
  cpa变化: number | null
}
type Summary = {
  在投项目数: number
  总消耗: number
  总白花: number
  白花比例: number | null
  集中度Top3: number | null
  成本变贵项目数: number
  偏高线: number
  有趋势: boolean
}
type Resp = { rows: Proj[]; summary: Summary }

const AXIS = { fontSize: 11, fill: CHART.axis }
// 趋势配色:红=成本在变贵 / 绿=在变好 / 灰=平稳或无数据
const trendColor = (v: number | null) =>
  v == null ? '#cbd5e1' : v > 0.1 ? '#ef4444' : v < -0.1 ? '#10b981' : '#94a3b8'

/** 「比上一段」涨跌:成本变贵=红,变便宜=绿。v 为比例(0.2 = 涨 20%)。 */
function Trend({ v }: { v: number | null }) {
  if (v == null) return <span className="text-faint">—</span>
  if (v > 0.02) return <span className="text-bad">↑贵了 {pct(v, 0)}</span>
  if (v < -0.02) return <span className="text-ok">↓便宜了 {pct(-v, 0)}</span>
  return <span className="text-muted">持平</span>
}

type Pt = {
  x: number
  y: number
  z: number
  name: string
  cpa变化: number | null
  白花钱比例: number | null
  spark: number[] | null
  消耗: number
}

function BubbleTip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-white p-2 shadow-lg text-[12px] min-w-[160px]">
      <div className="font-medium text-ink truncate">{p.name}</div>
      <div className="text-muted mt-0.5">
        消耗 {wan(p.消耗)} · 白花钱 {pct(p.白花钱比例)}
      </div>
      <div className="text-muted">
        比上一段 <Trend v={p.cpa变化} />
      </div>
      {p.spark && (
        <div className="w-[140px] mt-1">
          <Sparkline data={p.spark} color={trendColor(p.cpa变化)} />
        </div>
      )}
      <div className="text-faint mt-1">点击查看该项目账户 →</div>
    </div>
  )
}

const REASON_CLS: Record<string, string> = {
  成本在变贵: 'bg-bad/10 text-bad',
  大盘在漏: 'bg-risk/10 text-risk',
  花钱骤降: 'bg-amber-50 text-amber-600',
}

export function Projects() {
  const { filters, setFilter } = useFilters()
  const nav = useNavigate()
  const { data, loading } = useApi<Resp>('projects', {
    优化师: filters.优化师,
    媒体: filters.媒体,
    起始: filters.起始,
    截止: filters.截止,
  })
  if (loading || !data) return <Loading />

  const { rows, summary } = data
  const drill = (proj: string) => {
    setFilter('项目', proj)
    nav('/accounts')
  }

  // 分布图数据(只画有花钱的项目;log 轴不能有 0)
  const pts: Pt[] = rows
    .filter((r) => r.消耗 > 0)
    .map((r) => ({
      x: r.消耗,
      y: (r.白花钱比例 ?? 0) * 100,
      z: r.消耗,
      name: r.创量项目,
      cpa变化: r.cpa变化,
      白花钱比例: r.白花钱比例,
      spark: r.spark,
      消耗: r.消耗,
    }))
  const xs = pts.map((p) => p.x).sort((a, b) => a - b)
  const medSpend = xs.length ? xs[Math.floor(xs.length / 2)] : 0
  const ymax = Math.max(10, ...pts.map((p) => p.y))

  // 要重点看的项目(异动榜):命中任一规则即入榜,按消耗排序取前 6
  const flagged: { r: Proj; reason: string }[] = []
  if (summary.有趋势) {
    for (const r of rows) {
      if (r.消耗 <= 0) continue
      let reason = ''
      if (r.cpa变化 != null && r.cpa变化 > 0.2 && r.消耗 >= medSpend) reason = '成本在变贵'
      else if ((r.白花钱比例 ?? 0) > summary.偏高线 && r.消耗 >= medSpend) reason = '大盘在漏'
      else if (r.消耗变化 != null && r.消耗变化 < -0.3) reason = '花钱骤降'
      if (reason) flagged.push({ r, reason })
    }
    flagged.sort((a, b) => b.r.消耗 - a.r.消耗)
  }
  const topFlagged = flagged.slice(0, 6)

  const cols: Col<Proj>[] = [
    { key: '创量项目', label: '项目', render: (r) => <span className="text-ink">{r.创量项目}</span> },
    { key: '状态建议', label: '状态', render: (r) => <StatusBadge value={r.状态建议} /> },
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => money(r.消耗) },
    { key: '占比', label: '占比', align: 'right', sortable: true, sortVal: (r) => r.占比, render: (r) => pct(r.占比) },
    { key: '白花的钱', label: '白花的钱', align: 'right', sortable: true, sortVal: (r) => r.白花的钱, render: (r) => (r.白花的钱 > 0 ? <span className="text-bad">{money(r.白花的钱)}</span> : <span className="text-faint">—</span>) },
    {
      key: '白花钱比例',
      label: '白花钱比例',
      align: 'right',
      sortable: true,
      sortVal: (r) => r.白花钱比例 ?? 0,
      render: (r) => <span className={(r.白花钱比例 ?? 0) > summary.偏高线 ? 'text-bad font-medium' : ''}>{pct(r.白花钱比例)}</span>,
    },
    { key: 'CPA', label: 'CPA', align: 'right', render: (r) => dec(r.CPA, 1) },
    { key: 'cpa变化', label: '比上一段', align: 'right', sortable: true, sortVal: (r) => r.cpa变化 ?? -99, render: (r) => <Trend v={r.cpa变化} /> },
    { key: '转化', label: '转化', align: 'right', sortable: true, sortVal: (r) => r.转化, render: (r) => num(r.转化) },
    { key: '主要在投', label: '主要在投', render: (r) => <span className="text-muted">{r.主要在投 ?? '—'}</span> },
    { key: '账户数', label: '账户数', align: 'right', sortable: true, sortVal: (r) => r.账户数, render: (r) => num(r.账户数) },
  ]

  return (
    <div className="space-y-4">
      {/* ① 整盘体检 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatTile label="在投项目" value={num(summary.在投项目数)} sub="有花钱的项目" />
        <StatTile label="总消耗" value={wan(summary.总消耗)} />
        <StatTile label="整盘白花了" value={money(summary.总白花)} sub={`占总消耗 ${pct(summary.白花比例)}`} />
        <StatTile label="钱有多集中" value={pct(summary.集中度Top3)} sub="最大3个项目占" />
        <StatTile
          label="成本在变贵"
          value={summary.有趋势 ? `${summary.成本变贵项目数} 个` : '—'}
          sub={summary.有趋势 ? '比上一段更贵的项目' : '需按天数据'}
        />
      </div>

      {/* ② 项目分布图 */}
      <Card
        title="项目分布图"
        extra={<span className="text-[12px] text-muted">横轴=花钱多少 · 纵轴=白花钱比例 · 气泡越大花得越多 · 红=成本在变贵</span>}
      >
        {pts.length === 0 ? (
          <div className="py-16 text-center text-muted text-[14px]">暂无在投项目</div>
        ) : (
          <>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
                  <XAxis
                    type="number"
                    dataKey="x"
                    scale="log"
                    domain={[xs[0], xs[xs.length - 1]]}
                    tickFormatter={(v) => wan(v)}
                    tick={AXIS}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[0, Math.ceil(ymax)]}
                    tickFormatter={(v) => v + '%'}
                    tick={AXIS}
                    width={44}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ZAxis dataKey="z" range={[80, 700]} />
                  <ReferenceLine x={medSpend} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <ReferenceLine y={summary.偏高线 * 100} stroke="#fca5a5" strokeDasharray="4 4" />
                  <Tooltip content={<BubbleTip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={pts} onClick={(pt) => pt?.payload?.name && drill(pt.payload.name)} className="cursor-pointer">
                    {pts.map((p, i) => (
                      <Cell key={i} fill={trendColor(p.cpa变化)} fillOpacity={0.7} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
              <span>左上=花得多还白花得多(要排查)</span>
              <span>左下=花得多又干净(主力)</span>
              <span>右下=小而稳(潜力)</span>
              <span>点气泡看该项目账户</span>
            </div>
          </>
        )}
      </Card>

      {/* ③ 要重点看的项目 */}
      {summary.有趋势 && topFlagged.length > 0 && (
        <Card title="要重点看的项目" extra={<span className="text-[12px] text-muted">这段时间出了变化、该过问的</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topFlagged.map(({ r, reason }) => (
              <button
                key={r.创量项目}
                onClick={() => drill(r.创量项目)}
                className="text-left rounded-xl border border-line p-3 hover:border-brand hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink truncate">{r.创量项目}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${REASON_CLS[reason]}`}>{reason}</span>
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  消耗 {wan(r.消耗)} · CPA {dec(r.CPA, 1)} · 比上一段 <Trend v={r.cpa变化} />
                </div>
                {r.spark && (
                  <div className="mt-1.5">
                    <Sparkline data={r.spark} color={trendColor(r.cpa变化)} height={28} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ④ 明细表 */}
      <Card title="项目明细" extra={<span className="text-[12px] text-muted">点项目看它的账户 · CPA 不同项目间勿直接比</span>}>
        <DataTable cols={cols} rows={rows} initialSort={{ key: '消耗', dir: 'desc' }} onRowClick={(r) => drill(r.创量项目)} />
      </Card>
    </div>
  )
}

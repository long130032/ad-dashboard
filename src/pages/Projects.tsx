import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
import { Sparkline } from '../components/Sparkline'
import { useApi } from '../lib/useApi'
import { dec, money, num, pct, wan } from '../lib/format'
import { CHART } from '../lib/palette'
import { useFilters } from '../store/filters'
import { Loading } from './Overview'

// ---------- 类型 ----------
type Proj = {
  创量项目: string
  消耗: number
  占比: number
  展示: number
  点击: number
  转化: number
  CTR: number | null
  CPC: number | null
  CVR: number | null
  CPA: number | null
  零转化消耗: number
  零转化占比: number | null
  账户数: number
  媒体数: number
  是0转化: boolean
  低样本: boolean
  spark: number[] | null
}
type Summary = {
  总消耗: number
  总零转化消耗: number
  零转化占比: number | null
  在投项目数: number
  '0转化项目数': number
  CTR: number | null
  CPC: number | null
  有趋势: boolean
  有媒体: boolean
}
type Bucket = { 区间: string; 项目数: number; 消耗: number; 零转化消耗: number; top5: { 创量项目: string; 零转化占比: number | null; 消耗: number }[] }
type MatrixCell = { 消耗: number; 零转化消耗: number; 零转化占比: number | null; 展示: number; 点击: number; CTR: number | null; CPC: number | null } | null
type Matrix = { 媒体列: string[]; rows: { 创量项目: string; cells: Record<string, MatrixCell> }[] } | null
type Resp = { rows: Proj[]; summary: Summary; buckets: Bucket[]; matrix: Matrix }

type Day = { 时间: string; 消耗: number; 展示: number; 点击: number; 转化: number; 零转化消耗: number }
type Detail = {
  摘要: { 创量项目: string; 消耗: number; 展示: number; 点击: number; 转化: number; 激活: number; CTR: number | null; CPC: number | null; CVR: number | null; CPA: number | null; 零转化消耗: number; 零转化占比: number | null; 账户数: number }
  days: Day[]
  媒体构成: Record<string, number | string | null>[]
  账户分布: Record<string, { 账户数: number; 消耗: number }>
  链路: { 展示: number; 点击: number; 转化: number; 激活: number; CTR: number | null; 点击转化率: number | null; 转化激活率: number | null } | null
}

// ---------- 颜色 ----------
const C_有效 = CHART.accent // 青蓝
const C_零转化 = '#f87171' // 浅红
const C_整盘 = '#94a3b8'
const AXIS = { fontSize: 11, fill: CHART.axis }
const div = (a: number, b: number | null | undefined) => (b ? a / b : null)
// 0转化占比 → 浅到深红底色(克制)
const redBg = (p: number | null) => `rgba(239,68,68,${Math.min(0.06 + (p ?? 0) * 0.85, 0.55)})`

// ---------- 走势指标 ----------
type Metric = { key: string; label: string; calc: (d: Day) => number | null; fmt: (v: number) => string }
const yuan = (v: number) => '¥' + dec(v)
const OVERVIEW_METRICS: Metric[] = [
  { key: '消耗', label: '消耗', calc: (d) => d.消耗, fmt: wan },
  { key: '展示', label: '展示', calc: (d) => d.展示, fmt: num },
  { key: '点击', label: '点击', calc: (d) => d.点击, fmt: num },
  { key: 'CTR', label: 'CTR', calc: (d) => { const v = div(d.点击, d.展示); return v == null ? null : v * 100 }, fmt: (v) => v.toFixed(2) + '%' },
  { key: 'CPC', label: 'CPC', calc: (d) => div(d.消耗, d.点击), fmt: yuan },
  { key: '0转化占比', label: '0转化消耗占比', calc: (d) => { const v = div(d.零转化消耗, d.消耗); return v == null ? null : v * 100 }, fmt: (v) => v.toFixed(1) + '%' },
]

export function Projects() {
  const { filters, setFilter } = useFilters()
  const nav = useNavigate()
  const { data, loading } = useApi<Resp>('projects', {
    优化师: filters.优化师,
    媒体: filters.媒体,
    起始: filters.起始,
    截止: filters.截止,
  })
  const { data: trend } = useApi<{ rows: Day[] }>('trend', { 优化师: filters.优化师, 起始: filters.起始, 截止: filters.截止 })

  const [selected, setSelected] = useState<string | null>(null)
  const [showConv, setShowConv] = useState(false)
  const [metricKey, setMetricKey] = useState('消耗')

  if (loading || !data) return <Loading />
  const { rows, summary, buckets, matrix } = data
  const drill = (proj: string) => { setFilter('项目', proj); nav('/accounts') }
  const toggleSelect = (proj: string) => setSelected((s) => (s === proj ? null : proj))

  return (
    <div className="space-y-4">
      {/* ① KPI 概览带 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatTile label="总消耗" value={wan(summary.总消耗)} sub="所选范围内广告消耗" />
        <StatTile label="0转化消耗" value={money(summary.总零转化消耗)} sub={`占总消耗 ${pct(summary.零转化占比)}`} />
        <StatTile label="在投项目数" value={num(summary.在投项目数)} sub="本期有消耗项目" />
        <StatTile label="0转化项目数" value={num(summary['0转化项目数'])} sub="有消耗但无转化" />
        <StatTile label="整盘流量" value={`${pct(summary.CTR, 2)} CTR`} sub={`CPC ${summary.CPC == null ? '—' : yuan(summary.CPC)}`} />
      </div>

      {/* 第一屏:图A 消耗结构 + 图B 流量效率 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendStructure rows={rows} selected={selected} onSelect={toggleSelect} />
        <EfficiencyScatter rows={rows} selected={selected} onSelect={toggleSelect} />
      </div>

      {/* 第二屏:图C 走势 */}
      <TrendCard
        metrics={OVERVIEW_METRICS}
        metricKey={metricKey}
        setMetricKey={setMetricKey}
        overall={trend?.rows ?? []}
        selected={selected}
        hasTrend={summary.有趋势}
      />

      {/* 第三屏:图E 0转化占比分布 */}
      <DistributionCard buckets={buckets} />

      {/* 第四屏:图F 媒体矩阵 */}
      {matrix && <MediaMatrix matrix={matrix} selected={selected} onSelect={toggleSelect} />}

      {/* 第五屏:主表 */}
      <ProjectTable rows={rows} showConv={showConv} setShowConv={setShowConv} onSelect={toggleSelect} hasTrend={summary.有趋势} />

      {/* 右侧抽屉:单项目详情 */}
      {selected && <DetailDrawer 项目名={selected} onClose={() => setSelected(null)} onDrill={drill} />}
    </div>
  )
}

// ---------- ② 各项目消耗结构 ----------
function SpendStructure({ rows, selected, onSelect }: { rows: Proj[]; selected: string | null; onSelect: (p: string) => void }) {
  const spending = rows.filter((r) => r.消耗 > 0)
  const top = spending.slice(0, 15)
  const restSpend = spending.slice(15).reduce((s, r) => s + r.消耗, 0)
  const rest零 = spending.slice(15).reduce((s, r) => s + r.零转化消耗, 0)
  const data = top.map((r) => ({ name: r.创量项目, 有效消耗: r.消耗 - r.零转化消耗, 零转化消耗: r.零转化消耗, 消耗: r.消耗, 零转化占比: r.零转化占比 }))
  if (restSpend > 0) data.push({ name: '其他项目', 有效消耗: restSpend - rest零, 零转化消耗: rest零, 消耗: restSpend, 零转化占比: div(rest零, restSpend) })

  return (
    <Card title="各项目消耗结构" extra={<span className="text-[12px] text-muted">青=有效消耗 · 红=0转化消耗</span>}>
      <div style={{ height: Math.max(220, data.length * 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap={6}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => (v / 10000).toFixed(0) + '万'} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false}
              tickFormatter={(v: string) => (v.length > 7 ? v.slice(0, 7) + '…' : v)} />
            <Tooltip content={<StructTip />} cursor={{ fill: 'rgba(109,92,245,0.05)' }} />
            <Bar dataKey="有效消耗" stackId="a" fill={C_有效} radius={[3, 0, 0, 3]} onClick={(d: { name?: string }) => d?.name && d.name !== '其他项目' && onSelect(d.name)} className="cursor-pointer" />
            <Bar dataKey="零转化消耗" stackId="a" fill={C_零转化} radius={[0, 3, 3, 0]} onClick={(d: { name?: string }) => d?.name && d.name !== '其他项目' && onSelect(d.name)} className="cursor-pointer">
              {data.map((d, i) => (
                <Cell key={i} stroke={selected === d.name ? CHART.brand : 'none'} strokeWidth={selected === d.name ? 2 : 0} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
function StructTip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; 消耗: number; 零转化消耗: number; 零转化占比: number | null } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-white p-2 shadow-lg text-[12px]">
      <div className="font-medium text-ink">{p.name}</div>
      <div className="text-muted">消耗 {money(p.消耗)}</div>
      <div className="text-muted">0转化消耗 {money(p.零转化消耗)}({pct(p.零转化占比)})</div>
    </div>
  )
}

// ---------- ③ 流量效率分布(气泡) ----------
function EfficiencyScatter({ rows, selected, onSelect }: { rows: Proj[]; selected: string | null; onSelect: (p: string) => void }) {
  const pts = rows.filter((r) => r.消耗 > 0 && (r.点击 ?? 0) > 0 && r.CPC != null && r.CTR != null)
    .map((r) => ({ name: r.创量项目, x: r.CPC as number, y: (r.CTR as number) * 100, z: r.消耗, 零转化占比: r.零转化占比, 消耗: r.消耗, 展示: r.展示, 点击: r.点击 }))
  const hasFlow = pts.length > 0

  if (!hasFlow) {
    // 降级:0转化消耗占比排行
    const rank = rows.filter((r) => r.消耗 > 0).slice(0, 12)
    return (
      <Card title="各项目 0转化消耗占比" extra={<span className="text-[12px] text-muted">无展示/点击数据,改看占比</span>}>
        <div className="space-y-1.5">
          {rank.map((r) => (
            <button key={r.创量项目} onClick={() => onSelect(r.创量项目)} className="w-full flex items-center gap-2 text-left">
              <span className="w-28 truncate text-[12px] text-ink">{r.创量项目}</span>
              <span className="flex-1 h-3 rounded bg-canvas overflow-hidden"><span className="block h-full" style={{ width: pct(r.零转化占比), background: C_零转化 }} /></span>
              <span className="w-12 text-right text-[12px] tabular-nums text-muted">{pct(r.零转化占比)}</span>
            </button>
          ))}
        </div>
      </Card>
    )
  }

  const xs = pts.map((p) => p.x).sort((a, b) => a - b)
  const ys = pts.map((p) => p.y).sort((a, b) => a - b)
  const medX = xs[Math.floor(xs.length / 2)]
  const medY = ys[Math.floor(ys.length / 2)]
  const top5 = new Set([...pts].sort((a, b) => b.消耗 - a.消耗).slice(0, 5).map((p) => p.name))

  return (
    <Card title="项目流量效率分布" extra={<span className="text-[12px] text-muted">横=CPC 纵=CTR 气泡=消耗 色=0转化占比</span>}>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 16, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} />
            <XAxis type="number" dataKey="x" name="CPC" tickFormatter={yuan} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey="y" name="CTR" tickFormatter={(v) => v + '%'} tick={AXIS} width={40} axisLine={false} tickLine={false} />
            <ZAxis dataKey="z" range={[60, 600]} />
            <ReferenceLine x={medX} stroke="#e2e8f0" strokeDasharray="4 4" />
            <ReferenceLine y={medY} stroke="#e2e8f0" strokeDasharray="4 4" />
            <Tooltip content={<FlowTip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={pts} onClick={(pt) => pt?.payload?.name && onSelect(pt.payload.name)} className="cursor-pointer">
              {pts.map((p, i) => (
                <Cell key={i} fill={C_零转化} fillOpacity={Math.min(0.25 + (p.零转化占比 ?? 0) * 1.4, 0.9)}
                  stroke={selected === p.name ? CHART.brand : top5.has(p.name) ? '#64748b' : 'none'} strokeWidth={selected === p.name ? 2 : 1} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
function FlowTip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; 消耗: number; 展示: number; 点击: number; x: number; y: number; 零转化占比: number | null } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-white p-2 shadow-lg text-[12px] min-w-[150px]">
      <div className="font-medium text-ink truncate">{p.name}</div>
      <div className="text-muted">消耗 {wan(p.消耗)} · 0转化 {pct(p.零转化占比)}</div>
      <div className="text-muted">CTR {p.y.toFixed(2)}% · CPC {yuan(p.x)}</div>
      <div className="text-muted">展示 {num(p.展示)} · 点击 {num(p.点击)}</div>
    </div>
  )
}

// ---------- ④ 投放走势 ----------
function TrendCard({ metrics, metricKey, setMetricKey, overall, selected, hasTrend }: {
  metrics: Metric[]; metricKey: string; setMetricKey: (k: string) => void; overall: Day[]; selected: string | null; hasTrend: boolean
}) {
  const { filters } = useFilters()
  const { data: detail } = useApi<Detail>('projectDetail', { 项目名: selected ?? '', 优化师: filters.优化师, 起始: filters.起始, 截止: filters.截止 })
  const m = metrics.find((x) => x.key === metricKey) ?? metrics[0]
  if (!hasTrend) {
    return <Card title="投放走势"><div className="py-10 text-center text-muted text-[14px]">需上传「按天」报表后查看走势</div></Card>
  }
  const projDays = selected ? detail?.days ?? [] : []
  const projMap = new Map(projDays.map((d) => [d.时间, m.calc(d)]))
  const data = overall.map((d) => ({ 时间: d.时间, 整盘: m.calc(d), 项目: selected ? (projMap.get(d.时间) ?? null) : undefined }))

  return (
    <Card title="投放走势" extra={
      <div className="flex gap-1">
        {metrics.map((x) => (
          <button key={x.key} onClick={() => setMetricKey(x.key)}
            className={`rounded-md px-2 py-0.5 text-[12px] ${metricKey === x.key ? 'bg-brand-soft text-brand font-medium' : 'text-muted hover:text-ink'}`}>{x.label}</button>
        ))}
      </div>
    }>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="时间" tick={AXIS} minTickGap={28} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} width={48} axisLine={false} tickLine={false} tickFormatter={(v) => m.fmt(v)} />
            <Tooltip formatter={(v) => m.fmt(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
            <Line type="monotone" dataKey="整盘" stroke={C_整盘} strokeWidth={2} dot={false} name="整盘" connectNulls />
            {selected && <Line type="monotone" dataKey="项目" stroke={CHART.brand} strokeWidth={2} dot={false} name={selected} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ---------- ⑤ 0转化占比分布 ----------
function DistributionCard({ buckets }: { buckets: Bucket[] }) {
  const data = buckets.map((b, i) => ({ ...b, idx: i }))
  return (
    <Card title="0转化消耗占比分布" extra={<span className="text-[12px] text-muted">各项目的 0转化消耗占比落在哪个区间</span>}>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="区间" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} width={32} axisLine={false} tickLine={false} />
            <Tooltip content={<BucketTip />} cursor={{ fill: 'rgba(239,68,68,0.04)' }} />
            <Bar dataKey="项目数" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {data.map((_, i) => <Cell key={i} fill={`rgba(239,68,68,${0.25 + i * 0.16})`} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
function BucketTip({ active, payload }: { active?: boolean; payload?: { payload: Bucket }[] }) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-white p-2 shadow-lg text-[12px] min-w-[180px]">
      <div className="font-medium text-ink">0转化占比 {b.区间}</div>
      <div className="text-muted">{b.项目数} 个项目 · 消耗 {wan(b.消耗)} · 0转化 {wan(b.零转化消耗)}</div>
      {b.top5.length > 0 && <div className="mt-1 border-t border-line pt-1">
        {b.top5.map((t) => <div key={t.创量项目} className="flex justify-between gap-3"><span className="truncate">{t.创量项目}</span><span className="text-faint">{pct(t.零转化占比)}</span></div>)}
      </div>}
    </div>
  )
}

// ---------- ⑥ 项目媒体矩阵 ----------
function MediaMatrix({ matrix, selected, onSelect }: { matrix: NonNullable<Matrix>; selected: string | null; onSelect: (p: string) => void }) {
  return (
    <Card title="项目媒体分布" extra={<span className="text-[12px] text-muted">单元格=消耗 · 越红=0转化占比越高</span>}>
      <div className="overflow-auto">
        <table className="text-[12px] border-collapse">
          <thead>
            <tr className="text-muted">
              <th className="text-left font-medium py-1.5 px-2 sticky left-0 bg-white">项目</th>
              {matrix.媒体列.map((m) => <th key={m} className="text-right font-medium py-1.5 px-2 whitespace-nowrap">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.创量项目} onClick={() => onSelect(row.创量项目)}
                className={`cursor-pointer hover:bg-canvas/60 ${selected === row.创量项目 ? 'ring-1 ring-brand' : ''}`}>
                <td className="py-1.5 px-2 text-ink sticky left-0 bg-white whitespace-nowrap max-w-[160px] truncate">{row.创量项目}</td>
                {matrix.媒体列.map((m) => {
                  const c = row.cells[m]
                  return (
                    <td key={m} className="py-1.5 px-2 text-right tabular-nums" style={c ? { background: redBg(c.零转化占比) } : undefined}>
                      {c ? wan(c.消耗) : <span className="text-faint">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------- ⑦ 主表 ----------
function ProjectTable({ rows, showConv, setShowConv, onSelect, hasTrend }: {
  rows: Proj[]; showConv: boolean; setShowConv: (b: boolean) => void; onSelect: (p: string) => void; hasTrend: boolean
}) {
  const cols: Col<Proj>[] = [
    { key: '创量项目', label: '项目', render: (r) => (
      <span className="flex items-center gap-1.5">
        <span className="text-ink">{r.创量项目}</span>
        {r.是0转化 && <Tag>0转化</Tag>}
        {r.低样本 && <Tag>低样本</Tag>}
      </span>
    ) },
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => money(r.消耗) },
    { key: '占比', label: '占比', align: 'right', sortable: true, sortVal: (r) => r.占比, render: (r) => pct(r.占比) },
    { key: '零转化消耗', label: '0转化消耗', align: 'right', sortable: true, sortVal: (r) => r.零转化消耗, render: (r) => (r.零转化消耗 > 0 ? money(r.零转化消耗) : <span className="text-faint">—</span>) },
    { key: '零转化占比', label: '0转化占比', align: 'right', sortable: true, sortVal: (r) => r.零转化占比 ?? 0, render: (r) => <span style={{ color: (r.零转化占比 ?? 0) > 0.1 ? '#dc2626' : undefined }}>{pct(r.零转化占比)}</span> },
    { key: '展示', label: '展示', align: 'right', sortable: true, sortVal: (r) => r.展示, render: (r) => num(r.展示) },
    { key: '点击', label: '点击', align: 'right', sortable: true, sortVal: (r) => r.点击, render: (r) => num(r.点击) },
    { key: 'CTR', label: 'CTR', align: 'right', render: (r) => pct(r.CTR, 2) },
    { key: 'CPC', label: 'CPC', align: 'right', render: (r) => dec(r.CPC) },
    ...(showConv ? [
      { key: '转化', label: '转化', align: 'right' as const, sortable: true, sortVal: (r: Proj) => r.转化, render: (r: Proj) => num(r.转化) },
      { key: 'CPA', label: 'CPA', align: 'right' as const, render: (r: Proj) => dec(r.CPA, 1) },
      { key: 'CVR', label: 'CVR', align: 'right' as const, render: (r: Proj) => pct(r.CVR, 2) },
    ] : []),
    { key: '账户数', label: '账户数', align: 'right', sortable: true, sortVal: (r) => r.账户数, render: (r) => num(r.账户数) },
    ...(hasTrend ? [{ key: 'spark', label: '走势', render: (r: Proj) => (r.spark && r.spark.length > 1 ? <div className="w-20"><Sparkline data={r.spark} height={22} /></div> : <span className="text-faint">—</span>) }] : []),
  ]
  return (
    <Card title="项目明细" extra={
      <button onClick={() => setShowConv(!showConv)} className="text-[12px] text-brand hover:underline">
        {showConv ? '隐藏转化指标' : '显示转化/CPA/CVR'}
      </button>
    }>
      {showConv && <div className="mb-2 text-[12px] text-faint">转化/CPA/CVR 基于各项目当前转化口径计算,不同项目转化目标可能不同,不建议直接横向比较。</div>}
      <DataTable cols={cols} rows={rows} initialSort={{ key: '消耗', dir: 'desc' }} onRowClick={(r) => onSelect(r.创量项目)} />
    </Card>
  )
}
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded px-1.5 py-0.5 text-[10px] bg-canvas text-faint">{children}</span>
}

// ---------- ⑧ 单项目详情抽屉 ----------
function DetailDrawer({ 项目名, onClose, onDrill }: { 项目名: string; onClose: () => void; onDrill: (p: string) => void }) {
  const { filters } = useFilters()
  const { data, loading } = useApi<Detail>('projectDetail', { 项目名, 优化师: filters.优化师, 起始: filters.起始, 截止: filters.截止 })

  const DETAIL_METRICS: Metric[] = [
    ...OVERVIEW_METRICS,
    { key: '转化', label: '转化', calc: (d) => d.转化, fmt: num },
    { key: 'CPA', label: 'CPA', calc: (d) => div(d.消耗, d.转化), fmt: yuan },
  ]
  const [mk, setMk] = useState('消耗')
  const m = DETAIL_METRICS.find((x) => x.key === mk) ?? DETAIL_METRICS[0]

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-40 h-full w-[560px] max-w-[92vw] overflow-auto bg-white shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-ink truncate">{项目名}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-[20px] leading-none">×</button>
        </div>
        {loading || !data ? <Loading /> : (
          <>
            {/* 摘要 */}
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              {([['消耗', wan(data.摘要.消耗)], ['0转化占比', pct(data.摘要.零转化占比)], ['账户数', num(data.摘要.账户数)],
                 ['转化', num(data.摘要.转化)], ['CPA', data.摘要.CPA == null ? '—' : yuan(data.摘要.CPA)], ['CTR', pct(data.摘要.CTR, 2)]] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line p-2"><div className="text-faint">{k}</div><div className="text-ink font-semibold tabular-nums">{v}</div></div>
              ))}
            </div>
            <div className="text-[11px] text-faint">转化/CPA 基于当前数据口径。</div>

            {/* 项目趋势 */}
            {data.days.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1"><span className="text-[13px] font-medium text-ink">项目趋势</span>
                  <div className="flex flex-wrap gap-1">{DETAIL_METRICS.map((x) => (
                    <button key={x.key} onClick={() => setMk(x.key)} className={`rounded px-1.5 py-0.5 text-[11px] ${mk === x.key ? 'bg-brand-soft text-brand' : 'text-muted'}`}>{x.label}</button>
                  ))}</div>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.days.map((d) => ({ 时间: d.时间, v: m.calc(d) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="时间" tick={{ fontSize: 10, fill: CHART.axis }} minTickGap={24} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: CHART.axis }} width={44} axisLine={false} tickLine={false} tickFormatter={(v) => m.fmt(v)} />
                      <Tooltip formatter={(v) => m.fmt(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                      <Line type="monotone" dataKey="v" stroke={CHART.brand} strokeWidth={2} dot={false} connectNulls name={m.label} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 账户表现分布 */}
            <div>
              <div className="text-[13px] font-medium text-ink mb-1">账户表现分布</div>
              <div className="flex h-7 rounded-lg overflow-hidden text-[11px] text-white">
                {([['有消耗有转化', C_有效], ['有消耗0转化', C_零转化], ['0消耗', '#cbd5e1']] as [string, string][]).map(([k, color]) => {
                  const g = data.账户分布[k]
                  const total = Object.values(data.账户分布).reduce((s, x) => s + x.账户数, 0) || 1
                  const w = (g.账户数 / total) * 100
                  return w > 0 ? <span key={k} style={{ width: w + '%', background: color }} className="flex items-center justify-center" title={`${k} ${g.账户数}个`}>{w > 12 ? g.账户数 : ''}</span> : null
                })}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                {(['有消耗有转化', '有消耗0转化', '0消耗'] as const).map((k) => <span key={k}>{k} {data.账户分布[k].账户数}</span>)}
              </div>
            </div>

            {/* 媒体构成 */}
            {data.媒体构成.length > 0 && (
              <div>
                <div className="text-[13px] font-medium text-ink mb-1">媒体构成</div>
                <table className="w-full text-[12px]">
                  <thead><tr className="text-faint text-left"><th className="font-normal py-1">媒体</th><th className="font-normal py-1 text-right">消耗</th><th className="font-normal py-1 text-right">0转化</th><th className="font-normal py-1 text-right">CTR</th></tr></thead>
                  <tbody>{data.媒体构成.map((m2, i) => (
                    <tr key={i} className="border-t border-line/60"><td className="py-1 text-ink">{String(m2['媒体'])}</td><td className="py-1 text-right tabular-nums">{money(m2['消耗'] as number)}</td><td className="py-1 text-right tabular-nums">{pct(div(m2['零转化消耗'] as number, m2['消耗'] as number))}</td><td className="py-1 text-right tabular-nums">{pct(m2['CTR'] as number, 2)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {/* 转化链路 */}
            {data.链路 ? (
              <div>
                <div className="text-[13px] font-medium text-ink mb-1">转化链路</div>
                <div className="space-y-1 text-[12px]">
                  <FunnelRow 名="展示" 值={data.链路.展示} max={data.链路.展示} 率="" />
                  <FunnelRow 名="点击" 值={data.链路.点击} max={data.链路.展示} 率={`CTR ${pct(data.链路.CTR, 2)}`} />
                  <FunnelRow 名="转化" 值={data.链路.转化} max={data.链路.展示} 率={`点击转化率 ${pct(data.链路.点击转化率, 2)}`} />
                  {data.链路.激活 > 0 && <FunnelRow 名="激活" 值={data.链路.激活} max={data.链路.展示} 率={`转化→激活 ${pct(data.链路.转化激活率, 1)}`} />}
                </div>
              </div>
            ) : <div className="text-[12px] text-faint">当前项目暂无完整链路数据。</div>}

            <button onClick={() => onDrill(项目名)} className="w-full rounded-lg bg-brand py-2 text-[13px] font-medium text-white">查看该项目账户 →</button>
          </>
        )}
      </div>
    </>
  )
}
function FunnelRow({ 名, 值, max, 率 }: { 名: string; 值: number; max: number; 率: string }) {
  const w = max ? Math.max((值 / max) * 100, 1.5) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-faint">{名}</span>
      <span className="flex-1 h-5 rounded bg-canvas overflow-hidden"><span className="block h-full bg-brand/70" style={{ width: w + '%' }} /></span>
      <span className="w-20 text-right tabular-nums text-ink">{num(值)}</span>
      <span className="w-28 text-right text-faint">{率}</span>
    </div>
  )
}

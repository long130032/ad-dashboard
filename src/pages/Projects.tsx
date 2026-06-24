import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
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
  主投媒体: string | null
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
type Bucket = { 区间: string; 项目数: number; 消耗: number; 零转化消耗: number }
type Resp = { rows: Proj[]; summary: Summary; buckets: Bucket[] }

type Day = { 时间: string; 消耗: number; 展示: number; 点击: number; 转化: number; 零转化消耗: number; CPC: number | null; CPA: number | null }
type Peak = { 时间: string; 消耗: number; 贡献: { 项目: string; 消耗: number; 占比: number }[] } | null
type TrendResp = { rows: Day[]; 峰值: Peak }

type DetailT = {
  摘要: { 创量项目: string; 消耗: number; 展示: number; 点击: number; 转化: number; 激活: number; CTR: number | null; CPC: number | null; CVR: number | null; CPA: number | null; 零转化消耗: number; 零转化占比: number | null; 账户数: number }
  days: { 时间: string; 消耗: number; 展示: number; 点击: number; 转化: number; 零转化消耗: number }[]
  媒体构成: Record<string, number | string | null>[]
  账户分布: Record<string, { 账户数: number; 消耗: number }>
  链路: { 展示: number; 点击: number; 转化: number; 激活: number; CTR: number | null; 点击转化率: number | null; 转化激活率: number | null } | null
}

// ---------- 颜色 / 工具 ----------
const C_有效 = CHART.accent // 青蓝(有效消耗)
const C_零转化 = '#f87171' // 浅红(0转化消耗)
const C_均线 = '#2563eb' // 蓝(7日均线)
const C_叠加 = '#ef4444' // 红(0转化占比 / 叠加线)
const C_柱 = '#dbe3fb' // 浅蓝灰(每日消耗柱)
const AXIS = { fontSize: 11, fill: CHART.axis }
const yuan = (v: number) => '¥' + dec(v)
const div = (a: number, b: number | null | undefined) => (b ? a / b : null)
const md = (t: string) => (t.length >= 10 ? t.slice(5) : t) // yyyy-mm-dd → mm-dd

// 0转化占比分层(5 档,带配色)。卡片与区间归属共用。
const BUCKETS = [
  { 名: '0-5%', lo: 0, hi: 0.05, color: '#10b981', soft: '#ecfdf5' },
  { 名: '5-10%', lo: 0.05, hi: 0.1, color: '#3b82f6', soft: '#eff6ff' },
  { 名: '10-20%', lo: 0.1, hi: 0.2, color: '#f59e0b', soft: '#fffbeb' },
  { 名: '20-40%', lo: 0.2, hi: 0.4, color: '#fb7185', soft: '#fff1f2' },
  { 名: '40%+', lo: 0.4, hi: Infinity, color: '#ef4444', soft: '#fef2f2' },
]
const bucketOf = (p: number | null) => {
  const v = p ?? 0
  return (BUCKETS.find((b) => v >= b.lo && (b.hi === Infinity || v < b.hi)) ?? BUCKETS[0]).名
}
// 气泡 0转化占比分档色(4 档:绿/蓝/橙/红)
const zeroColor = (p: number | null) => {
  const v = p ?? 0
  return v < 0.05 ? '#10b981' : v < 0.1 ? '#3b82f6' : v < 0.2 ? '#f59e0b' : '#ef4444'
}
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  return sorted[lo] + (sorted[Math.ceil(pos)] - sorted[lo]) * (pos - lo)
}

// ---------- 走势主指标 / 叠加指标 ----------
type MainKey = '消耗' | '展示' | '点击'
type OverKey = '0转化占比' | 'CPC' | 'CTR'
const MAIN: Record<MainKey, { calc: (d: Day) => number; fmt: (v: number) => string }> = {
  消耗: { calc: (d) => d.消耗, fmt: wan },
  展示: { calc: (d) => d.展示, fmt: num },
  点击: { calc: (d) => d.点击, fmt: num },
}
const OVER: Record<OverKey, { calc: (d: Day) => number | null; fmt: (v: number) => string }> = {
  '0转化占比': { calc: (d) => (d.消耗 ? (d.零转化消耗 / d.消耗) * 100 : null), fmt: (v) => v.toFixed(1) + '%' },
  CPC: { calc: (d) => div(d.消耗, d.点击), fmt: yuan },
  CTR: { calc: (d) => (d.展示 ? (d.点击 / d.展示) * 100 : null), fmt: (v) => v.toFixed(2) + '%' },
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
  const { data: trend } = useApi<TrendResp>('trend', { 优化师: filters.优化师, 起始: filters.起始, 截止: filters.截止 })

  const [selected, setSelected] = useState<string | null>(null) // 选中项目(高亮+抽屉+表定位)
  const [bucketFilter, setBucketFilter] = useState<string | null>(null) // 底部表的区间筛选
  const [userBucket, setUserBucket] = useState<string | null>(null) // 用户点选的分层(模块④展示)

  if (loading || !data) return <Loading />
  const { rows, summary, buckets } = data

  const spending = rows.filter((r) => r.消耗 > 0)
  // 模块④默认选中:0转化消耗金额最高的区间
  const defaultBucket = buckets.length
    ? [...buckets].sort((a, b) => b.零转化消耗 - a.零转化消耗)[0].区间
    : BUCKETS[0].名
  const shownBucket = userBucket ?? defaultBucket

  const selectProject = (p: string) => {
    setSelected((s) => (s === p ? null : p))
    setBucketFilter(null)
  }
  const selectBucket = (b: string) => {
    setUserBucket(b)
    setBucketFilter(b)
    setSelected(null)
  }
  const clearFilter = () => {
    setSelected(null)
    setBucketFilter(null)
  }
  const drill = (proj: string) => {
    setFilter('项目', proj)
    nav('/accounts')
  }

  return (
    <div className="space-y-4">
      {/* ① 投放变化与质量趋势 */}
      <TrendModule trend={trend} hasTrend={summary.有趋势} />

      {/* ② 项目消耗结构 + ③ 流量效率定位 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendStructure rows={spending} selected={selected} onSelect={selectProject} />
        <EfficiencyScatter rows={spending} selected={selected} onSelect={selectProject} />
      </div>

      {/* ④ 0转化占比分层 */}
      <LayerModule
        buckets={buckets}
        rows={spending}
        shownBucket={shownBucket}
        onSelectBucket={selectBucket}
        onSelectProject={selectProject}
      />

      {/* 项目明细表 */}
      <ProjectTable
        rows={rows}
        hasTrend={summary.有趋势}
        hasMedia={summary.有媒体}
        selected={selected}
        bucketFilter={bucketFilter}
        onSelect={selectProject}
        onClear={clearFilter}
      />

      {/* 右侧抽屉:单项目详情 */}
      {selected && <DetailDrawer 项目名={selected} onClose={() => setSelected(null)} onDrill={drill} />}
    </div>
  )
}

// ============== ① 投放变化与质量趋势 ==============
function TrendModule({ trend, hasTrend }: { trend: TrendResp | null; hasTrend: boolean }) {
  const [mainKey, setMainKey] = useState<MainKey>('消耗')
  const [overKey, setOverKey] = useState<OverKey>('0转化占比')

  if (!hasTrend) {
    return (
      <Card title="投放变化与质量趋势">
        <div className="py-12 text-center text-muted text-[14px]">需上传「按天」账户报表后查看每日趋势</div>
      </Card>
    )
  }
  const days = trend?.rows ?? []
  const peak = trend?.峰值 ?? null
  const main = MAIN[mainKey]
  const over = OVER[overKey]

  // 图数据:柱=主指标,蓝线=7日均线(主指标),红线=叠加指标(右轴)
  const mains = days.map((d) => main.calc(d))
  const chart = days.map((d, i) => {
    const lo = Math.max(0, i - 6)
    const win = mains.slice(lo, i + 1)
    return {
      时间: md(d.时间),
      主: mains[i],
      均线: win.reduce((s, v) => s + v, 0) / win.length,
      叠加: over.calc(d),
    }
  })

  // KPI(固定基于消耗)
  const 总消耗 = days.reduce((s, d) => s + d.消耗, 0)
  const 日均 = days.length ? 总消耗 / days.length : 0
  const last7 = days.slice(-7).reduce((s, d) => s + d.消耗, 0)
  const prev7 = days.slice(-14, -7).reduce((s, d) => s + d.消耗, 0)
  const 环比 = prev7 ? last7 / prev7 - 1 : null

  return (
    <Card
      title="投放变化与质量趋势"
      extra={
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <Toggle label="主指标" value={mainKey} opts={['消耗', '展示', '点击']} onChange={(v) => setMainKey(v as MainKey)} />
          <Toggle label="叠加" value={overKey} opts={['0转化占比', 'CPC', 'CTR']} onChange={(v) => setOverKey(v as OverKey)} accent="red" />
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Kpi label="周期消耗" value={wan(总消耗)} />
        <Kpi label="日均消耗" value={wan(日均)} />
        <Kpi label="峰值日" value={peak ? md(peak.时间) : '—'} sub={peak ? wan(peak.消耗) : undefined} />
        <Kpi
          label="近7日环比"
          value={环比 == null ? '—' : (环比 >= 0 ? '+' : '') + (环比 * 100).toFixed(1) + '%'}
          tone={环比 == null ? undefined : 环比 >= 0 ? 'up' : 'down'}
          sub="较前7日"
        />
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="时间" tick={AXIS} minTickGap={24} axisLine={false} tickLine={false} />
            <YAxis yAxisId="L" tick={AXIS} width={48} axisLine={false} tickLine={false} tickFormatter={(v) => main.fmt(v)} />
            <YAxis yAxisId="R" orientation="right" tick={{ ...AXIS, fill: C_叠加 }} width={44} axisLine={false} tickLine={false} tickFormatter={(v) => over.fmt(v)} />
            <Tooltip content={<TrendTip mainKey={mainKey} overKey={overKey} mainFmt={main.fmt} overFmt={over.fmt} />} />
            <Bar yAxisId="L" dataKey="主" fill={C_柱} radius={[3, 3, 0, 0]} maxBarSize={22} name={`每日${mainKey}`} />
            <Line yAxisId="L" type="monotone" dataKey="均线" stroke={C_均线} strokeWidth={2} dot={false} name="7日均线" />
            <Line yAxisId="R" type="monotone" dataKey="叠加" stroke={C_叠加} strokeWidth={2} dot={false} connectNulls name={overKey} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <Legend swatch={C_柱}>每日{mainKey}</Legend>
        <Legend line={C_均线}>7日均线</Legend>
        <Legend line={C_叠加}>{overKey}</Legend>
      </div>

      {peak && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-canvas px-3 py-2 text-[12px]">
          <span className="text-ink font-medium">峰值日 {md(peak.时间)}</span>
          <span className="text-faint">·</span>
          <span className="text-muted">消耗 {wan(peak.消耗)}</span>
          <span className="text-faint">·</span>
          <span className="text-muted">贡献项目:</span>
          {peak.贡献.map((c) => (
            <span key={c.项目} className="text-muted">
              <span className="text-ink">{c.项目}</span> {pct(c.占比)}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  const c = tone === 'up' ? 'text-bad' : tone === 'down' ? 'text-ok' : 'text-ink'
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-0.5 text-[20px] leading-tight font-semibold tabular-nums ${c}`}>
        {value}
        {tone && <span className="ml-0.5 text-[13px]">{tone === 'up' ? '↑' : '↓'}</span>}
      </div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  )
}
function Toggle({ label, value, opts, onChange, accent }: { label: string; value: string; opts: string[]; onChange: (v: string) => void; accent?: 'red' }) {
  const on = accent === 'red' ? 'bg-red-50 text-[#dc2626] font-medium' : 'bg-brand-soft text-brand font-medium'
  return (
    <div className="flex items-center gap-1">
      <span className="text-faint">{label}</span>
      {opts.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`rounded-md px-2 py-0.5 ${value === o ? on : 'text-muted hover:text-ink'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}
function Legend({ swatch, line, children }: { swatch?: string; line?: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />}
      {line && <span className="inline-block h-0.5 w-4 rounded" style={{ background: line }} />}
      {children}
    </span>
  )
}
function TrendTip({ active, payload, label, mainKey, overKey, mainFmt, overFmt }: {
  active?: boolean
  payload?: { payload: { 主: number; 均线: number; 叠加: number | null } }[]
  label?: string
  mainKey: string
  overKey: string
  mainFmt: (v: number) => string
  overFmt: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-white p-2 shadow-lg text-[12px] min-w-[150px]">
      <div className="font-medium text-ink">{label}</div>
      <div className="text-muted">每日{mainKey} {mainFmt(p.主)}</div>
      <div className="text-muted">7日均线 {mainFmt(p.均线)}</div>
      <div style={{ color: C_叠加 }}>{overKey} {p.叠加 == null ? '—' : overFmt(p.叠加)}</div>
    </div>
  )
}

// ============== ② 项目消耗结构(排行式横条表) ==============
function SpendStructure({ rows, selected, onSelect }: { rows: Proj[]; selected: string | null; onSelect: (p: string) => void }) {
  const top = rows.slice(0, 10)
  const restSpend = rows.slice(10).reduce((s, r) => s + r.消耗, 0)
  const rest零 = rows.slice(10).reduce((s, r) => s + r.零转化消耗, 0)
  type LineRow = { name: string; 消耗: number; 零转化消耗: number; 零转化占比: number | null; clickable: boolean }
  const list: LineRow[] = top.map((r) => ({ name: r.创量项目, 消耗: r.消耗, 零转化消耗: r.零转化消耗, 零转化占比: r.零转化占比, clickable: true }))
  if (restSpend > 0) list.push({ name: '其他项目', 消耗: restSpend, 零转化消耗: rest零, 零转化占比: div(rest零, restSpend), clickable: false })
  const maxSpend = list.length ? Math.max(...list.map((r) => r.消耗)) : 1

  return (
    <Card title="项目消耗结构" extra={<span className="text-[12px] text-muted">青=有效消耗 · 红=0转化消耗</span>}>
      <div className="flex items-center gap-2 pb-1.5 text-[11px] text-faint border-b border-line">
        <span className="flex-1">项目</span>
        <span className="w-[34%]">消耗结构</span>
        <span className="w-20 text-right">总消耗</span>
        <span className="w-14 text-right">0转化占比</span>
      </div>
      <div className="divide-y divide-line/60">
        {list.map((r) => {
          const w = (r.消耗 / maxSpend) * 100
          const zr = r.消耗 ? (r.零转化消耗 / r.消耗) * 100 : 0
          const active = selected === r.name
          return (
            <div
              key={r.name}
              onClick={() => r.clickable && onSelect(r.name)}
              className={`flex items-center gap-2 py-1.5 text-[12px] ${r.clickable ? 'cursor-pointer hover:bg-canvas/60' : ''} ${active ? 'bg-brand-soft/50' : ''}`}
            >
              <span className={`flex-1 truncate ${active ? 'text-brand font-medium' : 'text-ink'}`} title={r.name}>{r.name}</span>
              <span className="w-[34%]">
                <span className="flex h-3.5 rounded-sm overflow-hidden bg-canvas" style={{ width: `${Math.max(w, 3)}%` }}>
                  <span className="h-full" style={{ width: `${100 - zr}%`, background: C_有效 }} />
                  <span className="h-full" style={{ width: `${zr}%`, background: C_零转化 }} />
                </span>
              </span>
              <span className="w-20 text-right tabular-nums text-ink">{wan(r.消耗)}</span>
              <span className="w-14 text-right tabular-nums" style={{ color: (r.零转化占比 ?? 0) > 0.1 ? '#dc2626' : '#64748b' }}>{pct(r.零转化占比)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ============== ③ 流量效率定位(CPC × CTR 象限气泡) ==============
function EfficiencyScatter({ rows, selected, onSelect }: { rows: Proj[]; selected: string | null; onSelect: (p: string) => void }) {
  const valid = rows.filter((r) => r.点击 > 0 && r.CPC != null && r.CTR != null)

  if (valid.length === 0) {
    // 降级:无展示/点击 → 0转化占比排行
    const rank = rows.slice(0, 12)
    return (
      <Card title="流量效率定位" extra={<span className="text-[12px] text-muted">无展示/点击,改看 0转化占比</span>}>
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

  // P95 聚焦坐标轴,极端点 clamp 到边缘(真值留 tooltip)
  const xsAll = valid.map((r) => r.CPC as number).sort((a, b) => a - b)
  const ysAll = valid.map((r) => (r.CTR as number) * 100).sort((a, b) => a - b)
  const p95x = quantile(xsAll, 0.95)
  const p95y = quantile(ysAll, 0.95)
  const xMax = +(p95x * 1.08).toFixed(2) || 1
  const yMax = +(p95y * 1.08).toFixed(2) || 1
  const medX = quantile(xsAll, 0.5)
  const medY = quantile(ysAll, 0.5)

  const labelSet = new Set([
    ...[...valid].sort((a, b) => b.消耗 - a.消耗).slice(0, 3).map((r) => r.创量项目),
    ...[...valid].sort((a, b) => (b.零转化占比 ?? 0) - (a.零转化占比 ?? 0)).slice(0, 3).map((r) => r.创量项目),
  ])
  const pts = valid.map((r) => {
    const rawX = r.CPC as number
    const rawY = (r.CTR as number) * 100
    return {
      name: r.创量项目,
      x: Math.min(rawX, xMax),
      y: Math.min(rawY, yMax),
      z: r.消耗,
      rawX,
      rawY,
      消耗: r.消耗,
      展示: r.展示,
      点击: r.点击,
      零转化占比: r.零转化占比,
      label: labelSet.has(r.创量项目) ? r.创量项目 : '',
    }
  })

  const quad = (x1: number, x2: number, y1: number, y2: number, fill: string, text: string, pos: string) => (
    <ReferenceArea x1={x1} x2={x2} y1={y1} y2={y2} fill={fill} fillOpacity={1} stroke="none"
      label={{ value: text, position: pos as 'insideTopLeft', fontSize: 10, fill: '#94a3b8' }} />
  )

  return (
    <Card title="流量效率定位" extra={<span className="text-[12px] text-muted">横=CPC 纵=CTR · 气泡=消耗 · 色=0转化占比</span>}>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 16, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} />
            {quad(0, medX, medY, yMax, '#ecfdf5', '低CPC / 高CTR', 'insideTopLeft')}
            {quad(medX, xMax, medY, yMax, '#eff6ff', '高CPC / 高CTR', 'insideTopRight')}
            {quad(0, medX, 0, medY, '#f8fafc', '低CPC / 低CTR', 'insideBottomLeft')}
            {quad(medX, xMax, 0, medY, '#fff1f2', '高CPC / 低CTR', 'insideBottomRight')}
            <XAxis type="number" dataKey="x" name="CPC" domain={[0, xMax]} tickFormatter={yuan} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey="y" name="CTR" domain={[0, yMax]} tickFormatter={(v) => v + '%'} tick={AXIS} width={40} axisLine={false} tickLine={false} />
            <ZAxis dataKey="z" range={[60, 620]} />
            <ReferenceLine x={medX} stroke="#cbd5e1" strokeDasharray="4 4" />
            <ReferenceLine y={medY} stroke="#cbd5e1" strokeDasharray="4 4" />
            <Tooltip content={<FlowTip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={pts} onClick={(pt) => pt?.payload?.name && onSelect(pt.payload.name)} className="cursor-pointer">
              {pts.map((p, i) => (
                <Cell key={i} fill={zeroColor(p.零转化占比)} fillOpacity={0.62}
                  stroke={selected === p.name ? CHART.brand : 'none'} strokeWidth={selected === p.name ? 2 : 0} />
              ))}
              <LabelList dataKey="label" position="top" style={{ fontSize: 10, fill: '#475569' }} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-2">
          0转化占比:
          {[['0-5%', '#10b981'], ['5-10%', '#3b82f6'], ['10-20%', '#f59e0b'], ['20%+', '#ef4444']].map(([t, c]) => (
            <span key={t} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{t}</span>
          ))}
        </span>
        <span className="inline-flex items-center gap-1">消耗 <span className="h-1.5 w-1.5 rounded-full bg-faint" /> <span className="h-2.5 w-2.5 rounded-full bg-faint" /> <span className="h-3.5 w-3.5 rounded-full bg-faint" /> 大</span>
      </div>
    </Card>
  )
}
function FlowTip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; 消耗: number; 展示: number; 点击: number; rawX: number; rawY: number; 零转化占比: number | null } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-white p-2 shadow-lg text-[12px] min-w-[150px]">
      <div className="font-medium text-ink truncate">{p.name}</div>
      <div className="text-muted">消耗 {wan(p.消耗)} · 0转化 {pct(p.零转化占比)}</div>
      <div className="text-muted">CTR {p.rawY.toFixed(2)}% · CPC {yuan(p.rawX)}</div>
      <div className="text-muted">展示 {num(p.展示)} · 点击 {num(p.点击)}</div>
    </div>
  )
}

// ============== ④ 0转化占比分层(分层卡片 + 区间内项目明细) ==============
function LayerModule({ buckets, rows, shownBucket, onSelectBucket, onSelectProject }: {
  buckets: Bucket[]
  rows: Proj[]
  shownBucket: string
  onSelectBucket: (b: string) => void
  onSelectProject: (p: string) => void
}) {
  const byName = new Map(buckets.map((b) => [b.区间, b]))
  const inBucket = rows.filter((r) => bucketOf(r.零转化占比) === shownBucket).sort((a, b) => b.消耗 - a.消耗)

  return (
    <Card title="0转化占比分层" extra={<span className="text-[12px] text-muted">按项目 0转化消耗占比分层 · 默认看影响最大的层级</span>}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {BUCKETS.map((b) => {
          const d = byName.get(b.名) ?? { 区间: b.名, 项目数: 0, 消耗: 0, 零转化消耗: 0 }
          const rep = rows.filter((r) => bucketOf(r.零转化占比) === b.名).sort((a, b2) => b2.消耗 - a.消耗).slice(0, 2)
          const active = shownBucket === b.名
          return (
            <button
              key={b.名}
              onClick={() => onSelectBucket(b.名)}
              className="text-left rounded-xl border p-3 transition-shadow hover:shadow-sm"
              style={{ borderColor: active ? b.color : '#eceef2', background: active ? b.soft : '#fff', borderWidth: active ? 2 : 1 }}
            >
              <div className="text-[14px] font-semibold" style={{ color: b.color }}>{b.名}</div>
              <div className="text-[12px] text-muted">{d.项目数} 个项目</div>
              <div className="mt-1.5 text-[12px] text-ink tabular-nums">消耗 {wan(d.消耗)}</div>
              <div className="text-[12px] tabular-nums" style={{ color: b.color }}>0转化 {wan(d.零转化消耗)}</div>
              <div className="mt-1 text-[11px] text-faint truncate" title={rep.map((r) => r.创量项目).join('、')}>
                {rep.length ? rep.map((r) => r.创量项目).join('、') : '—'}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[13px] font-medium text-ink">
          区间内项目明细 <span className="text-faint font-normal">({shownBucket} · {inBucket.length} 个项目)</span>
        </div>
        {inBucket.length === 0 ? (
          <div className="py-6 text-center text-muted text-[13px]">该区间内暂无项目</div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: 240 }}>
            <table className="w-full text-[12px] border-collapse">
              <thead className="sticky top-0 bg-white">
                <tr className="text-faint border-b border-line">
                  <th className="text-left font-normal py-1.5 px-2 bg-white">项目</th>
                  <th className="text-right font-normal py-1.5 px-2 bg-white">消耗</th>
                  <th className="text-right font-normal py-1.5 px-2 bg-white">0转化消耗</th>
                  <th className="text-right font-normal py-1.5 px-2 bg-white">0转化占比</th>
                  <th className="text-left font-normal py-1.5 px-2 bg-white">主投媒体</th>
                </tr>
              </thead>
              <tbody>
                {inBucket.map((r) => (
                  <tr key={r.创量项目} onClick={() => onSelectProject(r.创量项目)} className="border-b border-line/60 cursor-pointer hover:bg-canvas/60">
                    <td className="py-1.5 px-2 text-ink">{r.创量项目}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{wan(r.消耗)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{r.零转化消耗 > 0 ? wan(r.零转化消耗) : <span className="text-faint">—</span>}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: (r.零转化占比 ?? 0) > 0.1 ? '#dc2626' : undefined }}>{pct(r.零转化占比)}</td>
                    <td className="py-1.5 px-2 text-muted">{r.主投媒体 ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}

// ============== 项目明细表 ==============
function ProjectTable({ rows, hasTrend, hasMedia, selected, bucketFilter, onSelect, onClear }: {
  rows: Proj[]
  hasTrend: boolean
  hasMedia: boolean
  selected: string | null
  bucketFilter: string | null
  onSelect: (p: string) => void
  onClear: () => void
}) {
  const [showConv, setShowConv] = useState(false)
  const [search, setSearch] = useState('')
  const [media, setMedia] = useState('')

  const mediaOpts = useMemo(
    () => [...new Set(rows.map((r) => r.主投媒体).filter((m): m is string => !!m))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    let r = rows
    if (selected) r = r.filter((x) => x.创量项目 === selected)
    else if (bucketFilter) r = r.filter((x) => x.消耗 > 0 && bucketOf(x.零转化占比) === bucketFilter)
    if (search.trim()) r = r.filter((x) => x.创量项目.includes(search.trim()))
    if (media) r = r.filter((x) => x.主投媒体 === media)
    return r
  }, [rows, selected, bucketFilter, search, media])

  const chip = selected ? `项目 = ${selected}` : bucketFilter ? `0转化占比 ${bucketFilter}` : null

  const cols: Col<Proj>[] = [
    { key: '创量项目', label: '项目', render: (r) => (
      <span className="flex items-center gap-1.5">
        <span className="text-ink font-medium">{r.创量项目}</span>
        {r.是0转化 && <Tag>0转化</Tag>}
        {r.低样本 && <Tag>低样本</Tag>}
      </span>
    ) },
    ...(hasMedia ? [{ key: '主投媒体', label: '主投媒体', render: (r: Proj) => <span className="text-muted">{r.主投媒体 ?? '—'}</span> }] : []),
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => money(r.消耗) },
    { key: '占比', label: '消耗占比', align: 'right', sortable: true, sortVal: (r) => r.占比, render: (r) => pct(r.占比) },
    { key: '零转化消耗', label: '0转化消耗', align: 'right', sortable: true, sortVal: (r) => r.零转化消耗, render: (r) => (r.零转化消耗 > 0 ? money(r.零转化消耗) : <span className="text-faint">—</span>) },
    { key: '零转化占比', label: '0转化占比', align: 'right', sortable: true, sortVal: (r) => r.零转化占比 ?? 0, render: (r) => <span style={{ color: (r.零转化占比 ?? 0) > 0.1 ? '#dc2626' : undefined }}>{pct(r.零转化占比)}</span> },
    { key: '展示', label: '展示', align: 'right', sortable: true, sortVal: (r) => r.展示, render: (r) => num(r.展示) },
    { key: '点击', label: '点击', align: 'right', sortable: true, sortVal: (r) => r.点击, render: (r) => num(r.点击) },
    { key: 'CTR', label: 'CTR', align: 'right', sortable: true, sortVal: (r) => r.CTR ?? 0, render: (r) => pct(r.CTR, 2) },
    { key: 'CPC', label: 'CPC', align: 'right', sortable: true, sortVal: (r) => r.CPC ?? 0, render: (r) => dec(r.CPC) },
    { key: '账户数', label: '账户数', align: 'right', sortable: true, sortVal: (r) => r.账户数, render: (r) => num(r.账户数) },
    ...(showConv ? [
      { key: '转化', label: '转化', align: 'right' as const, sortable: true, sortVal: (r: Proj) => r.转化, render: (r: Proj) => num(r.转化) },
      { key: 'CPA', label: 'CPA', align: 'right' as const, render: (r: Proj) => dec(r.CPA, 1) },
      { key: 'CVR', label: 'CVR', align: 'right' as const, render: (r: Proj) => pct(r.CVR, 2) },
    ] : []),
    ...(hasTrend ? [{ key: 'spark', label: '走势', render: (r: Proj) => (r.spark && r.spark.length > 1 ? <div className="w-20"><Sparkline data={r.spark} height={22} /></div> : <span className="text-faint">—</span>) }] : []),
  ]

  const input = 'h-8 rounded-lg border border-line bg-white px-2.5 text-[12px] text-ink outline-none focus:border-brand'

  return (
    <Card
      title="项目明细"
      extra={
        <button onClick={() => setShowConv(!showConv)} className="text-[12px] text-brand hover:underline">
          {showConv ? '隐藏转化指标' : '显示转化/CPA/CVR'}
        </button>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索项目名" className={`${input} w-40`} />
        {mediaOpts.length > 0 && (
          <select value={media} onChange={(e) => setMedia(e.target.value)} className={input}>
            <option value="">全部媒体</option>
            {mediaOpts.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {chip && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] text-brand">
            当前筛选:{chip}
            <button onClick={onClear} className="ml-0.5 text-brand/70 hover:text-brand" title="清除筛选">×</button>
          </span>
        )}
        <span className="ml-auto text-[12px] text-faint">{filtered.length} 个项目</span>
      </div>
      {showConv && <div className="mb-2 text-[12px] text-faint">转化/CPA/CVR 按当前数据口径计算,不同优化目标项目之间仅供参考。</div>}
      <DataTable cols={cols} rows={filtered} initialSort={{ key: '消耗', dir: 'desc' }} onRowClick={(r) => onSelect(r.创量项目)} maxHeight={600} />
      <p className="mt-2 text-[11px] text-faint">提示:数字按千分位展示;消耗以「万」计;0转化消耗为空显示「—」;账户数为项目下广告账户ID数(含微量/未起量号)。</p>
    </Card>
  )
}
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded px-1.5 py-0.5 text-[10px] bg-canvas text-faint">{children}</span>
}

// ============== 右侧抽屉:单项目详情 ==============
function DetailDrawer({ 项目名, onClose, onDrill }: { 项目名: string; onClose: () => void; onDrill: (p: string) => void }) {
  const { filters } = useFilters()
  const { data, loading } = useApi<DetailT>('projectDetail', { 项目名, 优化师: filters.优化师, 起始: filters.起始, 截止: filters.截止 })

  const METRICS: { key: string; label: string; calc: (d: DetailT['days'][number]) => number | null; fmt: (v: number) => string }[] = [
    { key: '消耗', label: '消耗', calc: (d) => d.消耗, fmt: wan },
    { key: '展示', label: '展示', calc: (d) => d.展示, fmt: num },
    { key: '点击', label: '点击', calc: (d) => d.点击, fmt: num },
    { key: 'CTR', label: 'CTR', calc: (d) => { const v = div(d.点击, d.展示); return v == null ? null : v * 100 }, fmt: (v) => v.toFixed(2) + '%' },
    { key: 'CPC', label: 'CPC', calc: (d) => div(d.消耗, d.点击), fmt: yuan },
    { key: '0转化占比', label: '0转化占比', calc: (d) => { const v = div(d.零转化消耗, d.消耗); return v == null ? null : v * 100 }, fmt: (v) => v.toFixed(1) + '%' },
    { key: '转化', label: '转化', calc: (d) => d.转化, fmt: num },
    { key: 'CPA', label: 'CPA', calc: (d) => div(d.消耗, d.转化), fmt: yuan },
  ]
  const [mk, setMk] = useState('消耗')
  const m = METRICS.find((x) => x.key === mk) ?? METRICS[0]

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
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              {([['消耗', wan(data.摘要.消耗)], ['0转化占比', pct(data.摘要.零转化占比)], ['账户数', num(data.摘要.账户数)],
                 ['转化', num(data.摘要.转化)], ['CPA', data.摘要.CPA == null ? '—' : yuan(data.摘要.CPA)], ['CTR', pct(data.摘要.CTR, 2)]] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line p-2"><div className="text-faint">{k}</div><div className="text-ink font-semibold tabular-nums">{v}</div></div>
              ))}
            </div>
            <div className="text-[11px] text-faint">转化/CPA 基于当前数据口径,不同优化目标仅供参考。</div>

            {data.days.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1"><span className="text-[13px] font-medium text-ink">项目趋势</span>
                  <div className="flex flex-wrap gap-1">{METRICS.map((x) => (
                    <button key={x.key} onClick={() => setMk(x.key)} className={`rounded px-1.5 py-0.5 text-[11px] ${mk === x.key ? 'bg-brand-soft text-brand' : 'text-muted'}`}>{x.label}</button>
                  ))}</div>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.days.map((d) => ({ 时间: md(d.时间), v: m.calc(d) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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

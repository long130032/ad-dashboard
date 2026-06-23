import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '../components/Card'
import { KpiCard } from '../components/KpiCard'
import { ShareList } from '../components/ShareList'
import { CompareList } from '../components/CompareList'
import { QualityDonut } from '../components/QualityDonut'
import { StatusBadge } from '../components/StatusBadge'
import { useApi } from '../lib/useApi'
import { dec, money, num, pct, wan } from '../lib/format'
import { CHART } from '../lib/palette'
import { useFilters } from '../store/filters'

const yuan = (n?: number | null, d = 2) => (n == null ? '—' : '¥' + dec(n, d))

type Overview = {
  kpi: {
    消耗: number
    曝光: number
    点击: number
    CTR: number | null
    CPC: number | null
    CPM: number | null
    转化数: number
    转化成本: number | null
    激活数: number
    激活成本: number | null
    问题账户数: number
    无效消耗: number
    无效消耗占比: number | null
    投放账户数: number
    '0转化账户数': number
    休眠账户数: number
  }
  钱的三种状态: Record<string, { 账户数: number; 消耗: number }>
  项目Top10: { 创量项目: string; 消耗: number; 激活: number }[]
  媒体占比: { 媒体: string; 消耗: number }[]
  团队占比: { 优化师: string; 消耗: number }[]
  重点关注: {
    成本偏高: FocusItem[]
    有消耗无产出: FocusItem[]
  }
}
type FocusItem = {
  优化师: string
  创量项目: string
  账户名称: string
  账户ID: string
  浪费金额: number
  病灶: string
  问题类型: string
}
type Trend = {
  rows: { 时间: string; 消耗: number; 转化: number; 激活: number; CPC: number | null; CPA: number | null }[]
}

const AXIS = { fontSize: 11, fill: CHART.axis }
const TOOLTIP = { fontSize: 12, borderRadius: 10, border: '1px solid #eceef2', boxShadow: '0 4px 16px rgba(16,24,40,0.08)' }

// 账户健康分布:条按消耗(零消耗=0不显示),配色与 StatusBadge 一致
const HEALTH_ORDER = ['正常', '成本偏高', '起量中', '有消耗无产出', '零消耗']
const HEALTH_COLOR: Record<string, string> = {
  正常: '#10b981',
  成本偏高: '#f97316',
  起量中: '#0284c7',
  有消耗无产出: '#ef4444',
  零消耗: '#94a3b8',
}

export function Overview() {
  const { filters } = useFilters()
  const { data, loading } = useApi<Overview>('overview', filters)
  const { data: trend } = useApi<Trend>('trend', { 优化师: filters.优化师, 项目: filters.项目, 起始: filters.起始, 截止: filters.截止 })

  if (loading || !data) return <Loading />
  const k = data.kpi
  const 总 = k.消耗
  const rows = trend?.rows ?? []

  return (
    <div className="space-y-4">
      {/* KPI 第一行:基础投放指标 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="消耗" value={wan(k.消耗)} sub={filters.起始 ? `${filters.起始}~${filters.截止}` : '整段累计'} spark={rows.map((r) => r.消耗)} sparkColor={CHART.brand} />
        <KpiCard label="曝光量" value={num(k.曝光)} />
        <KpiCard label="点击量" value={num(k.点击)} />
        <KpiCard label="点击率 CTR" value={pct(k.CTR, 2)} />
        <KpiCard label="点击单价 CPC" value={yuan(k.CPC)} spark={rows.map((r) => r.CPC)} sparkColor={CHART.accent} />
        <KpiCard label="千次展现 CPM" value={yuan(k.CPM)} />
      </div>

      {/* KPI 第二行:转化与账户 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="转化数" value={num(k.转化数)} sub="目标不同·仅看量级" spark={rows.map((r) => r.转化)} sparkColor={CHART.brand} />
        <KpiCard label="转化成本" value={yuan(k.转化成本, 1)} sub="目标不同·勿横比" spark={rows.map((r) => r.CPA)} sparkColor={CHART.warn} />
        <KpiCard label="激活数" value={num(k.激活数)} spark={rows.map((r) => r.激活)} sparkColor={CHART.accent} />
        <KpiCard label="激活成本" value={yuan(k.激活成本, 1)} sub="目标不同·勿横比" />
        <KpiCard label="问题账户数" value={num(k.问题账户数)} tone="warn" sub="有消耗但0转化" />
        <KpiCard label="无效消耗" value={money(k.无效消耗)} tone="bad" sub={`占总盘 ${pct(k.无效消耗占比)}`} />
      </div>

      {/* 趋势区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="消耗 / 转化 / 激活 趋势" extra={<span className="text-[12px] text-muted">柱=消耗 · 线=转化/激活</span>}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="时间" tick={AXIS} minTickGap={28} axisLine={false} tickLine={false} />
                <YAxis yAxisId="L" tick={AXIS} tickFormatter={(v) => (v / 10000).toFixed(0) + '万'} width={44} axisLine={false} tickLine={false} />
                <YAxis yAxisId="R" orientation="right" tick={AXIS} tickFormatter={(v) => (v / 10000).toFixed(0) + '万'} width={40} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any, n: any) => (n === '消耗' ? money(Number(v)) : num(Number(v)))}
                  labelStyle={{ color: '#1f2937' }}
                  contentStyle={TOOLTIP}
                  cursor={{ fill: 'rgba(109,92,245,0.05)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Bar yAxisId="L" dataKey="消耗" fill="#e4e0fd" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Line yAxisId="R" type="monotone" dataKey="转化" stroke={CHART.brand} strokeWidth={2} dot={false} />
                <Line yAxisId="R" type="monotone" dataKey="激活" stroke={CHART.accent} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="CPC / CPA 趋势" extra={<span className="text-[12px] text-muted">CPA 目标不同·勿横比</span>}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="时间" tick={AXIS} minTickGap={28} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} tickFormatter={(v) => '¥' + v} width={40} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => yuan(Number(v))} labelStyle={{ color: '#1f2937' }} contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Line type="monotone" dataKey="CPC" stroke={CHART.brand} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="CPA" stroke={CHART.warn} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 投入产出对照 + 消耗质量 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="项目 消耗 vs 激活 Top10"
          className="lg:col-span-2"
          extra={<span className="text-[12px] text-muted">紫=消耗占比 · 青=激活占比</span>}
        >
          <CompareList
            data={data.项目Top10.map((p) => ({ name: p.创量项目, 消耗: p.消耗, 激活: p.激活 }))}
            totalC={k.消耗}
            totalA={k.激活数}
          />
        </Card>
        <Card title="消耗质量" extra={<span className="text-[12px] text-muted">有消耗0转化=无效</span>}>
          <QualityDonut 正常={k.消耗 - k.无效消耗} 无效={k.无效消耗} />
        </Card>
      </div>

      {/* 消耗占比:媒体 + 团队 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="媒体消耗占比">
          <ShareList data={data.媒体占比.map((m) => ({ name: m.媒体, value: m.消耗 }))} total={总} />
        </Card>
        <Card title="团队消耗占比">
          <ShareList data={data.团队占比.map((t) => ({ name: t.优化师, value: t.消耗 }))} total={总} />
        </Card>
      </div>

      {/* 账户健康 */}
      <Card title="账户健康" extra={<span className="text-[12px] text-muted">详见账户问题页 →</span>}>
        {/* 一行色点统计(5类) */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-line pb-4">
          {HEALTH_ORDER.map((t) => {
            const c = data.钱的三种状态[t]
            if (!c) return null
            return (
              <span key={t} className="flex items-center gap-1.5 text-[13px]">
                <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR[t] }} />
                <span className="text-ink">{t}</span>
                <span className="tabular-nums text-muted">{num(c.账户数)}</span>
              </span>
            )
          })}
        </div>
        {/* 重点关注:两类分栏,各不混排 */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <FocusCol type="成本偏高" note="烧大钱·同项目内CPA偏高" rows={data.重点关注.成本偏高} />
          <FocusCol type="有消耗无产出" note="空耗·激活转化双零" rows={data.重点关注.有消耗无产出} />
        </div>
      </Card>
    </div>
  )
}

function FocusCol({ type, note, rows }: { type: string; note: string; rows: FocusItem[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <StatusBadge value={type} />
        <span className="text-[12px] text-faint">{note}</span>
      </div>
      <div>
        {rows.map((r) => (
          <div key={r.账户ID} className="flex items-center justify-between gap-2 border-b border-line/50 py-1.5 last:border-0">
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-ink">{r.创量项目}</span>
              <span className="block truncate text-[11px] text-faint">
                {r.账户名称} · {r.优化师}
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-bad">{money(r.浪费金额)}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="py-2 text-[13px] text-faint">无</div>}
      </div>
    </div>
  )
}

export function Loading() {
  return <div className="text-muted text-[14px] py-20 text-center">加载中…</div>
}

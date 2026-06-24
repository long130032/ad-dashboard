import { Card } from '../components/Card'
import { DataTable, type Col } from '../components/DataTable'
import { useApi } from '../lib/useApi'
import { dec, money, num, pct, wan } from '../lib/format'
import { useFilters } from '../store/filters'
import { Loading } from './Overview'

// ---------- 类型 ----------
type MediaRow = {
  媒体: string
  消耗: number
  占比: number
  账户数: number
  账户占比: number
  单账户消耗: number | null
  展示: number
  点击: number
  转化: number
  CTR: number | null
  CPC: number | null
  CVR: number | null
  CPA: number | null
  零转化占比: number | null
  样本状态: string
}
type Total = { 总消耗: number; 媒体数: number; 账户总数: number; 单账户平均消耗: number | null; CTR: number | null; CPC: number | null; CVR: number | null; CPA: number | null }
type CmpCell = { 消耗: number; CPA: number | null; 账户数: number; CTR: number | null; CPC: number | null; CVR: number | null }
type Cmp = { 媒体列: string[]; rows: { 项目: string; 总消耗: number; 主消耗媒体: string; cells: Record<string, CmpCell> }[] }
type Resp = { rows: MediaRow[]; 总计: Total | null; 同项目对比: Cmp | null }

// ---------- 颜色 ----------
const PALETTE = ['#6d5cf5', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899']
const FIXED: Record<string, string> = { '腾讯广告3.0': '#6d5cf5', 巨量广告: '#3b82f6', 磁力智投: '#14b8a6' }
const yuan = (v: number | null) => (v == null ? '—' : '¥' + dec(v))

// 链路指标列定义(弱背景色 + 中性)
const LINK_COLS = [
  { key: 'CTR', name: '点击率', bg: '#eff6ff', color: '#2563eb', fmt: (r: MediaRow) => pct(r.CTR, 2) },
  { key: 'CPC', name: '单次点击成本', bg: '#f5f3ff', color: '#7c3aed', fmt: (r: MediaRow) => yuan(r.CPC) },
  { key: 'CVR', name: '转化率', bg: '#f0fdfa', color: '#0d9488', fmt: (r: MediaRow) => pct(r.CVR, 2) },
  { key: 'CPA', name: '单次转化成本', bg: '#fff7ed', color: '#ea580c', fmt: (r: MediaRow) => dec(r.CPA, 1) },
] as const

// 同项目 CPA 行内相对色阶:低→绿,高→橙(只在同项目内可比)
function cpaBg(cpa: number | null, lo: number, hi: number): string | undefined {
  if (cpa == null || hi <= lo) return undefined
  const t = Math.min(Math.max((cpa - lo) / (hi - lo), 0), 1)
  const g = [22, 163, 74]
  const o = [249, 115, 22]
  const c = g.map((v, i) => Math.round(v + (o[i] - v) * t))
  return `rgba(${c[0]},${c[1]},${c[2]},0.16)`
}

export function Media() {
  const { filters, setFilter } = useFilters()
  const { data, loading } = useApi<Resp>('media', { 优化师: filters.优化师, 项目: filters.项目, 媒体: filters.媒体 })
  if (loading || !data) return <Loading />
  const { rows, 总计, 同项目对比 } = data
  const colorOf = (m: string, i = rows.findIndex((r) => r.媒体 === m)) => FIXED[m] ?? PALETTE[(i < 0 ? 0 : i) % PALETTE.length]
  const toggleMedia = (m: string) => setFilter('媒体', filters.媒体 === m ? undefined : m)

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <Note />
        <Card><div className="py-12 text-center text-muted text-[14px]">当前筛选条件下暂无媒体数据</div></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Note />

      {/* ① 媒体概览卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {rows.map((r, i) => (
          <MediaCard key={r.媒体} r={r} color={colorOf(r.媒体, i)} active={filters.媒体 === r.媒体} onClick={() => toggleMedia(r.媒体)} />
        ))}
        {总计 && <TotalCard t={总计} />}
      </div>

      {/* ② 投放结构 + ③ 链路效率 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StructureCard rows={rows} colorOf={colorOf} />
        <LinkEfficiency rows={rows} colorOf={colorOf} />
      </div>

      {/* ④ 同项目媒体对比 */}
      <SameProjectCompare cmp={同项目对比} colorOf={colorOf} />

      {/* ⑤ 媒体明细表 */}
      <MediaTable rows={rows} colorOf={colorOf} />
    </div>
  )
}

function Note() {
  return (
    <div className="text-[12px] text-faint">
      📊 媒体数据来自项目报表(整段口径):支持 优化师 / 项目 / 媒体 筛选;日期筛选对本页不生效。
    </div>
  )
}

// ---------- 小环形进度 ----------
function Donut({ value, color, size = 58 }: { value: number; color: string; size?: number }) {
  const sw = 6
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(Math.max(value, 0), 1))
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="600" fill="#0f1729">{pct(value)}</text>
      <text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#94a3b8">消耗占比</text>
    </svg>
  )
}

// ---------- 概览卡:媒体 ----------
function MediaCard({ r, color, active, onClick }: { r: MediaRow; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_6px_20px_rgba(16,24,40,0.08)] ${active ? 'ring-2 ring-brand/30' : ''}`}
      style={{ borderColor: active ? color : '#eceef2' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded" style={{ background: color }} />
            <span className="text-[14px] font-semibold text-ink truncate">{r.媒体}</span>
            {r.样本状态 !== '充足' && <Tag tone="warn">{r.样本状态}</Tag>}
          </div>
          <div className="mt-2 text-[11px] text-faint">消耗</div>
          <div className="text-[24px] leading-none font-semibold tabular-nums text-ink">{wan(r.消耗)}</div>
          <div className="mt-2 text-[11px] text-muted">
            账户数 <span className="text-ink tabular-nums">{num(r.账户数)}</span> <span className="text-faint">({pct(r.账户占比)})</span>
          </div>
          <div className="text-[11px] text-muted">单账户消耗 <span className="text-ink tabular-nums">{money(r.单账户消耗)}</span></div>
        </div>
        <Donut value={r.占比} color={color} />
      </div>
      <MiniMetrics items={[['CTR', pct(r.CTR, 2)], ['CPC', yuan(r.CPC)], ['CVR', pct(r.CVR, 2)], ['CPA', dec(r.CPA, 1)]]} />
    </button>
  )
}

// ---------- 概览卡:全媒体 ----------
function TotalCard({ t }: { t: Total }) {
  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-soft/60 to-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-full bg-brand" />
        <span className="text-[14px] font-semibold text-ink">全媒体概览</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2">
        <div>
          <div className="text-[11px] text-faint">总消耗</div>
          <div className="text-[24px] leading-none font-semibold tabular-nums text-ink">{wan(t.总消耗)}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-faint">媒体数</div>
          <div className="text-[24px] leading-none font-semibold tabular-nums text-ink">{t.媒体数}</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted">账户总数 <span className="text-ink tabular-nums">{num(t.账户总数)}</span></div>
      <div className="text-[11px] text-muted">单账户平均消耗 <span className="text-ink tabular-nums">{money(t.单账户平均消耗)}</span></div>
      <MiniMetrics items={[['CTR', pct(t.CTR, 2)], ['CPC', yuan(t.CPC)], ['CVR', pct(t.CVR, 2)], ['CPA', dec(t.CPA, 1)]]} />
    </div>
  )
}

function MiniMetrics({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-1 border-t border-line pt-2">
      {items.map(([k, v]) => (
        <div key={k} className="text-center">
          <div className="text-[10px] text-faint">{k}</div>
          <div className="text-[12px] font-medium tabular-nums text-ink">{v}</div>
        </div>
      ))}
    </div>
  )
}
function Tag({ children, tone }: { children: React.ReactNode; tone?: 'warn' | 'ok' | 'muted' }) {
  const c = tone === 'warn' ? 'bg-orange-50 text-orange-600' : tone === 'ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-canvas text-faint'
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${c}`}>{children}</span>
}

// ---------- ② 媒体投放结构 ----------
function StructureCard({ rows, colorOf }: { rows: MediaRow[]; colorOf: (m: string) => string }) {
  return (
    <Card title="媒体投放结构" extra={
      <span className="flex items-center gap-3 text-[11px] text-muted">
        <Legend swatch="#6d5cf5">消耗占比</Legend>
        <Legend swatch="#22b8cf">账户占比</Legend>
        <span className="text-faint">单账户消耗</span>
      </span>
    }>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.媒体} className="flex items-center gap-3">
            <div className="w-24 shrink-0 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded" style={{ background: colorOf(r.媒体) }} />
              <span className="text-[12px] text-ink truncate" title={r.媒体}>{r.媒体}</span>
            </div>
            <div className="flex-1 space-y-1">
              <BarRow value={r.占比} color="#6d5cf5" />
              <BarRow value={r.账户占比} color="#22b8cf" />
            </div>
            <div className="w-24 shrink-0 text-right">
              <div className="text-[12px] font-medium tabular-nums text-ink">{money(r.单账户消耗)}</div>
              <div className="text-[10px] text-faint">单账户消耗</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between px-[108px] text-[10px] text-faint">
        {[0, 20, 40, 60, 80, 100].map((t) => <span key={t}>{t}%</span>)}
      </div>
    </Card>
  )
}
function BarRow({ value, color }: { value: number; color: string }) {
  const w = Math.min(Math.max(value, 0), 1) * 100
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex-1 h-2.5 rounded-full bg-canvas overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${w}%`, background: color }} />
      </span>
      <span className="w-11 text-right text-[11px] tabular-nums text-muted">{pct(value)}</span>
    </div>
  )
}
function Legend({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded" style={{ background: swatch }} />{children}</span>
}

// ---------- ③ 媒体链路效率 ----------
function LinkEfficiency({ rows, colorOf }: { rows: MediaRow[]; colorOf: (m: string) => string }) {
  // 每列的最大值,用于迷你条归一化
  const colMax: Record<string, number> = {}
  for (const c of LINK_COLS) colMax[c.key] = Math.max(...rows.map((r) => (r[c.key as 'CTR'] ?? 0) as number), 0) || 1
  return (
    <Card
      title="媒体链路效率"
      extra={<span className="text-[11px] text-faint">从曝光到转化的全链路效率对比</span>}
    >
      <div className="text-[11px] text-orange-600 mb-2">⚠ CPA 不同项目不可直接横向判优劣,请结合项目口径查看</div>
      <div className="overflow-auto">
        <table className="w-full border-separate" style={{ borderSpacing: '4px' }}>
          <thead>
            <tr>
              <th className="text-left text-[11px] font-medium text-faint px-1">媒体</th>
              {LINK_COLS.map((c) => (
                <th key={c.key} className="rounded-lg px-2 py-1.5 text-center" style={{ background: c.bg }} title={`${c.key} = ${c.key === 'CTR' ? '点击/展示' : c.key === 'CPC' ? '消耗/点击' : c.key === 'CVR' ? '转化/点击' : '消耗/转化'}`}>
                  <div className="text-[12px] font-semibold" style={{ color: c.color }}>{c.key}</div>
                  <div className="text-[10px] text-muted">{c.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.媒体}>
                <td className="px-1 text-[12px] text-ink whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ background: colorOf(r.媒体) }} />{r.媒体}</span>
                </td>
                {LINK_COLS.map((c) => {
                  const v = (r[c.key as 'CTR'] ?? null) as number | null
                  const w = v == null ? 0 : (v / colMax[c.key]) * 100
                  return (
                    <td key={c.key} className="rounded-lg px-2 py-1.5 text-center align-top" style={{ background: c.bg }}>
                      <div className="text-[15px] font-semibold tabular-nums" style={{ color: c.color }}>{c.fmt(r)}</div>
                      <span className="mt-1 block h-1 rounded-full bg-white/70 overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${w}%`, background: c.color, opacity: 0.5 }} />
                      </span>
                      {r.样本状态 === '样本较小' && <div className="text-[9px] text-faint mt-0.5">样本较小</div>}
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

// ---------- ④ 同项目媒体对比 ----------
function SameProjectCompare({ cmp, colorOf }: { cmp: Cmp | null; colorOf: (m: string) => string }) {
  if (!cmp || cmp.rows.length === 0) {
    return (
      <Card title="同项目媒体对比">
        <div className="py-10 text-center text-muted text-[13px]">当前筛选条件下暂无同项目多媒体投放数据</div>
      </Card>
    )
  }
  return (
    <Card
      title="同项目媒体对比"
      extra={<span className="text-[11px] text-faint">仅展示同项目下同时投放多个媒体的数据,避免跨项目直接比较 CPA · 单元格按行内 CPA 上色(绿低橙高)</span>}
    >
      <div className="overflow-auto" style={{ maxHeight: 460 }}>
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-muted">
              <th rowSpan={2} className="text-left font-medium py-2 px-2 bg-white border-b border-line">项目</th>
              <th rowSpan={2} className="text-right font-medium py-2 px-2 bg-white border-b border-line">总消耗</th>
              <th rowSpan={2} className="text-left font-medium py-2 px-2 bg-white border-b border-line">主消耗媒体</th>
              {cmp.媒体列.map((m) => (
                <th key={m} colSpan={2} className="text-center font-medium py-1.5 px-2 bg-white border-b border-line">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ background: colorOf(m) }} />{m}</span>
                </th>
              ))}
            </tr>
            <tr className="text-faint">
              {cmp.媒体列.map((m) => (
                <Frag key={m}>
                  <th className="text-right font-normal py-1 px-2 bg-white border-b border-line">消耗</th>
                  <th className="text-right font-normal py-1 px-2 bg-white border-b border-line">CPA</th>
                </Frag>
              ))}
            </tr>
          </thead>
          <tbody>
            {cmp.rows.map((row) => {
              const cpas = cmp.媒体列.map((m) => row.cells[m]?.CPA).filter((v): v is number => v != null)
              const lo = Math.min(...cpas)
              const hi = Math.max(...cpas)
              return (
                <tr key={row.项目} className="border-b border-line/60 hover:bg-canvas/40">
                  <td className="py-1.5 px-2 text-ink whitespace-nowrap max-w-[180px] truncate" title={row.项目}>{row.项目}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-ink">{money(row.总消耗)}</td>
                  <td className="py-1.5 px-2"><span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]" style={{ background: colorOf(row.主消耗媒体) + '22', color: colorOf(row.主消耗媒体) }}>{row.主消耗媒体}</span></td>
                  {cmp.媒体列.map((m) => {
                    const c = row.cells[m]
                    return (
                      <Frag key={m}>
                        <td className="py-1.5 px-2 text-right tabular-nums text-muted">{c ? money(c.消耗) : <span className="text-faint">—</span>}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-ink rounded" style={c ? { background: cpaBg(c.CPA, lo, hi) } : undefined}
                          title={c ? `账户数 ${c.账户数} · CTR ${pct(c.CTR, 2)} · CPC ${yuan(c.CPC)} · CVR ${pct(c.CVR, 2)}` : undefined}>
                          {c ? dec(c.CPA, 1) : <span className="text-faint">—</span>}
                        </td>
                      </Frag>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
function Frag({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// ---------- ⑤ 媒体明细表 ----------
function MediaTable({ rows, colorOf }: { rows: MediaRow[]; colorOf: (m: string) => string }) {
  const bar = (v: number, color: string) => (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <span className="h-1.5 w-12 rounded-full bg-canvas overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.min(v, 1) * 100}%`, background: color }} /></span>
      <span className="tabular-nums">{pct(v)}</span>
    </span>
  )
  const cols: Col<MediaRow>[] = [
    { key: '媒体', label: '媒体', render: (r) => <span className="inline-flex items-center gap-1.5 text-ink font-medium"><span className="h-2.5 w-2.5 rounded" style={{ background: colorOf(r.媒体) }} />{r.媒体}</span> },
    { key: '消耗', label: '消耗', align: 'right', sortable: true, sortVal: (r) => r.消耗, render: (r) => money(r.消耗) },
    { key: '占比', label: '消耗占比', align: 'right', render: (r) => bar(r.占比, '#6d5cf5') },
    { key: '账户数', label: '账户数', align: 'right', sortable: true, sortVal: (r) => r.账户数, render: (r) => num(r.账户数) },
    { key: '账户占比', label: '账户占比', align: 'right', render: (r) => bar(r.账户占比, '#22b8cf') },
    { key: '单账户消耗', label: '单账户消耗', align: 'right', render: (r) => money(r.单账户消耗) },
    { key: 'CTR', label: 'CTR', align: 'right', sortable: true, sortVal: (r) => r.CTR ?? 0, render: (r) => pct(r.CTR, 2) },
    { key: 'CPC', label: 'CPC', align: 'right', sortable: true, sortVal: (r) => r.CPC ?? 0, render: (r) => dec(r.CPC) },
    { key: 'CVR', label: 'CVR', align: 'right', sortable: true, sortVal: (r) => r.CVR ?? 0, render: (r) => pct(r.CVR, 2) },
    { key: 'CPA', label: 'CPA', align: 'right', sortable: true, sortVal: (r) => r.CPA ?? 0, render: (r) => dec(r.CPA, 1) },
    { key: '零转化占比', label: '0转化占比', align: 'right', render: (r) => <span style={{ color: (r.零转化占比 ?? 0) > 0.1 ? '#dc2626' : undefined }}>{pct(r.零转化占比)}</span> },
    { key: '样本状态', label: '样本状态', render: (r) => <StateTag s={r.样本状态} /> },
  ]
  return (
    <Card title="媒体明细" extra={<span className="text-[12px] text-muted">CPA 目标不同 · 勿直接横比</span>}>
      <DataTable cols={cols} rows={rows} initialSort={{ key: '消耗', dir: 'desc' }} />
    </Card>
  )
}
function StateTag({ s }: { s: string }) {
  const tone = s === '充足' ? 'ok' : s === '样本较小' || s === '无转化' ? 'warn' : 'muted'
  return <Tag tone={tone}>{s}</Tag>
}

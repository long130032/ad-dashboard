/** 数据塑形纯函数,对齐 backend/app.py 的 build_*。输出 JSON 形状与原后端逐字段一致,
 *  这样前端页面/组件一行不用改。 */
import type { Row, Cell } from './types'
import { getTables } from './store'
import { byDimension, derive } from './metrics'
import { classifyAccounts, inferTargets } from './diagnose'
import { DEFAULTS } from './config'
import { groupBy, n0, nunique, safe, sumCol } from './agg'

function pick(r: Row, cols: string[]): Row {
  const o: Row = {}
  for (const c of cols) o[c] = c in r ? r[c] : null
  return o
}

type FilterParams = { 优化师?: string; 项目?: string; 媒体?: string }

function filterRows(rows: Row[], { 优化师, 项目, 媒体 }: FilterParams): Row[] {
  return rows.filter(
    (r) =>
      (!优化师 || r['优化师'] === 优化师) &&
      (!项目 || r['创量项目'] === 项目) &&
      (!媒体 || !('媒体' in r) || r['媒体'] === 媒体),
  )
}

/** 维度列(文本,聚合时取首行原值);其余数值列里,可加的求和、不可加的(率/成本/均价)丢弃。 */
const DAILY_DIM_COLS = ['优化师', '创量项目', '账户ID', '账户名称', '合作商', '公司主体', '账户备注']
const isAdditive = (col: string) =>
  !col.includes('率') && !col.includes('成本') && !col.startsWith('平均')

/** 把「账户按天」表在 [起始, 截止] 窗口内按账户ID聚合,重建一张与「整段」同构的表。
 *  口径:可加列(消耗/展示/点击/转化/各环节计数)求和,率/成本一律不带(诊断会从分子分母重算)。 */
function aggregateDailyWindow(起始: string, 截止: string): Row[] {
  const day = getTables()['账户按天'] ?? []
  const inWindow = day.filter((r) => {
    const t = String(r['时间'] ?? '')
    return t >= 起始 && t <= 截止
  })
  if (inWindow.length === 0) return []
  // 数值列集合:首行里非维度的 key
  const numCols = Object.keys(inWindow[0]).filter((c) => !DAILY_DIM_COLS.includes(c) && c !== '时间')
  const out: Row[] = []
  for (const [, g] of groupBy(inWindow, '账户ID')) {
    const first = g[0]
    const row: Row = { 时间: `${起始}~${截止}` }
    for (const c of DAILY_DIM_COLS) row[c] = first[c] ?? null
    for (const c of numCols) row[c] = isAdditive(c) ? sumCol(g, c) : null
    out.push(row)
  }
  return out
}

/** 账户表(整段,或按天窗口聚合)+ 媒体(来自项目报表)+ 转化目标 + 问题分类,按浪费金额降序。对齐 app.enriched_accounts。 */
function enrichedAccounts(起始?: string, 截止?: string): Row[] {
  const tables = getTables()
  const base =
    起始 && 截止 && tables['账户按天'] ? aggregateDailyWindow(起始, 截止) : tables['账户整段'] ?? []
  const acc = base.map((r) => ({ ...r })) // 副本,避免污染内存表
  const 项目报表 = tables['项目报表']
  if (项目报表) {
    const mediaMap = new Map<string, string>() // 账户ID → 首个非空媒体
    for (const r of 项目报表) {
      const m = r['媒体']
      const id = String(r['账户ID'] ?? '')
      if (m != null && m !== '' && !mediaMap.has(id)) mediaMap.set(id, String(m))
    }
    for (const r of acc) r['媒体'] = mediaMap.get(String(r['账户ID'] ?? '')) ?? null
  } else {
    for (const r of acc) r['媒体'] = null
  }
  const targets = inferTargets(acc)
  acc.forEach((r, i) => (r['转化目标'] = targets[i]))
  return classifyAccounts(acc)
}

function countWhere(rows: Row[], pred: (r: Row) => boolean): number {
  let n = 0
  for (const r of rows) if (pred(r)) n++
  return n
}

export function buildOverview(优化师?: string, 项目?: string, 媒体?: string, 起始?: string, 截止?: string) {
  const acc = filterRows(enrichedAccounts(起始, 截止), { 优化师, 项目, 媒体 })
  const 总消耗 = sumCol(acc, '消耗')
  const d = derive(acc)

  // 钱的三种状态
  const buckets: Record<string, { 账户数: number; 消耗: number }> = {}
  for (const [类型, sub] of groupBy(acc, '问题类型')) {
    buckets[String(类型)] = { 账户数: sub.length, 消耗: sumCol(sub, '消耗') }
  }
  const 无效消耗 = sumCol(acc, '浪费金额')

  // 集中度(按项目消耗)
  const projSpend = byDimension(acc, '创量项目').map((p) => p.消耗) // 已按消耗降序
  const 集中度 = {
    top1占比: 总消耗 && projSpend.length ? projSpend[0] / 总消耗 : null,
    top3占比:
      总消耗 && projSpend.length ? projSpend.slice(0, 3).reduce((a, b) => a + b, 0) / 总消耗 : null,
  }

  const 重点关注: Record<string, Row[]> = {}
  const 关注列 = ['优化师', '创量项目', '账户名称', '账户ID', '浪费金额', '病灶', '问题类型']
  for (const 类型 of ['成本偏高', '有消耗无产出']) {
    重点关注[类型] = acc
      .filter((r) => r['问题类型'] === 类型 && n0(r['浪费金额']) > 0)
      .slice(0, 5)
      .map((r) => pick(r, 关注列))
  }

  const 媒体行 = acc.filter((r) => r['媒体'] != null)

  return {
    kpi: {
      消耗: 总消耗,
      曝光: d.展示,
      点击: d.点击,
      CTR: d.CTR,
      CPC: d.CPC,
      CPM: d.CPM,
      转化数: d.转化,
      转化成本: d.CPA,
      激活数: d.激活,
      激活成本: d.激活成本,
      问题账户数: countWhere(acc, (r) => n0(r['浪费金额']) > 0),
      无效消耗,
      无效消耗占比: 总消耗 ? 无效消耗 / 总消耗 : null,
      投放账户数: countWhere(acc, (r) => n0(r['消耗']) > 0),
      '0转化账户数': countWhere(acc, (r) => n0(r['消耗']) > 0 && n0(r['转化数']) === 0),
      休眠账户数: countWhere(acc, (r) => n0(r['消耗']) === 0),
    },
    钱的三种状态: buckets,
    集中度,
    项目Top10: byDimension(acc, '创量项目').slice(0, 10),
    媒体占比: 媒体行.length ? byDimension(媒体行, '媒体') : [],
    团队占比: byDimension(acc, '优化师'),
    重点关注,
  }
}

export function buildAccounts(优化师?: string, 项目?: string, 媒体?: string, 问题类型?: string, 起始?: string, 截止?: string) {
  let acc = filterRows(enrichedAccounts(起始, 截止), { 优化师, 项目, 媒体 })
  // 全量 5 类分布(筛选问题类型前算,tab 切换不变)
  const counts: Record<string, { 账户数: number; 消耗: number }> = {}
  for (const [类型, s] of groupBy(acc, '问题类型')) {
    counts[String(类型)] = { 账户数: s.length, 消耗: sumCol(s, '消耗') }
  }
  if (问题类型) acc = acc.filter((r) => r['问题类型'] === 问题类型)
  const cols = ['优化师', '创量项目', '媒体', '账户ID', '账户名称', '转化目标', '问题类型',
    '消耗', '展示数', '点击数', '转化数', '激活数', '浪费金额', '病灶', '建议']
  return { total: acc.length, counts, rows: acc.map((r) => pick(r, cols)) }
}

/** 每项目逐日消耗序列(主表迷你走势用)。无「按天」表 → 空 Map。按天表无媒体维度,只按优化师+日期过滤。 */
function projectSparks(优化师?: string, 起始?: string, 截止?: string): Map<string, number[]> {
  const out = new Map<string, number[]>()
  const day = getTables()['账户按天']
  if (!day) return out
  let rows = day.filter((r) => !优化师 || r['优化师'] === 优化师)
  if (起始 && 截止) rows = rows.filter((r) => {
    const t = String(r['时间'] ?? '')
    return t >= 起始 && t <= 截止
  })
  for (const [proj, g] of groupBy(rows, '创量项目')) {
    const series = groupBy(g, '时间')
      .map(([时间, d]) => ({ 时间: String(时间), 消耗: sumCol(d, '消耗') }))
      .sort((a, b) => a.时间.localeCompare(b.时间))
      .map((d) => d.消耗)
    out.set(String(proj), series)
  }
  return out
}

/** 0转化消耗 = 一组账户里「转化数==0」者的消耗之和。中性口径,不依赖 CPA 基准。 */
function zeroConvSpend(rows: Row[]): number {
  let s = 0
  for (const r of rows) if (n0(r['转化数']) === 0) s += n0(r['消耗'])
  return s
}

/** 逐项目中性事实行。基于 enrichedAccounts 聚合,数值来自 byDimension/derive。 */
function projectRows(acc: Row[], sparks: Map<string, number[]>) {
  const dims = byDimension(acc, '创量项目') // 已按消耗降序
  return dims.map((d) => {
    const name = String(d['创量项目'])
    const sub = acc.filter((r) => r['创量项目'] === name)
    const 零转化消耗 = zeroConvSpend(sub)
    // 主投媒体 = 该项目下消耗最高的媒体(无媒体归属时为 null)
    const mediaSpend = new Map<string, number>()
    for (const r of sub) {
      const m = r['媒体']
      if (typeof m === 'string' && m !== '') mediaSpend.set(m, (mediaSpend.get(m) ?? 0) + n0(r['消耗']))
    }
    const 媒体数 = mediaSpend.size
    const 主投媒体 = [...mediaSpend.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    return {
      ...d,
      创量项目: name,
      零转化消耗,
      零转化占比: d.消耗 ? 零转化消耗 / d.消耗 : null,
      媒体数,
      主投媒体,
      是0转化: d.消耗 > 0 && d.转化 === 0,
      低样本: d.消耗 > 0 && (d.转化 < DEFAULTS.低样本_最小转化 || d.点击 < DEFAULTS.低样本_最小点击),
      spark: sparks.get(name) ?? null,
    }
  })
}

const ZERO_BUCKETS = [
  { 名: '0-5%', lo: 0, hi: 0.05 },
  { 名: '5-10%', lo: 0.05, hi: 0.1 },
  { 名: '10-20%', lo: 0.1, hi: 0.2 },
  { 名: '20-40%', lo: 0.2, hi: 0.4 },
  { 名: '40%+', lo: 0.4, hi: Infinity },
]

export function buildProjects(优化师?: string, 媒体?: string, 起始?: string, 截止?: string) {
  const acc = filterRows(enrichedAccounts(起始, 截止), { 优化师, 媒体 })
  const sparks = projectSparks(优化师, 起始, 截止)
  const rows = projectRows(acc, sparks)

  const 总消耗 = sumCol(acc, '消耗')
  const 总零转化消耗 = rows.reduce((s, r) => s + r.零转化消耗, 0)
  const spending = rows.filter((r) => r.消耗 > 0)
  const dAll = derive(acc)

  // ⑤ 0转化消耗占比分桶(只统计有消耗项目)
  const buckets = ZERO_BUCKETS.map((b) => {
    const inB = spending.filter((r) => {
      const v = r.零转化占比 ?? 0
      return v >= b.lo && (b.hi === Infinity || v < b.hi)
    })
    return {
      区间: b.名,
      项目数: inB.length,
      消耗: inB.reduce((s, r) => s + r.消耗, 0),
      零转化消耗: inB.reduce((s, r) => s + r.零转化消耗, 0),
      top5: [...inB]
        .sort((a, b2) => (b2.零转化占比 ?? 0) - (a.零转化占比 ?? 0))
        .slice(0, 5)
        .map((r) => ({ 创量项目: r.创量项目, 零转化占比: r.零转化占比, 消耗: r.消耗 })),
    }
  })

  const summary = {
    总消耗,
    总零转化消耗,
    零转化占比: 总消耗 ? 总零转化消耗 / 总消耗 : null,
    在投项目数: spending.length,
    '0转化项目数': rows.filter((r) => r.是0转化).length,
    CTR: dAll.CTR,
    CPC: dAll.CPC,
    有趋势: sparks.size > 0,
    有媒体: !!getTables()['项目报表'],
    低样本阈值: { 转化: DEFAULTS.低样本_最小转化, 点击: DEFAULTS.低样本_最小点击 },
  }
  return { rows, summary, buckets }
}

/** ⑧ 单项目详情(抽屉懒加载):摘要 + 逐日走势 + 媒体构成 + 账户表现分布 + 转化链路。 */
export function buildProjectDetail(项目名: string, 优化师?: string, 起始?: string, 截止?: string) {
  const acc = filterRows(enrichedAccounts(起始, 截止), { 优化师 }).filter((r) => r['创量项目'] === 项目名)
  const d = derive(acc)
  const 零转化消耗 = zeroConvSpend(acc)

  const 摘要 = {
    创量项目: 项目名, 消耗: d.消耗, 展示: d.展示, 点击: d.点击, 转化: d.转化, 激活: d.激活,
    CTR: d.CTR, CPC: d.CPC, CVR: d.CVR, CPA: d.CPA,
    零转化消耗, 零转化占比: d.消耗 ? 零转化消耗 / d.消耗 : null,
    账户数: new Set(acc.map((r) => r['账户ID'])).size,
  }

  // 逐日走势(含日级 0转化消耗)
  const day = getTables()['账户按天']
  let days: { 时间: string; 消耗: number; 展示: number; 点击: number; 转化: number; 零转化消耗: number }[] = []
  if (day) {
    let dr = day.filter((r) => r['创量项目'] === 项目名 && (!优化师 || r['优化师'] === 优化师))
    if (起始 && 截止) dr = dr.filter((r) => { const t = String(r['时间'] ?? ''); return t >= 起始 && t <= 截止 })
    days = groupBy(dr, '时间')
      .map(([时间, g]) => ({
        时间: String(时间), 消耗: sumCol(g, '消耗'), 展示: sumCol(g, '展示数'),
        点击: sumCol(g, '点击数'), 转化: sumCol(g, '转化数'), 零转化消耗: zeroConvSpend(g),
      }))
      .sort((a, b) => a.时间.localeCompare(b.时间))
  }

  // 媒体构成
  const 媒体构成 = byDimension(acc.filter((r) => typeof r['媒体'] === 'string' && r['媒体'] !== ''), '媒体')
    .map((m) => ({ ...m, 零转化消耗: zeroConvSpend(acc.filter((r) => r['媒体'] === m['媒体'])) }))

  // 账户表现分布(互斥 3 组,中性命名)
  const 账户分布 = { 有消耗有转化: { 账户数: 0, 消耗: 0 }, 有消耗0转化: { 账户数: 0, 消耗: 0 }, '0消耗': { 账户数: 0, 消耗: 0 } }
  for (const r of acc) {
    const c = n0(r['消耗']), t = n0(r['转化数'])
    const k = c === 0 ? '0消耗' : t > 0 ? '有消耗有转化' : '有消耗0转化'
    账户分布[k].账户数++
    账户分布[k].消耗 += c
  }

  // 转化链路(展示/点击齐才给)
  const 链路 = d.展示 > 0 && d.点击 > 0
    ? { 展示: d.展示, 点击: d.点击, 转化: d.转化, 激活: d.激活, CTR: d.CTR, 点击转化率: safe(d.转化, d.点击), 转化激活率: safe(d.激活, d.转化) }
    : null

  return { 摘要, days, 媒体构成, 账户分布, 链路 }
}

export function buildTeam(项目?: string, 媒体?: string, 起始?: string, 截止?: string) {
  const acc = filterRows(enrichedAccounts(起始, 截止), { 项目, 媒体 })
  const team = byDimension(acc, '优化师')
  const rows = team.map((t) => {
    const name = t['优化师']
    const sub = acc.filter((r) => r['优化师'] === name)
    return {
      ...t,
      问题账户数: countWhere(sub, (r) => n0(r['浪费金额']) > 0),
      问题账户消耗: sumCol(sub, '浪费金额'),
      主转化目标: mode(sub.filter((r) => n0(r['转化数']) > 0).map((r) => r['转化目标'])),
    }
  })
  return { rows }
}

/** 众数,对齐 pandas .mode().iloc[0]:取出现最多者,并列时取升序第一;空集返回 null。 */
function mode(values: Cell[]): Cell {
  const cnt = new Map<string, { v: Cell; n: number }>()
  for (const v of values) {
    if (v === null || v === undefined) continue
    const k = String(v)
    const e = cnt.get(k) ?? { v, n: 0 }
    e.n++
    cnt.set(k, e)
  }
  if (cnt.size === 0) return null
  const sorted = [...cnt.values()].sort((a, b) => b.n - a.n || String(a.v).localeCompare(String(b.v)))
  return sorted[0].v
}

/** 媒体分析页。数据源唯一为「项目报表」(账户报表无媒体维度);支持 优化师/项目/媒体 过滤,
 *  无日期维度(项目报表为整段)。返回:每媒体结构指标 + 全媒体概览 + 同项目媒体对比矩阵。 */
export function buildMedia(优化师?: string, 项目?: string, 媒体?: string) {
  const 项目报表 = getTables()['项目报表']
  if (!项目报表) return { rows: [], 总计: null, 同项目对比: null }
  const all = filterRows(项目报表, { 优化师, 项目, 媒体 })
  const 总消耗 = sumCol(all, '消耗')
  const 账户总数 = nunique(all, '账户ID')

  const rows = groupBy(all, '媒体')
    .filter(([m]) => typeof m === 'string' && m !== '')
    .map(([m, g]) => {
      const 消耗 = sumCol(g, '消耗')
      const 展示 = sumCol(g, '展示数')
      const 点击 = sumCol(g, '点击数')
      const 转化 = sumCol(g, '转化数')
      const 账户数 = nunique(g, '账户ID')
      const 零转化消耗 = g.reduce((s, r) => s + (n0(r['转化数']) === 0 ? n0(r['消耗']) : 0), 0)
      const 占比 = safe(消耗, 总消耗)
      const 样本状态 =
        消耗 > 0 && 转化 === 0 ? '无转化' : 账户数 < 5 || (占比 ?? 0) < 0.01 ? '样本较小' : '充足'
      return {
        媒体: String(m),
        消耗,
        占比: 占比 ?? 0,
        账户数,
        账户占比: safe(账户数, 账户总数) ?? 0,
        单账户消耗: safe(消耗, 账户数),
        展示,
        点击,
        转化,
        CTR: safe(点击, 展示),
        CPC: safe(消耗, 点击),
        CVR: safe(转化, 点击),
        CPA: safe(消耗, 转化),
        零转化占比: safe(零转化消耗, 消耗),
        样本状态,
      }
    })
    .sort((a, b) => b.消耗 - a.消耗)

  const d = derive(all)
  const 总计 = {
    总消耗,
    媒体数: rows.length,
    账户总数,
    单账户平均消耗: safe(总消耗, 账户总数),
    CTR: d.CTR,
    CPC: d.CPC,
    CVR: d.CVR,
    CPA: d.CPA,
  }

  return { rows, 总计, 同项目对比: sameProjectMedia(all) }
}

/** ⑤ 同项目媒体对比:只取「同一项目下投了 ≥2 个媒体」的项目,逐项目列出各媒体的 消耗/CPA 等。
 *  CPA 只在同项目行内可比(跨项目不可比),色阶交给前端按行内相对值上色。 */
function sameProjectMedia(rows: Row[]) {
  type Cell = { 消耗: number; CPA: number | null; 账户数: number; CTR: number | null; CPC: number | null; CVR: number | null }
  const mediaSpend = new Map<string, number>()
  const out: { 项目: string; 总消耗: number; 主消耗媒体: string; cells: Record<string, Cell> }[] = []
  for (const [proj, g] of groupBy(rows, '创量项目')) {
    if (typeof proj !== 'string' || proj === '') continue
    const mediaGroups = groupBy(g, '媒体').filter(([m]) => typeof m === 'string' && m !== '')
    if (mediaGroups.length < 2) continue
    const cells: Record<string, Cell> = {}
    let 总消耗 = 0
    let 主消耗媒体 = ''
    let 主消耗 = -1
    for (const [m, mg] of mediaGroups) {
      const name = String(m)
      const 消耗 = sumCol(mg, '消耗')
      const 展示 = sumCol(mg, '展示数')
      const 点击 = sumCol(mg, '点击数')
      const 转化 = sumCol(mg, '转化数')
      cells[name] = { 消耗, CPA: safe(消耗, 转化), 账户数: nunique(mg, '账户ID'), CTR: safe(点击, 展示), CPC: safe(消耗, 点击), CVR: safe(转化, 点击) }
      总消耗 += 消耗
      mediaSpend.set(name, (mediaSpend.get(name) ?? 0) + 消耗)
      if (消耗 > 主消耗) { 主消耗 = 消耗; 主消耗媒体 = name }
    }
    out.push({ 项目: proj, 总消耗, 主消耗媒体, cells })
  }
  if (out.length === 0) return null
  out.sort((a, b) => b.总消耗 - a.总消耗)
  const 媒体列 = [...mediaSpend.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m)
  return { 媒体列, rows: out }
}

export function buildTrend(优化师?: string, 项目?: string, 起始?: string, 截止?: string) {
  const day = getTables()['账户按天']
  if (!day) return { rows: [], 峰值: null }
  let df = filterRows(day, { 优化师, 项目 }) // 按天表无媒体维度,不支持媒体筛选
  if (起始 && 截止) df = df.filter((r) => {
    const t = String(r['时间'] ?? '')
    return t >= 起始 && t <= 截止
  })
  const rows = groupBy(df, '时间')
    .map(([时间, g]) => {
      const 消耗 = sumCol(g, '消耗')
      const 转化 = sumCol(g, '转化数')
      const 激活 = sumCol(g, '激活数')
      const 点击 = sumCol(g, '点击数')
      const 展示 = sumCol(g, '展示数')
      return {
        时间,
        消耗,
        转化,
        激活,
        点击,
        展示,
        零转化消耗: zeroConvSpend(g), // 当日「转化数==0」账户的消耗(0转化消耗占比走势用)
        CPA: 转化 ? 消耗 / 转化 : null,
        CPC: 点击 ? 消耗 / 点击 : null,
      }
    })
    .sort((a, b) => String(a.时间).localeCompare(String(b.时间)))

  // 峰值日 = 消耗最高的一天;贡献项目 = 当日各项目消耗占比(Top3 + 其他)
  let 峰值: { 时间: string; 消耗: number; 贡献: { 项目: string; 消耗: number; 占比: number }[] } | null = null
  if (rows.length > 0) {
    const top = rows.reduce((a, b) => (b.消耗 > a.消耗 ? b : a))
    const dayRows = df.filter((r) => String(r['时间'] ?? '') === String(top.时间))
    const byProj = groupBy(dayRows, '创量项目')
      .map(([proj, g]) => ({ 项目: String(proj), 消耗: sumCol(g, '消耗') }))
      .sort((a, b) => b.消耗 - a.消耗)
    const total = top.消耗 || 1
    const top3 = byProj.slice(0, 3)
    const 其他消耗 = byProj.slice(3).reduce((s, p) => s + p.消耗, 0)
    const 贡献 = top3.map((p) => ({ ...p, 占比: p.消耗 / total }))
    if (其他消耗 > 0) 贡献.push({ 项目: '其他项目', 消耗: 其他消耗, 占比: 其他消耗 / total })
    峰值 = { 时间: String(top.时间), 消耗: top.消耗, 贡献 }
  }
  return { rows, 峰值 }
}

export function buildFilters() {
  const acc = enrichedAccounts()
  const uniq = (col: string) =>
    [...new Set(acc.map((r) => r[col]).filter((v): v is string => typeof v === 'string' && v !== ''))].sort()
  return { 优化师: uniq('优化师'), 项目: uniq('创量项目'), 媒体: uniq('媒体'), 日期范围: dailyDateRange() }
}

/** 按天表的可选日期范围(单日最小/最大);无按天表返回 null。供日期筛选控件用。 */
function dailyDateRange(): { min: string; max: string } | null {
  const day = getTables()['账户按天']
  if (!day || day.length === 0) return null
  let min = '', max = ''
  for (const r of day) {
    const t = String(r['时间'] ?? '')
    if (!t) continue
    if (!min || t < min) min = t
    if (!max || t > max) max = t
  }
  return min && max ? { min, max } : null
}

export function buildConfig() {
  return DEFAULTS
}

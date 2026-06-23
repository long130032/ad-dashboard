/** 数据塑形纯函数,对齐 backend/app.py 的 build_*。输出 JSON 形状与原后端逐字段一致,
 *  这样前端页面/组件一行不用改。 */
import type { Row, Cell } from './types'
import { getTables } from './store'
import { byDimension, derive } from './metrics'
import { classifyAccounts, inferTargets } from './diagnose'
import { projectStatus } from './projectStatus'
import { DEFAULTS } from './config'
import { groupBy, n0, sumCol } from './agg'

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

/** 账户整段表 + 媒体(来自项目报表)+ 转化目标 + 问题分类,按浪费金额降序。对齐 app.enriched_accounts。 */
function enrichedAccounts(): Row[] {
  const tables = getTables()
  const acc = (tables['账户整段'] ?? []).map((r) => ({ ...r })) // 副本,避免污染内存表
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

export function buildOverview(优化师?: string, 项目?: string, 媒体?: string) {
  const acc = filterRows(enrichedAccounts(), { 优化师, 项目, 媒体 })
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

export function buildAccounts(优化师?: string, 项目?: string, 媒体?: string, 问题类型?: string) {
  let acc = filterRows(enrichedAccounts(), { 优化师, 项目, 媒体 })
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

export function buildProjects(优化师?: string, 媒体?: string) {
  const acc = filterRows(enrichedAccounts(), { 优化师, 媒体 })
  return { rows: projectStatus(acc) }
}

export function buildTeam(项目?: string, 媒体?: string) {
  const acc = filterRows(enrichedAccounts(), { 项目, 媒体 })
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

export function buildMedia() {
  const 项目报表 = getTables()['项目报表']
  if (!项目报表) return { rows: [] }
  return { rows: byDimension(项目报表, '媒体') }
}

export function buildTrend(优化师?: string, 项目?: string) {
  const day = getTables()['账户按天']
  if (!day) return { rows: [] }
  const df = filterRows(day, { 优化师, 项目 }) // 按天表无媒体维度,不支持媒体筛选
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
        CPA: 转化 ? 消耗 / 转化 : null,
        CPC: 点击 ? 消耗 / 点击 : null,
      }
    })
    .sort((a, b) => String(a.时间).localeCompare(String(b.时间)))
  return { rows }
}

export function buildFilters() {
  const acc = enrichedAccounts()
  const uniq = (col: string) =>
    [...new Set(acc.map((r) => r[col]).filter((v): v is string => typeof v === 'string' && v !== ''))].sort()
  return { 优化师: uniq('优化师'), 项目: uniq('创量项目'), 媒体: uniq('媒体') }
}

export function buildConfig() {
  return DEFAULTS
}

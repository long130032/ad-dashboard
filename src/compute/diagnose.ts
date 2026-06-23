/** 账户问题诊断。对齐 backend/diagnose.py。
 *
 * 主线:钱。账户按「白花的钱(浪费金额)」降序,最该肉疼的浮在最上面。
 * 5 类:零消耗 / 起量中 / 有消耗无产出 / 成本偏高 / 正常。
 * 浪费金额:有消耗无产出=全部消耗;成本偏高=超出同项目基准的多花部分;其余 0。
 */
import type { Row } from './types'
import { DEFAULTS, type Config } from './config'
import { median, n0 } from './agg'

/** 按类型给病灶定位 + 处理建议。对齐 diagnose._病灶与建议。 */
function 病灶与建议(类型: string, 展示: number, 点击: number): [string, string] {
  if (类型 === '成本偏高') return ['同项目内CPA偏高', '对标本项目高效账户——查出价/定向/落地页']
  if (类型 === '起量中') return ['激活已起未转化', '持续观察——优化转化承接(落地页/出价/转化定向)']
  // 有消耗无产出
  if (展示 === 0) return ['几乎无展示', '检查出价/预算/审核——账户没起量']
  if (点击 === 0) return ['有展示无点击', '素材/定向问题——换创意、收窄人群']
  return ['有点击无转化', '承接问题——查落地页/转化定向/出价']
}

/** 每个项目内,转化量达标账户的 CPA 中位数,作为该项目「成本偏高」判定基准。
 *  用中位数而非均值:抗个别极端账户带偏。 */
function projectCpaBaseline(acc: Row[], 最小转化: number): Map<string, number> {
  const byProj = new Map<string, number[]>() // 项目 → 达标账户的 cpa 列表
  for (const r of acc) {
    const 消耗 = n0(r['消耗'])
    const 转化 = n0(r['转化数'])
    if (转化 <= 0) continue
    const cpa = 消耗 / 转化
    if (转化 >= 最小转化) {
      const proj = String(r['创量项目'] ?? '')
      const list = byProj.get(proj) ?? []
      list.push(cpa)
      byProj.set(proj, list)
    }
  }
  const base = new Map<string, number>()
  for (const [proj, list] of byProj) if (list.length) base.set(proj, median(list))
  return base
}

/** 对整段账户表分 5 类,逐行写入「问题类型/浪费金额/病灶/建议」,返回按浪费金额降序的新数组。
 *  注意:会就地修改传入行对象(调用方应已传入副本)。 */
export function classifyAccounts(acc: Row[], cfg: Config = DEFAULTS): Row[] {
  const 最小转化 = cfg.CPA偏高_最小转化量
  const 倍数 = cfg.CPA偏高_倍数
  const base = projectCpaBaseline(acc, 最小转化)

  for (const r of acc) {
    const c = n0(r['消耗'])
    const imp = n0(r['展示数'])
    const clk = n0(r['点击数'])
    const t = n0(r['转化数'])
    const a = n0(r['激活数'])
    const proj = String(r['创量项目'] ?? '')

    let 类型: string
    let 浪费: number
    let b = ''
    let s = ''
    if (c === 0) {
      类型 = '零消耗'
      浪费 = 0
    } else if (t > 0) {
      const 基准 = base.get(proj)
      if (t >= 最小转化 && 基准 && c / t > 基准 * 倍数) {
        类型 = '成本偏高'
        浪费 = Math.max(c - 基准 * t, 0)
        ;[b, s] = 病灶与建议('成本偏高', imp, clk)
      } else {
        类型 = '正常'
        浪费 = 0
      }
    } else if (a > 0) {
      类型 = '起量中'
      浪费 = 0
      ;[b, s] = 病灶与建议('起量中', imp, clk)
    } else {
      类型 = '有消耗无产出'
      浪费 = c
      ;[b, s] = 病灶与建议('有消耗无产出', imp, clk)
    }
    r['问题类型'] = 类型
    r['浪费金额'] = 浪费
    r['病灶'] = b
    r['建议'] = s
  }

  return acc.slice().sort((x, y) => n0(y['浪费金额']) - n0(x['浪费金额']))
}

// 漏斗各环节计数列,用来反推账户的转化目标
const STAGE_COLS: [string, string][] = [
  ['激活', '激活数'],
  ['注册', '注册数'],
  ['首次付费', '首次付费数'],
  ['付费', '付费数'],
  ['深度转化', '深度转化数'],
]

/** 反推每个账户的转化目标:拿「转化数」去匹配最接近的漏斗环节计数(差距>10% 归「其他」,0 转化归 null)。
 *  返回与 acc 等长、同序的目标数组。 */
export function inferTargets(acc: Row[]): (string | null)[] {
  return acc.map((r) => {
    const t = n0(r['转化数'])
    if (t <= 0) return null
    let best = '其他'
    let bestDiff = 0.1
    for (const [name, col] of STAGE_COLS) {
      const v = n0(r[col])
      if (v > 0) {
        const diff = Math.abs(v - t) / t
        if (diff <= bestDiff) {
          best = name
          bestDiff = diff
        }
      }
    }
    return best
  })
}

/** 各问题桶的账户数与合计消耗。对齐 diagnose.summary。 */
export function summary(classified: Row[]): Record<string, { 账户数: number; 消耗: number }> {
  const out: Record<string, { 账户数: number; 消耗: number }> = {}
  for (const r of classified) {
    const 类型 = String(r['问题类型'] ?? '')
    const bucket = out[类型] ?? { 账户数: 0, 消耗: 0 }
    bucket.账户数 += 1
    bucket.消耗 += n0(r['消耗'])
    out[类型] = bucket
  }
  return out
}

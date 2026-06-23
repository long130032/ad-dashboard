/** 派生指标与维度汇总。对齐 backend/metrics.py。
 *
 * 口径铁律:一律先汇总分子分母再相除,绝不对平台的率/均价列求平均。
 * 维度分布一律按消耗金额。
 */
import type { Row } from './types'
import { groupBy, nunique, safe, sumCol } from './agg'

export type Derived = {
  消耗: number
  展示: number
  点击: number
  转化: number
  激活: number
  CTR: number | null
  CPC: number | null
  CVR: number | null
  CPA: number | null
  激活成本: number | null
  CPM: number | null
}

/** 对一组账户行汇总后算派生指标。 */
export function derive(rows: Row[]): Derived {
  const 消耗 = sumCol(rows, '消耗')
  const 展示 = sumCol(rows, '展示数')
  const 点击 = sumCol(rows, '点击数')
  const 转化 = sumCol(rows, '转化数')
  const 激活 = sumCol(rows, '激活数') // 列不存在时 sumCol 返回 0
  return {
    消耗,
    展示,
    点击,
    转化,
    激活,
    CTR: safe(点击, 展示),
    CPC: safe(消耗, 点击),
    CVR: safe(转化, 点击),
    CPA: safe(消耗, 转化),
    激活成本: safe(消耗, 激活),
    CPM: safe(消耗 * 1000, 展示),
  }
}

export type DimRow = Derived & {
  占比: number
  账户数: number
  有消耗账户数: number
  [dim: string]: Row[string] | number | null
}

/** 按维度(创量项目/媒体/优化师)汇总,返回按消耗降序的行。 */
export function byDimension(rows: Row[], dim: string): DimRow[] {
  const 总消耗 = sumCol(rows, '消耗')
  const out: DimRow[] = []
  for (const [key, g] of groupBy(rows, dim)) {
    const m = derive(g)
    // 同一账户在组内可能多行,先按账户ID汇总消耗,再数「有消耗」的账户
    const perAcc = new Map<string, number>()
    for (const r of g) {
      const id = String(r['账户ID'] ?? '')
      perAcc.set(id, (perAcc.get(id) ?? 0) + (typeof r['消耗'] === 'number' ? r['消耗'] : 0))
    }
    let 有消耗账户数 = 0
    for (const v of perAcc.values()) if (v > 0) 有消耗账户数++
    out.push({
      ...m,
      [dim]: key,
      占比: safe(m.消耗, 总消耗) ?? 0,
      账户数: nunique(g, '账户ID'),
      有消耗账户数,
    })
  }
  // 稳定排序:消耗降序(Array.sort 在现代引擎稳定)
  out.sort((a, b) => b.消耗 - a.消耗)
  return out
}

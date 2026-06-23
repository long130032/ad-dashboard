/** 项目状态标签(系统建议)。对齐 backend/project_status.py 的思路,但效率轴已改版。
 *
 * 主靠:消耗规模 + 白花钱比例(账户级浪费金额聚合到项目)。
 * 不再用 CVR 跨项目中位数劈刀 —— 不同项目转化目标不同,CVR/CPA 跨项目不可比。
 * 5 类:问题 / 低消耗 / 主力 / 要排查 / 潜力,均为可改的默认建议,不硬判。
 */
import type { Row } from './types'
import { byDimension, type DimRow } from './metrics'
import { quantile, sumCol, safe, groupBy } from './agg'
import { DEFAULTS, type Config } from './config'

export type ProjRow = DimRow & { 状态建议: string; 白花的钱: number; 白花钱比例: number | null }

/** 按创量项目汇总并打状态标签,按消耗降序。入参 acc 为 enrichedAccounts(每行带「浪费金额」)。 */
export function projectStatus(acc: Row[], cfg: Config = DEFAULTS): ProjRow[] {
  const proj = byDimension(acc, '创量项目')

  // 每项目「白花的钱」= 该项目账户行的浪费金额之和
  const wasteByProj = new Map<string, number>()
  for (const [key, g] of groupBy(acc, '创量项目')) wasteByProj.set(String(key), sumCol(g, '浪费金额'))

  const spends = proj.map((p) => p.消耗)
  const 高消耗线 = quantile(spends, 0.6) // 前 40% 算高消耗
  const 低消耗线 = quantile(spends, 0.25) // 后 25% 算低消耗
  const 偏高线 = cfg.项目白花钱偏高线

  return proj.map((r) => {
    const 白花的钱 = wasteByProj.get(String(r['创量项目'])) ?? 0
    const 白花钱比例 = safe(白花的钱, r.消耗)
    const 漏 = (白花钱比例 ?? 0) > 偏高线

    let 状态建议: string
    if (r.消耗 > 0 && r.转化 === 0) {
      状态建议 = '问题'
    } else if (r.消耗 <= 低消耗线) {
      状态建议 = '低消耗'
    } else if (r.消耗 >= 高消耗线) {
      状态建议 = 漏 ? '要排查' : '主力'
    } else {
      状态建议 = 漏 ? '要排查' : '潜力'
    }
    return { ...r, 状态建议, 白花的钱, 白花钱比例 }
  })
}

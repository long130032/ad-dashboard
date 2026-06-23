/** 项目状态标签(系统建议)。对齐 backend/project_status.py。
 *
 * 主靠:消耗规模 + 有无转化 + 同项目效率,弱化 CPA 绝对值。
 * 问题 / 低消耗 / 主力 / 需关注 / 潜力,均为可改的默认建议,不硬判。
 */
import type { Row } from './types'
import { byDimension, type DimRow } from './metrics'
import { median, quantile } from './agg'

export type ProjRow = DimRow & { 状态建议: string }

/** 按创量项目汇总并打状态标签,按消耗降序。 */
export function projectStatus(acc: Row[]): ProjRow[] {
  const proj = byDimension(acc, '创量项目')

  const spends = proj.map((p) => p.消耗)
  const 高消耗线 = quantile(spends, 0.6) // 前 40% 算高消耗
  const 低消耗线 = quantile(spends, 0.25) // 后 25% 算低消耗
  const 有转化 = proj.filter((p) => p.转化 > 0)
  const cvr中位 = 有转化.length ? median(有转化.map((p) => p.CVR)) : 0

  return proj.map((r) => {
    let 状态建议: string
    if (r.消耗 > 0 && r.转化 === 0) {
      状态建议 = '问题'
    } else if (r.消耗 <= 低消耗线) {
      状态建议 = '低消耗'
    } else {
      const eff好 = (r.CVR ?? 0) >= cvr中位
      if (r.消耗 >= 高消耗线) 状态建议 = eff好 ? '主力' : '需关注'
      else 状态建议 = eff好 ? '潜力' : '低消耗'
    }
    return { ...r, 状态建议 }
  })
}

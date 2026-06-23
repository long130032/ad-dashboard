/** 可配阈值。对齐 backend/config.py 的 DEFAULTS。 */
export const DEFAULTS = {
  // 消耗超此线且 0 转化 → 标红「高消耗低转化(高优先级)」;其余 0 转化为普通问题
  高消耗低转化_消耗线: 1000.0,
  // 转化数低于此不参与「CPA 偏高」判断(小样本成本不可信)
  CPA偏高_最小转化量: 10,
  // 同项目内 CPA 超基准这么多倍算偏高
  CPA偏高_倍数: 1.5,
}

export type Config = typeof DEFAULTS

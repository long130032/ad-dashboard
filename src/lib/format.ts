export const money = (n?: number | null) =>
  n == null ? '—' : '¥' + Math.round(n).toLocaleString('zh-CN')

export const wan = (n?: number | null) =>
  n == null ? '—' : (n / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) + '万'

export const num = (n?: number | null) =>
  n == null ? '—' : Math.round(n).toLocaleString('zh-CN')

export const pct = (n?: number | null, d = 1) =>
  n == null ? '—' : (n * 100).toFixed(d) + '%'

export const dec = (n?: number | null, d = 2) => (n == null ? '—' : n.toFixed(d))

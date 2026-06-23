// 轻量 sparkline:纯 SVG,无坐标轴,KPI 卡里表达趋势形态。数据点 < 2 时不渲染。
export function Sparkline({
  data,
  color = '#6d5cf5',
  height = 34,
}: {
  data: (number | null)[]
  color?: string
  height?: number
}) {
  const vals = data.filter((v): v is number => v != null && !Number.isNaN(v))
  if (vals.length < 2) return null

  const W = 120
  const H = height
  const P = 3
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const x = (i: number) => (i / (vals.length - 1)) * W
  const y = (v: number) => H - P - ((v - min) / span) * (H - P * 2)
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${W} ${H} L0 ${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} className="block">
      <path d={area} fill={color} fillOpacity={0.08} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

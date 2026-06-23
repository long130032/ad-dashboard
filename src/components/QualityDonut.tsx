import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { money, pct } from '../lib/format'

// 消耗质量:正常消耗 vs 无效消耗(有消耗但0转化)。环形 + 中心无效占比 + 图例金额。
export function QualityDonut({ 正常, 无效 }: { 正常: number; 无效: number }) {
  const total = 正常 + 无效
  const 无效率 = total ? 无效 / total : 0
  const data = [
    { name: '正常消耗', value: Math.max(正常, 0), color: '#10b981' },
    { name: '无效消耗', value: Math.max(无效, 0), color: '#ef4444' },
  ]
  return (
    <div>
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={56}
              outerRadius={78}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[12px] text-muted">无效消耗</div>
          <div className="text-[24px] font-semibold tabular-nums text-bad">{pct(无效率)}</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              <span className="text-ink">{d.name}</span>
            </span>
            <span className="tabular-nums text-muted">{money(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

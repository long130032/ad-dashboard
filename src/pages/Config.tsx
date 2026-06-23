import { Card } from '../components/Card'
import { useApi } from '../lib/useApi'

type Cfg = Record<string, number>

const FORMULAS = [
  ['CTR', 'Σ点击数 / Σ展示数'],
  ['CPC', 'Σ消耗 / Σ点击数'],
  ['CVR', 'Σ转化数 / Σ点击数'],
  ['CPA', 'Σ消耗 / Σ转化数'],
  ['CPM', 'Σ消耗 / Σ展示数 × 1000'],
]

const RULES = [
  '派生指标一律先汇总分子分母再相除,绝不对平台的率/均价列求平均。',
  '维度分布一律按消耗金额,不按账户数/行数。',
  'CPA 只在同项目 / 同转化目标内比较,跨项目跨媒体不可直接排名。',
  '问题账户按浪费金额(0转化账户的消耗)降序;消耗超阈值标「高消耗低转化」。',
]

export function Config() {
  const { data } = useApi<Cfg>('config')

  return (
    <div className="max-w-3xl space-y-4">
      <Card title="指标口径(对外明示)">
        <table className="w-full text-[13px]">
          <tbody>
            {FORMULAS.map(([k, v]) => (
              <tr key={k} className="border-b border-line/60 last:border-0">
                <td className="py-2 w-20 font-semibold text-brand">{k}</td>
                <td className="py-2 text-ink font-mono">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="当前阈值">
        <table className="w-full text-[13px]">
          <tbody>
            {data &&
              Object.entries(data).map(([k, v]) => (
                <tr key={k} className="border-b border-line/60 last:border-0">
                  <td className="py-2 text-ink">{k}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{v}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-muted">阈值在线编辑为二期功能;当前改值请改 backend/config.py。</p>
      </Card>

      <Card title="口径铁律">
        <ul className="space-y-2 text-[13px] text-ink list-disc pl-5">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

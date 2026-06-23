const MAP: Record<string, string> = {
  // 项目状态
  主力: 'bg-ok/10 text-ok',
  潜力: 'bg-brand/10 text-brand',
  需关注: 'bg-risk/10 text-risk',
  低消耗: 'bg-muted/10 text-muted',
  问题: 'bg-bad/10 text-bad',
  // 账户问题类型(5类)
  有消耗无产出: 'bg-bad/10 text-bad',
  成本偏高: 'bg-risk/10 text-risk',
  起量中: 'bg-sky-50 text-sky-600',
  零消耗: 'bg-muted/10 text-muted',
  正常: 'bg-ok/10 text-ok',
}

export function StatusBadge({ value }: { value: string }) {
  const cls = MAP[value] ?? 'bg-muted/10 text-muted'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${cls}`}>
      {value}
    </span>
  )
}

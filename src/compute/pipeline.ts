/** CSV 清洗 + 类型识别。把创量导出的三张表读成规范 Table。对齐 backend/pipeline.py。
 *
 * 三张表靠列指纹自动识别:
 * - 有「媒体」列            → 项目报表
 * - 时间是区间串(8-8)      → 账户报表(整段)
 * - 时间是单日(yyyy-mm-dd) → 账户报表(按天)
 */
import type { Row, Table, TableType } from './types'

// 各表的维度列(文本,不做数值清洗);其余列一律按数值清洗
const DIM_COLS: Record<TableType, string[]> = {
  项目报表: ['时间', '创量项目', '媒体', '优化师', '账户ID', '账户名称'],
  账户整段: ['时间', '优化师', '创量项目', '账户ID', '账户名称', '合作商', '公司主体', '账户备注'],
  账户按天: ['时间', '优化师', '创量项目', '账户ID', '账户名称', '合作商', '公司主体', '账户备注'],
}

const RANGE_RE = /^\d{8}-\d{8}$/ // 20260401-20260618
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/ // 2026-04-11

/** 按列指纹 + 时间格式判断是哪张表。 */
export function detectType(headers: string[], rows: Row[]): TableType {
  if (headers.includes('媒体')) return '项目报表'
  const sample = rows
    .map((r) => String(r['时间'] ?? '').trim())
    .find((t) => t !== '' && t !== '总计')
  if (sample && DAY_RE.test(sample)) return '账户按天'
  if (sample && RANGE_RE.test(sample)) return '账户整段'
  throw new Error(`无法识别的表结构,时间样例=${JSON.stringify(sample)}, 列数=${headers.length}`)
}

/** 单元格转数值:去引号/空白、'--'→null、'%'除100、去千分位逗号。对齐 pipeline._to_num。 */
export function toNum(x: unknown): number | null {
  let s = String(x ?? '').trim()
  s = s.replace(/^"+/, '').replace(/"+$/, '').trim()
  if (s === '--' || s === '' || s === 'nan' || s === 'None') return null
  const pct = s.endsWith('%')
  s = s.replace(/%+$/, '').replace(/,/g, '')
  const v = Number(s)
  if (s === '' || Number.isNaN(v)) return null
  return pct ? v / 100 : v
}

/** 账户ID 去引号、制表符、空白,作为关联键。对齐 pipeline._clean_account_id。 */
export function cleanAccountId(x: unknown): string {
  return String(x ?? '').replace(/"/g, '').replace(/\t/g, '').trim()
}

/** 清洗一张原始表(papaparse 出来的字符串行),返回规范 Table + 表类型。 */
export function clean(
  rawRows: Record<string, string>[],
  headers: string[],
  tableType?: TableType,
): { table: Table; type: TableType } {
  const type = tableType ?? detectType(headers, rawRows)
  const dims = new Set(DIM_COLS[type])

  const table: Table = []
  for (const raw of rawRows) {
    // 1. 跳过「总计」汇总行
    if (String(raw['时间'] ?? '').trim() === '总计') continue
    const row: Row = {}
    for (const col of headers) {
      if (col === '账户ID') row[col] = cleanAccountId(raw[col])
      else if (dims.has(col)) row[col] = raw[col] ?? null // 维度列保留原文
      else row[col] = toNum(raw[col]) // 数值列清洗
    }
    table.push(row)
  }
  return { table, type }
}

/** 一行记录:维度列是字符串,数值列清洗后是 number,缺失为 null(对齐 pandas 的 NaN)。 */
export type Cell = string | number | null
export type Row = Record<string, Cell>
export type Table = Row[]

export type TableType = '账户整段' | '账户按天' | '项目报表'

export type Tables = Partial<Record<TableType, Table>>

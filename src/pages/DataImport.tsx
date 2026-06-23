import { useState } from 'react'
import { Card } from '../components/Card'
import { useFilters } from '../store/filters'
import { uploadCsvFiles, resetData } from '../compute/store'

type Report = { file: string; 识别为: string; 清洗后行数: number }

export function DataImport() {
  const { refresh, meta } = useFilters()
  const [files, setFiles] = useState<FileList | null>(null)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const reset = async () => {
    if (!confirm('确定清空当前数据?清空后看板回到无数据状态,需重新上传。')) return
    setResetting(true)
    setErr(null)
    setReport(null)
    try {
      await resetData()
      refresh()
    } catch (e) {
      setErr(String(e))
    } finally {
      setResetting(false)
    }
  }

  const upload = async () => {
    if (!files?.length) return
    setBusy(true)
    setErr(null)
    setReport(null)
    try {
      const rep = await uploadCsvFiles(Array.from(files))
      setReport(rep)
      refresh()
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card title="上传数据">
        <p className="text-[13px] text-muted mb-4">
          从创量后台导出的 CSV 直接全选丢进来即可,系统按列自动识别(账户整段 / 账户按天 / 项目报表),无需对号入座。每次上传覆盖上一批。
        </p>
        <input
          type="file"
          multiple
          accept=".csv"
          onChange={(e) => setFiles(e.target.files)}
          className="block w-full text-[13px] text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-brand file:font-medium"
        />
        <button
          onClick={upload}
          disabled={busy || !files?.length}
          className="mt-4 rounded-lg bg-brand px-5 py-2 text-[14px] font-medium text-white disabled:opacity-40"
        >
          {busy ? '处理中…' : '上传并清洗'}
        </button>
        {meta.has_data && (
          <button
            onClick={reset}
            disabled={resetting || busy}
            className="mt-4 ml-3 rounded-lg border border-bad/40 px-5 py-2 text-[14px] font-medium text-bad disabled:opacity-40"
          >
            {resetting ? '清空中…' : '清空当前数据'}
          </button>
        )}
        {meta.has_data && <span className="ml-3 text-[12px] text-muted">当前数据截至 {meta.uploaded_at}</span>}
      </Card>

      {err && (
        <Card>
          <div className="text-bad text-[13px]">{err}</div>
        </Card>
      )}

      {report && (
        <Card title="清洗结果">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-muted border-b border-line">
                <th className="text-left py-2 font-medium">文件</th>
                <th className="text-left py-2 font-medium">识别为</th>
                <th className="text-right py-2 font-medium">清洗后行数</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.file} className="border-b border-line/60">
                  <td className="py-2 truncate max-w-[280px]">{r.file}</td>
                  <td className="py-2 text-brand">{r.识别为}</td>
                  <td className="py-2 text-right tabular-nums">{r.清洗后行数.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[12px] text-muted">已自动处理:跳过总计行、账户ID 去制表符、率值去 %、空值 -- 归缺失。</p>
        </Card>
      )}
    </div>
  )
}

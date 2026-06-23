/** 当前数据快照:覆盖式。内存 + IndexedDB 落盘(替代后端 pickle),不攒历史、不做数据库。
 *  对齐 backend/store.py 的语义,外加浏览器端 CSV 解析(原 backend app.api_upload)。 */
import Papa from 'papaparse'
import type { Tables, TableType } from './types'
import { clean } from './pipeline'

type Snapshot = { tables: Tables; uploadedAt: string | null }

const state: Snapshot = { tables: {}, uploadedAt: null }

// ---------- IndexedDB(最小封装,单 key 存整份快照) ----------
const DB_NAME = 'ad-diagnosis'
const STORE = 'kv'
const KEY = 'snapshot'
const HAS_IDB = typeof indexedDB !== 'undefined' // node 测试环境 / 隐私模式下为 false

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(): Promise<Snapshot | undefined> {
  if (!HAS_IDB) return undefined
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(snap: Snapshot | null): Promise<void> {
  if (!HAS_IDB) return
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const os = tx.objectStore(STORE)
    if (snap) os.put(snap, KEY)
    else os.delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 启动时从 IndexedDB 水合内存快照。所有读接口都先 await 它,避免首屏竞态。 */
export const ready: Promise<void> = (async () => {
  try {
    const snap = await idbGet()
    if (snap) {
      state.tables = snap.tables ?? {}
      state.uploadedAt = snap.uploadedAt ?? null
    }
  } catch {
    // IndexedDB 不可用(隐私模式等):退化为纯内存,不致命
  }
})()

// ---------- 对外 API(对齐 store.py) ----------

export function getTables(): Tables {
  return state.tables
}

export function meta(): { uploaded_at: string | null; has_data: boolean } {
  return { uploaded_at: state.uploadedAt, has_data: Object.keys(state.tables).length > 0 }
}

function setTables(tables: Tables, uploadedAt: string): void {
  state.tables = tables
  state.uploadedAt = uploadedAt
  void idbPut({ tables, uploadedAt }) // 异步落盘,失败不阻塞
}

/** 测试用:直接注入已清洗的表(绕过 CSV 上传)。 */
export { setTables as __setTablesForTest }

/** 归零:清空内存快照并删掉落盘。 */
export async function resetData(): Promise<void> {
  state.tables = {}
  state.uploadedAt = null
  await idbPut(null)
}

export type UploadReport = { file: string; 识别为: TableType; 清洗后行数: number }

/** 解析并清洗一批 CSV(覆盖式入库)。对齐 backend app.api_upload。 */
export async function uploadCsvFiles(files: File[]): Promise<UploadReport[]> {
  const tables: Tables = {}
  const report: UploadReport[] = []
  for (const f of files) {
    let text = await f.text()
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // 去 BOM
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })
    const headers = parsed.meta.fields ?? []
    const { table, type } = clean(parsed.data, headers)
    tables[type] = table
    report.push({ file: f.name, 识别为: type, 清洗后行数: table.length })
  }
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  setTables(tables, stamp)
  return report
}

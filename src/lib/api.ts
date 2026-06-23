/** 数据接缝:原来打 `/api/*` 的 HTTP,现在直接调浏览器内的 compute 层。
 *  保持 `api(path, params)` 签名不变,所以 useApi / filters / 各页面一行都不用改。 */
import { ready, meta } from '../compute/store'
import {
  buildOverview,
  buildAccounts,
  buildProjects,
  buildProjectDetail,
  buildTeam,
  buildMedia,
  buildTrend,
  buildFilters,
  buildConfig,
} from '../compute/builders'

export async function api<T>(
  path: string,
  params: Record<string, string | undefined> = {},
): Promise<T> {
  await ready // 首屏前确保已从 IndexedDB 水合
  const p = params
  let out: unknown
  switch (path) {
    case 'meta':
      out = meta()
      break
    case 'filters':
      out = buildFilters()
      break
    case 'overview':
      out = buildOverview(p.优化师, p.项目, p.媒体, p.起始, p.截止)
      break
    case 'accounts':
      out = buildAccounts(p.优化师, p.项目, p.媒体, p.问题类型, p.起始, p.截止)
      break
    case 'projects':
      out = buildProjects(p.优化师, p.媒体, p.起始, p.截止)
      break
    case 'projectDetail':
      out = buildProjectDetail(p.项目名 ?? '', p.优化师, p.起始, p.截止)
      break
    case 'team':
      out = buildTeam(p.项目, p.媒体, p.起始, p.截止)
      break
    case 'media':
      out = buildMedia()
      break
    case 'trend':
      out = buildTrend(p.优化师, p.项目, p.起始, p.截止)
      break
    case 'config':
      out = buildConfig()
      break
    default:
      throw new Error(`未知接口: ${path}`)
  }
  return out as T
}

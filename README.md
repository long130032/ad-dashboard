# 广告投放诊断看板(纯静态版)

投放负责人内部用的只读看板:上传创量后台导出的 CSV → **在浏览器里**当场清洗、计算、出看板。
**无后端、无 API、无数据库、不攒历史**,每次上传覆盖上一批。

> 这是 `../ad-diagnosis-dashboard`(后端版)的纯静态重制(部署选型方案 A)。
> 口径完全一致并由测试锁定;原后端逻辑已用 TypeScript 在 `src/compute/` 重写一处。

## 它和后端版的区别

| | 后端版 | 本版(纯静态) |
| --- | --- | --- |
| 算在哪 | Python/pandas 进程 | **浏览器里(JS)** |
| 部署 | 得开一台机跑服务 | **push 即出 URL,零运维**(Cloudflare Pages / Netlify) |
| 数据去向 | 上传到那台机 | **只留在看的人浏览器里(IndexedDB),不传任何服务器** |
| 共享 | 全队开同一 IP 看同一份 | **各看各的**(谁看谁传一次,之后常驻本机) |

适合「负责人自己分析、对齐时投屏/截图给团队」。如果团队要各自打开看同一份数据,则是另一条路(打 exe 单机用,或后端挪到内网常驻机),不走静态化。

## 开发

```bash
npm install
npm run dev      # http://localhost:5173
```

## 构建与本地预览

```bash
npm run build    # 产出 dist/(纯静态)
npm run preview  # 本地起静态服务器看 dist
```

## 部署(零运维)

`dist/` 是纯静态资源,托管到任意静态站点即可:

- **Cloudflare Pages / Netlify**:连仓库,build command `npm run build`,output `dist`,push 即自动部署。
- ⚠️ **不能**把 `dist/index.html` 当文件双击打开(`file://` 会被浏览器的 ES module 安全策略拦),必须经静态站点或 `npm run preview` 之类的 HTTP 服务。

> 数据隐私:页面是公开的,但你上传的 CSV **只在你自己的浏览器里解析**,从不离开本机。等于一个公开的「计算器」,数据自带。

## 换数据

「数据导入」页上传新 CSV(覆盖式),或先「清空当前数据」归零再传。数据存在浏览器 IndexedDB 里,**刷新/重开浏览器仍在**,换一台机器/换浏览器则需重新上传。

## 口径测试(锁住已知数字)

```bash
npm test         # vitest:跑 数据样本/ 三个 CSV,断言账户3203/0消耗735/有消耗0转化746/媒体占比/各诊断类浪费 等
```

这套测试是从后端 `verify_sample.py` / `verify_diagnose.py` 搬过来的验收关口,任何口径改动跑一遍就知道有没有飘。

## 结构

```
src/
  compute/           ← 口径核心(对齐原 backend/,一处实现)
    pipeline.ts        CSV 清洗 + 三表自动识别(= pipeline.py)
    metrics.ts         派生指标(先汇总再除)+ 维度汇总(= metrics.py)
    diagnose.ts        账户 5 类诊断 + 白花的钱 + 同项目 CPA 基准 + 转化目标反推(= diagnose.py)
    projectStatus.ts   项目状态标签(= project_status.py)
    config.ts          可配阈值(= config.py)
    builders.ts        总览/账户/项目/团队/媒体/趋势/筛选 数据塑形(= app.py 的 build_*)
    store.ts           内存快照 + IndexedDB 落盘 + CSV 上传解析(= store.py + app.api_upload)
    agg.ts             聚合小工具(sum/quantile/median 对齐 pandas skipna/linear)
    kou_jing.test.ts   口径回归测试
  lib/api.ts         数据接缝:原打 /api/* 的 HTTP,现直接调 compute 层(签名不变,页面零改动)
  pages/ components/ layout/ store/   ← 页面/组件/图表,从后端版逐字节照搬,未改
```

## 已知口径(重要,与后端版一致)

- 维度分布一律按**消耗金额**(按账户数会得出相反结论)。
- 派生指标先汇总分子分母再相除,不对平台率值求平均。
- **CPA 跨项目/跨人不可直接比**:转化目标不同(激活几毛、付费几十),团队/媒体页的 CPA 仅作参考。
- 账户分 5 类(零消耗 / 起量中 / 有消耗无产出 / 成本偏高 / 正常),按「白花的钱」排序。**真正的浪费是"成本偏高"(同项目内 CPA 偏高),金额远大于 0 转化小号**——抓大放小。

# 四阶段验收清单

这份清单用于判断博客方案的完成度。状态分三类：

- `已完成`：仓库中已有代码、脚本、配置或线上产物可证明。
- `可选启用`：能力已经实现，但需要外部账号、域名、素材或仓库配置后才会真正启用。
- `待输入`：需要提供内容源或外部决策，仓库无法凭空完成。

## 第一阶段：最小可用博客

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| 创建 Astro 博客 | 已完成 | `astro.config.mjs`、`src/`、`npm run build` |
| 首页 | 已完成 | `src/pages/index.astro` |
| 文章页 | 已完成 | `src/pages/posts/[...slug].astro`、`src/pages/[year]/[month]/[day]/[slug].astro` |
| 标签页 | 已完成 | `src/pages/tags/index.astro`、`src/pages/tags/[tag].astro` |
| 关于页 | 已完成 | `src/pages/about.astro` |
| 深色模式 | 已完成 | `src/styles/global.css` 的 `prefers-color-scheme: dark` |
| RSS / Atom / JSON Feed | 已完成 | `src/pages/rss.xml.ts`、`src/pages/atom.xml.ts`、`src/pages/feed.json.ts`、`dist/rss.xml`、`dist/atom.xml`、`dist/feed.json` |
| 站点地图 | 已完成 | `src/pages/sitemap.xml.ts`、`dist/sitemap.xml` |
| GitHub Pages 自动部署 | 已完成 | `.github/workflows/deploy.yml`、线上站点可访问 |

## 第二阶段：接入写作库

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| 配置 Obsidian Vault | 已完成 | `.obsidian/app.json`、`.obsidian/templates.json` |
| 统一文章模板 | 已完成 | `templates/article.md` |
| 统一图片目录和文件命名 | 已完成 | `scripts/prepare-post.mjs`、`public/images/inbox/.gitkeep` |
| 添加一键发布脚本 | 已完成 | `scripts/publish-post.mjs`、`npm run publish` |

## 第三阶段：公众号分发

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| 生成适合公众号的 HTML | 已完成 | `scripts/generate-wechat.mjs`、`npm run wechat` |
| 自动处理图片路径 | 已完成 | `scripts/generate-wechat.mjs` 将本地图片转为博客绝对 URL |
| 保留博客原文链接 | 已完成 | `content_source_url`、文末原文地址 |
| 视接口权限自动创建草稿 | 可选启用 | `scripts/create-wechat-draft.mjs`、`npm run wechat:draft`；需要 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`WECHAT_THUMB_MEDIA_ID` |

## 第四阶段：完善

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| 独立域名 | 可选启用 | `SITE_URL`、`CUSTOM_DOMAIN`、GitHub Actions CNAME 写入、`npm run config:services -- --domain example.com` 会输出 GitHub Pages A/AAAA/CNAME 清单；需要用户拥有域名并配置 DNS |
| 搜索 | 已完成 | `src/pages/articles.astro`、`scripts/generate-search-index.mjs`、`public/search.json` 的静态全文搜索；`src/pages/opensearch.xml.ts` 提供 OpenSearch 发现 |
| 评论 | 可选启用 | Giscus 环境变量入口、`npm run config:services` 配置清单；默认不加载第三方脚本 |
| 访问统计 | 可选启用 | Umami 环境变量入口、`npm run config:services` 配置清单；默认不加载第三方脚本 |
| SEO | 已完成 | canonical、结构化数据、文章时间、sitemap、robots、`llms.txt` |
| Open Graph 分享图 | 已完成 | `scripts/generate-og-images.mjs`、`dist/og/posts/2026-06-24-welcome/index.svg`、文章页 `og:image` |
| 旧公众号文章批量迁移 | 可选启用 | `scripts/import-wechat.mjs`、`imports/wechat/`、`exports/wechat-import-report.json` 导入报告；需要提供旧文章导出文件 |
| 国内访问镜像 | 可选启用 | `scripts/deploy-mirror.mjs`、`npm run mirror`、`exports/mirror-report.json` 发布报告、`npm run config:services` 配置清单；需要目标镜像仓库和平台权限 |

## 一键验证命令

```bash
npm run build
npm run audit
npm run doctor
npm run doctor -- --online
```

`npm run audit` 会检查核心交付物存在，`npm run doctor` 会检查本地维护状态，`--online` 会检查线上主站入口。

# 学语思

一个以 Markdown 为唯一内容源的轻量个人博客：

- Obsidian 本地写作
- Astro 生成静态页面
- GitHub Pages 免费托管
- GitHub Actions 自动部署
- 同一份文章可继续分发到微信公众号
- 可选评论、访问统计和自定义域名配置，默认不加载第三方资源

线上地址：<https://zhuchengxue.github.io/>

## 当前能力

- 首页、统一文章页、标签页、关于页和 404 页面
- 深色模式与移动端排版
- 71 篇新旧文章统一 Astro 风格
- 静态全文搜索、上一篇/下一篇导航
- RSS、Atom 和 sitemap
- 自动生成文章级 Open Graph 分享图与文章结构化数据
- 完整文章元数据与 Web App Manifest
- GitHub Pages 自动构建与发布
- Obsidian Vault、图片整理和一键发布脚本
- 公众号 HTML/JSON 分发和旧公众号文章批量导入草稿
- 独立域名、评论、统计、镜像的配置清单生成助手

## 首次使用

```bash
npm install
npm run dev
```

浏览器打开 <http://localhost:4321>。

用 Obsidian 的“打开本地仓库”功能选择本仓库根目录。仓库内已包含推荐配置：

- 新笔记目录：`src/content/posts`
- 模板目录：`templates`
- 图片收件箱：`public/images/inbox`
- 自动更新内部链接

个人工作区布局文件不会提交到 Git。

## 新建文章

推荐使用命令创建，文件名和图片目录会自动符合规范：

```bash
npm run new -- "文章标题" article-slug
```

生成：

```text
src/content/posts/YYYY-MM-DD-article-slug.md
public/images/article-slug/
```

也可以在 Obsidian 中使用 `templates/article.md`。

文章元数据：

```yaml
---
title: 文章标题
description: 一两句话概括文章
pubDate: 2026-06-25
tags:
  - 写作
draft: true
wechatUrl:
cover:
---
```

## 图片工作流

在 Obsidian 中直接粘贴图片。附件会进入：

```text
public/images/inbox/
```

写完后运行：

```bash
npm run prepare -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

脚本会：

1. 识别 Obsidian Wiki 图片和普通 Markdown 图片。
2. 将普通位图旋转校正并限制为最大 1600px。
3. 转为质量 82 的 WebP。
4. 重命名为 `article-slug-01.webp`。
5. 移入 `public/images/article-slug/`。
6. 重写文章图片路径并清理收件箱原图。

SVG 会原样保留并统一命名。

只查看计划、不修改文件：

```bash
npm run prepare -- "文章路径" --dry-run
```

## 一键发布

发布前填写真实摘要和标签。建议先做只读体检：

```bash
npm run ready -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

它会检查标题、摘要、发布日期、标签、正文长度、图片命名、封面图和公众号 HTML 转换可行性。严格要求 `draft: false` 时可以运行：

```bash
npm run ready -- "文章路径" --strict
```

确认无误后运行：

```bash
npm run publish -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

脚本会依次：

1. 拒绝混入无关工作区改动。
2. 自动整理文章图片。
3. 将 `draft` 改为 `false`。
4. 执行完整内容、类型和构建检查。
5. 只暂存本文及本文图片。
6. 创建 Git 提交并推送。
7. 触发 GitHub Pages 自动部署。

发布预检：

```bash
npm run publish -- "文章路径" --dry-run
```

## 手动检查

```bash
npm run check:content
npm run ready -- "src/content/posts/YYYY-MM-DD-article-slug.md"
npm run build
npm run audit
npm run doctor
npm run preview
```

需要确认 GitHub Pages 线上站点时运行：

```bash
npm run doctor -- --online
```

它会检查首页、文章页、RSS、sitemap、Manifest、示例文章，以及线上 `/search.json` 是否包含 71 篇全文搜索索引。

想快速查看四阶段完成度和还缺哪些外部配置，可以运行：

```bash
npm run status
npm run status -- --online
```

`npm run status` 只做只读汇总；不上传、不推送、不调用公众号或镜像平台。加 `--online` 时才会访问当前站点做线上抽检。

构建会检查新旧文章、图片路径、旧文迁移完整性、订阅源、首页和最终静态产物。
`npm run audit` 会额外审计四阶段核心交付物是否仍然存在，例如 Obsidian 配置、公众号分发、旧文导入、SEO、评论/统计配置入口和 GitHub Pages 部署配置。
`npm run doctor` 会做维护体检：检查 Git 工作区、关键文件、构建产物、可选环境变量和默认第三方脚本状态。需要顺便检查线上主站时运行：

```bash
npm run doctor -- --online
```

如果正在改代码、尚未提交，但想先看其它诊断项，可以运行：

```bash
npm run doctor -- --allow-dirty
```

需要生成独立域名、Giscus、Umami、镜像或公众号 API 的配置清单时运行：

```bash
npm run config:services -- --domain example.com
npm run config:services -- --giscus-repo owner/repo --giscus-repo-id xxx --giscus-category General --giscus-category-id xxx
npm run config:services -- --umami-script https://analytics.example.com/script.js --umami-website-id xxx
npm run config:services -- --mirror-repo https://gitee.com/用户名/仓库名.git --mirror-branch pages --mirror-domain mirror.example.com
```

检查外部服务变量是否只填了一半：

```bash
npm run services:check
npm run services:check -- --strict
```

更完整的日常操作清单见 [docs/OPERATIONS.md](docs/OPERATIONS.md)，四阶段验收状态见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。

## 主要目录

```text
.obsidian/                 Obsidian 可共享设置
src/content/posts/         新文章 Markdown
src/content/legacy-posts.json
                           迁移后的 70 篇旧文章
public/images/inbox/       Obsidian 图片收件箱
public/images/<slug>/      已整理文章图片
imports/wechat/            旧公众号导入源文件，本目录内容不提交
exports/wechat/            公众号分发产物，本目录不提交
templates/article.md       文章模板
scripts/                   新建、整理、发布与检查脚本
.github/workflows/         GitHub Pages 部署
```

## 公众号分发

博客 Markdown 是主稿。建议先发布博客，确保图片 URL 已上线，然后生成公众号版本：

```bash
npm run wechat -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

批量生成全部已发布新文章的公众号版本：

```bash
npm run wechat:all -- --dry-run
npm run wechat:all
```

输出目录：

```text
exports/wechat/YYYY-MM-DD-article-slug.html
exports/wechat/YYYY-MM-DD-article-slug.json
exports/wechat/index.json
```

HTML 已使用适合公众号编辑器的内联样式，并自动：

- 将本地文章图片改为博客绝对 URL
- 处理代码块、引用、列表、表格和链接
- 在文末保留博客原文链接

JSON 包含标题、作者、摘要、正文 HTML、原文链接、封面和正文图片清单，可直接作为未来微信草稿 API 的输入。

只做转换预检：

```bash
npm run wechat -- "文章路径" --dry-run
```

生成文件属于发布产物，不会提交到 Git。

## 自动创建公众号草稿

如果公众号具备草稿箱接口权限，可以把上一步生成的 JSON 直接提交到微信草稿箱。先准备：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_THUMB_MEDIA_ID`

其中 `WECHAT_THUMB_MEDIA_ID` 必须是已经上传到公众号素材库的封面图素材 ID。仓库不会保存这些凭据。

先预检：

```bash
WECHAT_THUMB_MEDIA_ID=你的封面素材ID npm run wechat:draft -- "exports/wechat/YYYY-MM-DD-article-slug.json" --dry-run
```

确认字段无误后创建草稿：

```bash
WECHAT_APP_ID=你的AppID WECHAT_APP_SECRET=你的AppSecret WECHAT_THUMB_MEDIA_ID=你的封面素材ID npm run wechat:draft -- "exports/wechat/YYYY-MM-DD-article-slug.json"
```

正文图片默认使用博客绝对 URL。多数情况下可先进入公众号后台人工预览；如果微信编辑器不显示外链图片，后续再走微信图片上传接口替换正文图片地址。

## 旧公众号文章批量迁移

把旧公众号导出的 `.html`、`.htm`、`.txt` 或 `.md` 文件放到：

```text
imports/wechat/
```

先预检：

```bash
npm run import:wechat -- --dry-run
npm run import:wechat -- --dry-run --report
```

确认无误后导入：

```bash
npm run import:wechat
```

脚本会在 `src/content/posts/` 生成 Markdown 草稿，默认：

- `draft: true`，不会直接上线
- 标签为 `旧公众号`
- 文件名优先使用源文件中的日期，例如 `2020-03-29-文章标题.html`
- HTML 会尽量转换为 Markdown，图片链接会先保留原地址
- 正式导入或加 `--report` 时，会生成 `exports/wechat-import-report.json`，记录导入、跳过和疑似重复项

导入后建议逐篇检查标题、摘要、标签、图片和排版，再用正常发布流程上线。

## 自定义域名

当前默认站点地址是 `https://zhuchengxue.github.io`。以后绑定自定义域名时，在构建环境设置：

```text
SITE_URL=https://你的域名
CUSTOM_DOMAIN=你的域名
```

博客 canonical、Open Graph、结构化数据以及公众号原文和图片地址会一起切换，不需要逐文件修改。`CUSTOM_DOMAIN` 会让 GitHub Actions 在构建产物里生成 `CNAME`。

如果使用 GitHub Pages 自定义域名，还需要在仓库 Settings → Pages 里绑定域名，并按 GitHub 提示配置 DNS。可以先用配置助手生成清单：

```bash
npm run config:services -- --domain example.com
```

DNS 常见填法：

- 顶级域名，例如 `example.com`：添加 4 条 A 记录到 `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`；需要 IPv6 时再添加 4 条 AAAA 记录到 `2606:50c0:8000::153`、`2606:50c0:8001::153`、`2606:50c0:8002::153`、`2606:50c0:8003::153`。
- 子域名，例如 `www.example.com` 或 `blog.example.com`：添加 CNAME 到 `zhuchengxue.github.io`。

建议顺序是先在 GitHub Pages 里添加并验证域名，再配置 DNS，最后开启 Enforce HTTPS。

本地可复制 `.env.example` 作为配置参考。GitHub Pages 部署时，推荐在仓库 Settings → Secrets and variables → Actions → Variables 中配置同名变量。

## 评论和访问统计

为了保持低资源占用，评论和统计默认关闭。只有设置环境变量后，页面才会加载对应第三方脚本。

启用 Giscus 评论：

```text
PUBLIC_GISCUS_REPO=用户名/仓库名
PUBLIC_GISCUS_REPO_ID=仓库 ID
PUBLIC_GISCUS_CATEGORY=Announcements
PUBLIC_GISCUS_CATEGORY_ID=分类 ID
```

启用 Umami 访问统计：

```text
PUBLIC_UMAMI_SCRIPT=https://你的-umami/script.js
PUBLIC_UMAMI_WEBSITE_ID=网站 ID
```

如果你继续坚持“最低占用资源”，可以一直不配置这两组变量，博客仍然是纯静态页面。

## 国内访问镜像

最低成本建议先不做自动同步镜像，避免多维护一套部署。需要时可选：

1. 绑定自定义域名，让未来切换托管平台更容易。
2. 使用 Cloudflare Pages、Vercel 或 Netlify 作为同仓库镜像。
3. 国内必须更稳时，再考虑 Gitee Pages、静态对象存储或服务器同步，但这通常会增加备案、费用或维护成本。

仓库已经提供一个手动镜像发布脚本。先确保主站构建通过：

```bash
npm run build
```

再配置目标仓库并预检：

```bash
MIRROR_REPO=https://gitee.com/用户名/仓库名.git MIRROR_BRANCH=pages npm run mirror -- --dry-run
```

确认后发布：

```bash
MIRROR_REPO=https://gitee.com/用户名/仓库名.git MIRROR_BRANCH=pages npm run mirror
```

脚本会把 `dist/` 推送到镜像仓库指定分支，并自动写入 `.nojekyll`。如果镜像也绑定域名，可以额外设置：

```text
MIRROR_DOMAIN=mirror.example.com
```

这个脚本默认不会在 GitHub Actions 中运行，也不会保存任何镜像平台 token。这样主博客仍然是零常驻资源；只有你明确需要镜像时，才手动同步一次。

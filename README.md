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
- 全文标题搜索、上一篇/下一篇导航
- RSS、Atom 和 sitemap
- Open Graph 分享图与文章结构化数据
- 完整文章元数据与 Web App Manifest
- GitHub Pages 自动构建与发布
- Obsidian Vault、图片整理和一键发布脚本
- 公众号 HTML/JSON 分发和旧公众号文章批量导入草稿

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

发布前填写真实摘要和标签，然后运行：

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
npm run build
npm run preview
```

构建会检查新旧文章、图片路径、旧文迁移完整性、订阅源、首页和最终静态产物。

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

输出目录：

```text
exports/wechat/YYYY-MM-DD-article-slug.html
exports/wechat/YYYY-MM-DD-article-slug.json
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

生成文件属于发布产物，不会提交到 Git。自动创建公众号草稿需要公众号具备接口权限，并通过环境变量提供 AppID/Secret；仓库不会保存微信凭据。

## 旧公众号文章批量迁移

把旧公众号导出的 `.html`、`.htm`、`.txt` 或 `.md` 文件放到：

```text
imports/wechat/
```

先预检：

```bash
npm run import:wechat -- --dry-run
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

导入后建议逐篇检查标题、摘要、标签、图片和排版，再用正常发布流程上线。

## 自定义域名

当前默认站点地址是 `https://zhuchengxue.github.io`。以后绑定自定义域名时，在构建环境设置：

```text
SITE_URL=https://你的域名
```

博客 canonical、Open Graph、结构化数据以及公众号原文和图片地址会一起切换，不需要逐文件修改。

如果使用 GitHub Pages 自定义域名，还需要在仓库 Settings → Pages 里绑定域名，并按 GitHub 提示配置 DNS。

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

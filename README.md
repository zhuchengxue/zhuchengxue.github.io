# 个人博客

一个轻量的中文个人博客：使用 Markdown 写作，由 Astro 生成静态页面，通过 GitHub Pages 免费托管。

本仓库已将原 Hexo 博客的 2017–2020 年文章迁移为结构化正文数据。旧文章继续使用原 URL，但与新文章共享同一套 Astro 页面、导航和排版。

网站的 `/articles/` 页面会自动合并新旧文章，并提供无需后端的即时标题搜索。

## 本地使用

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:4321`。

正式构建：

```bash
npm run build
```

## 写文章

1. 用 Obsidian 打开本仓库目录。
2. 在终端运行 `npm run new -- "文章标题" ying-wen-huo-pin-yin`。
3. 新文章会自动创建到 `src/content/posts/`，文件名为 `YYYY-MM-DD-短名.md`。
4. 图片放到 `public/images/文章名/`，正文中使用 `../../images/文章名/图片.webp`。
5. 写作时保持 `draft: true`；发布时改为 `draft: false`。

站点名称、作者和简介在 `src/config.ts` 中修改，个人介绍在 `src/pages/about.astro` 中修改。

使用 `../../images/` 是为了同时兼容本地预览、用户主页仓库和带仓库名前缀的 GitHub Pages。

分享图源文件是 `public/og-default.svg`，网站实际使用兼容性更好的 `public/og-default.png`。修改 SVG 后可重新生成 PNG：

```bash
node -e "import('sharp').then(({default:sharp})=>sharp('public/og-default.svg').png().toFile('public/og-default.png'))"
```

发布前运行：

```bash
npm run build
```

构建会先检查每篇文章的标题、摘要、日期、标签、草稿状态和文件名，避免格式错误的文章被发布。

## 发布到 GitHub Pages

1. 在 GitHub 创建一个仓库，然后把本项目推送上去。
2. 打开仓库的 **Settings → Pages**。
3. 将 **Source** 设置为 **GitHub Actions**。
4. 推送到 `main` 或 `master` 分支后，工作流会自动构建并发布。

配置会根据 GitHub 仓库名自动判断网址：

- 仓库名为 `用户名.github.io`：发布到 `https://用户名.github.io/`
- 其他仓库名：发布到 `https://用户名.github.io/仓库名/`

仓库路径只会在 GitHub Actions 构建时启用，因此本地 `npm run dev` 和 `npm run preview` 始终使用根路径，不需要手工修改配置。

## 公众号分发

博客和公众号共用同一份 Markdown 原稿。博客通过 GitHub 自动发布；公众号暂时通过 Markdown Nice 或 Doocs MD 排版后手动复制，维护成本最低，也最稳定。

## 旧文章兼容

迁移后的 70 篇旧文保存在 `src/content/legacy-posts.json`，由 Astro 在原日期 URL（例如 `/2017/06/21/Chrome不完全指南/`）生成统一风格页面。旧归档、标签和分页链接会永久跳转到 `/articles/`，因此不再需要 Hexo 主题文件。

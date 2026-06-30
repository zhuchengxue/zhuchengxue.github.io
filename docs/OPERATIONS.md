# 学语思博客运维手册

这份手册只记录日常操作，不替代 README。README 讲“有什么能力”，这里讲“遇到具体场景怎么做”。

换 Windows 或 Mac、恢复未发布草稿以及补齐积压文章，请看 [MIGRATION.md](MIGRATION.md)。

## 日常推荐：不用命令行

Windows 双击 `打开写作助手.cmd`，Mac 双击 `打开写作助手.command`。浏览器控制台包含新建、检查、预发布、正式发布、公众号导出、批量导入、体检和迁移盘点按钮。

日常首页只保留“开始写作、打开写作、发布博客、推送公众号”。其他低频功能折叠在“设置与工具”。控制台会自动识别 Obsidian 当前登记的 Dropbox Vault，并使用其中的 `博客网站/` 目录同步文章；因此不会再用 C 盘路径直接唤起 Obsidian。首次换电脑时，先在 Obsidian 中打开 Dropbox 写作库即可。

已有文章无需手工搬运：展开“设置与工具 → Dropbox 旧文章”，先“扫描”，再“全部导入为草稿”。系统读取 Vault 根目录和 `已发布/`，自动补齐博客标题、摘要、日期和 `公众号归档` 标签；导入不会直接上线。

以下命令行内容主要保留给故障排查和自动化使用。

## 0. 一键体检

日常先跑：

```bash
npm run doctor
```

如果想顺便检查线上主站：

```bash
npm run doctor -- --online
```

线上体检会同时检查首页、文章页、RSS、JSON Feed、OpenSearch、llms.txt、humans.txt、sitemap、Manifest、示例文章和 `/search.json`，确认全文搜索索引已发布且包含 71 篇文章。

如果正在改代码、还没提交：

```bash
npm run doctor -- --allow-dirty
```

## 1. 新写一篇博客

```bash
npm run new -- "文章标题" article-slug
```

然后在 Obsidian 中编辑生成的 Markdown。图片直接粘贴即可，先进入 `public/images/inbox/`。

发布前先做只读体检：

```bash
npm run ready -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

确认要执行图片整理和构建预检：

```bash
npm run publish -- "src/content/posts/YYYY-MM-DD-article-slug.md" --dry-run
```

dry-run 会检查图片整理计划并执行完整文章体检，不会修改文件、提交或推送。

正式发布：

```bash
npm run publish -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

## 2. 只整理文章图片

```bash
npm run prepare -- "src/content/posts/YYYY-MM-DD-article-slug.md" --dry-run
npm run prepare -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

图片会被移动到 `public/images/<slug>/`，位图会转成 WebP。

## 3. 分发到微信公众号

先确保博客已发布、图片地址已经在线，再生成公众号版本：

```bash
npm run wechat -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

批量导出全部已发布新文章：

```bash
npm run wechat:all -- --dry-run
npm run wechat:all
```

产物在：

```text
exports/wechat/YYYY-MM-DD-article-slug.html
exports/wechat/YYYY-MM-DD-article-slug.json
exports/wechat/index.json
```

推荐做法：双击“打开写作助手”，首次在“公众号连接”填写 AppID 和 AppSecret；之后选文章，点击“推送到公众号草稿箱”。程序会自动上传正文图片、封面和草稿，不会自动群发。

每台电脑的凭据分别保存在本机 `.env`，不进 GitHub/Dropbox。换网络后若接口提示 IP 错误，需要把当前公网 IP 加入公众号后台白名单。

命令行等价入口：

```bash
npm run wechat:push -- "src/content/posts/YYYY-MM-DD-article-slug.md" --dry-run
npm run wechat:push -- "src/content/posts/YYYY-MM-DD-article-slug.md"
```

草稿进入后台后，人工预览并群发。没有接口权限时仍可打开生成的 HTML 复制到编辑器。

## 4. 批量迁移旧公众号文章

把旧文章导出的 `.html`、`.htm`、`.txt`、`.md` 放到：

```text
imports/wechat/
```

预检：

```bash
npm run import:wechat -- --dry-run
npm run import:wechat -- --dry-run --report
```

导入草稿：

```bash
npm run import:wechat
```

导入脚本会识别目标文件是否已存在、标题是否疑似重复，并处理微信常见的 `#js_content` 正文容器、`data-src` 懒加载图片以及页面中的标题、日期、摘要和原文地址。正式导入或加 `--report` 时，会生成 `exports/wechat-import-report.json`。导入后逐篇检查标题、摘要、图片、标签，再按正常博客流程发布。

## 5. 绑定独立域名

先生成配置清单：

```bash
npm run config:services -- --domain example.com
```

需要三处配置：

1. GitHub 仓库 Settings → Pages 绑定域名。
2. 域名服务商添加 DNS 记录：
   - 顶级域名：4 条 A 记录指向 `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`。
   - 顶级域名可选 IPv6：4 条 AAAA 记录指向 `2606:50c0:8000::153`、`2606:50c0:8001::153`、`2606:50c0:8002::153`、`2606:50c0:8003::153`。
   - 子域名：CNAME 指向 `zhuchengxue.github.io`。
3. GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加：

```text
SITE_URL=https://你的域名
CUSTOM_DOMAIN=你的域名
```

推送后 GitHub Actions 会把 `dist/CNAME` 写入构建产物。
建议顺序是先在 GitHub Pages 里添加并验证域名，再配置 DNS，最后开启 Enforce HTTPS。

## 6. 启用评论或访问统计

默认关闭，页面不加载第三方脚本。

先用配置助手生成 GitHub Actions Variables 清单：

```bash
npm run config:services -- --giscus-repo owner/repo --giscus-repo-id xxx --giscus-category General --giscus-category-id xxx
npm run config:services -- --umami-script https://analytics.example.com/script.js --umami-website-id xxx
```

检查变量是否只填了一半：

```bash
npm run services:check
npm run services:check -- --strict
```

评论使用 Giscus，需要配置：

```text
PUBLIC_GISCUS_REPO=
PUBLIC_GISCUS_REPO_ID=
PUBLIC_GISCUS_CATEGORY=
PUBLIC_GISCUS_CATEGORY_ID=
```

统计使用 Umami，需要配置：

```text
PUBLIC_UMAMI_SCRIPT=
PUBLIC_UMAMI_WEBSITE_ID=
```

配置完推送一次，重新部署后生效。

## 7. 同步国内或备用镜像

先生成配置和验证命令：

```bash
npm run config:services -- --mirror-repo https://gitee.com/用户名/仓库名.git --mirror-branch pages --mirror-domain mirror.example.com
```

先构建：

```bash
npm run build
```

预检：

```bash
MIRROR_REPO=https://gitee.com/用户名/仓库名.git MIRROR_BRANCH=pages npm run mirror -- --dry-run
MIRROR_REPO=https://gitee.com/用户名/仓库名.git MIRROR_BRANCH=pages npm run mirror -- --dry-run --report
```

正式同步：

```bash
MIRROR_REPO=https://gitee.com/用户名/仓库名.git MIRROR_BRANCH=pages npm run mirror
```

如果镜像也绑定域名：

```bash
MIRROR_DOMAIN=mirror.example.com MIRROR_REPO=https://gitee.com/用户名/仓库名.git MIRROR_BRANCH=pages npm run mirror
```

镜像脚本会检查 `dist/` 关键文件，包括首页、RSS、JSON Feed、OpenSearch、llms.txt、humans.txt、sitemap、Manifest 和搜索索引，并在 dry-run 或加 `--report` 时生成 `exports/mirror-report.json`。它不会保存 token，也不会自动运行。

## 8. 故障排查

### 搜索没有命中正文

先重新构建，确认 `dist/search.json` 已生成：

```bash
npm run search:index
npm run build
```

搜索功能是纯静态的，不依赖后端；如果线上搜索没更新，通常是 GitHub Pages 尚未完成部署。

### GitHub Pages 没更新

先看本地：

```bash
npm run build
npm run doctor -- --online
```

如果本地正常但线上没更新，检查 GitHub Actions 是否失败。

### 分享图没有更新

文章级 Open Graph 分享图是构建前生成的 1200×630 压缩 PNG。先本地重新生成并构建：

```bash
npm run og:images
npm run build
```

如果线上仍是旧图，多半是社交平台缓存，需要等待或使用对应平台的链接刷新工具。

### `npm ci` 失败

确认 `scripts/prepare-post.mjs` 没有被改回强制要求文章参数；安装阶段会跳过 npm 的 `prepare` 生命周期。

### 公众号图片不显示

当前 HTML 优先使用博客图片绝对 URL。若微信编辑器拦截外链图片，需要把图片上传到微信素材/图片接口后替换正文图片地址。

### 评论或统计没出现

先运行：

```bash
npm run doctor
```

确认对应环境变量不是“未配置”。如果变量已配置但仍没有出现，检查变量是否配置在 GitHub Actions 的 Variables 中，而不是只写在本地 `.env`。

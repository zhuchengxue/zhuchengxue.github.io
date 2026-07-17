# 学语思

这是一个以 Dropbox Markdown 为唯一原稿、由 GitHub Pages 免费托管的个人博客。

## 日常使用

日常流程保持两段式：写作用 Obsidian/Typora，发布才打开发布器。

1. 在 Obsidian 或 Typora 中写 Markdown。
2. 写成文章后，把 Markdown 放进 Dropbox 的 `02-待发布/`。
3. 双击仓库里的 `发布文章.cmd`（Windows）或 `发布文章.command`（macOS）。
4. 选择文章，点“发布到博客”。
5. 博客由 GitHub Actions 自动构建并上线。

没有新建、预发布、命令行检查或手工复制流程。发布器成功后会自动退出，也不会常驻占用电脑资源。

## Dropbox 写作库

- `00-今日写作.md`：可选的临时草稿，不参与发布。
- `01-选题池.md`：随手记录题目，不参与发布。
- `02-待发布/`：写完、准备发到博客的文章。
- `03-已发布/`：发布成功后自动归档的原稿。
- `04-素材/`：图片、截图、资料。
- `05-归档/`：旧材料和不确定是否还有用的内容。
- `.obsidian/`：Obsidian 的 Vault 配置，必须保留。

发布器会自动创建上述文件和目录，但发布器本身只负责发布，不负责打开编辑器。旧系统的 `已发布/` 会继续兼容读取；新的发布归档统一进入 `03-已发布/`。旧的 `博客网站/` 镜像目录已停用，发布器不会再创建。

## 系统结构

- Dropbox + Obsidian：唯一原稿，负责跨 Windows、Mac 和手机同步。
- 本地发布器：临时读取一篇原稿，整理文章与图片，然后退出。
- GitHub：保存网站发布版本和历史记录。
- GitHub Actions + Pages：云端构建并免费托管网站。
- 微信公众号 API：代码保留，暂不进入日常发布流程。

Git 仓库必须放在 Dropbox 之外。Dropbox 中旧的 `博客网站/` 目录不再参与发布，可以保留作历史备份。

## 新电脑首次安装

1. 安装 Dropbox，等待“公众号文章”目录同步完成。
2. 安装 Obsidian，并把该目录作为 Vault 打开。
3. 安装并登录 GitHub Desktop，把 `zhuchengxue/zhuchengxue.github.io` 克隆到 Dropbox 之外。
4. 安装 Node.js LTS。
5. 在仓库中双击 `首次安装.cmd` 或 `首次安装.command`。
6. 以后只双击“发布文章”。

## 发布规则

- Dropbox 原稿内容不会被修改；博客发布成功后会从 `02-待发布/` 移入 `03-已发布/`。
- 发布器用 Dropbox 文件名记录稳定身份；修改文章标题或移动到 `03-已发布/` 后，仍会更新原网址。
- 新文章自动生成摘要、发布日期、标签和网址。
- Obsidian 图片会复制并压缩到网站目录；原图保持不变。
- 本机不构建整个 Astro 网站，推送后由 GitHub Actions 构建。
- 两台电脑恰好同时发布时，会自动拉取并重试；只有同时改动同一篇文章才需要人工处理。
- 博客发布成功后，Dropbox 原稿会自动移入 `03-已发布/`；博客失败时留在原处，方便重试。
- 公众号推送与博客彻底解耦；在固定出口 IP 方案启用前，不影响写作、发布或归档。

## 广告预留

广告系统默认关闭，不会影响当前阅读体验。以后申请到 Google AdSense 或国内广告联盟后，只需要配置环境变量即可启用。

- `PUBLIC_ADS_ENABLED=true`：开启广告。
- `PUBLIC_AD_PROVIDER=adsense`：使用 Google AdSense。
- `PUBLIC_ADSENSE_CLIENT`：填写 `ca-pub-...` 客户端 ID。
- `PUBLIC_ADSENSE_SLOT_ARTICLE_BOTTOM`：文章底部广告位。
- `PUBLIC_ADSENSE_SLOT_LIST_BOTTOM`：全部文章页底部广告位。
- `PUBLIC_ADSENSE_SLOT_TUTORIAL_TOP` / `PUBLIC_ADSENSE_SLOT_TUTORIAL_BOTTOM`：教程页广告位。
- `PUBLIC_AD_PROVIDER=custom` + `PUBLIC_AD_CUSTOM_HTML`：预留给国内广告代码；启用前确认代码来源可信。

## 留言评论

评论系统使用 Giscus，也就是把每篇文章的评论托管到 GitHub Discussions。成本为 0，不需要服务器，不占用本机资源。

默认情况下评论关闭；等你准备启用时，做三件事：

1. 在 GitHub 仓库打开 Discussions。
2. 安装 Giscus GitHub App，并允许它访问 `zhuchengxue/zhuchengxue.github.io`。
3. 到 Giscus 配置页生成参数，把 `PUBLIC_GISCUS_REPO_ID`、`PUBLIC_GISCUS_CATEGORY`、`PUBLIC_GISCUS_CATEGORY_ID` 填进 GitHub Pages 的环境变量。

配置完整后，每篇文章底部会自动出现“留言评论”。没有配置完整时，页面不会加载 Giscus 脚本，也不会显示空白评论框。

## 维护与故障排查

日常说明见 [运维手册](docs/OPERATIONS.md)，换电脑见 [迁移手册](docs/MIGRATION.md)。

- 网站：https://zhuchengxue.github.io
- 仓库：https://github.com/zhuchengxue/zhuchengxue.github.io
- GitHub Actions：https://github.com/zhuchengxue/zhuchengxue.github.io/actions

仓库只保留网站构建、Dropbox 发布器和公众号草稿链路，不再包含旧写作控制台、批量导入、迁移包或镜像发布工具。

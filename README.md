# 学语思

这是一个以 Dropbox Markdown 为唯一原稿、由 GitHub Pages 免费托管的个人博客。

## 日常使用

1. 在 Obsidian 中打开 Dropbox 的“公众号文章”写作库，直接写 Markdown。
2. 写完后双击仓库里的 `发布文章.cmd`（Windows）或 `发布文章.command`（macOS）。
3. 选择文章，点击一次同步按钮。
4. 博客由 GitHub Actions 自动构建；公众号只创建后台草稿，不会自动群发。

没有新建、预发布、命令行检查或手工复制流程。发布器成功后会自动退出，也不会常驻占用电脑资源。

## Dropbox 写作库

- 根目录的 Markdown：正在写或等待发布的文章。
- `已发布/`：发布成功后自动归档的原稿。
- `想要写的选题/`：选题和灵感，不参与发布列表。
- `.obsidian/`：Obsidian 的 Vault 配置，必须保留。
- `.claude/`、`.claudian/`：Claudian 插件数据，与博客发布无关；卸载该插件后可以删除。

旧系统的 `博客网站/` 镜像目录已停用，发布器不会再创建。

## 系统结构

- Dropbox + Obsidian：唯一原稿，负责跨 Windows、Mac 和手机同步。
- 本地发布器：临时读取一篇原稿，整理文章与图片，然后退出。
- GitHub：保存网站发布版本和历史记录。
- GitHub Actions + Pages：云端构建并免费托管网站。
- 微信公众号 API：把同一篇文章放入公众号后台草稿箱。

Git 仓库必须放在 Dropbox 之外。Dropbox 中旧的 `博客网站/` 目录不再参与发布，可以保留作历史备份。

## 新电脑首次安装

1. 安装 Dropbox，等待“公众号文章”目录同步完成。
2. 安装 Obsidian，并把该目录作为 Vault 打开。
3. 安装并登录 GitHub Desktop，把 `zhuchengxue/zhuchengxue.github.io` 克隆到 Dropbox 之外。
4. 安装 Node.js LTS。
5. 在仓库中双击 `首次安装.cmd` 或 `首次安装.command`。
6. 以后只双击“发布文章”。

首次连接公众号时，在发布器底部展开“本机设置”，填写公众号 AppID 和 AppSecret。凭据只写入当前电脑的 `.env`，不会进入 Dropbox 或 GitHub。换电脑后需重新填写一次。

## 发布规则

- Dropbox 原稿不会被发布器修改或移动。
- 发布器用 Dropbox 文件名记录稳定身份；修改文章标题或移动到 `已发布/` 后，仍会更新原网址。
- 新文章自动生成摘要、发布日期、标签和网址。
- Obsidian 图片会复制并压缩到网站目录；原图保持不变。
- 本机不构建整个 Astro 网站，推送后由 GitHub Actions 构建。
- 两台电脑恰好同时发布时，会自动拉取并重试；只有同时改动同一篇文章才需要人工处理。
- 如果公众号已连接，主按钮会同时发布博客和创建公众号草稿。
- 全部成功后，Dropbox 原稿会自动移入 `已发布/`；失败时留在原处，方便修复后重试。

## 维护与故障排查

日常说明见 [运维手册](docs/OPERATIONS.md)，换电脑见 [迁移手册](docs/MIGRATION.md)。

- 网站：https://zhuchengxue.github.io
- 仓库：https://github.com/zhuchengxue/zhuchengxue.github.io
- GitHub Actions：https://github.com/zhuchengxue/zhuchengxue.github.io/actions

仓库只保留网站构建、Dropbox 发布器和公众号草稿链路，不再包含旧写作控制台、批量导入、迁移包或镜像发布工具。

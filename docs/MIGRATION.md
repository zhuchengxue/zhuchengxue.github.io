# 换电脑迁移手册

迁移时不用搬整个工作电脑。文章由 Dropbox 同步，网站程序由 GitHub 同步，两者分别恢复。

## 新 Windows 或新 Mac

1. 安装并登录 Dropbox，等待“公众号文章”完整同步。
2. 安装 Obsidian，把该目录作为 Vault 打开。
3. 安装并登录 GitHub Desktop。
4. 从 GitHub Desktop 克隆 `zhuchengxue/zhuchengxue.github.io`，位置必须在 Dropbox 之外。
5. 安装 Node.js LTS。
6. 双击仓库中的 `首次安装.cmd`（Windows）或 `首次安装.command`（macOS）。
7. 双击“发布文章”，确认能打开 `00-今日写作.md`，并能看到 `02-待发布/` 里的文章。

之后两台电脑完全相同：双击发布器开始写作，写完放进 `02-待发布/`，再发布博客。每次发布前程序都会先拉取 GitHub 最新版本，因此家里 Mac 和工作 Windows 可以交替使用。

## 哪些东西会自动回来

- Markdown 原稿和原始图片：Dropbox。
- 博客代码、已发布文章和网站历史：GitHub。
- Obsidian 基础 Vault 内容：Dropbox。

## 哪些东西要重新设置

- GitHub Desktop 登录。
- Node.js 和首次安装依赖。

公众号自动草稿暂时不属于换机流程，因此 Windows 和 Mac 都不需要配置白名单。

## 尚未上线的文章

无需批量导入。把尚未上线的 Markdown 放进 `02-待发布/`，每次选择一篇发布即可。已经上线但需要修改的文章，可以在 `03-已发布/` 中编辑后重新发布。

`00-今日写作.md`、`01-选题池.md` 和 `写作风格.md` 都是内部文件，发布器会自动忽略。旧的 Dropbox `已发布/` 目录仍会兼容读取，但新的归档统一进入 `03-已发布/`。旧的 Dropbox `博客网站/` 镜像目录不再使用，可暂时保留备份，确认无用后自行归档。

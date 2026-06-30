# 换电脑迁移手册

迁移时不用搬整个工作电脑。文章由 Dropbox 同步，网站程序由 GitHub 同步，两者分别恢复。

## 新 Windows 或新 Mac

1. 安装并登录 Dropbox，等待“公众号文章”完整同步。
2. 安装 Obsidian，把该目录作为 Vault 打开。
3. 安装并登录 GitHub Desktop。
4. 从 GitHub Desktop 克隆 `zhuchengxue/zhuchengxue.github.io`，位置必须在 Dropbox 之外。
5. 安装 Node.js LTS。
6. 双击仓库中的 `首次安装.cmd`（Windows）或 `首次安装.command`（macOS）。
7. 双击“发布文章”，确认能看到 Dropbox 文章列表。
8. 展开“本机设置”，重新填写公众号 AppID 和 AppSecret。

之后两台电脑完全相同：Obsidian 写作，双击发布器同步。每次发布前程序都会先拉取 GitHub 最新版本，因此家里 Mac 和工作 Windows 可以交替使用。

## 哪些东西会自动回来

- Markdown 原稿和原始图片：Dropbox。
- 博客代码、已发布文章和网站历史：GitHub。
- Obsidian 基础 Vault 内容：Dropbox。

## 哪些东西要重新设置

- GitHub Desktop 登录。
- Node.js 和首次安装依赖。
- 公众号 AppID、AppSecret、当前网络 IP 白名单。

这些凭据刻意不进入 Dropbox 或 GitHub，避免工作电脑、家用电脑和公开仓库之间泄露。

## 尚未上线的文章

无需批量导入。它们只要位于 Dropbox 写作库根目录或 `已发布/` 目录，就会出现在发布器列表中。每次选择一篇同步即可；已上线文章会显示“已发布”，未上线文章显示“未发布”。

`写作风格.md` 是内部规范，发布器会自动忽略。旧的 Dropbox `博客网站/` 镜像目录不再使用，可暂时保留备份，确认无用后自行归档。

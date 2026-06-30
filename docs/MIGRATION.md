# 写作系统换电脑与积压文章迁移

这套系统分成两层：

1. **公开博客仓库**：代码、已发布文章、整理后的图片、模板与 Obsidian 公共设置，通过 GitHub 迁移。
2. **私密写作资料**：未提交草稿、旧公众号导出、图片收件箱、`.env` 密钥与 Obsidian 个人布局，必须通过私密迁移包或个人云盘迁移。

写作控制台会优先自动识别 Obsidian 已登记的 Dropbox Vault，并把网站文章同步到 Vault 内的 `博客网站/`。新电脑只需等待 Dropbox 同步完成，再用 Obsidian 打开该 Vault。

若新电脑的本地 Git 仓库尚未包含 Dropbox 旧稿，可在写作控制台的“设置与工具”中执行一次“Dropbox 旧文章 → 全部导入为草稿”；重复执行会按标题跳过已存在文章。

`draft: true` 只是不生成网页；如果把草稿提交到公开 GitHub 仓库，任何人仍可读取源码。因此未发布内容不要执行 `git add .`。

## 离开旧电脑前

先进入博客仓库：

```bash
npm run handoff
git status
npm run build
```

如果存在代码或文档改动，先正常提交推送。然后把不可通过 Git 恢复的资料复制到仓库外：

Windows 示例：

```powershell
npm run handoff -- "D:\Blog-Private-Handoff"
```

macOS 或移动硬盘示例：

```bash
npm run handoff -- "/Volumes/MyDisk/Blog-Private-Handoff"
```

如果还想保留可以重新生成的公众号 HTML/JSON 等 `exports/` 内容：

```bash
npm run handoff -- "目标目录" --include-exports
```

迁移包可能包含未发布文章和密钥，只能放到个人网盘、加密移动硬盘或私人目录，不能上传到公开仓库。

## 新 Windows 电脑

安装：

- Git
- Node.js 24（或项目当前要求的更新 LTS）
- Obsidian

打开 PowerShell：

```powershell
git clone https://github.com/zhuchengxue/zhuchengxue.github.io.git
cd zhuchengxue.github.io
npm ci
npm run doctor
```

把迁移包 `private/` 中的文件按原目录结构复制回仓库，再运行：

```powershell
npm run handoff
npm run doctor -- --allow-dirty
```

最后在 Obsidian 中选择“打开本地仓库”，打开这个 Git 仓库根目录。

如果不想使用命令行，可以用 GitHub Desktop 克隆仓库，随后双击 `打开写作助手.cmd`，在控制台点击“安装/修复依赖”。

## 新 Mac

安装 Git、Node.js 24 和 Obsidian，然后在 Terminal 执行：

```bash
git clone https://github.com/zhuchengxue/zhuchengxue.github.io.git
cd zhuchengxue.github.io
npm ci
npm run doctor
```

再恢复迁移包并用 Obsidian 打开仓库根目录。所有日常 `npm run ...` 命令在 Windows 和 macOS 相同。

不想使用命令行时，可以用 GitHub Desktop 克隆，然后双击 `打开写作助手.command`，在控制台安装依赖并完成后续操作。

旧电脑设置的 `127.0.0.1:10023` 是全局 Git 代理，不会随仓库迁移。只有新电脑也运行同一个本地代理并使用同一端口时才重新设置，否则不要照搬。

## 目前如何补齐尚未上线的文章

当前仓库能证明线上内容为：70 篇历史文章，加 1 篇新 Markdown 文章。`imports/wechat/` 和图片收件箱目前为空，因此其他文章尚未进入这套系统，需要先收集原始文件。

### 旧公众号文章

将公众号导出的 `.html`、`.htm`、`.md` 或 `.txt` 放入：

```text
imports/wechat/
```

然后：

```bash
npm run import:wechat -- --dry-run --report
npm run import:wechat
```

导入结果全部是 `draft: true`，不会上线。可以保留很多未暂存草稿，再逐篇执行：

```bash
npm run ready -- "src/content/posts/日期-文章名.md"
npm run publish -- "src/content/posts/日期-文章名.md" --dry-run
npm run publish -- "src/content/posts/日期-文章名.md"
```

发布脚本只暂存当前文章和对应图片，不会把其他积压草稿带进提交。

### 已有 Markdown 或 Obsidian 笔记

推荐为每篇文章先创建标准文件：

```bash
npm run new -- "文章标题" english-or-pinyin-slug
```

把旧正文粘贴进去，补齐摘要、日期和标签，再按上述 `ready → publish --dry-run → publish` 流程发布。

不建议一次性把所有文章都设为 `draft: false`。先批量导入为草稿，再按质量和时间逐篇检查上线，网站历史会更干净。

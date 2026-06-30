#!/bin/zsh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "请先安装 Node.js" message "安装后再双击“发布文章”。"'
  exit 1
fi
nohup node scripts/article-publisher.mjs >/tmp/xueyusi-article-publisher.log 2>&1 &
exit 0

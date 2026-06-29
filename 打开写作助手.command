#!/bin/zsh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "请先安装 Node.js" message "安装后再双击打开写作助手。"'
  exit 1
fi
nohup node scripts/writing-dashboard.mjs >/tmp/xueyusi-writing-dashboard.log 2>&1 &
exit 0

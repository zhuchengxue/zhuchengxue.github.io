#!/bin/zsh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "请先安装 Node.js LTS" message "安装完成后，再双击“首次安装”。"'
  open https://nodejs.org/
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  osascript -e 'display alert "请先安装 GitHub Desktop" message "安装完成后，再双击“首次安装”。"'
  open https://desktop.github.com/
  exit 1
fi
npm ci && osascript -e 'display notification "以后双击“发布文章”即可" with title "学语思发布器安装完成"'

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const values = args.filter((arg) => arg !== '--dry-run');
const title = values[0]?.trim();
const requestedSlug = values[1]?.trim();

if (!title) {
  console.error('用法：npm run new -- "文章标题" [英文或拼音短名]');
  process.exit(1);
}

const now = new Date();
const date = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0')
].join('-');
const fallbackSlug = `post-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
const slug = (requestedSlug || title)
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
  .replace(/^-+|-+$/g, '') || fallbackSlug;
const filename = `${date}-${slug}.md`;
const postsDirectory = resolve('src/content/posts');
const target = resolve(postsDirectory, filename);
const content = `---
title: ${title}
description: 请填写文章摘要
pubDate: ${date}
tags:
  - 未分类
draft: true
wechatUrl:
cover:
---

从这里开始写正文。
`;

if (existsSync(target)) {
  console.error(`文章已存在：${target}`);
  process.exit(1);
}

if (dryRun) {
  console.log(target);
  console.log(content);
  process.exit(0);
}

mkdirSync(postsDirectory, { recursive: true });
writeFileSync(target, content, 'utf8');
console.log(`已创建：${target}`);

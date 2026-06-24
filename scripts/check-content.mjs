import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const postsDirectory = resolve('src/content/posts');
const files = readdirSync(postsDirectory)
  .filter((name) => name.endsWith('.md'))
  .sort();
const failures = [];

for (const file of files) {
  const source = readFileSync(resolve(postsDirectory, file), 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];

  if (!frontmatter) {
    failures.push(`${file}: 缺少 YAML frontmatter`);
    continue;
  }

  const field = (name) =>
    frontmatter.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? '';
  const title = field('title');
  const description = field('description');
  const pubDate = field('pubDate');
  const draft = field('draft');

  if (!title) failures.push(`${file}: title 不能为空`);
  if (!description) failures.push(`${file}: description 不能为空`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pubDate) || Number.isNaN(Date.parse(`${pubDate}T00:00:00Z`))) {
    failures.push(`${file}: pubDate 必须是有效的 YYYY-MM-DD 日期`);
  }
  if (!['true', 'false'].includes(draft)) {
    failures.push(`${file}: draft 必须是 true 或 false`);
  }
  if (!/^tags:\s*$/m.test(frontmatter) || !/^\s+-\s+\S+/m.test(frontmatter)) {
    failures.push(`${file}: 至少需要一个 tags 条目`);
  }
  if (!/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(file)) {
    failures.push(`${file}: 文件名应为 YYYY-MM-DD-短名.md`);
  }
}

if (failures.length) {
  console.error('文章检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`文章检查通过：${files.length} 篇`);

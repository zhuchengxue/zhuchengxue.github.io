import { existsSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';

const postsDirectory = resolve('src/content/posts');
const args = process.argv.slice(2);
const articleArgument = args.find((arg) => !arg.startsWith('--'));
const strict = args.includes('--strict');

if (!articleArgument) {
  console.error('用法：npm run ready -- "src/content/posts/文章.md" [--strict]');
  process.exit(1);
}

const articlePath = resolve(articleArgument);
const relativeArticle = relative(postsDirectory, articlePath);
if (relativeArticle.startsWith('..') || isAbsolute(relativeArticle) || !articlePath.endsWith('.md')) {
  console.error('只能检查 src/content/posts 下的 Markdown 文章。');
  process.exit(1);
}
if (!existsSync(articlePath)) {
  console.error(`文章不存在：${articlePath}`);
  process.exit(1);
}

const projectRoot = resolve('.');
const filename = basename(articlePath, '.md');
const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
const siteOrigin = (process.env.SITE_URL || 'https://zhuchengxue.github.io').replace(/\/$/, '');
const postURL = `${siteOrigin}/posts/${encodeURIComponent(filename)}/`;
const source = readFileSync(articlePath, 'utf8');
const parsed = matter(source);
const failures = [];
const warnings = [];

function pass(label) {
  console.log(`✅ ${label}`);
}

function fail(label) {
  failures.push(label);
  console.log(`❌ ${label}`);
}

function warn(label) {
  warnings.push(label);
  console.log(`⚠️ ${label}`);
}

function field(name) {
  const value = parsed.data[name];
  return typeof value === 'string' ? value.trim() : value;
}

function localImagePath(reference) {
  if (!reference || /^(?:https?:|data:)/i.test(reference)) return null;
  const normalized = reference.replaceAll('\\', '/').replace(/^(?:\.\.\/)+/, '');
  return resolve('public', normalized);
}

function checkImageReference(reference, label) {
  if (!reference) return;
  if (/^(?:https?:|data:)/i.test(reference)) {
    pass(`${label} 使用远程地址`);
    return;
  }

  const normalized = reference.replaceAll('\\', '/');
  const expected = new RegExp(`^\\.\\.\\/\\.\\.\\/images\\/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{2}\\.(?:webp|svg)$`);
  if (!expected.test(normalized)) {
    fail(`${label} 路径或命名不符合规范：${reference}`);
    return;
  }

  const path = localImagePath(reference);
  if (!path || !existsSync(path)) {
    fail(`${label} 文件不存在：${reference}`);
    return;
  }

  pass(`${label} 已整理：${reference}`);
}

console.log(`文章发布前体检：${relative(projectRoot, articlePath).replaceAll('\\', '/')}`);
console.log(`预计博客地址：${postURL}`);

if (!/^---\r?\n[\s\S]*?\r?\n---/.test(source)) fail('缺少 YAML frontmatter');
else pass('YAML frontmatter 存在');

const title = field('title');
const description = field('description');
const pubDate = field('pubDate');
const draft = field('draft');
const tags = Array.isArray(parsed.data.tags) ? parsed.data.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];

if (title) pass(`标题：${title}`);
else fail('title 不能为空');

if (description && description !== '请填写文章摘要') pass(`摘要：${description}`);
else fail('description 不能为空，也不能保留模板占位');

const pubDateText = pubDate instanceof Date
  ? pubDate.toISOString().slice(0, 10)
  : typeof pubDate === 'string'
    ? pubDate
    : '';

if (/^\d{4}-\d{2}-\d{2}$/.test(pubDateText) && !Number.isNaN(Date.parse(`${pubDateText}T00:00:00Z`))) {
  pass(`发布日期：${pubDateText}`);
} else {
  fail('pubDate 必须是有效的 YYYY-MM-DD 日期');
}

if (draft === true || draft === false) {
  if (draft && strict) fail('strict 模式下 draft 必须为 false');
  else if (draft) warn('当前仍是 draft: true；正式发布时 npm run publish 会改为 false');
  else pass('draft: false');
} else {
  fail('draft 必须是 true 或 false');
}

if (tags.length && !tags.includes('未分类')) pass(`标签：${tags.join(', ')}`);
else fail('至少需要一个真实标签，不能只保留“未分类”');

const content = parsed.content.trim();
if (content.length >= 120) pass(`正文长度：${content.length} 字符`);
else fail('正文过短，建议至少写到 120 字符以上再发布');

if (/!\[\[/.test(content)) fail('仍有 Obsidian Wiki 图片引用，请先运行 npm run prepare');
else pass('没有未整理的 Obsidian Wiki 图片引用');

const imageMatches = [...content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)];
if (imageMatches.length) {
  for (const match of imageMatches) checkImageReference(match[1].trim(), '正文图片');
} else {
  warn('正文没有图片；可以发布，但公众号传播时建议至少准备一张封面');
}

if (parsed.data.cover) checkImageReference(String(parsed.data.cover).trim(), '封面图');
else warn('未设置 cover；博客会使用默认 OG 图，公众号草稿 API 仍需要 WECHAT_THUMB_MEDIA_ID');

const wechat = spawnSync(process.execPath, ['scripts/generate-wechat.mjs', articlePath, '--dry-run'], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: 'pipe',
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1'
  }
});

if (wechat.status === 0) {
  pass('公众号 HTML 转换预检通过');
} else {
  fail('公众号 HTML 转换预检失败');
  const detail = `${wechat.stderr || wechat.stdout}`.trim();
  if (detail) console.log(detail);
}

if (warnings.length) {
  console.log('\n提醒：');
  warnings.forEach((item) => console.log(`- ${item}`));
}

if (failures.length) {
  console.error(`\n发布前体检未通过：${failures.length} 项需要处理。`);
  process.exit(1);
}

console.log('\n发布前体检通过。');
console.log(`下一步发布博客：npm run publish -- "${relative(projectRoot, articlePath).replaceAll('\\', '/')}"`);
console.log(`博客上线后生成公众号版本：npm run wechat -- "${relative(projectRoot, articlePath).replaceAll('\\', '/')}"`);

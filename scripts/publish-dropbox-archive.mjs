import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';
import { findObsidianVault } from './lib/obsidian-vault.mjs';
import { collectDraftBacklog, isAllowedBacklogChange } from './lib/publish-worktree.mjs';

const dryRun = process.argv.includes('--dry-run');
const projectRoot = resolve('.');
const postsDirectory = resolve('src/content/posts');
const vault = findObsidianVault();

if (!vault || !existsSync(resolve(vault, '已发布'))) {
  console.error('没有找到 Dropbox 写作库的“已发布”目录。');
  process.exit(1);
}

function cleanText(value) {
  return value.replace(/[*_~`>#]/g, '').replace(/\s+/g, ' ').trim();
}

const publishedDropboxTitles = new Set(readdirSync(resolve(vault, '已发布'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '写作风格.md')
  .map((entry) => {
    const path = resolve(vault, '已发布', entry.name);
    const parsed = matter(readFileSync(path, 'utf8'));
    const h1 = parsed.content.match(/^\s*#\s+(.+?)\s*$/m)?.[1];
    return cleanText(String(parsed.data.title || h1 || basename(entry.name, '.md')));
  }));

const candidates = readdirSync(postsDirectory)
  .filter((name) => name.endsWith('.md'))
  .map((name) => {
    const path = resolve(postsDirectory, name);
    const parsed = matter(readFileSync(path, 'utf8'));
    return { name, path, title: String(parsed.data.title || ''), draft: parsed.data.draft === true };
  })
  .filter((post) => post.draft && publishedDropboxTitles.has(post.title))
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

if (!candidates.length) {
  console.log('没有待发布的 Dropbox“已发布”文章。');
  process.exit(0);
}

console.log(`待发布：${candidates.length} 篇`);
for (const post of candidates) console.log(`- ${post.title}`);

function run(command, args, { capture = false, allowFailure = false } = {}) {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const commandArgs = command === 'git'
    ? ['-c', `safe.directory=${projectRoot.replaceAll('\\', '/')}`, ...args]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: false,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }
  });
  if (result.status !== 0 && !allowFailure) {
    if (capture) process.stderr.write(result.stderr || result.stdout || '');
    throw new Error(`${command} 执行失败，退出码 ${result.status ?? 1}`);
  }
  return capture
    ? { ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}`.trim() }
    : result.status === 0;
}

const candidatePaths = new Set(candidates.map((post) => relative(projectRoot, post.path).replaceAll('\\', '/')));
const backlog = collectDraftBacklog(postsDirectory, projectRoot);
const status = run('git', ['status', '--porcelain=v1', '-z'], { capture: true }).output.split('\0').filter(Boolean);
const unrelated = status.filter((line) => {
  const path = line.slice(3).replaceAll('\\', '/').replace(/^"|"$/g, '');
  return !candidatePaths.has(path) && !isAllowedBacklogChange(line, backlog);
});
if (unrelated.length) {
  console.error('批量发布前请先处理以下无关改动：');
  unrelated.forEach((line) => console.error(`- ${line}`));
  process.exit(1);
}

for (const post of candidates) {
  const prepared = run('node', ['scripts/prepare-post.mjs', post.path, ...(dryRun ? ['--dry-run'] : [])], { capture: true, allowFailure: true });
  const checked = prepared.ok
    ? run('node', ['scripts/check-post-ready.mjs', post.path], { capture: true, allowFailure: true })
    : { ok: false, output: '' };
  if (!prepared.ok || !checked.ok) {
    console.error(prepared.output || checked.output);
    process.exit(1);
  }
  console.log(`✓ ${post.title}`);
}

if (dryRun) {
  console.log(`完整预演通过：${candidates.length} 篇；未修改、提交或推送。`);
  process.exit(0);
}

const originals = new Map(candidates.map((post) => [post.path, readFileSync(post.path, 'utf8')]));
const restore = () => {
  for (const [path, source] of originals) writeFileSync(path, source, 'utf8');
};

try {
  for (const post of candidates) {
    writeFileSync(post.path, originals.get(post.path).replace(/^draft:\s*true\s*$/m, 'draft: false'), 'utf8');
  }
  const build = run('npm', ['run', 'build'], { capture: true, allowFailure: true });
  if (!build.ok) {
    console.error(build.output.slice(-12000));
    throw new Error('批量构建失败');
  }
  run('git', ['add', '--', ...[...candidatePaths]]);
  run('git', ['commit', '-m', `Publish Dropbox archive (${candidates.length} posts)`]);
} catch (error) {
  restore();
  console.error(`${error.message}；已恢复草稿状态。`);
  process.exit(1);
}

run('git', ['push']);
console.log(`批量发布完成：${candidates.length} 篇。`);

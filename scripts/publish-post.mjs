import { readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const postsDirectory = resolve('src/content/posts');
const articleArgument = process.argv.slice(2).find((arg) => arg !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');

if (!articleArgument) {
  console.error('用法：npm run publish -- "src/content/posts/文章.md" [--dry-run]');
  process.exit(1);
}

const articlePath = resolve(articleArgument);
const relativeArticle = relative(postsDirectory, articlePath);
if (relativeArticle.startsWith('..') || isAbsolute(relativeArticle) || !articlePath.endsWith('.md')) {
  console.error('只能发布 src/content/posts 下的 Markdown 文章。');
  process.exit(1);
}

function run(command, args, options = {}) {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const commandArgs = command === 'git'
    ? ['-c', `safe.directory=${resolve('.').replaceAll('\\', '/')}`, ...args]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: resolve('.'),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: false,
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: '1'
    }
  });
  if (result.status !== 0) {
    if (options.capture) process.stderr.write(result.stderr ?? '');
    if (options.allowFailure) return false;
    process.exit(result.status ?? 1);
  }
  if (options.allowFailure) return true;
  return options.capture ? result.stdout?.trim() ?? '' : '';
}

const filename = basename(articlePath, '.md');
const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
const allowedPrefixes = [
  relative(resolve('.'), articlePath).replaceAll('\\', '/'),
  `public/images/${slug}/`
];
const status = run('git', ['status', '--porcelain=v1', '-z'], { capture: true })
  .split('\0')
  .filter(Boolean);
const unrelated = status.filter((line) => {
  const path = line.slice(3).replaceAll('\\', '/').replace(/^"|"$/g, '');
  return !allowedPrefixes.some((allowed) => path === allowed || path.startsWith(allowed));
});

if (unrelated.length) {
  console.error('发布前请先处理以下无关改动，避免误提交：');
  unrelated.forEach((line) => console.error(`- ${line}`));
  process.exit(1);
}

run('node', ['scripts/prepare-post.mjs', articlePath, ...(dryRun ? ['--dry-run'] : [])]);
if (dryRun) {
  console.log('预检通过；未修改文件、未提交、未推送。');
  process.exit(0);
}

let source = readFileSync(articlePath, 'utf8');
const title = (source.match(/^title:\s*(.*?)\s*$/m)?.[1] ?? filename)
  .trim()
  .replace(/^["']|["']$/g, '');
const description = source.match(/^description:\s*(.*?)\s*$/m)?.[1]?.trim() ?? '';
if (!description || description === '请填写文章摘要') {
  console.error('发布前请填写 description 文章摘要。');
  process.exit(1);
}
if (/^tags:\s*\r?\n\s+-\s+未分类\s*$/m.test(source)) {
  console.error('发布前请把“未分类”替换为真实标签。');
  process.exit(1);
}
if (!/^draft:\s*true\s*$/m.test(source) && !/^draft:\s*false\s*$/m.test(source)) {
  console.error('文章缺少 draft: true/false。');
  process.exit(1);
}
const preparedSource = source;
source = source.replace(/^draft:\s*true\s*$/m, 'draft: false');
writeFileSync(articlePath, source, 'utf8');

const buildSucceeded = run('npm', ['run', 'build'], { allowFailure: true });
if (!buildSucceeded) {
  writeFileSync(articlePath, preparedSource, 'utf8');
  console.error('构建失败，已恢复发布前的草稿状态。');
  process.exit(1);
}
run('git', ['add', '--', relative(resolve('.'), articlePath), `public/images/${slug}`]);

const staged = run('git', ['diff', '--cached', '--name-only'], { capture: true });
if (!staged) {
  console.log('文章已发布且没有新改动。');
  process.exit(0);
}

run('git', ['commit', '-m', `Publish: ${title}`]);
run('git', ['push']);
console.log(`发布完成：https://zhuchengxue.github.io/posts/${filename}/`);

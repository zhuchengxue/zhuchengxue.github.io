import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';

const workspace = resolve('.');
const postsDirectory = resolve('src/content/posts');
const destinationArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const includeExports = process.argv.includes('--include-exports');

function git(args) {
  return spawnSync('git', ['-c', `safe.directory=${workspace.replaceAll('\\', '/')}`, ...args], {
    cwd: workspace,
    encoding: 'utf8',
    shell: false
  });
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function relativePath(path) {
  return relative(workspace, path).replaceAll('\\', '/');
}

const posts = existsSync(postsDirectory)
  ? readdirSync(postsDirectory).filter((name) => name.endsWith('.md')).map((file) => {
      const path = resolve(postsDirectory, file);
      const parsed = matter(readFileSync(path, 'utf8'));
      return {
        file,
        path,
        title: String(parsed.data.title || basename(file, '.md')),
        draft: parsed.data.draft === true,
        slug: file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '')
      };
    })
  : [];
const drafts = posts.filter((post) => post.draft);
const published = posts.filter((post) => !post.draft);
const importFiles = walk(resolve('imports/wechat')).filter((path) => basename(path) !== '.gitkeep');
const inboxFiles = walk(resolve('public/images/inbox')).filter((path) => basename(path) !== '.gitkeep');
const exportFiles = includeExports ? walk(resolve('exports')) : [];
const statusResult = git(['status', '--porcelain=v1', '-uall']);
const statusLines = statusResult.stdout?.split(/\r?\n/).filter(Boolean) ?? [];
const trackedPostFiles = new Set((git(['ls-files', '--', 'src/content/posts']).stdout || '').split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll('\\', '/')));
const trackedDrafts = drafts.filter((post) => trackedPostFiles.has(relativePath(post.path)));
const privateContentPrefixes = ['src/content/posts/', 'public/images/', 'imports/wechat/', 'exports/'];
const nonContentChanges = statusLines.filter((line) => {
  const path = line.slice(3).replaceAll('\\', '/').replace(/^"|"$/g, '');
  return !privateContentPrefixes.some((prefix) => path.startsWith(prefix));
});

console.log('写作系统迁移盘点');
console.log(`- 已发布 Markdown：${published.length} 篇（另有 70 篇历史文章在 legacy 数据中）`);
console.log(`- 未发布草稿：${drafts.length} 篇`);
console.log(`- 待导入源文件：${importFiles.length} 个`);
console.log(`- 图片收件箱：${inboxFiles.length} 个`);
console.log(`- 本地环境变量：${existsSync(resolve('.env')) ? '存在，需要私密复制' : '不存在'}`);
console.log(`- Git 工作区：${statusLines.length ? `${statusLines.length} 项未提交改动` : '干净'}`);
console.log(`- 已提交到公开仓库的草稿：${trackedDrafts.length} 篇`);

if (drafts.length) {
  console.log('\n未发布草稿：');
  drafts.forEach((post) => console.log(`- ${post.file}｜${post.title}`));
}
if (nonContentChanges.length) {
  console.log('\n需要先提交或另行复制的代码/文档改动：');
  nonContentChanges.forEach((line) => console.log(`- ${line}`));
}
if (trackedDrafts.length) {
  console.log('\n隐私提醒：以下 draft: true 文件已经被 Git 跟踪，源码仍可在公开仓库读取：');
  trackedDrafts.forEach((post) => console.log(`- ${post.file}`));
}

console.log('\nGit clone 会带走：代码、已提交文章、整理后的已提交图片、模板和 Obsidian 公共设置。');
console.log('Git clone 不会带走：未提交草稿、imports/wechat、图片收件箱、exports、.env 和 Obsidian 个人布局。');

if (!destinationArgument) {
  console.log('\n只做了盘点，没有复制文件。');
  console.log('生成私密迁移包：npm run handoff -- "目标目录"');
  console.log('如需保留可重新生成的 exports：在命令末尾加 --include-exports');
  process.exit(0);
}

if (nonContentChanges.length) {
  console.error('\n存在未提交的代码或文档改动。请先提交推送，避免新电脑缺少系统改动。');
  process.exit(1);
}

const destination = resolve(destinationArgument);
const destinationRelative = relative(workspace, destination);
const destinationInsideWorkspace = destinationRelative === ''
  || (!destinationRelative.startsWith('..') && !isAbsolute(destinationRelative));
if (destinationInsideWorkspace) {
  console.error('迁移包必须放在博客仓库之外，例如移动硬盘、个人网盘目录或另一个本地目录。');
  process.exit(1);
}
if (existsSync(destination) && (!statSync(destination).isDirectory() || readdirSync(destination).length)) {
  console.error(`目标目录不是空目录：${destination}`);
  process.exit(1);
}

const privateFiles = new Set();
for (const post of drafts) {
  privateFiles.add(post.path);
  for (const image of walk(resolve('public/images', post.slug))) privateFiles.add(image);
}
for (const file of [...importFiles, ...inboxFiles, ...exportFiles]) privateFiles.add(file);
for (const path of ['.env', '.obsidian/workspace.json', '.obsidian/workspace-mobile.json']) {
  const fullPath = resolve(path);
  if (existsSync(fullPath)) privateFiles.add(fullPath);
}
for (const line of statusLines) {
  const path = line.slice(3).replaceAll('\\', '/').replace(/^"|"$/g, '');
  if (!privateContentPrefixes.some((prefix) => path.startsWith(prefix))) continue;
  const fullPath = resolve(path);
  if (existsSync(fullPath) && statSync(fullPath).isFile()) privateFiles.add(fullPath);
}

mkdirSync(destination, { recursive: true });
const copied = [];
for (const source of privateFiles) {
  const targetRelative = relativePath(source);
  const target = resolve(destination, 'private', targetRelative);
  mkdirSync(resolve(target, '..'), { recursive: true });
  cpSync(source, target);
  copied.push(targetRelative);
}

const branch = git(['branch', '--show-current']).stdout?.trim() || '';
const commit = git(['rev-parse', 'HEAD']).stdout?.trim() || '';
const manifest = {
  createdAt: new Date().toISOString(),
  sourceWorkspace: workspace,
  branch,
  commit,
  privateFileCount: copied.length,
  includesExports: includeExports,
  files: copied.sort((a, b) => a.localeCompare(b, 'zh-CN'))
};
writeFileSync(resolve(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
writeFileSync(resolve(destination, 'RESTORE.md'), `# 博客私密迁移包\n\n1. 在新电脑克隆公开仓库：\n\n   git clone https://github.com/zhuchengxue/zhuchengxue.github.io.git\n\n2. 将本目录 private/ 内的内容按原目录结构复制到克隆后的仓库。\n3. 在仓库运行 npm ci，然后运行 npm run handoff 和 npm run doctor -- --allow-dirty。\n4. 用 Obsidian 打开仓库根目录。\n\n注意：private/ 可能包含未发布文章和 .env 密钥，不要上传到公开仓库。\n`, 'utf8');

console.log(`\n私密迁移包已生成：${destination}`);
console.log(`已复制 ${copied.length} 个不可仅靠 Git 恢复的文件。`);
console.log('请把整个迁移包保存到个人网盘、加密移动硬盘或其他私人位置。');

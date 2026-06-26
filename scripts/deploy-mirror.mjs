import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const writeReport = args.includes('--report');
const distDirectory = resolve('dist');
const workspace = resolve('.');
const mirrorDirectory = resolve('.mirror-worktree');
const reportDirectory = resolve('exports');
const reportPath = resolve(reportDirectory, 'mirror-report.json');
const mirrorRepo = process.env.MIRROR_REPO;
const mirrorBranch = process.env.MIRROR_BRANCH || 'pages';
const mirrorDomain = process.env.MIRROR_DOMAIN;
const requiredDistFiles = ['index.html', 'rss.xml', 'feed.json', 'sitemap.xml', 'site.webmanifest', 'search.json'];

function run(command, commandArgs, options = {}) {
  const printable = [command, ...commandArgs].join(' ');
  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return { status: 0 };
  }

  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`命令执行失败：${printable}`);
  }

  return result;
}

function ensureSafeMirrorDirectory() {
  const normalizedWorkspace = workspace.toLowerCase();
  const normalizedMirror = mirrorDirectory.toLowerCase();
  if (!normalizedMirror.startsWith(normalizedWorkspace) || basename(mirrorDirectory) !== '.mirror-worktree') {
    throw new Error(`镜像临时目录不安全：${mirrorDirectory}`);
  }
}

function walkDirectory(directory) {
  const entries = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkDirectory(fullPath));
    } else if (entry.isFile()) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function collectDistReport() {
  const files = walkDirectory(distDirectory);
  const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  const missing = requiredDistFiles.filter((file) => !existsSync(resolve(distDirectory, file)));
  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    mirrorRepo,
    mirrorBranch,
    mirrorDomain: mirrorDomain || '',
    dist: {
      directory: distDirectory,
      fileCount: files.length,
      totalBytes,
      requiredFiles: requiredDistFiles.map((file) => ({
        file,
        exists: existsSync(resolve(distDirectory, file))
      }))
    },
    missingRequiredFiles: missing
  };
}

if (!existsSync(distDirectory)) {
  console.error('缺少 dist/，请先运行 npm run build。');
  process.exit(1);
}

if (!mirrorRepo) {
  console.error('缺少 MIRROR_REPO。示例：MIRROR_REPO=https://gitee.com/用户名/仓库名.git npm run mirror');
  process.exit(1);
}

ensureSafeMirrorDirectory();

console.log(`镜像仓库：${mirrorRepo}`);
console.log(`镜像分支：${mirrorBranch}`);
if (mirrorDomain) console.log(`镜像域名：${mirrorDomain}`);

const report = collectDistReport();
console.log(`镜像源文件：${report.dist.fileCount} 个，约 ${(report.dist.totalBytes / 1024).toFixed(1)} KB`);
if (report.missingRequiredFiles.length) {
  console.error(`dist/ 缺少关键文件：${report.missingRequiredFiles.join(', ')}`);
  console.error('请先运行 npm run build 并确认构建通过。');
  process.exit(1);
}

if (dryRun || writeReport) {
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`镜像发布报告：${reportPath}`);
}

if (!dryRun && existsSync(mirrorDirectory)) {
  rmSync(mirrorDirectory, { recursive: true, force: true });
}

try {
  run('git', ['clone', '--depth', '1', '--branch', mirrorBranch, mirrorRepo, mirrorDirectory]);
} catch {
  if (dryRun) {
    // dry-run 下不需要真的处理新分支。
  } else {
    run('git', ['clone', '--depth', '1', mirrorRepo, mirrorDirectory]);
    run('git', ['checkout', '--orphan', mirrorBranch], { cwd: mirrorDirectory });
  }
}

if (!dryRun) {
  for (const entry of readdirSync(mirrorDirectory)) {
    if (entry === '.git') continue;
    rmSync(resolve(mirrorDirectory, entry), { recursive: true, force: true });
  }

  mkdirSync(mirrorDirectory, { recursive: true });
  cpSync(distDirectory, mirrorDirectory, { recursive: true });
  writeFileSync(resolve(mirrorDirectory, '.nojekyll'), '', 'utf8');
  if (mirrorDomain) writeFileSync(resolve(mirrorDirectory, 'CNAME'), `${mirrorDomain}\n`, 'utf8');
}

run('git', ['add', '-A'], { cwd: mirrorDirectory });

const diff = dryRun
  ? { status: 1 }
  : spawnSync('git', ['diff', '--cached', '--quiet'], {
      cwd: mirrorDirectory,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

if (diff.status === 0) {
  console.log('镜像产物没有变化，无需推送。');
  process.exit(0);
}

run('git', ['commit', '-m', `Deploy mirror ${new Date().toISOString()}`], { cwd: mirrorDirectory });
run('git', ['push', 'origin', `HEAD:${mirrorBranch}`], { cwd: mirrorDirectory });

console.log(dryRun ? '镜像发布预检完成；未克隆、未提交、未推送。' : '镜像发布完成。');

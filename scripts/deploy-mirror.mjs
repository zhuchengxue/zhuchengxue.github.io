import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const distDirectory = resolve('dist');
const workspace = resolve('.');
const mirrorDirectory = resolve('.mirror-worktree');
const mirrorRepo = process.env.MIRROR_REPO;
const mirrorBranch = process.env.MIRROR_BRANCH || 'pages';
const mirrorDomain = process.env.MIRROR_DOMAIN;

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

console.log('镜像发布完成。');

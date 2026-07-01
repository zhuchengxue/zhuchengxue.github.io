import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';
import { syncArticle } from './lib/sync-article.mjs';

const root = mkdtempSync(resolve(tmpdir(), 'xueyusi-sync-'));
const remote = resolve(root, 'remote.git');
const project = resolve(root, 'repo');
const competitor = resolve(root, 'other-computer');
const vault = resolve(root, 'Dropbox', '公众号文章');
const previousSiteUrl = process.env.SITE_URL;
process.env.SITE_URL = 'https://blog.example';

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout || ''}${result.stderr || ''}`);
  return result.stdout.trim();
}

function configure(cwd) {
  git(cwd, 'config', 'user.name', 'Publisher Test');
  git(cwd, 'config', 'user.email', 'publisher@example.invalid');
}

try {
  mkdirSync(vault, { recursive: true });
  git(root, 'init', '--bare', '--initial-branch=master', remote);
  git(root, 'clone', remote, project);
  configure(project);
  mkdirSync(resolve(project, 'src/content/posts'), { recursive: true });
  mkdirSync(resolve(project, 'public/images'), { recursive: true });
  writeFileSync(resolve(project, 'README.md'), '# test\n', 'utf8');
  git(project, 'add', 'README.md');
  git(project, 'commit', '-m', 'Initial');
  git(project, 'push', '-u', 'origin', 'master');

  writeFileSync(resolve(vault, '文章.md'), '# 第一版标题\n\n这是用于端到端测试的完整文章正文，发布后应当进入远端仓库。\n', 'utf8');
  const firstProgress = [];
  const first = await syncArticle({
    articleId: '文章.md',
    vaultPath: vault,
    projectRoot: project,
    wechat: false,
    onProgress: (message) => firstProgress.push(message)
  });
  assert.equal(first.committed, true);
  assert.match(first.articleUrl, /^https:\/\/blog\.example\/posts\//);
  assert.match(firstProgress.join('\n'), /正在提交文章到 GitHub/);
  assert.equal(readdirSync(resolve(project, 'src/content/posts')).filter((file) => file.endsWith('.md')).length, 1);
  const stableFilename = first.filename;
  assert.equal(first.archiveWarning, '');
  assert.equal(readdirSync(vault).includes('文章.md'), false);
  assert.equal(readdirSync(resolve(vault, '已发布')).includes('文章.md'), true);
  assert.equal(matter(readFileSync(resolve(project, 'src/content/posts', stableFilename), 'utf8')).data.sourceId, '文章.md');

  git(root, 'clone', remote, competitor);
  configure(competitor);
  writeFileSync(resolve(vault, '已发布', '文章.md'), '# 改过的标题\n\n标题发生变化，但应继续更新原文章，并保留第一次生成的网址。\n', 'utf8');
  let competitorPushed = false;
  const secondProgress = [];
  const second = await syncArticle({
    articleId: '已发布/文章.md',
    vaultPath: vault,
    projectRoot: project,
    wechat: false,
    onProgress: (message) => {
      secondProgress.push(message);
      if (message === '正在推送到 GitHub Pages…' && !competitorPushed) {
        competitorPushed = true;
        writeFileSync(resolve(competitor, 'other-computer.txt'), 'concurrent update\n', 'utf8');
        git(competitor, 'add', 'other-computer.txt');
        git(competitor, 'commit', '-m', 'Concurrent update');
        git(competitor, 'push');
      }
    }
  });

  assert.equal(second.filename, stableFilename);
  assert.match(secondProgress.join('\n'), /检测到另一台电脑刚刚发布/);
  assert.equal(readdirSync(resolve(project, 'src/content/posts')).filter((file) => file.endsWith('.md')).length, 1);
  assert.equal(matter(readFileSync(resolve(project, 'src/content/posts', stableFilename), 'utf8')).data.title, '改过的标题');
  assert.match(git(root, '--git-dir', remote, 'ls-tree', '-r', '--name-only', 'master'), /other-computer\.txt/);
  assert.equal(git(project, 'status', '--porcelain'), '');
  console.log('轻量同步端到端测试通过：稳定网址、异步 Git 与跨电脑并发重试均正常。');
} finally {
  if (previousSiteUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = previousSiteUrl;
  rmSync(root, { recursive: true, force: true });
}

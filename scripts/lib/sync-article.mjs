import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { findDropboxArticle } from './dropbox-articles.mjs';
import { transformDropboxArticle, writeTransformedArticle } from './article-transform.mjs';
import { loadLocalEnv } from './local-env.mjs';

const SITE_ORIGIN = (process.env.SITE_URL || 'https://zhuchengxue.github.io').replace(/\/$/, '');

function run(command, args, options = {}) {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const projectRoot = resolve(options.projectRoot || '.');
  const commandArgs = command === 'git'
    ? ['-c', `safe.directory=${projectRoot.replaceAll('\\', '/')}`, ...args]
    : args;
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, commandArgs, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...options.env, ASTRO_TELEMETRY_DISABLED: '1' }
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      child.kill();
      const error = new Error(`${command} 执行超时，请检查网络后重试。`);
      error.command = `${command} ${args.join(' ')}`;
      finish(rejectRun, error);
    }, options.timeoutMs || 180_000);
    child.on('error', (error) => finish(rejectRun, error));
    child.on('close', (status) => {
      const output = `${stdout}${stderr}`.trim();
      const result = { ok: status === 0, output, status };
      if (status !== 0 && !options.allowFailure) {
        const error = new Error(output || `${command} 执行失败`);
        error.command = `${command} ${args.join(' ')}`;
        finish(rejectRun, error);
      } else {
        finish(resolveRun, result);
      }
    });
  });
}

function validateArticle(transformed) {
  if (!transformed.title) throw new Error('文章没有标题。请在 Obsidian 中添加一级标题。');
  if (!transformed.body || transformed.body.trim().length < 20) {
    throw new Error('文章正文太短，暂不发布。');
  }
  if (!transformed.description) throw new Error('无法生成文章摘要。');
}

async function ensureCleanTrackedFiles(projectRoot) {
  const [unstaged, staged] = await Promise.all([
    run('git', ['diff', '--quiet'], { projectRoot, allowFailure: true }),
    run('git', ['diff', '--cached', '--quiet'], { projectRoot, allowFailure: true })
  ]);
  if (!unstaged.ok || !staged.ok) {
    throw new Error('博客程序本身有尚未保存的改动。为避免误提交，本次同步已停止。Dropbox 里的文章不会受影响。');
  }
}

async function pushWithConcurrentRetry(projectRoot, notify) {
  const pushArgs = ['-c', 'http.version=HTTP/1.1', 'push'];
  const first = await run('git', pushArgs, { projectRoot, allowFailure: true });
  if (first.ok) return;
  if (!/(?:rejected|fetch first|non-fast-forward)/i.test(first.output)) {
    throw new Error(first.output || 'GitHub 推送失败，请检查网络和登录状态。');
  }

  notify('检测到另一台电脑刚刚发布，正在自动合并…');
  const pull = await run('git', ['pull', '--rebase'], { projectRoot, allowFailure: true });
  if (!pull.ok) {
    await run('git', ['rebase', '--abort'], { projectRoot, allowFailure: true });
    throw new Error('另一台电脑同时修改了同一篇文章，自动合并未成功。Dropbox 原稿安全，请稍后重试或用 GitHub Desktop 处理冲突。');
  }
  await run('git', pushArgs, { projectRoot });
}

function snapshotOutput(transformed) {
  const backupRoot = mkdtempSync(resolve(tmpdir(), 'xueyusi-publish-'));
  const targetExisted = existsSync(transformed.targetPath);
  const imagesExisted = existsSync(transformed.imageDirectory);
  if (targetExisted) cpSync(transformed.targetPath, resolve(backupRoot, 'article.md'));
  if (imagesExisted) cpSync(transformed.imageDirectory, resolve(backupRoot, 'images'), { recursive: true });
  return {
    cleanup: () => rmSync(backupRoot, { recursive: true, force: true }),
    restore: () => {
      rmSync(transformed.targetPath, { force: true });
      rmSync(transformed.imageDirectory, { recursive: true, force: true });
      if (targetExisted) cpSync(resolve(backupRoot, 'article.md'), transformed.targetPath);
      if (imagesExisted) cpSync(resolve(backupRoot, 'images'), transformed.imageDirectory, { recursive: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  };
}

export function wechatIsConfigured() {
  const env = loadLocalEnv();
  return Boolean(process.env.WECHAT_APP_ID || env.WECHAT_APP_ID)
    && Boolean(process.env.WECHAT_APP_SECRET || env.WECHAT_APP_SECRET);
}

export async function syncArticle(options) {
  const projectRoot = resolve(options.projectRoot || '.');
  const notify = options.onProgress || (() => {});
  const withWechat = Boolean(options.wechat);
  loadLocalEnv();

  if (withWechat && !wechatIsConfigured()) {
    throw new Error('公众号尚未连接。请先在“本机设置”中保存 AppID 和 AppSecret。');
  }

  notify('正在读取 Dropbox 原稿…');
  const { vaultPath, article } = findDropboxArticle(options.articleId, {
    vaultPath: options.vaultPath
  });

  notify('正在获取博客的最新版本…');
  await ensureCleanTrackedFiles(projectRoot);
  await run('git', ['pull', '--rebase'], { projectRoot });

  notify('正在检查文章与图片…');
  const preview = await transformDropboxArticle(article, { vaultPath, projectRoot, dryRun: true });
  validateArticle(preview);
  const snapshot = snapshotOutput(preview);
  const transformed = preview;
  let committed = false;
  try {
    notify('正在整理文章与图片…');
    await writeTransformedArticle(transformed);
    notify('正在提交文章到 GitHub…');
    const addPaths = [transformed.relativeTarget];
    const trackedImages = (await run('git', ['ls-files', '--', transformed.relativeImageDirectory], { projectRoot })).output;
    if (transformed.imageCount || trackedImages) addPaths.push(transformed.relativeImageDirectory);
    await run('git', ['add', '-A', '--', ...addPaths], { projectRoot });
    const staged = (await run('git', ['diff', '--cached', '--name-only'], { projectRoot })).output;
    if (staged) {
      await run('git', ['commit', '-m', `Publish: ${transformed.title}`], { projectRoot });
      committed = true;
    }
    notify('正在推送到 GitHub Pages…');
    await pushWithConcurrentRetry(projectRoot, notify);
    snapshot.cleanup();
  } catch (error) {
    if (!committed) {
      await run('git', ['reset', '--', preview.relativeTarget, preview.relativeImageDirectory], { projectRoot, allowFailure: true });
      snapshot.restore();
    } else {
      snapshot.cleanup();
    }
    throw error;
  }

  let wechatCreated = false;
  if (withWechat) {
    const wechatOutput = mkdtempSync(resolve(tmpdir(), 'xueyusi-wechat-'));
    try {
      notify('正在生成公众号版本…');
      const wechatEnv = { WECHAT_OUTPUT_DIRECTORY: wechatOutput };
      await run(process.execPath, ['scripts/generate-wechat.mjs', transformed.targetPath], { projectRoot, env: wechatEnv });
      const metadataPath = resolve(wechatOutput, `${basename(transformed.filename, '.md')}.json`);
      if (!existsSync(metadataPath)) throw new Error('公众号版本生成失败。');
      notify('正在创建公众号草稿…');
      await run(process.execPath, ['scripts/create-wechat-draft.mjs', metadataPath], { projectRoot, env: wechatEnv });
      wechatCreated = true;
    } catch (error) {
      const articleUrl = `${SITE_ORIGIN}/posts/${encodeURIComponent(basename(transformed.filename, '.md'))}/`;
      throw new Error(`博客已经推送成功，但公众号草稿创建失败：${error.message}\n博客地址：${articleUrl}`);
    } finally {
      rmSync(wechatOutput, { recursive: true, force: true });
    }
  }

  const articleUrl = `${SITE_ORIGIN}/posts/${encodeURIComponent(basename(transformed.filename, '.md'))}/`;
  notify('同步完成。');
  return {
    title: transformed.title,
    filename: transformed.filename,
    articleUrl,
    imageCount: transformed.imageCount,
    committed,
    wechatCreated
  };
}

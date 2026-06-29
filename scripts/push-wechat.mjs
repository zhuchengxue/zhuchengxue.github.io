import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const article = args.find((argument) => argument !== '--dry-run');

if (!article) {
  console.error('请选择要推送到公众号草稿箱的文章。');
  process.exit(1);
}

function run(script, scriptArgs) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: resolve('.'),
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

run('scripts/generate-wechat.mjs', [article, ...(dryRun ? ['--dry-run'] : [])]);
if (dryRun) {
  console.log('公众号草稿推送预检通过。');
  process.exit(0);
}

const metadata = resolve('exports/wechat', `${basename(article, '.md')}.json`);
run('scripts/create-wechat-draft.mjs', [metadata]);

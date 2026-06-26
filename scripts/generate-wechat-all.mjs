import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const includeDrafts = args.includes('--include-drafts');
const postsDirectory = resolve('src/content/posts');
const outputDirectory = resolve('exports/wechat');
const siteOrigin = (process.env.SITE_URL || 'https://zhuchengxue.github.io').replace(/\/$/, '');

const posts = readdirSync(postsDirectory)
  .filter((name) => name.endsWith('.md'))
  .map((name) => {
    const path = resolve(postsDirectory, name);
    const parsed = matter(readFileSync(path, 'utf8'));
    return {
      name,
      path,
      filename: basename(name, '.md'),
      title: parsed.data.title || basename(name, '.md'),
      description: parsed.data.description || '',
      pubDate: parsed.data.pubDate instanceof Date
        ? parsed.data.pubDate.toISOString().slice(0, 10)
        : String(parsed.data.pubDate || ''),
      draft: Boolean(parsed.data.draft)
    };
  })
  .filter((post) => includeDrafts || !post.draft)
  .sort((a, b) => b.pubDate.localeCompare(a.pubDate) || b.name.localeCompare(a.name));

if (!posts.length) {
  console.log(includeDrafts ? '没有可导出的文章。' : '没有已发布文章可导出；如需包含草稿，添加 --include-drafts。');
  process.exit(0);
}

console.log(`公众号批量导出：${posts.length} 篇${includeDrafts ? '（包含草稿）' : '（仅已发布）'}`);

const manifest = [];
for (const post of posts) {
  const argsForSingle = ['scripts/generate-wechat.mjs', post.path, ...(dryRun ? ['--dry-run'] : [])];
  const result = spawnSync(process.execPath, argsForSingle, {
    cwd: resolve('.'),
    encoding: 'utf8',
    stdio: dryRun ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: '1'
    }
  });

  if (result.status !== 0) {
    if (dryRun) {
      process.stderr.write(result.stderr || result.stdout || '');
    }
    console.error(`导出失败：${post.name}`);
    process.exit(result.status || 1);
  }

  if (dryRun) {
    console.log(`- ${post.title} -> exports/wechat/${post.filename}.html`);
  }

  manifest.push({
    title: post.title,
    description: post.description,
    pubDate: post.pubDate,
    draft: post.draft,
    source: `src/content/posts/${post.name}`,
    blogUrl: `${siteOrigin}/posts/${encodeURIComponent(post.filename)}/`,
    html: `exports/wechat/${post.filename}.html`,
    json: `exports/wechat/${post.filename}.json`
  });
}

if (dryRun) {
  console.log('预检完成；未写入 exports/wechat。');
  process.exit(0);
}

mkdirSync(outputDirectory, { recursive: true });
const manifestPath = resolve(outputDirectory, 'index.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`公众号导出清单：${manifestPath}`);

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const SITE_ORIGIN = (process.env.SITE_URL ?? 'https://zhuchengxue.github.io').replace(/\/$/, '');
const postsDirectory = resolve('src/content/posts');
const outputDirectory = resolve('exports/wechat');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const articleArgument = args.find((arg) => arg !== '--dry-run');

if (!articleArgument) {
  console.error('用法：npm run wechat -- "src/content/posts/文章.md" [--dry-run]');
  process.exit(1);
}

const articlePath = resolve(articleArgument);
const relativeArticle = relative(postsDirectory, articlePath);
if (relativeArticle.startsWith('..') || isAbsolute(relativeArticle) || !articlePath.endsWith('.md')) {
  console.error('只能转换 src/content/posts 下的 Markdown 文章。');
  process.exit(1);
}
if (!existsSync(articlePath)) {
  console.error(`文章不存在：${articlePath}`);
  process.exit(1);
}

const filename = basename(articlePath, '.md');
const sourceURL = `${SITE_ORIGIN}/posts/${encodeURIComponent(filename)}/`;
const parsed = matter(readFileSync(articlePath, 'utf8'));
if (/!\[\[/.test(parsed.content)) {
  console.error('文章仍有 Obsidian Wiki 图片，请先运行 npm run prepare。');
  process.exit(1);
}

const images = [];
function resolvePublicAsset(reference) {
  if (!reference) return null;
  if (/^https?:/i.test(reference)) return { publicUrl: reference, localPath: null };

  const normalized = reference.replaceAll('\\', '/');
  const publicRelative = normalized.startsWith('/images/')
    ? normalized.slice(1)
    : normalized.replace(/^(?:\.\.\/)+/, '');
  if (!publicRelative.startsWith('images/')) {
    throw new Error(`无法转换图片路径：${reference}`);
  }

  const localPath = resolve('public', publicRelative);
  if (!existsSync(localPath)) throw new Error(`图片文件不存在：${reference}`);
  return {
    publicUrl: `${SITE_ORIGIN}/${publicRelative.split('/').map(encodeURIComponent).join('/')}`,
    localPath: relative(resolve('.'), localPath).replaceAll('\\', '/')
  };
}

const markdown = parsed.content.replace(
  /!\[([^\]]*)\]\(([^)]+)\)/g,
  (markup, alt, rawReference) => {
    const reference = rawReference.trim();
    if (/^(?:https?:|data:)/i.test(reference)) {
      images.push({ alt, publicUrl: reference, localPath: null });
      return markup;
    }

    const asset = resolvePublicAsset(reference);
    images.push({ alt, ...asset });
    return `![${alt}](${asset.publicUrl})`;
  }
);

marked.setOptions({
  gfm: true,
  breaks: false
});

const escapeAttribute = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

function inlineWechatStyles(html) {
  return html
    .replaceAll('<p>', '<p style="margin:1.2em 0;line-height:1.9;color:#2c2c2c;font-size:16px;text-align:justify;">')
    .replaceAll('<h2>', '<h2 style="margin:2.2em 0 0.9em;padding-left:12px;border-left:4px solid #276749;color:#202020;font-size:22px;line-height:1.45;">')
    .replaceAll('<h3>', '<h3 style="margin:2em 0 0.8em;color:#276749;font-size:19px;line-height:1.5;">')
    .replaceAll('<h4>', '<h4 style="margin:1.8em 0 0.7em;color:#333;font-size:17px;line-height:1.5;">')
    .replace(/<blockquote>/g, '<blockquote style="margin:1.5em 0;padding:0.7em 1em;border-left:3px solid #84a98c;background:#f4f7f4;color:#5b645d;">')
    .replace(/<ul>/g, '<ul style="margin:1em 0;padding-left:1.5em;color:#2c2c2c;">')
    .replace(/<ol>/g, '<ol style="margin:1em 0;padding-left:1.5em;color:#2c2c2c;">')
    .replace(/<li>/g, '<li style="margin:0.45em 0;line-height:1.8;">')
    .replace(/<strong>/g, '<strong style="color:#1f5f45;font-weight:700;">')
    .replace(/<hr>/g, '<hr style="margin:2.5em auto;border:0;border-top:1px solid #d9ded9;">')
    .replace(/<a href="([^"]+)"([^>]*)>/g, '<a href="$1"$2 style="color:#276749;text-decoration:underline;text-underline-offset:3px;">')
    .replace(/<img src="([^"]+)" alt="([^"]*)"([^>]*)>/g, '<img src="$1" alt="$2"$3 style="display:block;max-width:100%;height:auto;margin:1.6em auto;border-radius:6px;">')
    .replace(/<pre><code(?: class="language-([^"]+)")?>/g, (_match, language) =>
      `<pre style="margin:1.5em 0;padding:1em;overflow-x:auto;border-radius:6px;background:#1f2329;color:#f1f1f1;font-size:13px;line-height:1.65;"><code${language ? ` data-language="${escapeAttribute(language)}"` : ''}>`
    )
    .replace(/<code>/g, '<code style="padding:0.15em 0.35em;border-radius:3px;background:#f0f2f0;color:#b33;font-size:0.9em;">')
    .replace(/<table>/g, '<table style="width:100%;margin:1.5em 0;border-collapse:collapse;font-size:14px;">')
    .replace(/<th>/g, '<th style="padding:8px;border:1px solid #d9ded9;background:#f4f7f4;text-align:left;">')
    .replace(/<td>/g, '<td style="padding:8px;border:1px solid #d9ded9;">');
}

const content = inlineWechatStyles(await marked.parse(markdown));
const footer = `
<section style="margin-top:2.8em;padding-top:1.2em;border-top:1px solid #d9ded9;color:#7a7a7a;font-size:13px;line-height:1.7;">
  <p style="margin:0;">本文首发于「学语思」个人博客。</p>
  <p style="margin:0.35em 0 0;">原文地址：<a href="${sourceURL}" style="color:#276749;text-decoration:underline;">${sourceURL}</a></p>
</section>`;
const finalHTML = `<section style="max-width:677px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;">${content}${footer}</section>`;

const metadata = {
  title: parsed.data.title ?? filename,
  author: 'zhuchengxue',
  digest: parsed.data.description ?? '',
  content: finalHTML,
  content_source_url: sourceURL,
  thumb_media_id: '',
  cover: resolvePublicAsset(parsed.data.cover),
  images
};

if (dryRun) {
  console.log(`标题：${metadata.title}`);
  console.log(`摘要：${metadata.digest}`);
  console.log(`图片：${images.length} 张`);
  console.log(`原文：${sourceURL}`);
  process.exit(0);
}

mkdirSync(outputDirectory, { recursive: true });
const htmlPath = resolve(outputDirectory, `${filename}.html`);
const metadataPath = resolve(outputDirectory, `${filename}.json`);
writeFileSync(htmlPath, `<!doctype html><meta charset="utf-8"><title>${escapeAttribute(metadata.title)}</title>${finalHTML}`, 'utf8');
writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

console.log(`公众号 HTML：${htmlPath}`);
console.log(`草稿元数据：${metadataPath}`);
console.log(`图片数量：${images.length}`);

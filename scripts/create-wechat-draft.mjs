import { existsSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const metadataArgument = args.find((arg) => arg !== '--dry-run');
const outputDirectory = resolve('exports/wechat');

if (!metadataArgument) {
  console.error('用法：npm run wechat:draft -- "exports/wechat/文章.json" [--dry-run]');
  process.exit(1);
}

const metadataPath = resolve(metadataArgument);
const relativeMetadata = relative(outputDirectory, metadataPath);
if (relativeMetadata.startsWith('..') || isAbsolute(relativeMetadata) || !metadataPath.endsWith('.json')) {
  console.error('只能读取 exports/wechat 下的 JSON 草稿元数据。');
  process.exit(1);
}
if (!existsSync(metadataPath)) {
  console.error(`草稿元数据不存在：${metadataPath}`);
  process.exit(1);
}

const appId = process.env.WECHAT_APP_ID;
const appSecret = process.env.WECHAT_APP_SECRET;
const defaultThumbMediaId = process.env.WECHAT_THUMB_MEDIA_ID;
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const thumbMediaId = metadata.thumb_media_id || defaultThumbMediaId;

const article = {
  title: metadata.title,
  author: metadata.author,
  digest: metadata.digest,
  content: metadata.content,
  content_source_url: metadata.content_source_url,
  thumb_media_id: thumbMediaId,
  need_open_comment: 0,
  only_fans_can_comment: 0
};

const missing = [];
if (!article.title) missing.push('title');
if (!article.content) missing.push('content');
if (!article.content_source_url) missing.push('content_source_url');
if (!article.thumb_media_id) missing.push('thumb_media_id 或 WECHAT_THUMB_MEDIA_ID');
if (!dryRun) {
  if (!appId) missing.push('WECHAT_APP_ID');
  if (!appSecret) missing.push('WECHAT_APP_SECRET');
}

if (missing.length) {
  console.error(`缺少必要字段：${missing.join(', ')}`);
  process.exit(1);
}

const imageCount = Array.isArray(metadata.images) ? metadata.images.length : 0;
console.log(`草稿文件：${basename(metadataPath)}`);
console.log(`标题：${article.title}`);
console.log(`摘要：${article.digest || '无'}`);
console.log(`原文：${article.content_source_url}`);
console.log(`正文图片：${imageCount} 张`);
if (imageCount) {
  console.log('提示：正文图片当前使用博客绝对 URL。如微信编辑器不显示，需后续通过微信 uploadimg 接口上传并替换。');
}

if (dryRun) {
  console.log('dry-run：不会请求微信接口。');
  process.exit(0);
}

async function requestJSON(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`微信接口返回非 JSON：${text.slice(0, 200)}`);
  }

  if (!response.ok || (json.errcode && json.errcode !== 0)) {
    throw new Error(`微信接口失败：${JSON.stringify(json)}`);
  }

  return json;
}

const tokenURL = new URL('https://api.weixin.qq.com/cgi-bin/token');
tokenURL.searchParams.set('grant_type', 'client_credential');
tokenURL.searchParams.set('appid', appId);
tokenURL.searchParams.set('secret', appSecret);

const tokenResult = await requestJSON(tokenURL, { method: 'GET' });
if (!tokenResult.access_token) {
  throw new Error(`未获取到 access_token：${JSON.stringify(tokenResult)}`);
}

const addDraftURL = new URL('https://api.weixin.qq.com/cgi-bin/draft/add');
addDraftURL.searchParams.set('access_token', tokenResult.access_token);

const draftResult = await requestJSON(addDraftURL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ articles: [article] })
});

console.log(`公众号草稿创建成功：media_id=${draftResult.media_id}`);

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { loadLocalEnv } from './lib/local-env.mjs';

loadLocalEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const metadataArgument = args.find((arg) => arg !== '--dry-run');
const outputDirectory = resolve(process.env.WECHAT_OUTPUT_DIRECTORY || 'exports/wechat');

if (!metadataArgument) {
  console.error('缺少公众号草稿元数据，请使用“发布文章”入口。');
  process.exit(1);
}

const metadataPath = resolve(metadataArgument);
const relativeMetadata = relative(outputDirectory, metadataPath);
if (relativeMetadata.startsWith('..') || isAbsolute(relativeMetadata) || !metadataPath.endsWith('.json')) {
  console.error('只能读取发布器临时目录中的 JSON 草稿元数据。');
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
const defaultCover = process.env.WECHAT_DEFAULT_COVER || 'public/wechat-cover.svg';
const apiOrigin = process.env.WECHAT_API_ORIGIN || 'https://api.weixin.qq.com';
if (apiOrigin !== 'https://api.weixin.qq.com' && process.env.NODE_ENV !== 'test') {
  throw new Error('WECHAT_API_ORIGIN 只允许在测试环境中覆盖。');
}
const initialThumbMediaId = metadata.thumb_media_id || defaultThumbMediaId;

const article = {
  title: metadata.title,
  author: metadata.author,
  digest: metadata.digest,
  content: metadata.content,
  content_source_url: metadata.content_source_url,
  thumb_media_id: initialThumbMediaId,
  need_open_comment: 0,
  only_fans_can_comment: 0
};

const missing = [];
if (!article.title) missing.push('title');
if (!article.content) missing.push('content');
if (!article.content_source_url) missing.push('content_source_url');
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
console.log(`封面：${article.thumb_media_id ? '复用已配置的微信素材' : metadata.cover?.localPath || metadata.cover?.publicUrl || defaultCover}`);

if (dryRun) {
  console.log('dry-run：将上传正文图片和封面并创建公众号草稿，但本次不会请求微信接口。');
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

function apiURL(path) {
  return new URL(path, `${apiOrigin.replace(/\/$/, '')}/`);
}

function mimeType(pathOrUrl) {
  const extension = extname(new URL(pathOrUrl, 'https://local.invalid').pathname).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  return 'image/png';
}

async function readImage(source) {
  const localPath = source?.localPath ? resolve(source.localPath) : null;
  if (localPath && existsSync(localPath)) {
    return {
      bytes: readFileSync(localPath),
      filename: basename(localPath),
      type: mimeType(localPath)
    };
  }

  const url = typeof source === 'string' ? source : source?.publicUrl;
  if (!url || !/^https?:\/\//i.test(url)) throw new Error(`找不到可上传的图片：${url || localPath || '未提供'}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载图片失败（${response.status}）：${url}`);
  const type = response.headers.get('content-type')?.split(';')[0] || mimeType(url);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    filename: basename(new URL(url).pathname) || `image.${type === 'image/jpeg' ? 'jpg' : 'png'}`,
    type
  };
}

async function normalizeImage(image, maxBytes) {
  if (new Set(['image/jpeg', 'image/png']).has(image.type) && image.bytes.length <= maxBytes) return image;
  let bytes = await sharp(image.bytes)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 84, progressive: true })
    .toBuffer();
  if (bytes.length > maxBytes) {
    bytes = await sharp(bytes)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72, progressive: true })
      .toBuffer();
  }
  if (bytes.length > maxBytes) throw new Error(`图片压缩后仍超过微信限制：${image.filename}`);
  return { bytes, filename: image.filename.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg' };
}

async function uploadImage(path, source) {
  const original = await readImage(source);
  const image = await normalizeImage(original, path.includes('/media/uploadimg') ? 900 * 1024 : 5 * 1024 * 1024);
  const body = new FormData();
  body.append('media', new Blob([image.bytes], { type: image.type }), image.filename);
  const url = apiURL(path);
  url.searchParams.set('access_token', accessToken);
  return requestJSON(url, { method: 'POST', body });
}

const tokenURL = apiURL('/cgi-bin/token');
tokenURL.searchParams.set('grant_type', 'client_credential');
tokenURL.searchParams.set('appid', appId);
tokenURL.searchParams.set('secret', appSecret);

const tokenResult = await requestJSON(tokenURL, { method: 'GET' });
if (!tokenResult.access_token) {
  throw new Error(`未获取到 access_token：${JSON.stringify(tokenResult)}`);
}
const accessToken = tokenResult.access_token;

for (let index = 0; index < (metadata.images || []).length; index += 1) {
  const image = metadata.images[index];
  const sourceUrl = image.publicUrl;
  if (!sourceUrl || !article.content.includes(sourceUrl)) continue;
  console.log(`上传正文图片 ${index + 1}/${imageCount}…`);
  const uploaded = await uploadImage('/cgi-bin/media/uploadimg', image);
  if (!uploaded.url) throw new Error(`正文图片上传后未返回 URL：${JSON.stringify(uploaded)}`);
  article.content = article.content.replaceAll(sourceUrl, uploaded.url);
}

if (!article.thumb_media_id) {
  const cover = metadata.cover?.localPath || metadata.cover?.publicUrl
    ? metadata.cover
    : (/^https?:\/\//i.test(defaultCover) ? { publicUrl: defaultCover } : { localPath: defaultCover });
  console.log('上传公众号封面…');
  const uploadedCover = await uploadImage('/cgi-bin/material/add_material?type=image', cover);
  if (!uploadedCover.media_id) throw new Error(`封面上传后未返回 media_id：${JSON.stringify(uploadedCover)}`);
  article.thumb_media_id = uploadedCover.media_id;
}

const addDraftURL = apiURL('/cgi-bin/draft/add');
addDraftURL.searchParams.set('access_token', accessToken);

const draftResult = await requestJSON(addDraftURL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ articles: [article] })
});

const receiptPath = metadataPath.replace(/\.json$/i, '.result.json');
writeFileSync(receiptPath, `${JSON.stringify({
  media_id: draftResult.media_id,
  title: article.title,
  created_at: new Date().toISOString(),
  body_images: imageCount,
  thumb_media_id: article.thumb_media_id
}, null, 2)}\n`, 'utf8');
console.log(`公众号草稿创建成功：media_id=${draftResult.media_id}`);
console.log(`回执：${receiptPath}`);

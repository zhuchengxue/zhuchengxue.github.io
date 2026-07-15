import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { listDropboxArticles } from './lib/dropbox-articles.mjs';
import { transformDropboxArticle, writeTransformedArticle } from './lib/article-transform.mjs';

const root = mkdtempSync(resolve(tmpdir(), 'xueyusi-article-'));
const vault = resolve(root, 'Dropbox', '公众号文章');
const project = resolve(root, 'repo');

try {
  mkdirSync(resolve(vault, '02-待发布'), { recursive: true });
  mkdirSync(resolve(vault, '03-已发布'), { recursive: true });
  mkdirSync(resolve(vault, '附件'), { recursive: true });
  mkdirSync(resolve(project, 'src/content/posts'), { recursive: true });
  writeFileSync(resolve(vault, '写作风格.md'), '# 内部规范\n', 'utf8');
  writeFileSync(resolve(vault, '00-今日写作.md'), '# 今日写作\n\n这是入口文件，不应该进入发布列表。\n', 'utf8');
  writeFileSync(resolve(vault, '02-待发布', '新文章.md'), '# 新文章\n\n这是用于自动生成摘要的一段完整正文，内容足够长，也应当保留在 Dropbox 原稿中。\n\n![[配图.svg|示例图]]\n', 'utf8');
  writeFileSync(resolve(vault, '附件', '配图.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', 'utf8');
  writeFileSync(resolve(vault, '03-已发布', '旧文章.md'), '# 旧文章\n\n旧正文。\n', 'utf8');
  writeFileSync(resolve(root, '外部图片.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8');
  writeFileSync(resolve(project, 'src/content/posts/2024-01-02-旧文章.md'), '---\ntitle: "旧文章"\ndescription: "旧摘要"\npubDate: 2024-01-02\ntags:\n  - "旧标签"\ndraft: false\n---\n\n旧版本\n', 'utf8');

  const collection = listDropboxArticles({ vaultPath: vault });
  assert.equal(collection.articles.length, 2);
  assert.equal(collection.articles.some((item) => item.title === '内部规范'), false);
  assert.equal(collection.articles.some((item) => item.title === '今日写作'), false);
  assert.equal(collection.articles.find((item) => item.title === '旧文章').archived, true);
  assert.equal(collection.articles.find((item) => item.title === '新文章').pending, true);

  const fresh = collection.articles.find((item) => item.title === '新文章');
  const transformed = await transformDropboxArticle(fresh, { vaultPath: vault, projectRoot: project, dryRun: true });
  assert.equal(existsSync(transformed.targetPath), false);
  await writeTransformedArticle(transformed);
  assert.match(transformed.filename, /^\d{4}-\d{2}-\d{2}-新文章\.md$/);
  assert.equal(transformed.imageCount, 1);
  assert.match(readFileSync(transformed.targetPath, 'utf8'), /draft: false/);
  assert.match(readFileSync(transformed.targetPath, 'utf8'), /sourceId: "新文章\.md"/);
  assert.match(readFileSync(transformed.targetPath, 'utf8'), /\.\.\/\.\.\/images\/新文章\/新文章-01\.svg/);

  const old = collection.articles.find((item) => item.title === '旧文章');
  const updated = await transformDropboxArticle(old, { vaultPath: vault, projectRoot: project });
  assert.equal(updated.filename, '2024-01-02-旧文章.md');
  assert.match(updated.output, /pubDate: 2024-01-02/);
  assert.match(updated.output, /- "旧标签"/);
  assert.match(updated.output, /sourceId: "旧文章\.md"/);

  writeFileSync(resolve(vault, '03-已发布', '旧文章.md'), '# 旧文章的新标题\n\n改标题后仍应更新原来的博客网址。\n', 'utf8');
  const renamed = listDropboxArticles({ vaultPath: vault }).articles.find((item) => item.sourceId === '旧文章.md');
  const renamedResult = await transformDropboxArticle(renamed, { vaultPath: vault, projectRoot: project, dryRun: true });
  assert.equal(renamedResult.filename, '2024-01-02-旧文章.md');
  assert.equal(renamedResult.title, '旧文章的新标题');

  writeFileSync(resolve(vault, '02-待发布', '越界文章.md'), '# 越界文章\n\n这篇文章尝试引用写作库外部的图片。\n\n![[../外部图片.svg]]\n', 'utf8');
  const outside = listDropboxArticles({ vaultPath: vault }).articles.find((item) => item.title === '越界文章');
  await assert.rejects(
    transformDropboxArticle(outside, { vaultPath: vault, projectRoot: project, dryRun: true }),
    /找不到文章图片/
  );
  console.log('Dropbox 唯一原稿与文章转换测试通过。');
} finally {
  rmSync(root, { recursive: true, force: true });
}

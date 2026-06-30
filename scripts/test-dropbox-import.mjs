import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';

const root = mkdtempSync(resolve(tmpdir(), 'blog-dropbox-import-'));
const vault = resolve(root, '公众号文章');
const published = resolve(vault, '已发布');
const output = resolve(root, 'output');
mkdirSync(published, { recursive: true });
writeFileSync(resolve(vault, '草稿文章.md'), '# 草稿文章\n\n这是一段足够长的摘要文字，用于验证 Dropbox 文章可以转换为博客草稿。\n\n正文继续。\n', 'utf8');
writeFileSync(resolve(published, '旧文章.md'), '这是另一篇没有一级标题的旧文章正文，导入时应当使用文件名作为标题。\n', 'utf8');

try {
  const result = spawnSync(process.execPath, ['scripts/import-dropbox-posts.mjs'], {
    cwd: resolve('.'),
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', WRITING_VAULT: vault, DROPBOX_IMPORT_OUTPUT: output }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const files = readdirSync(output).filter((file) => file.endsWith('.md'));
  assert.equal(files.length, 2);
  const posts = files.map((file) => matter(readFileSync(resolve(output, file), 'utf8')));
  assert.deepEqual(new Set(posts.map((post) => post.data.title)), new Set(['草稿文章', '旧文章']));
  assert.ok(posts.every((post) => post.data.draft === true));
  assert.ok(posts.every((post) => post.data.tags.includes('公众号归档')));
  console.log('Dropbox 文章导入测试通过：标题、摘要、日期、标签和草稿状态均已生成。');
} finally {
  rmSync(root, { recursive: true, force: true });
}

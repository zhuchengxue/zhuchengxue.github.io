import assert from 'node:assert/strict';
import { isAllowedBacklogChange } from './lib/publish-worktree.mjs';

const backlog = {
  draftFiles: new Set(['src/content/posts/2024-01-01-backlog.md']),
  draftSlugs: new Set(['backlog'])
};

assert.equal(isAllowedBacklogChange('?? src/content/posts/2024-01-01-backlog.md', backlog), true);
assert.equal(isAllowedBacklogChange(' M src/content/posts/2024-01-01-backlog.md', backlog), true);
assert.equal(isAllowedBacklogChange('M  src/content/posts/2024-01-01-backlog.md', backlog), false);
assert.equal(isAllowedBacklogChange('?? public/images/backlog/backlog-01.webp', backlog), true);
assert.equal(isAllowedBacklogChange(' M README.md', backlog), false);

console.log('积压草稿隔离测试通过：允许保留未暂存草稿，但拒绝已暂存草稿和无关代码改动。');

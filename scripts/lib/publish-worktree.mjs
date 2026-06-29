import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const normalize = (value) => value.replaceAll('\\', '/').replace(/^"|"$/g, '');

export function collectDraftBacklog(postsDirectory, projectRoot) {
  const draftFiles = new Set();
  const draftSlugs = new Set();
  if (!existsSync(postsDirectory)) return { draftFiles, draftSlugs };

  for (const file of readdirSync(postsDirectory).filter((name) => name.endsWith('.md'))) {
    const path = resolve(postsDirectory, file);
    if (!/^draft:\s*true\s*$/m.test(readFileSync(path, 'utf8'))) continue;
    draftFiles.add(normalize(relative(projectRoot, path)));
    draftSlugs.add(file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, ''));
  }

  return { draftFiles, draftSlugs };
}

export function isAllowedBacklogChange(statusLine, backlog) {
  const status = statusLine.slice(0, 2);
  const path = normalize(statusLine.slice(3));
  const isOnlyInWorktree = status === '??' || status[0] === ' ';
  if (!isOnlyInWorktree) return false;
  if (backlog.draftFiles.has(path)) return true;

  const image = path.match(/^public\/images\/([^/]+)\//);
  return Boolean(image && backlog.draftSlugs.has(image[1]));
}

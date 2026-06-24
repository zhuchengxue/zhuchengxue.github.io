import { defineConfig } from 'astro/config';

const [owner = '', repository = ''] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const isUserSite = repository.endsWith('.github.io');
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  site: isGitHubActions && owner ? `https://${owner}.github.io` : 'http://localhost:4321',
  base: isGitHubActions && repository && !isUserSite ? `/${repository}` : '/',
  output: 'static',
  trailingSlash: 'always'
});

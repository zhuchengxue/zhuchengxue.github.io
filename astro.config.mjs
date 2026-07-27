import { defineConfig } from 'astro/config';

const [, repository = ''] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const isUserSite = repository.endsWith('.github.io');
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const configuredSite = process.env.SITE_URL?.trim();
const site = configuredSite || 'https://xys.bot.cd';

export default defineConfig({
  site,
  base: isGitHubActions && repository && !isUserSite ? `/${repository}` : '/',
  output: 'static',
  trailingSlash: 'always'
});

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, resolve } from 'node:path';
import { readLocalEnv } from './local-env.mjs';

function obsidianConfigPath() {
  if (process.platform === 'win32' && process.env.APPDATA) return resolve(process.env.APPDATA, 'obsidian/obsidian.json');
  if (process.platform === 'darwin') return resolve(homedir(), 'Library/Application Support/obsidian/obsidian.json');
  return resolve(process.env.XDG_CONFIG_HOME || resolve(homedir(), '.config'), 'obsidian/obsidian.json');
}

export function findObsidianVault() {
  if (process.env.WRITING_VAULT_DISABLED === '1') return null;
  const configured = process.env.WRITING_VAULT || readLocalEnv().WRITING_VAULT;
  if (configured && existsSync(configured)) return resolve(configured);

  const configPath = obsidianConfigPath();
  if (!existsSync(configPath)) return null;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const vaults = Object.values(config.vaults || {})
      .filter((vault) => vault?.path && existsSync(vault.path))
      .sort((a, b) => Number(Boolean(b.open)) - Number(Boolean(a.open)) || (b.ts || 0) - (a.ts || 0));
    return vaults[0]?.path ? resolve(vaults[0].path) : null;
  } catch {
    return null;
  }
}

export function obsidianFileURL(vaultPath, filePath) {
  const relativeFile = filePath
    .slice(resolve(vaultPath).length)
    .replace(/^[/\\]+/, '')
    .replaceAll('\\', '/')
    .replace(/\.md$/i, '');
  const params = new URLSearchParams({ vault: basename(vaultPath), file: relativeFile });
  return `obsidian://open?${params}`;
}

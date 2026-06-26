import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const astroBin = resolve('node_modules/astro/bin/astro.mjs');
const result = spawnSync(process.execPath, [astroBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: process.env.ASTRO_TELEMETRY_DISABLED || '1'
  }
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);

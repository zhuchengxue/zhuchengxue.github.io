import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.env');

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function readLocalEnv() {
  if (!existsSync(envPath)) return {};
  const values = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) values[match[1]] = unquote(match[2]);
  }
  return values;
}

export function loadLocalEnv() {
  const values = readLocalEnv();
  for (const [name, value] of Object.entries(values)) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
  return values;
}

function serialize(value) {
  const text = String(value ?? '');
  if (!text || /^[A-Za-z0-9_./:@+-]+$/.test(text)) return text;
  return JSON.stringify(text);
}

export function updateLocalEnv(updates) {
  const source = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const lines = source ? source.replace(/\r\n/g, '\n').split('\n') : [];
  const pending = new Map(Object.entries(updates));

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !pending.has(match[1])) continue;
    lines[index] = `${match[1]}=${serialize(pending.get(match[1]))}`;
    pending.delete(match[1]);
  }

  if (pending.size && lines.length && lines.at(-1) !== '') lines.push('');
  for (const [name, value] of pending) lines.push(`${name}=${serialize(value)}`);
  const output = `${lines.join('\n').replace(/\n+$/, '')}\n`;
  writeFileSync(envPath, output, { encoding: 'utf8', mode: 0o600 });
}

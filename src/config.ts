import { readFileSync } from 'fs';
import { Config } from './types.js';

export function loadConfig(path = 'config.json'): Config {
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as Config;
}

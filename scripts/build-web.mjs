// Exporta la versión web para GitHub Pages (ruta base /Adivina-pkm) y le añade la CSP.
// Multiplataforma: funciona igual en Linux, macOS y PowerShell.
import { spawnSync } from 'node:child_process';

const env = { ...process.env, PAGES_BASE_URL: process.env.PAGES_BASE_URL ?? '/Adivina-pkm' };
const shell = process.platform === 'win32';
const run = (command, args) => {
  const result = spawnSync(command, args, { env, stdio: 'inherit', shell });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist']);
run(process.execPath, ['scripts/add-web-csp.mjs', 'dist']);

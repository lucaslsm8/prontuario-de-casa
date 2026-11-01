// `npm run app:build`: gera os instaladores.
// Com a chave de assinatura (variável TAURI_SIGNING_PRIVATE_KEY ou o arquivo ~/.tauri/prontuario-de-casa.key),
// também gera os arquivos de atualização (.sig). Sem a chave (quem clonou o repositório), gera só os instaladores.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const env = { ...process.env };
const arquivo = join(homedir(), '.tauri', 'prontuario-de-casa.key');
if (!env.TAURI_SIGNING_PRIVATE_KEY && existsSync(arquivo)) {
  env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(arquivo, 'utf8');
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= '';
}
const args = ['tauri', 'build', ...process.argv.slice(2)];
const arquivoConfig = join(tmpdir(), `prontuario-build-${process.pid}.json`);
if (!env.TAURI_SIGNING_PRIVATE_KEY) {
  console.log('Sem chave de assinatura: gerando só os instaladores (sem arquivos de atualização).');
  // O --config vai num arquivo: JSON na linha de comando quebra no cmd do Windows.
  args.push('--config', arquivoConfig);
  writeFileSync(arquivoConfig, JSON.stringify({ bundle: { createUpdaterArtifacts: false } }));
}
let r;
try {
  r = spawnSync('npx', args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
} finally {
  rmSync(arquivoConfig, { force: true });
}
process.exit(r.status ?? 1);

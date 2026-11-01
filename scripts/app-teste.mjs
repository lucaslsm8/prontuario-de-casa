// `npm run app:teste -- a` (ou b): gera um app de TESTE com outro identificador (dados, chave e janela separados do app real)
// e copia o .exe para src-tauri/target/teste-<letra>/. Serve para testar a sincronização entre dois "aparelhos" no mesmo PC.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const letra = (process.argv[2] ?? '').toLowerCase();
if (!/^[a-z]$/.test(letra)) {
  console.error('Use: npm run app:teste -- a   (uma letra: a, b, …)');
  process.exit(1);
}
const config = { identifier: `br.familia.arquivosaude.teste${letra}`, productName: `Prontuário teste ${letra.toUpperCase()}`, bundle: { createUpdaterArtifacts: false }, app: { windows: [{ label: 'main', title: `Prontuário teste ${letra.toUpperCase()}`, width: 1280, height: 800, minWidth: 1024, minHeight: 680, center: true, backgroundColor: '#F4F7F7' }] } };
// O --config vai num arquivo: JSON com aspas e acentos na linha de comando quebra no cmd do Windows.
const arquivoConfig = join(tmpdir(), `prontuario-teste-${letra}-${process.pid}.json`);
writeFileSync(arquivoConfig, JSON.stringify(config));
let r;
try {
  r = spawnSync('npx', ['tauri', 'build', '--no-bundle', '--config', arquivoConfig], { stdio: 'inherit', shell: process.platform === 'win32' });
} finally {
  rmSync(arquivoConfig, { force: true });
}
if (r.status !== 0) process.exit(r.status ?? 1);
const destino = `src-tauri/target/teste-${letra}`;
mkdirSync(destino, { recursive: true });
copyFileSync('src-tauri/target/release/arquivo-saude.exe', `${destino}/arquivo-saude.exe`);
console.log(`Pronto: ${destino}/arquivo-saude.exe (identificador br.familia.arquivosaude.teste${letra})`);

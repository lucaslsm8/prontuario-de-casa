// Baixa os instaladores de todas as versões publicadas (GitHub Releases) para release/<versão>/:
// APK do Android (+ .sha256), .exe e .msi do Windows. Pula o que já foi baixado.
// A pasta release/ fica fora do git (.gitignore): o repositório é público e os instaladores são grandes.
//
//   npm run releases            todas as versões publicadas
//   npm run releases -- v0.5.18 só uma versão
//
// Precisa do GitHub CLI (`gh`) logado.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'lucaslsm8/prontuario-de-casa';
const RAIZ = join(import.meta.dirname, '..', 'release');
const PADROES = ['*.apk', '*.apk.sha256', '*.exe', '*.msi'];

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const pedidas = process.argv.slice(2);
const versoes = pedidas.length
  ? pedidas
  : JSON.parse(gh(['release', 'list', '--repo', REPO, '--limit', '200', '--json', 'tagName,isDraft']))
      .filter((r) => !r.isDraft)
      .map((r) => r.tagName);

mkdirSync(RAIZ, { recursive: true });
let novas = 0;
for (const tag of versoes) {
  const pasta = join(RAIZ, tag);
  const antes = existsSync(pasta) ? readdirSync(pasta).length : 0;
  mkdirSync(pasta, { recursive: true });
  try {
    gh(['release', 'download', tag, '--repo', REPO, '--dir', pasta, '--skip-existing', ...PADROES.flatMap((p) => ['--pattern', p])]);
  } catch {
    console.error(`${tag}: não foi possível baixar (rascunho ou sem arquivos?)`);
    continue;
  }
  const depois = readdirSync(pasta).length;
  if (depois > antes) novas++;
  console.log(`${tag}: ${depois} arquivo(s)${depois > antes ? ` (+${depois - antes})` : ''}`);
}
console.log(`\nPronto: ${versoes.length} versão(ões) em release/, ${novas} com arquivos novos.`);

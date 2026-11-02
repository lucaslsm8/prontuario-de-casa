// `npm run android:chave`: cria (uma vez) a chave que assina o APK e mostra como cadastrá-la no GitHub.
// Nunca sobrescreve uma chave existente (trocar a chave impede atualizar o app já instalado)
// e nunca imprime a senha: os comandos abaixo a leem do arquivo.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = join(homedir(), '.tauri');
const jks = join(pasta, 'prontuario-android.jks');
const arquivoSenha = join(pasta, 'prontuario-android.senha');
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const props = join(raiz, 'src-tauri', 'gen', 'android', 'keystore.properties');

mkdirSync(pasta, { recursive: true });

if (existsSync(jks)) {
  console.log(`A chave já existe em ${jks}: nada foi alterado.`);
  if (!existsSync(arquivoSenha)) {
    console.error(`Falta o arquivo da senha (${arquivoSenha}). Sem ele não dá para assinar.`);
    process.exit(1);
  }
} else {
  if (existsSync(arquivoSenha)) {
    console.error(`Já existe ${arquivoSenha} sem a chave correspondente. Mova-o antes de gerar uma chave nova.`);
    process.exit(1);
  }
  const senha = randomBytes(24).toString('base64url');
  const keytool = join(process.env.JAVA_HOME ?? '', 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool');
  const comando = process.env.JAVA_HOME && existsSync(keytool) ? keytool : 'keytool';
  // Grava a senha antes, para não perder a chave se algo falhar depois.
  writeFileSync(arquivoSenha, senha, { mode: 0o600 });
  const r = spawnSync(
    comando,
    ['-genkeypair', '-v', '-keystore', jks, '-alias', 'prontuario', '-keyalg', 'RSA', '-keysize', '4096',
      '-validity', '10000', '-storepass', senha, '-keypass', senha, '-dname', 'CN=Prontuario de Casa'],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  if (r.status !== 0 || !existsSync(jks)) {
    console.error('Não consegui gerar a chave. Confira se o JAVA_HOME aponta para um JDK 17.');
    process.exit(1);
  }
  console.log(`Chave criada em ${jks} (senha em ${arquivoSenha}).`);
}

const senha = readFileSync(arquivoSenha, 'utf8').trim();
writeFileSync(props, `storeFile=${jks.split('\\').join('/')}\npassword=${senha}\n`, { mode: 0o600 });
console.log(`Escrevi ${props} (ignorado pelo git) para assinar builds locais.`);

console.log(`
Guarde ${jks} e ${arquivoSenha} num lugar seguro: sem eles o Android não aceita atualizar o app instalado.

Cadastre os dois segredos no GitHub (PowerShell, uma vez):

[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\\.tauri\\prontuario-android.jks")) | gh secret set ANDROID_KEYSTORE_B64 --repo lucaslsm8/prontuario-de-casa
Get-Content -Raw "$env:USERPROFILE\\.tauri\\prontuario-android.senha" | gh secret set ANDROID_KEYSTORE_SENHA --repo lucaslsm8/prontuario-de-casa
`);

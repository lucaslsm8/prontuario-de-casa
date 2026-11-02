# Etapa 3: Android básico — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Prontuário de Casa roda no celular Android como app de verdade:
- chave do banco protegida pelo **Android Keystore**;
- dados fora do backup automático do Android;
- **biometria** para abrir;
- área segura e tecla voltar;
- ícone e nome certos;
- telas de **família no celular** (entrar com convite e card de família);
- **APK assinado** publicado no mesmo GitHub Release do desktop.

**Architecture:**
- Projeto Android gerado pelo Tauri em `src-tauri/gen/android` (já compila um APK de debug; commit `28ed071`).
- Um **plugin móvel do próprio app** (Kotlin `CofrePlugin` + módulo Rust `cofre_android.rs`) devolve a chave de 32 bytes do banco, cifrada por uma chave AES do AndroidKeyStore. Ele substitui o arquivo `chave.bin` em claro no Android.
- A biometria usa o `tauri-plugin-biometric` oficial.
- O workflow de release ganha um job `android` (Ubuntu), que assina o APK com um keystore guardado em segredos do GitHub.

**Tech Stack:** Tauri 2 mobile (Kotlin + Rust), Android SDK 36 / NDK r28, Gradle KTS, `tauri-plugin-biometric` 2, React/TS.

Spec: [`docs/superpowers/specs/2026-10-31-android-sincronizacao-design.md`](../specs/2026-10-31-android-sincronizacao-design.md), seção 4. Ambiente: `ANDROID_HOME`, `NDK_HOME`, `JAVA_HOME` já definidos no usuário do Windows.

## Global Constraints

- **Dados nunca em claro no disco.** No Android, a chave do banco fica cifrada pelo Keystore. O app **não** entra no backup automático do Android (`android:allowBackup="false"`, `android:fullBackupContent="false"`, `android:dataExtractionRules` excluindo tudo).
- **Sem rede nova.** A biometria é local. Nada de analytics.
- O identificador do app continua `br.familia.arquivosaude` e o nome "Prontuário de Casa".
- O desktop não pode quebrar: `cd src-tauri && cargo test` e `npm run build` passam depois de cada tarefa. O código só-Android fica sob `#[cfg(target_os = "android")]`; o só-celular, sob `#[cfg(mobile)]`.
- Textos em pt-BR. Alvo de toque mínimo de 44 px no celular.
- Build Android local (Git Bash):
  - `export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk" NDK_HOME="$LOCALAPPDATA/Android/Sdk/ndk/28.2.13676358" JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.21.21-hotspot"`
  - depois `npx tauri android build --apk --target aarch64 --debug`.
- **Nunca** rodar o app desktop real (`npm run app:dev`) nem o `.exe` real.
- Segredos (senha do keystore, keystore) **nunca** no repositório: ficam em `%USERPROFILE%\.tauri\` e nos segredos do GitHub.

---

### Task 1: Manifesto, ícones, área segura e tecla voltar

**Files:**
- Modify: `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
- Create: `src-tauri/gen/android/app/src/main/res/xml/data_extraction_rules.xml`
- Modify: `index.html` (viewport)
- Modify: `src/styles/shell.css` (área segura no `.phone` e na tab bar quando não é moldura)
- Modify: `src/App.tsx` ou `src/mobile/useVoltar.ts` (tecla voltar)
- Regenerate: ícones do Android

**Interfaces:** nenhuma nova para as outras tarefas.

- [ ] **Step 1: Manifesto.**
  - No `<application …>` de `AndroidManifest.xml`, acrescente:
    - `android:allowBackup="false"`;
    - `android:fullBackupContent="false"`;
    - `android:dataExtractionRules="@xml/data_extraction_rules"`.
  - Crie `res/xml/data_extraction_rules.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Nada do app vai para o backup na nuvem nem para a transferência entre aparelhos do Android:
     os dados já são cifrados e a família sincroniza pelo próprio app. -->
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" />
        <exclude domain="file" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" />
        <exclude domain="file" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </device-transfer>
</data-extraction-rules>
```
  - Confira que `res/values/strings.xml` tem `app_name` e `main_activity_title` = "Prontuário de Casa". Se não tiver, corrija.

- [ ] **Step 2: Ícones.** Rode `npx tauri icon docs/design/icone/icone.svg -o src-tauri/icons`. Com o projeto Android existente, o Tauri escreve os mipmaps em `gen/android/app/src/main/res/mipmap-*`. Confira com `git status` que mudaram, e que o fundo adaptativo (`ic_launcher_background`) ficou branco (`#FFFFFF`), não azul. Se ficou outra cor, troque em `res/values/ic_launcher_background.xml` ou no drawable correspondente.

- [ ] **Step 3: Área segura.**
  - No `index.html`, o `<meta name="viewport">` passa a ter `viewport-fit=cover`.
  - Em `src/styles/shell.css`:
    - `.phone:not(.is-frame)` ganha `padding-top: env(safe-area-inset-top, 0px)`;
    - a tab bar já usa `env(safe-area-inset-bottom)` (confira `grep -n "safe-area" src/styles/*.css`);
    - as telas cheias de cor (bloqueio, onboarding escuro) devem continuar ocupando até a borda.

- [ ] **Step 4: Tecla voltar.** No Android, a tecla voltar do sistema dispara `popstate` no WebView do Tauri quando há histórico, e fecha o app quando não há. Confira se `HashRouter` + a navegação atual já funcionam com isso. Se o `WryActivity.onBackPressed` padrão do Tauri só fechar o app, implemente em `src-tauri/gen/android/app/src/main/java/br/familia/arquivosaude/MainActivity.kt` um `onBackPressedDispatcher.addCallback` que:
  - chame `window.history.back()` no WebView quando `webView.canGoBack()`;
  - caso contrário, siga o padrão (sair).

  Documente no relatório o que foi preciso.

- [ ] **Step 5: Build e commit.**
  - Rode `npm run build`, `cd src-tauri && cargo test` e o build do APK (Global Constraints). Todos passam.
  - `git add -A && git commit -m "Android: sem backup automático, ícone, área segura e tecla voltar"`

---

### Task 2: Chave do banco no Android Keystore

**Files:**
- Create: `src-tauri/gen/android/app/src/main/java/br/familia/arquivosaude/CofrePlugin.kt`
- Create: `src-tauri/src/cofre_android.rs`
- Modify: `src-tauri/src/lib.rs` (registrar o plugin; usar a chave do Keystore no Android)
- Modify: `src-tauri/src/cripto.rs` (ramo Android não usa mais `chave.bin`)

**Interfaces:**
- Produces:
  - `cofre_android::init<R: Runtime>() -> TauriPlugin<R>`, só em Android;
  - `cofre_android::chave(app: &AppHandle) -> Result<[u8; 32], String>`, que lê ou cria a chave do banco cifrada pelo Keystore;
  - `cofre_android::apagar(app: &AppHandle)`.

- [ ] **Step 1: Kotlin** (`CofrePlugin.kt`):
```kotlin
package br.familia.arquivosaude

import android.app.Activity
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Chave do banco (32 bytes) guardada cifrada por uma chave AES do AndroidKeyStore,
 * que nunca sai do hardware/sistema. Arquivo: filesDir/chave.cofre = iv(12) | texto cifrado.
 */
@TauriPlugin
class CofrePlugin(private val activity: Activity) : Plugin(activity) {
    private val alias = "prontuario-chave-do-banco"
    private val arquivo get() = File(activity.filesDir, "chave.cofre")

    private fun chaveDoSistema(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    private fun hex(b: ByteArray) = b.joinToString("") { "%02x".format(it) }

    @Command
    fun chave(invoke: Invoke) {
        try {
            val sistema = chaveDoSistema()
            val f = arquivo
            val claro: ByteArray = if (f.exists()) {
                val tudo = f.readBytes()
                val c = Cipher.getInstance("AES/GCM/NoPadding")
                c.init(Cipher.DECRYPT_MODE, sistema, GCMParameterSpec(128, tudo.copyOfRange(0, 12)))
                c.doFinal(tudo.copyOfRange(12, tudo.size))
            } else {
                val nova = ByteArray(32).also { SecureRandom().nextBytes(it) }
                val c = Cipher.getInstance("AES/GCM/NoPadding")
                c.init(Cipher.ENCRYPT_MODE, sistema)
                f.writeBytes(c.iv + c.doFinal(nova))
                nova
            }
            invoke.resolve(JSObject().put("chave", hex(claro)))
        } catch (e: Exception) {
            invoke.reject("cofre do sistema: ${e.message}")
        }
    }

    @Command
    fun apagar(invoke: Invoke) {
        try {
            arquivo.delete()
            KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("cofre do sistema: ${e.message}")
        }
    }
}
```

- [ ] **Step 2: Rust** (`src-tauri/src/cofre_android.rs`):
```rust
//! Android: a chave do banco vem do CofrePlugin (Kotlin), cifrada pelo AndroidKeyStore.
//! Nos outros sistemas este módulo não existe (cripto.rs usa o cofre do sistema ou um arquivo).

use serde::Deserialize;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};

pub struct Cofre<R: Runtime>(PluginHandle<R>);

#[derive(Deserialize)]
struct Resposta {
    chave: String,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("cofre")
        .setup(|app, api| {
            let h = api.register_android_plugin("br.familia.arquivosaude", "CofrePlugin")?;
            app.manage(Cofre(h));
            Ok(())
        })
        .build()
}

pub fn chave<R: Runtime>(app: &AppHandle<R>) -> Result<[u8; 32], String> {
    let c = app.state::<Cofre<R>>();
    let r: Resposta = c.0.run_mobile_plugin("chave", ()).map_err(|e| e.to_string())?;
    let mut out = [0u8; 32];
    if r.chave.len() != 64 || !r.chave.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("chave do cofre inválida".into());
    }
    for (i, par) in r.chave.as_bytes().chunks(2).enumerate() {
        out[i] = u8::from_str_radix(std::str::from_utf8(par).unwrap_or("00"), 16).map_err(|e| e.to_string())?;
    }
    Ok(out)
}

pub fn apagar<R: Runtime>(app: &AppHandle<R>) {
    let c = app.state::<Cofre<R>>();
    let _: Result<serde_json::Value, _> = c.0.run_mobile_plugin("apagar", ());
}
```

- [ ] **Step 3: Ligar no `lib.rs`.**
  - Acrescente `#[cfg(target_os = "android")] mod cofre_android;`.
  - No `run()`, acrescente `#[cfg(target_os = "android")] let builder = builder.plugin(cofre_android::init());` antes de `.setup`.
  - `abrir_banco` passa a receber a chave já resolvida, ou um "provedor":
    - no setup, no Android, `let chave = cofre_android::chave(app.handle())`;
    - nos outros sistemas, continua `cripto::chave_do_aparelho(&servico, &dir, novo)`.
  - Mantenha um único caminho para os dois casos, por exemplo uma função `fn chave_para(app, servico, dir, novo) -> R<[u8;32]>` com os `cfg`.
  - Em `apagar_tudo`, no Android, chame `cofre_android::apagar(&app)` em vez de `cripto::apagar_chave`. O comando passa a receber `app: tauri::AppHandle`.
  - Mantenha o `Estado` sem `AppHandle` guardado; só o comando recebe.
  - O ramo "arquivo" de `cripto.rs` continua para Linux. No Android ele não é mais usado: documente isso no comentário de `chave_do_aparelho`.

- [ ] **Step 4: Verificar.**
  - `cd src-tauri && cargo test` e `cargo clippy --all-targets` passam no desktop.
  - O build do APK passa.
  - No relatório, liste os comandos e as saídas.

- [ ] **Step 5: Commit** `git commit -m "Android: chave do banco no Keystore (CofrePlugin)"`

---

### Task 3: Biometria para abrir

**Files:**
- Modify: `src-tauri/Cargo.toml` (`tauri-plugin-biometric = "2"` em `[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]`)
- Modify: `src-tauri/src/lib.rs` (`#[cfg(mobile)] let builder = builder.plugin(tauri_plugin_biometric::init());`)
- Create: `src-tauri/capabilities/mobile.json` (`"platforms": ["android", "iOS"]`, `"windows": ["main"]`, `"permissions": ["biometric:default"]`)
- Modify: `package.json` (`@tauri-apps/plugin-biometric`, versão exata como os outros plugins)
- Create: `src/data/biometria.ts`
- Modify: `src/mobile/Config.tsx` (tela de desbloqueio com PIN, ~linhas 150–200)

**Interfaces:**
- Produces:
  - `biometriaDisponivel(): Promise<boolean>`, que dá `false` fora do Android ou sem biometria cadastrada;
  - `autenticarBiometria(motivo: string): Promise<boolean>`.

- [ ] **Step 1: Dependências.** Instale (`npm install @tauri-apps/plugin-biometric@2`; fixe a versão exata no `package.json`) e acrescente a crate e o plugin no Rust, como em **Files**.

- [ ] **Step 2: `src/data/biometria.ts`:**
```ts
// Biometria (digital/rosto) para abrir o app no celular. Só no app Android; no resto devolve "indisponível".
import { EM_TAURI } from './tempo';

const noCelular = () => EM_TAURI && /Android/i.test(navigator.userAgent);

export async function biometriaDisponivel(): Promise<boolean> {
  if (!noCelular()) return false;
  try {
    const { checkStatus } = await import('@tauri-apps/plugin-biometric');
    return (await checkStatus()).isAvailable;
  } catch {
    return false;
  }
}

/** true se a pessoa confirmou; false se cancelou ou falhou (o PIN continua valendo). */
export async function autenticarBiometria(motivo: string): Promise<boolean> {
  try {
    const { authenticate } = await import('@tauri-apps/plugin-biometric');
    await authenticate(motivo, { allowDeviceCredential: false, cancelTitle: 'Usar PIN' });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Tela de desbloqueio** (`src/mobile/Config.tsx`, componente com o teclado de PIN, linha ~156 `const biometria = MODO_EXEMPLO && state.config.biometria;`).
  - No modo real: `biometria = state.config.biometria && disponivel`, onde `disponivel` vem de `biometriaDisponivel()` num `useEffect`.
  - Ao montar com biometria ligada e disponível, chame `autenticarBiometria('Abrir o Prontuário de Casa')` uma vez. Se der `true`, `api.bloquear(false)`.
  - O botão "Biometria" do teclado chama de novo.
  - No modo exemplo, o comportamento atual continua igual.
  - Na configuração, a linha "Abrir com biometria" fica desabilitada, com texto "Indisponível neste aparelho", quando `biometriaDisponivel()` é `false` no modo real.

- [ ] **Step 4: Verificar.**
  - `npx vitest run`, `npm run build` e `cargo test` passam.
  - O APK compila.
  - Commit `git commit -m "Android: abrir com biometria"`.

---

### Task 4: Família no celular

**Files:**
- Modify: `src/mobile/Onboarding.tsx` (`BoasVindas`: link "Entrar na família" ao lado de "Restaurar um backup")
- Modify: `src/mobile/Config.tsx` (tela de Privacidade do celular: o card de família)
- Modify: `src/ui/Familia.tsx` (`CardFamilia` e as folhas aceitam `desktop?: boolean` e repassam para `Folha`; o card tem layout que caiba em 390 px)
- Modify: `src/ui/Familia.tsx` (`ProtejaEsteAparelho` e `QuemEVoce` com classes que funcionem no celular, não só `pu`)

**Interfaces:**
- Consumes: `CardFamilia`, `EntrarNaFamilia({ desktop, onClose })`, `QuemEVoce`, `ProtejaEsteAparelho` (já existem).

- [ ] **Step 1:** Em `BoasVindas` (celular), acrescente o link "Entrar na família", que abre `<EntrarNaFamilia onClose=… />` sem `desktop`. Use o mesmo padrão do botão "Restaurar um backup" que já existe ali.
- [ ] **Step 2:** Na tela de Privacidade do celular (`src/mobile/Config.tsx`, onde estão bloqueio/backup), acrescente uma seção "Família e aparelhos" com `<CardFamilia />`.
  - O card e as folhas usam `Folha` sem `desktop` no celular: acrescente uma prop `desktop` ao `CardFamilia` e passe-a adiante.
  - Botões com 44 px de altura mínima (`btn--h50` no celular).
  - Use `npm run dev` e o layout "Celular" da barra Telas para conferir em 390 px.
- [ ] **Step 3:** `QuemEVoce` e `ProtejaEsteAparelho` precisam ficar bons em 390 px (a lista em largura total, com 16 px de margem). Confira no navegador com a largura do celular. Para ver a tela, use `?persistir=1` com um log que tenha pessoas e nenhuma identidade, como na verificação da Etapa 1.
- [ ] **Step 4:** `npx vitest run` e `npm run build`; confira no navegador em 390 px; commit `git commit -m "Família no celular: entrar, card e Quem é você?"`.

---

### Task 5: APK assinado no release

**Files:**
- Modify: `src-tauri/gen/android/app/build.gradle.kts` (`signingConfigs.release` lendo `keystore.properties` ou variáveis de ambiente)
- Modify: `src-tauri/gen/android/.gitignore` (ignorar `keystore.properties` e `*.jks`)
- Modify: `.github/workflows/release.yml` (job `android`)
- Create: `scripts/android-chave.mjs`, que gera o keystore local uma vez e imprime o que cadastrar como segredo
- Modify: `README.md` ("Publicar uma versão": segredos do Android)

**Interfaces:**
- Produces:
  - **segredos do GitHub:** `ANDROID_KEYSTORE_B64` (keystore em base64), `ANDROID_KEYSTORE_SENHA`;
  - **asset do release:** `Prontuario.de.Casa_<versão>_android.apk` + `.sha256`.

- [ ] **Step 1: Gradle.** Em `build.gradle.kts`, antes de `buildTypes`:
```kotlin
    signingConfigs {
        create("release") {
            val props = Properties().apply {
                val f = rootProject.file("keystore.properties")
                if (f.exists()) f.inputStream().use { load(it) }
            }
            val arquivo = System.getenv("ANDROID_KEYSTORE_PATH") ?: props.getProperty("storeFile")
            val senha = System.getenv("ANDROID_KEYSTORE_SENHA") ?: props.getProperty("password")
            if (arquivo != null && senha != null) {
                storeFile = file(arquivo)
                storePassword = senha
                keyAlias = "prontuario"
                keyPassword = senha
            }
        }
    }
```
  No `getByName("release")`, acrescente a linha abaixo. Sem a chave, o release continua sem assinatura, como hoje.
```kotlin
            signingConfigs.getByName("release").takeIf { it.storeFile != null }?.let { signingConfig = it }
```

- [ ] **Step 2: `scripts/android-chave.mjs`:**
  - Se `~/.tauri/prontuario-android.jks` não existir, gera com o `keytool` do `JAVA_HOME`:
    - `keytool -genkeypair -v -keystore <arq> -alias prontuario -keyalg RSA -keysize 4096 -validity 10000 -storepass <senha> -keypass <senha> -dname "CN=Prontuario de Casa"`;
    - a senha é aleatória (`crypto.randomBytes(24).toString('base64url')`) e fica em `~/.tauri/prontuario-android.senha`.
  - Escreve `src-tauri/gen/android/keystore.properties` (ignorado pelo git) com `storeFile=<caminho>` e `password=<senha>`.
  - Imprime os **dois comandos PowerShell** que o usuário roda para cadastrar os segredos:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.tauri\prontuario-android.jks")) | gh secret set ANDROID_KEYSTORE_B64 --repo lucaslsm8/prontuario-de-casa
Get-Content -Raw "$env:USERPROFILE\.tauri\prontuario-android.senha" | gh secret set ANDROID_KEYSTORE_SENHA --repo lucaslsm8/prontuario-de-casa
```
  - Acrescente `"android:chave": "node scripts/android-chave.mjs"` ao `package.json`.
  - Não rode o script na tarefa: o controlador roda junto com o usuário.

- [ ] **Step 3: Workflow.** Em `.github/workflows/release.yml`, novo job `android` (`runs-on: ubuntu-latest`, `needs: []`) com os passos:
  1. checkout;
  2. setup-node 20 com cache npm;
  3. `actions/setup-java@v4` (temurin 17);
  4. `dtolnay/rust-toolchain@stable` com `targets: aarch64-linux-android,armv7-linux-androideabi,i686-linux-android,x86_64-linux-android`;
  5. `npm ci`;
  6. NDK com `sdkmanager "ndk;28.2.13676358"` e `NDK_HOME=$ANDROID_HOME/ndk/28.2.13676358`; o runner já tem `ANDROID_HOME`;
  7. decodificar `ANDROID_KEYSTORE_B64` para `$RUNNER_TEMP/prontuario.jks` e exportar `ANDROID_KEYSTORE_PATH` e `ANDROID_KEYSTORE_SENHA`;
  8. `npx tauri android build --apk` (universal, release);
  9. renomear o APK `app-universal-release.apk` para `Prontuario.de.Casa_${VERSAO}_android.apk` e gerar o `.sha256`; `VERSAO` vem de `github.ref_name` sem o `v`;
  10. esperar o release existir. O job `windows` cria o rascunho, então o `android` usa `needs: windows`;
  11. `gh release upload ${{ github.ref_name }} <apk> <apk>.sha256 --clobber` com `GITHUB_TOKEN`.

- [ ] **Step 4: Verificar localmente** que o build release sem chave continua funcionando: `npx tauri android build --apk --target aarch64` (sem `--debug`) termina. O APK sai sem assinatura, o que é esperado sem a chave. Commit `git commit -m "Android: assinatura do APK e job no release"`.

- [ ] **Step 5: README:** subseção "Android" em "Publicar uma versão":
  - rodar `npm run android:chave` uma vez;
  - cadastrar os dois segredos;
  - o APK aparece no mesmo release;
  - **guardar** `~/.tauri/prontuario-android.jks` e a senha: sem eles, o Android não aceita atualizar o app instalado.

---

### Task 6: Verificação no celular (controlador + usuário)

- [ ] `npm run android:chave` e o cadastro dos segredos (o usuário roda os comandos PowerShell).
- [ ] Build local do APK release assinado: `npx tauri android build --apk`.
- [ ] Instalar no celular do usuário, por `adb install` com depuração USB ou copiando o APK.
- [ ] Conferir:
  1. abre com o nome e o ícone certos;
  2. o primeiro uso no celular funciona;
  3. o PIN funciona;
  4. a biometria funciona;
  5. a área segura não corta o topo;
  6. a tecla voltar volta;
  7. "Entrar na família" com um convite do desktop baixa os dados e mostra "Quem é você?".
- [ ] Versão 0.5.0: subir a versão, escrever as notas, criar a tag e conferir que o release tem o `.exe` e o `.apk`.

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

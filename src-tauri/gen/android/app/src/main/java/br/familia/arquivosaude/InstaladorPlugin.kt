package br.familia.arquivosaude

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class ArgsInstalar {
    var caminho: String = ""
}

/**
 * Atualização do APK: entrega o arquivo baixado (no cache do app) ao instalador do Android por um
 * FileProvider. Sem a permissão "instalar apps desconhecidos" para este app, abre a tela de
 * configurações dela e devolve estado "permissao"; com ela, devolve "aberto".
 */
@TauriPlugin
class InstaladorPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun instalar(invoke: Invoke) {
        val args = invoke.parseArgs(ArgsInstalar::class.java)
        try {
            val r = JSObject()
            if (!activity.packageManager.canRequestPackageInstalls()) {
                val config = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.packageName))
                activity.startActivity(config)
                r.put("estado", "permissao")
                invoke.resolve(r)
                return
            }
            val arquivo = File(args.caminho)
            if (!arquivo.isFile) {
                invoke.reject("arquivo não encontrado")
                return
            }
            val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", arquivo)
            val intent = Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            activity.startActivity(intent)
            r.put("estado", "aberto")
            invoke.resolve(r)
        } catch (e: Exception) {
            invoke.reject(e.message ?: "não foi possível abrir o instalador")
        }
    }
}

package br.familia.arquivosaude

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/**
 * Tomei / Pular tocados com o app fechado: o tauri-plugin-notification (2.8.0) lê a Intent de abertura no
 * `load` e dispara `actionPerformed` antes de o JS registrar o listener, e a ação se perde. A Intent continua
 * na Activity com os extras que o plugin põe em `buildIntent` (TauriNotificationManager.kt); aqui o front
 * lê essa ação uma vez, na montagem dos lembretes. Os extras saem da Intent depois de lidos, para a mesma
 * ação não voltar numa recarga do WebView ou ao girar a tela.
 */
@TauriPlugin
class LembretePlugin(private val activity: Activity) : Plugin(activity) {
    private companion object {
        // Mesmos nomes do TauriNotificationManager.kt (inclusive o "Notfication" com erro de grafia).
        const val ID = "NotificationId"
        const val ACAO = "NotificationUserAction"
        const val OBJETO = "LocalNotficationObject"
    }

    @Command
    fun acaoPendente(invoke: Invoke) {
        val r = JSObject()
        try {
            val intent = activity.intent
            if (intent != null && intent.getIntExtra(ID, Int.MIN_VALUE) != Int.MIN_VALUE) {
                r.put("actionId", intent.getStringExtra(ACAO))
                intent.getStringExtra(OBJETO)?.let { r.put("notification", JSObject(it)) }
                intent.removeExtra(ID)
                intent.removeExtra(ACAO)
                intent.removeExtra(OBJETO)
            }
        } catch (_: Exception) {
            // Extras ilegíveis: sem ação pendente.
        }
        invoke.resolve(r)
    }
}

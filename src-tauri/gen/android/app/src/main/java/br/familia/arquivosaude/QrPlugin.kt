package br.familia.arquivosaude

import android.app.Activity
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanIntentResult
import com.journeyapps.barcodescanner.ScanOptions

/**
 * Leitor do QR do convite da família (ZXing, offline). A câmera abre numa tela própria (CaptureActivity),
 * que pede a permissão de câmera sozinha; o WebView não fica transparente nem disputa a câmera.
 * Responde `{ conteudo }` (ausente = cancelou).
 */
@TauriPlugin
class QrPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun ler(invoke: Invoke) {
        val opcoes = ScanOptions()
            .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            .setPrompt("Aponte para o QR do convite")
            .setBeepEnabled(false)
            .setOrientationLocked(false)
        startActivityForResult(invoke, ScanContract().createIntent(activity, opcoes), "lido")
    }

    @ActivityCallback
    private fun lido(invoke: Invoke, result: ActivityResult) {
        val r = JSObject()
        try {
            ScanIntentResult.parseActivityResult(result.resultCode, result.data).contents?.let { r.put("conteudo", it) }
        } catch (_: Exception) {
            // Resultado ilegível conta como cancelado.
        }
        invoke.resolve(r)
    }
}

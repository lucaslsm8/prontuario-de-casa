package br.familia.arquivosaude

import android.Manifest
import android.app.Activity
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import app.tauri.PermissionState
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class ArgsRedeAtual {
    var pedir: Boolean = false
}

/**
 * Rede de casa: BSSID e SSID do Wi-Fi atual. O Android só entrega com a permissão de localização
 * (pedida só quando a pessoa toca "Esta é a rede de casa"); sem ela, volta vazio ou 02:00:00:00:00:00,
 * que o Rust trata como "indisponível". Desde o Android 12, pedir FINE exige pedir COARSE junto.
 */
@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION], alias = "localizacao")
    ]
)
class RedePlugin(private val activity: Activity) : Plugin(activity) {
    private val alias = "localizacao"

    @Command
    fun atual(invoke: Invoke) {
        val args = invoke.parseArgs(ArgsRedeAtual::class.java)
        if (args.pedir && getPermissionState(alias) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias, invoke, "depoisDaPermissao")
            return
        }
        responder(invoke)
    }

    @PermissionCallback
    private fun depoisDaPermissao(invoke: Invoke) {
        responder(invoke)
    }

    private fun responder(invoke: Invoke) {
        val r = JSObject()
        try {
            if (getPermissionState(alias) == PermissionState.GRANTED && noWifi()) {
                val wifi = activity.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                // connectionInfo está obsoleto desde a API 31, mas segue entregando BSSID/SSID com a
                // permissão de localização; a alternativa exige um NetworkCallback assíncrono.
                @Suppress("DEPRECATION")
                val info = wifi.connectionInfo
                info?.bssid?.let { r.put("bssid", it) }
                info?.ssid?.let { r.put("ssid", it) }
            }
        } catch (_: Exception) {
            // Qualquer falha conta como "rede indisponível".
        }
        invoke.resolve(r)
    }

    private fun noWifi(): Boolean {
        val cm = activity.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork ?: return false) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }
}

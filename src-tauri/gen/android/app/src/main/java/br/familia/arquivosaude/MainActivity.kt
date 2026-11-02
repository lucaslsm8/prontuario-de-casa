package br.familia.arquivosaude

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  // O TauriActivity desliga a tecla voltar do WebView; ligamos de novo: volta no histórico
  // (HashRouter) e, sem histórico, sai do app.
  override val handleBackNavigation: Boolean = true

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}

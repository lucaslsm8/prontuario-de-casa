package br.familia.arquivosaude

import android.Manifest
import android.app.Activity
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.provider.CalendarContract
import app.tauri.PermissionState
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.TimeZone

@InvokeArg
class EventoAgenda {
    lateinit var chave: String
    lateinit var titulo: String
    var inicio: Long = 0
    var fim: Long = 0
    var local: String? = null
    var descricao: String? = null
}

@InvokeArg
class ArgsSincronizar {
    var calendarioId: Long = 0
    var eventos: Array<EventoAgenda> = arrayOf()
}

/**
 * Consultas na agenda do celular (CalendarContract): a mesma agenda que o Google Agenda sincroniza.
 * Guarda só "chave da consulta → id do evento" nas preferências do app (nada de saúde); cada sincronização
 * cria, atualiza e apaga os eventos para bater com a lista recebida. Trocar de agenda apaga os eventos da anterior.
 */
@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR], alias = "agenda")
    ]
)
class AgendaPlugin(private val activity: Activity) : Plugin(activity) {
    private val alias = "agenda"
    private val prefs by lazy { activity.getSharedPreferences("agenda_consultas", Context.MODE_PRIVATE) }

    private fun permitido() = getPermissionState(alias) == PermissionState.GRANTED

    /** Agendas em que dá para escrever. Pede a permissão se faltar. */
    @Command
    fun calendarios(invoke: Invoke) {
        if (!permitido()) {
            requestPermissionForAlias(alias, invoke, "depoisDaPermissao")
            return
        }
        listar(invoke)
    }

    @PermissionCallback
    private fun depoisDaPermissao(invoke: Invoke) {
        if (!permitido()) {
            invoke.reject("Sem permissão de agenda")
            return
        }
        listar(invoke)
    }

    private fun listar(invoke: Invoke) {
        val lista = JSArray()
        val campos = arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.IS_PRIMARY,
        )
        val filtro = "${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ${CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR} AND ${CalendarContract.Calendars.VISIBLE} = 1"
        activity.contentResolver.query(CalendarContract.Calendars.CONTENT_URI, campos, filtro, null, null)?.use { c ->
            while (c.moveToNext()) {
                val o = JSObject()
                o.put("id", c.getLong(0))
                o.put("nome", c.getString(1) ?: "Agenda")
                o.put("conta", c.getString(2) ?: "")
                o.put("principal", c.getInt(3) == 1)
                lista.put(o)
            }
        }
        val r = JSObject()
        r.put("calendarios", lista)
        invoke.resolve(r)
    }

    @Command
    fun sincronizar(invoke: Invoke) {
        val args = invoke.parseArgs(ArgsSincronizar::class.java)
        if (!permitido()) {
            invoke.reject("Sem permissão de agenda")
            return
        }
        val cr = activity.contentResolver
        val ed = prefs.edit()
        val anterior = prefs.getLong("calendario", -1L)
        // Trocou de agenda (ou desligou com 0): tira tudo o que foi posto na anterior.
        if (anterior != args.calendarioId) {
            for ((k, v) in prefs.all) if (k.startsWith("ev:")) apagar((v as? Long) ?: continue)
            for (k in prefs.all.keys) if (k.startsWith("ev:")) ed.remove(k)
            ed.putLong("calendario", args.calendarioId)
            ed.apply()
        }
        if (args.calendarioId <= 0L) {
            invoke.resolve(JSObject())
            return
        }
        val ed2 = prefs.edit()
        val vistas = HashSet<String>()
        var criados = 0
        for (e in args.eventos) {
            vistas.add(e.chave)
            val v = ContentValues().apply {
                put(CalendarContract.Events.CALENDAR_ID, args.calendarioId)
                put(CalendarContract.Events.TITLE, e.titulo)
                put(CalendarContract.Events.DTSTART, e.inicio)
                put(CalendarContract.Events.DTEND, e.fim)
                put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
                put(CalendarContract.Events.EVENT_LOCATION, e.local ?: "")
                put(CalendarContract.Events.DESCRIPTION, e.descricao ?: "")
            }
            val id = prefs.getLong("ev:${e.chave}", -1L)
            val atualizou = id > 0 && try {
                cr.update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id), v, null, null) > 0
            } catch (_: Exception) { false }
            if (!atualizou) {
                val uri = try { cr.insert(CalendarContract.Events.CONTENT_URI, v) } catch (_: Exception) { null }
                uri?.lastPathSegment?.toLongOrNull()?.let { ed2.putLong("ev:${e.chave}", it); criados++ }
            }
        }
        // Consultas que saíram da lista (apagadas, passaram de outra pessoa): o evento sai da agenda.
        var apagados = 0
        for ((k, v) in prefs.all) {
            if (!k.startsWith("ev:") || k.removePrefix("ev:") in vistas) continue
            apagar((v as? Long) ?: continue)
            ed2.remove(k)
            apagados++
        }
        ed2.apply()
        val r = JSObject()
        r.put("criados", criados)
        r.put("apagados", apagados)
        invoke.resolve(r)
    }

    private fun apagar(id: Long) {
        try {
            activity.contentResolver.delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id), null, null)
        } catch (_: Exception) {
            // Evento já apagado pela pessoa na agenda: nada a fazer.
        }
    }
}

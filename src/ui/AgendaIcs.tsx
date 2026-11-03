// Importar convites (.ics do Google Agenda, Outlook, e-mail de confirmação) e exportar a agenda.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { eu, paraConsultas, podeVer, useStore } from '../data/store';
import { gerarIcs, lerIcs, type EventoIcs } from '../data/ics';
import { exportarTexto } from '../data/anexos';
import { dataBR, quem } from '../data/format';
import { HOJE } from '../data/tempo';
import { novoId } from '../data/persistencia';
import { Chip, cx } from './index';
import { atualizarAgenda, useInfoAgenda } from '../data/agendaConectada';

export function AgendaIcs({ compacto }: { compacto?: boolean }) {
  const { state, api } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [lidos, setLidos] = useState<(EventoIcs & { ok: boolean })[] | null>(null);
  const [para, setPara] = useState(eu(state).id);
  const pessoas = paraConsultas(state);
  const me = eu(state).id;

  const exportar = async () => {
    const futuras = state.consultas.filter((c) => c.data >= HOJE && (c.pessoaId === me || podeVer(state, c.pessoaId, 'consultas')));
    if (!futuras.length) { api.toast({ texto: 'Nenhuma consulta marcada para exportar.' }); return; }
    const nome = (id: string) => quem(state.pessoas.find((p) => p.id === id));
    try {
      if (await exportarTexto('agenda-familia.ics', 'text/calendar', gerarIcs(futuras, nome))) api.toast({ texto: `${futuras.length} consultas exportadas` });
    } catch { api.toast({ texto: 'Não foi possível exportar.' }); }
  };
  const ler = async (f?: File) => {
    if (!f) return;
    const evs = lerIcs(await f.text());
    if (!evs.length) { api.toast({ texto: 'Nenhum evento encontrado nesse arquivo.' }); return; }
    // Só o que ainda vai acontecer vem marcado.
    setLidos(evs.map((e) => ({ ...e, ok: e.data >= HOJE })));
  };
  const importar = () => {
    const escolhidos = (lidos ?? []).filter((e) => e.ok);
    for (const e of escolhidos) {
      const id = e.uid ? `ics-${e.uid.replace(/[^\w-]/g, '').slice(0, 40)}` : `c-${novoId()}`;
      if (state.consultas.some((c) => c.id === id)) continue;
      api.addConsulta({ id, tipo: 'consulta', pessoaId: para, titulo: e.titulo, local: e.local, profissional: e.descricao?.split('\n')[0]?.slice(0, 80), data: e.data, hora: e.hora, duracaoMin: 30, levar: [], lembretes: ['1 dia antes'] });
    }
    api.toast({ texto: `${escolhidos.length} ${escolhidos.length === 1 ? 'consulta importada' : 'consultas importadas'}` });
    setLidos(null);
  };

  return (
    <>
      <AgendaConectada compacto={compacto} />
      <button type="button" className={cx('btn btn--outline', compacto ? 'btn--h40' : 'btn--h38')} onClick={() => input.current?.click()}>Importar .ics</button>
      <button type="button" className={cx('btn btn--outline', compacto ? 'btn--h40' : 'btn--h38')} onClick={exportar}>Exportar .ics</button>
      <input ref={input} type="file" accept=".ics,text/calendar" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void ler(f); }} />
      {lidos && createPortal(
        <div className="overlay overlay--fixed overlay--top" onMouseDown={(e) => { if (e.target === e.currentTarget) setLidos(null); }}>
          <div className="dlg" role="dialog" aria-modal="true" aria-label="Importar agenda" style={{ width: 520 }}>
            <div className="dlg__head"><h2 className="dlg__title">Importar {lidos.length} {lidos.length === 1 ? 'evento' : 'eventos'}</h2></div>
            <div className="dlg__body stack" style={{ gap: 12 }}>
              <span className="field__label">De quem são</span>
              <div className="chips">{pessoas.map((p) => <Chip key={p.id} ativo={para === p.id} onClick={() => setPara(p.id)}>{quem(p)}</Chip>)}</div>
              <div className="dlista">
                {lidos.map((e, i) => (
                  <button key={i} type="button" className="dlista__item" role="checkbox" aria-checked={e.ok} onClick={() => setLidos(lidos.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)))}>
                    <span className="dlista__check">{e.ok ? '✓' : ''}</span>
                    <span className="stack" style={{ flex: 1, minWidth: 0, padding: '6px 0' }}>
                      <span style={{ fontWeight: 600 }}>{e.titulo}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{dataBR(e.data)} às {e.hora}{e.local ? ` · ${e.local}` : ''}{e.data < HOJE ? ' · já passou' : ''}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="dlg__foot">
              <button type="button" className="btn btn--outline btn--h40d" onClick={() => setLidos(null)}>Cancelar</button>
              <button type="button" className="btn btn--teal btn--h40d" disabled={!lidos.some((e) => e.ok)} onClick={importar}>Importar</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** "Conectar Google Agenda" (cola o endereço iCal) ou, conectada, "Atualizar" e o estado. */
export function AgendaConectada({ compacto }: { compacto?: boolean }) {
  const store = useStore();
  const { state, api } = store;
  const info = useInfoAgenda();
  const ag = state.config.agenda;
  const [aberto, setAberto] = useState(false);
  const [url, setUrl] = useState(ag?.url ?? '');
  const [para, setPara] = useState(ag?.pessoaId ?? eu(state).id);
  const tam = compacto ? 'btn--h40' : 'btn--h38';
  const valido = /^https:\/\/\S+$/.test(url.trim());
  const salvar = () => {
    api.setConfig({ agenda: { url: url.trim(), pessoaId: para } });
    setAberto(false);
    // O estado novo chega no próximo render; atualiza logo em seguida.
    setTimeout(() => void atualizarAgenda({ state: { ...state, config: { ...state.config, agenda: { url: url.trim(), pessoaId: para } } }, api }), 0);
  };
  return (
    <>
      {ag ? (
        <>
          <button type="button" className={cx('btn btn--soft', tam)} disabled={info.atualizando} onClick={() => void atualizarAgenda(store)} title={info.erro ? `Último erro: ${info.erro}` : undefined}>
            {info.atualizando ? 'Atualizando…' : 'Atualizar agenda'}
          </button>
          <button type="button" className={cx('btn btn--link', tam)} style={{ fontSize: 13 }} onClick={() => setAberto(true)}>
            {info.erro ? 'Agenda com erro' : info.ultima ? `Google · ${info.ultima}` : 'Google conectado'}
          </button>
        </>
      ) : (
        <button type="button" className={cx('btn btn--outline', tam)} onClick={() => setAberto(true)}>Conectar Google Agenda</button>
      )}
      {aberto && createPortal(
        <div className="overlay overlay--fixed overlay--top" onMouseDown={(e) => { if (e.target === e.currentTarget) setAberto(false); }}>
          <div className="dlg" role="dialog" aria-modal="true" aria-label="Conectar agenda" style={{ width: 560 }}>
            <div className="dlg__head"><h2 className="dlg__title">{ag ? 'Agenda conectada' : 'Conectar Google Agenda'}</h2></div>
            <div className="dlg__body stack" style={{ gap: 14, fontSize: 14, lineHeight: 1.5 }}>
              <span className="muted">O app baixa a sua agenda ao abrir e quando você toca em “Atualizar”: consultas novas entram, mudanças de horário são aplicadas e o que foi cancelado sai. Nada é enviado ao Google.</span>
              <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)' }}>
                <li>No Google Agenda (computador), abra <b>Configurações</b> e escolha a agenda na lista à esquerda.</li>
                <li>Em <b>Integrar agenda</b>, copie o <b>Endereço secreto no formato iCal</b>.</li>
                <li>Cole aqui. Funciona também com o link .ics do Outlook.</li>
              </ol>
              <input className="input input--desk input--mono" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Endereço iCal" />
              <span className="field__label">As consultas são de</span>
              <div className="chips">{paraConsultas(state).map((p) => <Chip key={p.id} ativo={para === p.id} onClick={() => setPara(p.id)}>{quem(p)}</Chip>)}</div>
              <span className="muted" style={{ fontSize: 12 }}>O endereço fica guardado cifrado neste aparelho. Quem tiver esse endereço consegue ver sua agenda; não compartilhe.</span>
              {info.erro && <span style={{ color: 'var(--danger)', fontSize: 13 }}>Último erro: {info.erro}</span>}
            </div>
            <div className="dlg__foot" style={{ justifyContent: 'space-between' }}>
              {ag ? <button type="button" className="btn btn--danger-link btn--h40d" onClick={() => { api.setConfig({ agenda: null }); setAberto(false); api.toast({ texto: 'Agenda desconectada. As consultas importadas continuam.' }); }}>Desconectar</button> : <span />}
              <span className="hstack" style={{ gap: 8 }}>
                <button type="button" className="btn btn--outline btn--h40d" onClick={() => setAberto(false)}>Cancelar</button>
                <button type="button" className="btn btn--teal btn--h40d" disabled={!valido} onClick={salvar}>{ag ? 'Salvar e atualizar' : 'Conectar'}</button>
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

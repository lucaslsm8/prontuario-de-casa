import { AgendaCelular } from '../ui/AgendaCelular';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HOJE, MODO_EXEMPLO } from '../data/tempo';
import { autenticarBiometria, biometriaDisponivel } from '../data/biometria';
import { instalarAtualizacao, noCelular, useInfoAtualizacao, verificarAtualizacao } from '../data/atualizacao';
import { compartilhado, eu, podeVer, useStore } from '../data/store';
import { familia, pets } from '../data/pets';
import { exportarAnexo } from '../data/anexos';
import { nomeDoPdf, pdfDoPerfil } from '../data/relatorio';
import { CATEGORIAS, type Pessoa } from '../data/types';
import { dataLonga, quando, tamanhoArquivo } from '../data/format';
import { Folha, RestaurarBackup, SenhaApp, SenhaBackup } from '../ui/Backup';
import { CardFamilia } from '../ui/Familia';
import { RedesCasa } from '../ui/RedesCasa';
import { Avatar, Check, Label, Lock, Pill, Row, Segmented, Toggle, TopNav } from '../ui';
import { resumoCompartilhado } from './Familia';
import { MScreen } from './Shell';

const BLOQUEIO = ['30 segundos', '1 minuto', '5 minutos', '15 minutos'];

/** Hub de configurações (não desenhado; segue o padrão de lista das outras telas). */
export function Configuracoes() {
  const { state, api } = useStore();
  const nav = useNavigate();
  const [exportar, setExportar] = useState(false);
  // Aberta direto (sem histórico no app), "Voltar" leva ao Início.
  const voltar = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/', { replace: true }));
  return (
    <MScreen gap={16} tabs>
      <TopNav voltar="Voltar" onVoltar={voltar} />
      <h1 className="title" style={{ margin: 0 }}>Configurações</h1>
      <div className="card" style={{ fontSize: 15 }}>
        <Row mutedLabel={false} label="Família e compartilhamento" valor={<span className="faint">›</span>} onClick={() => nav('/familia')} />
        <Row mutedLabel={false} label="Privacidade e backup" valor={<span className="faint">›</span>} onClick={() => nav('/privacidade')} />
        <Row mutedLabel={false} label="Atualizações" valor={<span className="muted">{state.config.update.disponivel ? 'nova versão ›' : `${state.config.update.instalada} ›`}</span>} onClick={() => nav('/atualizacoes')} />
        <Row mutedLabel={false} label="Ficha de emergência" valor={<span className="faint">›</span>} onClick={() => nav(`/pessoa/${eu(state).id}/emergencia`)} />
        <Row
          mutedLabel={false}
          label={
            <span className="stack" style={{ gap: 2 }}>
              <span>Exportar perfil em PDF</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Tudo de uma pessoa, para levar a um profissional</span>
            </span>
          }
          valor={<span className="faint">›</span>}
          onClick={() => setExportar(true)}
        />
      </div>
      <Label>Menu inferior</Label>
      <Segmented opcoes={[{ id: 'texto', nome: 'Texto' }, { id: 'icones', nome: 'Ícones' }]} valor={state.config.menuIcones ? 'icones' : 'texto'} onChange={(v) => api.setConfig({ menuIcones: v === 'icones' })} />
      {exportar && <ExportarPdf onClose={() => setExportar(false)} />}
      <span style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Prontuário de Casa · versão {state.config.update.instalada}</span>
    </MScreen>
  );
}

/** Escolhe de quem é o PDF e salva. O arquivo sai do cofre sem criptografia (ação explícita da pessoa). */
export function ExportarPdf({ onClose, desktop }: { onClose: () => void; desktop?: boolean }) {
  const { state, api } = useStore();
  const [salvando, setSalvando] = useState(false);
  const me = eu(state);
  const lista = [...familia(state), ...pets(state)]
    .filter((p) => CATEGORIAS.some((c) => podeVer(state, p.id, c.id)))
    .sort((a, b) => Number(!!b.souEu) - Number(!!a.souEu));
  const salvar = async (p: Pessoa) => {
    setSalvando(true);
    try {
      const bytes = pdfDoPerfil(state, p, (c) => podeVer(state, p.id, c), HOJE);
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      const nome = nomeDoPdf(p, HOJE);
      const ok = await exportarAnexo({ id: 'pdf-perfil', donoId: p.id, tipo: 'exame', nome, mime: 'application/pdf', dados: `data:application/pdf;base64,${btoa(bin)}`, tamanho: bytes.length, em: '' });
      if (ok) { api.toast({ texto: `PDF de ${p.id === me.id ? 'você' : p.curto} salvo` }); onClose(); }
    } catch {
      api.toast({ texto: 'Não foi possível salvar o PDF.' });
    }
    setSalvando(false);
  };
  return (
    <Folha titulo="Exportar perfil em PDF" onClose={onClose} desktop={desktop}>
      <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-2)' }}>
        Dados pessoais, alergias, vacinas, remédios, consultas, exames e plano, no que a pessoa compartilha com você. O arquivo sai do aparelho sem senha: guarde com cuidado.
      </span>
      <div className="stack" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        {lista.map((p) => (
          <button key={p.id} type="button" className="row" disabled={salvando} style={{ gap: 12, padding: '10px 4px', justifyContent: 'flex-start', minHeight: 56, textAlign: 'left' }} onClick={() => void salvar(p)}>
            <Avatar pessoa={p} size={40} font={15} />
            <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{p.souEu ? `${p.curto} (você)` : p.curto}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)' }}>{salvando ? '…' : 'Salvar PDF'}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--outline btn--h50" onClick={onClose}>Cancelar</button>
    </Folha>
  );
}

/** M10 — Privacidade, backup e compartilhamento. */
export function Privacidade() {
  const { state, api } = useStore();
  const nav = useNavigate();
  const c = state.config;
  const me = eu(state);
  const [params] = useSearchParams();
  const [apagar, setApagar] = useState(false);
  const [bioOk, setBioOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (!MODO_EXEMPLO) biometriaDisponivel().then(setBioOk);
  }, []);
  const [palavra, setPalavra] = useState('');
  const [folha, setFolha] = useState<null | 'senha' | 'restaurar' | 'pin'>(params.get('restaurar') ? 'restaurar' : null);
  // Pets ficam fora do compartilhamento.
  const outros = familia(state).filter((p) => !p.souEu && compartilhado(state, p.id, me.id).length > 0);
  const b = c.backup;

  const backupAgora = () => (b.temSenha ? api.backupAgora() : setFolha('senha'));

  return (
    <MScreen gap={16} tabs>
      <TopNav voltar="Configurações" voltarPara="/configuracoes" />
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="title" style={{ margin: 0 }}>Privacidade</h1>
        <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>Seus dados ficam só neste aparelho. Nada é enviado para servidores. Para não perder nada, faça backups.</span>
      </div>
      <div className="card" style={{ fontSize: 15 }}>
        {MODO_EXEMPLO ? (
          <Row mutedLabel={false} label="Abrir com biometria" valor={<Toggle on={c.biometria} onChange={(v) => api.setConfig({ biometria: v })} label="Abrir com biometria" />} />
        ) : (
          <>
            <Row
              mutedLabel={false}
              label="Abrir com biometria"
              valor={bioOk === false ? <span className="muted">Indisponível neste aparelho</span> : <Toggle on={c.biometria && bioOk === true} onChange={(v) => api.setConfig({ biometria: v })} label="Abrir com biometria" />}
            />
            <Row mutedLabel={false} label="PIN de desbloqueio" onClick={() => setFolha('pin')} valor={<span className="muted">{state.temSenha ? 'trocar' : 'criar'} ›</span>} />
          </>
        )}
        <Row
          mutedLabel={false}
          label="Bloquear após"
          onClick={() => api.setConfig({ bloqueioMobile: BLOQUEIO[(BLOQUEIO.indexOf(c.bloqueioMobile) + 1) % BLOQUEIO.length] })}
          valor={<span className="muted">{c.bloqueioMobile} ›</span>}
        />
        <RedesCasa />
        <AgendaCelular />
        <Row
          mutedLabel={false}
          label={
            <span className="stack" style={{ gap: 2 }}>
              <span>Esconder nome do remédio</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Nas notificações aparece “Hora do remédio”</span>
            </span>
          }
          valor={<Toggle on={c.esconderNomeNotif} onChange={(v) => api.setConfig({ esconderNomeNotif: v })} label="Esconder nome do remédio" />}
        />
      </div>

      <Label>Backup criptografado</Label>
      <div className="card card--pad" style={{ gap: 12 }}>
        <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{b.ultimo ? `Último backup: ${quando(b.ultimo)}` : 'Nenhum backup ainda'}</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {b.temSenha ? `Arquivo protegido por senha${b.tamanho ? ` · ${tamanhoArquivo(b.tamanho)}` : ''}` : 'Crie uma senha para o primeiro backup'}
            </span>
          </div>
          <button type="button" onClick={() => api.configurarBackup({ freq: b.freq === 'semanal' ? 'manual' : 'semanal' })} aria-label="Mudar frequência do backup">
            <Pill>{b.freq === 'semanal' ? 'Semanal' : 'Manual'}</Pill>
          </button>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button type="button" className="btn btn--ink btn--h42 btn--grow" onClick={backupAgora}>Fazer agora</button>
          <button type="button" className="btn btn--outline btn--h42 btn--grow" style={{ background: 'transparent' }} onClick={() => setFolha('restaurar')}>Restaurar</button>
        </div>
      </div>

      <CardFamilia />

      {outros.length > 0 && (
        <>
          <Label>Compartilhado com você</Label>
          <div className="card">
            {outros.map((p) => (
              <button type="button" key={p.id} className="row" style={{ padding: '12px 16px', gap: 12, justifyContent: 'flex-start' }} onClick={() => nav(`/pessoa/${p.id}`)}>
                <Avatar pessoa={p} size={32} font={13} />
                <span className="stack" style={{ flex: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{p.curto}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{resumoCompartilhado(compartilhado(state, p.id, me.id))}</span>
                </span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className="btn btn--danger-link" style={{ fontSize: 14, padding: '4px 0', minHeight: 44 }} onClick={() => setApagar(true)}>
        Apagar todos os dados deste aparelho
      </button>

      {apagar && (
        <>
          <div className="overlay" onClick={() => setApagar(false)} />
          <div className="sheet" role="alertdialog" aria-label="Apagar todos os dados">
            <span style={{ fontSize: 18, fontWeight: 600 }}>Apagar tudo deste aparelho?</span>
            <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-2)' }}>
              Remédios, consultas, exames e planos somem deste aparelho. O que foi compartilhado com outras pessoas continua com elas. Para confirmar, digite <b>APAGAR</b>.
            </span>
            <input className="input" value={palavra} onChange={(e) => setPalavra(e.target.value)} placeholder="APAGAR" autoFocus aria-label="Palavra de confirmação" />
            <button
              type="button"
              className="btn btn--h50"
              style={{ background: 'var(--danger)', color: '#fff' }}
              disabled={palavra.trim().toUpperCase() !== 'APAGAR'}
              onClick={async () => { await api.apagarTudo(); nav('/', { replace: true }); }}
            >
              Apagar todos os dados
            </button>
            <button type="button" className="btn btn--outline btn--h50" onClick={() => setApagar(false)}>Cancelar</button>
          </div>
        </>
      )}
      {folha === 'senha' && <SenhaBackup fazerBackup onClose={() => setFolha(null)} />}
      {folha === 'restaurar' && <RestaurarBackup onClose={() => setFolha(null)} />}
      {folha === 'pin' && <SenhaApp onClose={() => setFolha(null)} />}
    </MScreen>
  );
}

/** M11 — Desbloqueio. */
export function Desbloqueio() {
  const { state, api } = useStore();
  const nav = useNavigate();
  const [pin, setPin] = useState('');
  const [errou, setErrou] = useState(false);
  const tecla = { height: 72, borderRadius: '50%', background: 'var(--ink-2)', display: 'grid', placeItems: 'center' } as const;
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => {
    if (!MODO_EXEMPLO) biometriaDisponivel().then(setBioOk);
  }, []);
  const biometria = MODO_EXEMPLO ? state.config.biometria : state.config.biometria && bioOk;
  const tentarBiometria = () => {
    autenticarBiometria('Abrir o Prontuário de Casa').then((ok) => { if (ok) api.bloquear(false); });
  };
  // Ao abrir a tela, pede a biometria uma vez (o PIN continua valendo).
  useEffect(() => {
    if (!MODO_EXEMPLO && biometria) tentarBiometria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometria]);

  useEffect(() => {
    if (pin.length !== 6) return;
    const tentativa = pin;
    api.desbloquear(tentativa).then((ok) => {
      // Só limpa se a pessoa não começou a digitar de novo enquanto conferia.
      setPin((atual) => (atual === tentativa ? '' : atual));
      if (!ok) setErrou(true);
    });
  }, [pin, api]);

  return (
    <MScreen bg="var(--ink)" pad="0 32px 48px" gap={28} style={{ color: '#fff', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }} statusStyle={{ color: '#fff' }}>
      <span style={{ width: 72, height: 72, borderRadius: 10, background: 'var(--teal)', display: 'grid', placeItems: 'center', color: '#fff' }}>
        <Lock large />
      </span>
      <div className="stack" style={{ gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 600 }}>Prontuário de Casa</span>
        <span style={{ fontSize: 15, color: 'var(--tab-inactive)' }}>{errou ? 'PIN incorreto. Tente de novo.' : biometria ? 'Use a biometria para abrir' : 'Digite seu PIN'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,14px)', gap: 14 }} aria-label={`${pin.length} de 6 dígitos`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? '#fff' : undefined, border: i < pin.length ? undefined : '1.5px solid var(--text-2)', transition: 'background 120ms' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,72px)', gap: '16px 28px', fontSize: 28, fontWeight: 500 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <button type="button" key={n} style={tecla} onClick={() => { setErrou(false); setPin((p) => (p.length < 6 ? p + n : n)); }}>{n}</button>
        ))}
        <button type="button" style={{ height: 72, fontSize: 13, color: 'var(--teal-on-dark)' }} onClick={MODO_EXEMPLO ? () => api.bloquear(false) : tentarBiometria} disabled={!biometria}>
          {biometria ? 'Biometria' : ''}
        </button>
        <button type="button" style={tecla} onClick={() => { setErrou(false); setPin((p) => (p.length < 6 ? p + '0' : '0')); }}>0</button>
        <button type="button" style={{ height: 72, fontSize: 13, color: 'var(--tab-inactive)' }} onClick={() => setPin((p) => p.slice(0, -1))}>Apagar</button>
      </div>
      {state.config.fichaSemDesbloqueio && (
        <button type="button" style={{ fontSize: 14, color: 'var(--teal-on-dark)', fontWeight: 500, minHeight: 44 }} onClick={() => nav(`/emergencia-bloqueado`)}>
          Acesso de emergência
        </button>
      )}
    </MScreen>
  );
}

/** M15 — Lembrete na tela bloqueada (simulação da notificação nativa do Android). */
export function LembreteDose() {
  const { state, api } = useStore();
  const nav = useNavigate();
  const r = state.remedios.find((x) => x.id === 'sinvastatina') ?? state.remedios.find((x) => x.ativo && x.horarios.length);
  const dono = state.pessoas.find((p) => p.id === r?.pessoaId);
  const esconder = state.config.esconderNomeNotif;
  const acao = { padding: '14px 16px', borderBottom: '1px solid var(--border-card)', textAlign: 'left' as const };

  const responder = (status: 'tomada' | 'pulada' | 'adiar') => {
    if (r && status !== 'adiar') api.marcarDose(r.id, r.horarios[0], status);
    else api.toast({ texto: 'Vamos lembrar de novo em 15 min' });
    nav('/');
  };

  return (
    <MScreen bg="linear-gradient(180deg,#2C4350,#14202A)" pad="0" gap={0} semHora statusStyle={{ color: '#fff' }} style={{ color: '#fff' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 2, paddingTop: 28 }}>
        <span style={{ fontSize: 17, fontWeight: 500, opacity: 0.85 }}>{dataLonga(HOJE)}</span>
        <span style={{ fontSize: 88, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1 }}>{r?.horarios[0] ?? '21:00'}</span>
      </div>
      <div className="stack" style={{ padding: '36px 12px 0', gap: 10 }}>
        <div className="stack" style={{ borderRadius: 10, background: 'rgba(244,247,247,.92)', color: 'var(--ink)', padding: '14px 16px', gap: 12 }}>
          <div className="hstack" style={{ gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 5, background: 'var(--teal)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Prontuário de Casa</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>agora</span>
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{esconder ? `Hora do remédio do ${dono?.curto}` : `${r?.nome} · ${dono?.curto}`}</span>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{esconder ? `Abra para ver qual. 1 dose às ${r?.horarios[0]}.` : `${r?.doseLonga ?? r?.dose} às ${r?.horarios[0]}.`}</span>
          </div>
        </div>
        <div className="stack" style={{ borderRadius: 6, background: 'rgba(244,247,247,.92)', color: 'var(--ink)', fontSize: 16, fontWeight: 500 }}>
          <button type="button" style={{ ...acao, color: 'var(--teal)', fontWeight: 600 }} onClick={() => responder('tomada')}>Tomei</button>
          <button type="button" style={acao} onClick={() => responder('adiar')}>Lembrar em 15 min</button>
          <button type="button" style={{ ...acao, borderBottom: 0 }} onClick={() => responder('pulada')}>Pular esta dose</button>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 'auto', padding: '0 0 40px', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>{esconder ? 'Nome do remédio escondido · ajuste em Privacidade' : 'Nome visível · ajuste em Privacidade'}</span>
        <span style={{ width: 134, height: 5, borderRadius: 3, background: '#fff' }} />
      </div>
    </MScreen>
  );
}

const HISTORICO = [
  { v: '1.4.2', data: '02/10/2026', nota: 'Correções no backup automático' },
  { v: '1.4.0', data: '11/09/2026', nota: 'Resumo para consulta' },
  { v: '1.3.0', data: '20/07/2026', nota: 'Compartilhamento por categoria' },
];

/** M22 — Atualizações (Android). */
export function Atualizacoes() {
  const store = useStore();
  const { state, api } = store;
  const nav = useNavigate();
  const u = state.config.update;
  const real = noCelular();
  const at = useInfoAtualizacao();
  const [historico, setHistorico] = useState(false);
  const set = (patch: Partial<typeof u>) => api.setConfig({ update: { ...u, ...patch } });

  return (
    <MScreen gap={16} tabs>
      <TopNav voltar="Configurações" voltarPara="/configuracoes" />
      <div className="stack" style={{ gap: 4 }}>
        <h1 className="title" style={{ margin: 0 }}>Atualizações</h1>
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Versão instalada <span className="mono">{u.instalada}</span></span>
      </div>
      {real ? (
        at.disponivel ? (
          <div className="card" style={{ border: '1.5px solid var(--teal)', padding: 16, gap: 12 }}>
            <div className="hstack" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>Versão {at.disponivel.versao} disponível</span>
              <Pill>Nova</Pill>
            </div>
            <div className="stack" style={{ gap: 6, fontSize: 14, lineHeight: 1.4 }}>
              {at.disponivel.notas.map((n) => <span key={n}>• {n}</span>)}
            </div>
            <button type="button" className="btn btn--ink btn--h48" disabled={at.estado === 'baixando'} onClick={() => void instalarAtualizacao(store)}>
              {at.estado === 'baixando' ? 'Baixando…' : 'Baixar e instalar'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>GitHub Releases · SHA-256 conferido antes de instalar</span>
          </div>
        ) : (
          <div className="card card--pad" style={{ gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {at.estado === 'verificando' ? 'Procurando…' : at.estado === 'erro' ? 'Não foi possível procurar atualizações' : at.estado === 'em-dia' ? 'Você está na versão mais recente' : 'Toque para procurar atualizações'}
            </span>
            <button type="button" className="btn btn--outline btn--h48" disabled={at.estado === 'verificando'} onClick={() => void verificarAtualizacao(store, { manual: true })}>Procurar atualizações</button>
          </div>
        )
      ) : u.disponivel ? (
        <div className="card" style={{ border: '1.5px solid var(--teal)', padding: 16, gap: 12 }}>
          <div className="hstack" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>Versão {u.disponivel.versao} disponível</span>
            <Pill>Nova</Pill>
          </div>
          <div className="stack" style={{ gap: 6, fontSize: 14, lineHeight: 1.4 }}>
            {u.disponivel.notas.map((n) => <span key={n}>• {n}</span>)}
          </div>
          <button type="button" className="btn btn--ink btn--h48" onClick={() => nav('/atualizacoes/instalando')}>Baixar e instalar · {u.disponivel.tamanho}</button>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Publicada {u.disponivel.publicada} no GitHub Releases · assinatura conferida</span>
        </div>
      ) : (
        <div className="card card--pad" style={{ gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Você está na versão mais recente</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Última verificação: {u.ultimaVerificacao}</span>
        </div>
      )}
      <div className="card" style={{ fontSize: 15 }}>
        <Row mutedLabel={false} label="Procurar automaticamente" valor={<Toggle on={u.auto} onChange={(v) => set({ auto: v })} label="Procurar automaticamente" />} />
        {u.auto && (
          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <span>Com que frequência</span>
            <Segmented variante="sm" opcoes={[{ id: 'dia', nome: '1x por dia' }, { id: 'semana', nome: '1x por semana' }]} valor={u.freq} onChange={(v) => set({ freq: v })} />
          </div>
        )}
        <Row
          mutedLabel={false}
          label={<span className="stack" style={{ gap: 2 }}><span>Backup antes de atualizar</span><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Recomendado</span></span>}
          valor={<Toggle on={u.backupAntes} onChange={(v) => set({ backupAntes: v })} label="Backup antes de atualizar" />}
        />
        {!real && <Row label="Última verificação" valor={u.ultimaVerificacao} valorStyle={{ color: 'var(--ink)' }} />}
      </div>
{MODO_EXEMPLO && (
        <button type="button" className="btn btn--link" style={{ fontSize: 14, fontWeight: 500, minHeight: 44 }} onClick={() => setHistorico(true)}>Ver histórico de versões</button>
      )}

      {historico && (
        <>
          <div className="overlay" onClick={() => setHistorico(false)} />
          <div className="sheet" role="dialog" aria-label="Histórico de versões">
            <span style={{ fontSize: 18, fontWeight: 600 }}>Histórico de versões</span>
            <div className="card" style={{ fontSize: 14 }}>
              {HISTORICO.map((h) => (
                <div key={h.v} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="stack" style={{ gap: 2 }}><span className="mono" style={{ fontWeight: 500 }}>{h.v}</span><span className="muted" style={{ fontSize: 13 }}>{h.nota}</span></span>
                  <span className="faint" style={{ fontSize: 13 }}>{h.data}</span>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn--cta" onClick={() => setHistorico(false)}>Fechar</button>
          </div>
        </>
      )}
    </MScreen>
  );
}

/** M23 — Instalando atualização (simulação do fluxo: backup → download/assinatura → instalação). */
export function Instalando() {
  const { state, api } = useStore();
  const nav = useNavigate();
  const u = state.config.update;
  const alvo = u.disponivel?.versao ?? u.instalada;
  const [etapa, setEtapa] = useState(u.backupAntes ? 0 : 1);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (etapa < 2) {
      const t = setTimeout(() => setEtapa(etapa + 1), 900);
      return () => clearTimeout(t);
    }
    if (pct < 100) {
      const t = setTimeout(() => setPct((p) => Math.min(100, p + 4)), 70);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      api.setConfig({ update: { ...u, instalada: alvo, disponivel: undefined, ultimaVerificacao: 'agora' } });
      api.toast({ texto: `Atualizado para ${alvo}` });
      nav('/');
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, pct]);

  const spinner = <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--teal)', borderRightColor: 'var(--teal-light)', flex: 'none', animation: 'spin 900ms linear infinite' }} />;
  const linha = (i: number, nome: string, info: string) => (
    <div className="hstack" style={{ padding: '14px 16px', gap: 12, borderBottom: '1px solid var(--divider)' }}>
      {etapa > i ? <Check size={24} font={12} /> : etapa === i ? spinner : <span style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--border-input)' }} />}
      <span style={{ flex: 1, fontWeight: etapa === i ? 600 : 400 }}>{nome}</span>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{etapa > i ? info : ''}</span>
    </div>
  );

  return (
    <MScreen pad="0 28px 48px" gap={28} style={{ justifyContent: 'center' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div className="stack" style={{ gap: 8 }}>
        <span className="mono" style={{ fontSize: 12, letterSpacing: '.1em', color: 'var(--text-2)' }}>{u.instalada} → {alvo}</span>
        <h1 className="title" style={{ margin: 0 }}>Atualizando o app</h1>
        <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>Seus dados continuam neste aparelho. Leva menos de um minuto.</span>
      </div>
      <div className="card" style={{ fontSize: 15 }}>
        {u.backupAntes && linha(0, 'Backup criptografado', 'feito')}
        {linha(1, 'Download e assinatura', u.disponivel?.tamanho ?? '')}
        <div className="stack" style={{ padding: '14px 16px', gap: 10 }}>
          <div className="hstack" style={{ gap: 12 }}>
            {etapa >= 2 && pct >= 100 ? <Check size={24} font={12} /> : etapa === 2 ? spinner : <span style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--border-input)' }} />}
            <span style={{ flex: 1, fontWeight: etapa === 2 ? 600 : 400 }}>Instalando</span>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{etapa === 2 ? `${pct}%` : ''}</span>
          </div>
          <div className="bar"><span style={{ width: `${etapa === 2 ? pct : 0}%`, transition: 'width 70ms linear' }} /></div>
        </div>
      </div>
      <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-3)' }}>
        O Android vai pedir para confirmar a instalação. Se algo der errado, o backup de hoje pode ser restaurado.
      </span>
    </MScreen>
  );
}

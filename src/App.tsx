import { useEffect, useState } from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { temEu, useStore } from './data/store';
import { MODO_EXEMPLO, MODO_REAL } from './data/tempo';
import { Lock } from './ui';
import { QuemEVoce } from './ui/Familia';
import { MobileShell } from './mobile/Shell';
import { Inicio } from './mobile/Inicio';
import { BoasVindas, CadastroMembro } from './mobile/Onboarding';
import { DetalheRemedio, EditarRemedio, NovoRemedio, Remedios } from './mobile/Remedios';
import { Agenda, EditarConsulta, NovaConsulta, ResumoConsulta } from './mobile/Agenda';
import { AdicionarExame, DetalheExame, EditarExame, Exames } from './mobile/Exames';
import { Compartilhar, Familia, FichaEmergencia, PerfilMembro, PlanoSaude } from './mobile/Familia';
import { EditarPerfilMobile } from './mobile/EditarPerfil';
import { NovoPet } from './mobile/NovoPet';
import { NovaPesagem, RegistrarPrevencao, RegistrarProcedimento, RegistrarSintoma, RegistrarVacina } from './mobile/RegistrosPet';
import { Atualizacoes, Configuracoes, Desbloqueio, Instalando, LembreteDose, Privacidade } from './mobile/Config';
import { DesktopShell } from './desktop/Shell';
import { REGISTROS_PET, type RegistroPet } from './desktop/Formularios';
import { DInicio } from './desktop/Inicio';
import { DPessoa } from './desktop/Pessoa';
import { DExames } from './desktop/Exames';
import { DAgenda, DPlanos, DPrivacidade, DRemedios } from './desktop/Paginas';
import { DPrimeiroUso } from './desktop/PrimeiroUso';
import { DRemedio } from './desktop/Remedio';
import { DResumo } from './desktop/Resumo';
import { useLayout, type Layout } from './layout';
import { DevBar } from './dev/DevBar';
import { NovoPlano } from './mobile/NovoPlano';
import { MedicoesPessoa, NovaMedicao } from './mobile/Medicoes';
import { Busca, HistoricoPessoa } from './mobile/Busca';
import { useAtualizarAgendaAoAbrir } from './data/agendaConectada';
import { useVerificarAtualizacaoAoAbrir } from './data/atualizacao';
import { useSincronizacao } from './data/sincronizacao';

function RotasMobile({ frame }: { frame: boolean }) {
  const { state } = useStore();
  const loc = useLocation();
  // Ficha de emergência pode abrir sem desbloquear, se o usuário ativou.
  if (state.bloqueado && loc.pathname !== '/emergencia-bloqueado') {
    return (
      <Routes>
        <Route element={<MobileShell frame={frame} />}>
          <Route path="*" element={<Desbloqueio />} />
        </Route>
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<MobileShell frame={frame} />}>
        <Route index element={<Inicio />} />
        <Route path="boas-vindas" element={<BoasVindas />} />
        <Route path="cadastro" element={<CadastroMembro />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="agenda/nova" element={<NovaConsulta />} />
        <Route path="consulta/:id/resumo" element={<ResumoConsulta />} />
        <Route path="remedios" element={<Remedios />} />
        <Route path="remedios/novo" element={<NovoRemedio />} />
        <Route path="remedios/:id" element={<DetalheRemedio />} />
        <Route path="remedios/:id/editar" element={<EditarRemedio />} />
        <Route path="exames" element={<Exames />} />
        <Route path="exames/novo" element={<AdicionarExame />} />
        <Route path="exames/:id" element={<DetalheExame />} />
        <Route path="exames/:id/editar" element={<EditarExame />} />
        <Route path="consulta/:id/editar" element={<EditarConsulta />} />
        <Route path="familia" element={<Familia />} />
        <Route path="pet/novo" element={<NovoPet />} />
        <Route path="pet/:id/vacina" element={<RegistrarVacina />} />
        <Route path="pet/:id/prevencao" element={<RegistrarPrevencao />} />
        <Route path="pet/:id/sintoma" element={<RegistrarSintoma />} />
        <Route path="pet/:id/procedimento" element={<RegistrarProcedimento />} />
        <Route path="pet/:id/pesagem" element={<NovaPesagem />} />
        <Route path="pessoa/:id" element={<PerfilMembro />} />
        <Route path="pessoa/:id/editar" element={<EditarPerfilMobile />} />
        <Route path="pessoa/:id/plano" element={<PlanoSaude />} />
        <Route path="pessoa/:id/plano/novo" element={<NovoPlano />} />
        <Route path="pessoa/:id/plano/editar" element={<NovoPlano editar />} />
        <Route path="pessoa/:id/medicoes" element={<MedicoesPessoa />} />
        <Route path="pessoa/:id/historico" element={<HistoricoPessoa />} />
        <Route path="busca" element={<Busca />} />
        <Route path="pessoa/:id/medicoes/nova" element={<NovaMedicao />} />
        <Route path="pessoa/:id/emergencia" element={<FichaEmergencia />} />
        <Route path="emergencia-bloqueado" element={<FichaDoDono />} />
        <Route path="compartilhar/:id" element={<Compartilhar />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="privacidade" element={<Privacidade />} />
        <Route path="desbloqueio" element={<DesbloqueioDemo />} />
        <Route path="lembrete" element={<LembreteDose />} />
        <Route path="atualizacoes" element={<Atualizacoes />} />
        <Route path="atualizacoes/instalando" element={<Instalando />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function FichaDoDono() {
  const { state } = useStore();
  return <FichaEmergencia pessoaId={state.pessoas.find((p) => p.souEu)?.id} />;
}

/** Abre a tela de desbloqueio a partir do navegador de telas. */
function DesbloqueioDemo() {
  const { api } = useStore();
  const nav = useNavigate();
  useEffect(() => { api.bloquear(true); nav('/', { replace: true }); }, [api, nav]);
  return null;
}

/** Primeiro uso no celular: boas-vindas, cadastro em 3 passos e restaurar backup. */
function RotasOnboarding({ frame }: { frame: boolean }) {
  return (
    <Routes>
      <Route element={<MobileShell frame={frame} />}>
        <Route index element={<BoasVindas />} />
        <Route path="cadastro" element={<CadastroMembro />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/** No desktop o "Editar perfil" é um diálogo: a rota do celular leva ao perfil já com ele aberto. */
function EditarNoDesktop() {
  const { id = '' } = useParams();
  return <Navigate to={`/pessoa/${id}?abrir=perfil:${id}`} replace />;
}

/** Rotas de edição do celular abertas no desktop: a página do registro com o diálogo de edição. */
function EditarNoDesktop2({ tipo, base, sufixo = '' }: { tipo: string; base: string; sufixo?: string }) {
  const { id = '' } = useParams();
  return <Navigate to={`${base}/${id}${sufixo}?abrir=editar-${tipo}:${id}`} replace />;
}

/** No desktop o novo plano é um diálogo na página de planos. */
function PlanoNoDesktop() {
  const { id = '' } = useParams();
  return <Navigate to={`/planos?abrir=plano:${id}`} replace />;
}

/** No desktop as medições ficam na aba do perfil; "nova" abre o diálogo. */
function MedicoesNoDesktop() {
  const { id = '' } = useParams();
  return <Navigate to={`/pessoa/${id}?abrir=medicao:${id}`} replace />;
}

/** No desktop o histórico é a aba do perfil. */
function HistoricoNoDesktop() {
  const { id = '' } = useParams();
  return <Navigate to={`/pessoa/${id}`} replace />;
}

/** No desktop os registros do pet são diálogos: /pet/:id/<registro> abre o perfil do pet com o diálogo. */
function RegistroNoDesktop() {
  const { id = '', registro = '' } = useParams();
  if (!(REGISTROS_PET as string[]).includes(registro)) return <Navigate to={`/pessoa/${id}`} replace />;
  return <Navigate to={`/pessoa/${id}?abrir=${registro as RegistroPet}:${id}`} replace />;
}

function RotasDesktop() {
  return (
    <Routes>
      {/* Passos 2 e 3 do primeiro uso (o passo 1 já criou "souEu") e as boas-vindas pelo navegador de telas. */}
      <Route path="cadastro" element={<DPrimeiroUso />} />
      <Route path="boas-vindas" element={<DPrimeiroUso />} />
      <Route element={<DesktopShell />}>
        <Route index element={<DInicio />} />
        <Route path="agenda" element={<DAgenda />} />
        <Route path="consulta/:id/resumo" element={<DResumo />} />
        <Route path="remedios" element={<DRemedios />} />
        <Route path="remedios/:id" element={<DRemedio />} />
        <Route path="exames" element={<DExames />} />
        <Route path="exames/:id" element={<DExames />} />
        <Route path="planos" element={<DPlanos />} />
        <Route path="pessoa/:id" element={<DPessoa />} />
        <Route path="pessoa/:id/editar" element={<EditarNoDesktop />} />
        <Route path="pessoa/:id/plano/novo" element={<PlanoNoDesktop />} />
        <Route path="remedios/:id/editar" element={<EditarNoDesktop2 tipo="remedio" base="/remedios" />} />
        <Route path="exames/:id/editar" element={<EditarNoDesktop2 tipo="exame" base="/exames" />} />
        <Route path="consulta/:id/editar" element={<EditarNoDesktop2 tipo="consulta" base="/consulta" sufixo="/resumo" />} />
        <Route path="pessoa/:id/medicoes/*" element={<MedicoesNoDesktop />} />
        <Route path="pessoa/:id/historico" element={<HistoricoNoDesktop />} />
        <Route path="busca" element={<Navigate to="/" replace />} />
        <Route path="pet/novo" element={<Navigate to="/?abrir=pet" replace />} />
        <Route path="pet/:id/:registro" element={<RegistroNoDesktop />} />
        <Route path="privacidade" element={<DPrivacidade />} />
        <Route path="*" element={<NaoDesenhadaNoDesktop />} />
      </Route>
    </Routes>
  );
}

function NaoDesenhadaNoDesktop() {
  return (
    <div className="desk__page" style={{ alignItems: 'flex-start' }}>
      <span className="muted">Esta tela existe só no celular.</span>
      <Link to="/">Voltar ao início</Link>
    </div>
  );
}

/** Bloqueia o app depois do tempo de inatividade configurado (só no app instalado). */
function useBloqueioPorInatividade(layout: Layout) {
  const { state, api } = useStore();
  const tempo = layout === 'mobile' ? state.config.bloqueioMobile : state.config.bloqueioDesktop;
  const ativo = MODO_REAL && state.temSenha && temEu(state) && !state.bloqueado && (layout === 'mobile' || state.config.senhaAoAbrir);
  useEffect(() => {
    if (!ativo) return;
    const ms = (parseInt(tempo, 10) || 1) * (tempo.includes('segundo') ? 1000 : 60000);
    let t = window.setTimeout(() => api.bloquear(true), ms);
    const reset = () => { window.clearTimeout(t); t = window.setTimeout(() => api.bloquear(true), ms); };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => { window.clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [ativo, tempo, api]);
}

function Abertura({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 24 }}>
      <div className="stack" style={{ alignItems: 'center', gap: 18, maxWidth: 420, textAlign: 'center' }}>
        <span style={{ width: 72, height: 72, borderRadius: 10, background: 'var(--teal)', display: 'grid', placeItems: 'center', color: '#fff' }}>
          <Lock large />
        </span>
        {children}
      </div>
    </div>
  );
}

/** O banco não abriu (ex.: a chave do aparelho sumiu). Oferece começar de novo e restaurar. */
function TelaErro({ erro }: { erro: string }) {
  const { api } = useStore();
  const [confirmar, setConfirmar] = useState(false);
  return (
    <Abertura>
      <span style={{ fontSize: 22, fontWeight: 600 }}>Não foi possível abrir os dados</span>
      <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>{erro}</span>
      {confirmar ? (
        <div className="stack" style={{ gap: 8, width: '100%' }}>
          <span style={{ fontSize: 14, color: 'var(--danger)' }}>O banco atual deste aparelho será apagado. Depois você pode restaurar um backup.</span>
          <button type="button" className="btn btn--h48" style={{ background: 'var(--danger)', color: '#fff' }} onClick={async () => { await api.apagarTudo(); location.reload(); }}>
            Apagar e começar de novo
          </button>
          <button type="button" className="btn btn--outline btn--h48" onClick={() => setConfirmar(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="btn btn--ink btn--h48" style={{ width: '100%' }} onClick={() => setConfirmar(true)}>Começar de novo</button>
      )}
    </Abertura>
  );
}

export default function App() {
  const { layout, frame, setForcado, forcado } = useLayout();
  const { state, status, erro } = useStore();
  const [devAberto, setDevAberto] = useState(false);
  useBloqueioPorInatividade(layout);
  useAtualizarAgendaAoAbrir();
  useVerificarAtualizacaoAoAbrir();
  useSincronizacao();

  if (status === 'carregando') return <Abertura><span style={{ fontSize: 15, color: 'var(--text-2)' }}>Abrindo…</span></Abertura>;
  if (status === 'erro') return <TelaErro erro={erro ?? 'Erro desconhecido.'} />;

  return (
    <HashRouter>
      {!temEu(state) && MODO_REAL && state.pessoas.some((p) => p.tipo !== 'pet') ? (
        <QuemEVoce />
      ) : !temEu(state) ? (
        layout === 'desktop' ? <DPrimeiroUso /> : <RotasOnboarding frame={frame} />
      ) : layout === 'mobile' ? (
        <RotasMobile frame={frame} />
      ) : (
        <RotasDesktop />
      )}
      {import.meta.env.DEV && MODO_EXEMPLO && <DevBar layout={layout} forcado={forcado} setForcado={setForcado} aberto={devAberto} setAberto={setDevAberto} />}
    </HashRouter>
  );
}

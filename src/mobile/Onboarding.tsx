import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { temEu, useStore } from '../data/store';
import { PARENTESCO, useFormPessoa } from '../data/formularios';
import { useLayout } from '../layout';
import { RestaurarBackup, SenhaApp } from '../ui/Backup';
import { ChipGroup, Field, FieldGroup, Lock, TopNav } from '../ui';
import { SangueGrid } from '../ui/Sangue';
import { MScreen } from './Shell';
import { CampoData } from '../ui/CampoData';
import { HOJE } from '../data/tempo';

const mono = { fontFamily: 'var(--font-mono)' };

/**
 * As três cartas inclinadas da M01. `escuro`: sobre o painel `--ink` do primeiro uso no desktop,
 * sem a borda clara e com sombras mais fortes (as do mockup somem no fundo escuro).
 */
export function CartasBoasVindas({ escuro }: { escuro?: boolean }) {
  const cartao = { position: 'absolute' as const, background: '#fff', border: escuro ? 0 : '1px solid var(--border-card)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 6 };
  const rotulo = { ...mono, fontSize: 10, letterSpacing: '.1em', color: 'var(--text-3)' };
  return (
    <div style={{ position: 'relative', height: 300, ...(escuro ? { width: '100%', maxWidth: 400 } : {}) }} aria-hidden>
      <div style={{ ...cartao, left: 24, right: 24, top: 0, height: 120, transform: 'rotate(-4deg)', ...(escuro ? { boxShadow: '0 12px 24px -16px rgba(0,0,0,.5)' } : {}) }}>
        <span style={rotulo}>PLANO</span>
        <span style={{ ...mono, fontSize: 16 }}>0 123 4567 8901</span>
      </div>
      <div style={{ ...cartao, left: 8, right: 40, top: 90, height: 110, transform: 'rotate(3deg)', boxShadow: escuro ? '0 16px 30px -14px rgba(0,0,0,.6)' : '0 12px 24px -16px rgba(20,40,50,.3)' }}>
        <span style={rotulo}>21:00</span>
        <span style={{ fontSize: 17, fontWeight: 600 }}>Sinvastatina 20 mg</span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Roberto</span>
      </div>
      <div style={{ ...cartao, border: 0, left: 36, right: 12, top: 176, height: 112, background: 'var(--teal)', color: '#fff', transform: 'rotate(-1.5deg)', boxShadow: escuro ? '0 20px 36px -14px rgba(0,0,0,.65)' : '0 16px 30px -16px rgba(20,60,70,.5)' }}>
        <span style={{ ...rotulo, color: '#fff', opacity: 0.75 }}>05 NOV · 10:00</span>
        <span style={{ fontSize: 17, fontWeight: 600 }}>Cardiologista</span>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Levar eletrocardiograma</span>
      </div>
    </div>
  );
}

/** M01 — Boas-vindas. */
export function BoasVindas() {
  const nav = useNavigate();
  const [restaurar, setRestaurar] = useState(false);
  return (
    <MScreen pad="24px 24px 34px" gap={32}>
      <CartasBoasVindas />
      <div className="stack" style={{ gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.12, textWrap: 'pretty' } as React.CSSProperties}>
          A saúde da sua família, organizada num lugar só.
        </h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--text-2)' }}>
          Remédios com lembrete, consultas, exames e a carteirinha do plano, de cada pessoa da casa.
        </p>
      </div>
      <div className="stack" style={{ marginTop: 'auto', gap: 12 }}>
        <div className="hstack" style={{ gap: 8, justifyContent: 'center', fontSize: 13, color: 'var(--text-2)' }}>
          <Lock />
          Tudo fica guardado neste aparelho
        </div>
        <button type="button" className="btn btn--cta" onClick={() => nav('/cadastro?passo=1')}>Começar</button>
        <button type="button" className="btn" style={{ height: 48, fontSize: 15, color: 'var(--teal)' }} onClick={() => setRestaurar(true)}>
          Restaurar um backup
        </button>
      </div>
      {restaurar && <RestaurarBackup primeiroUso onClose={() => setRestaurar(false)} />}
    </MScreen>
  );
}

/**
 * Cadastro de pessoa. No primeiro uso vira um fluxo de 3 passos:
 * 1. você · 2. alguém da casa (M02, opcional) · 3. PIN ou senha do app.
 * Fora do primeiro uso, é só o M02 (adicionar alguém).
 */
export function CadastroMembro() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { state } = useStore();
  const primeiroUso = !temEu(state);
  const passo = primeiroUso ? 1 : Number(params.get('passo') ?? 0);
  if (passo === 3) return <PassoProtecao />;
  return <FormPessoa key={passo} passo={passo} souEu={primeiroUso} onSalvo={(id) => {
    if (primeiroUso) nav('/cadastro?passo=2', { replace: true });
    else if (passo === 2) nav('/cadastro?passo=3', { replace: true });
    else nav(`/pessoa/${id}`);
  }} onPular={passo === 2 ? () => nav('/cadastro?passo=3', { replace: true }) : undefined} />;
}

function FormPessoa({ passo, souEu, onSalvo, onPular }: {
  passo: number; souEu: boolean; onSalvo: (id: string) => void; onPular?: () => void;
}) {
  const { nome, setNome, nasc, setNasc, par, setPar, sangue, setSangue, erroData, valido, salvar } = useFormPessoa({ souEu, onSalvo });

  const comPassos = passo >= 1;
  return (
    <MScreen gap={22}>
      <TopNav
        voltar={souEu ? 'Voltar' : passo === 2 ? 'Voltar' : 'Voltar'}
        voltarPara={souEu ? '/' : undefined}
        extra={comPassos ? <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{passo} de 3</span> : <span />}
      />
      {comPassos && <div className="progress-seg">{[1, 2, 3].map((i) => <span key={i} className={i <= passo ? 'is-on' : ''} />)}</div>}
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="title title--26" style={{ margin: 0 }}>{souEu ? 'Vamos começar por você' : 'Quem vamos adicionar?'}</h1>
        <span style={{ fontSize: 15, color: 'var(--text-2)' }}>Só o nome é obrigatório. O resto pode vir depois.</span>
      </div>
      <Field label={souEu ? 'Seu nome' : 'Nome'}>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus autoComplete="name" />
      </Field>
      <Field label="Data de nascimento">
        <CampoData className="input input--mono" valor={nasc} onChange={setNasc} max={HOJE} />
        {erroData && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{erroData}</span>}
      </Field>
      {!souEu && (
        <FieldGroup label="Parentesco com você">
          <ChipGroup opcoes={PARENTESCO} valor={par} onChange={setPar} />
        </FieldGroup>
      )}
      <FieldGroup label="Tipo sanguíneo">
        <SangueGrid valor={sangue} onChange={setSangue} />
      </FieldGroup>
      <div className="stack" style={{ marginTop: 'auto', gap: 4 }}>
        <button type="button" className="btn btn--cta" disabled={!valido} onClick={salvar}>
          Continuar
        </button>
        {onPular && (
          <button type="button" className="btn" style={{ height: 44, fontSize: 15, color: 'var(--teal)' }} onClick={onPular}>
            Pular por enquanto
          </button>
        )}
      </div>
    </MScreen>
  );
}

/** Passo 3 do primeiro uso: proteger o app com PIN (celular) ou senha (desktop). */
function PassoProtecao() {
  const nav = useNavigate();
  const { layout } = useLayout();
  const desktop = layout === 'desktop';
  const [folha, setFolha] = useState(false);
  const fim = () => nav('/', { replace: true });
  return (
    <MScreen gap={22}>
      <TopNav voltar="Voltar" extra={<span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>3 de 3</span>} />
      <div className="progress-seg"><span className="is-on" /><span className="is-on" /><span className="is-on" /></div>
      <span style={{ width: 72, height: 72, borderRadius: 10, background: 'var(--teal)', display: 'grid', placeItems: 'center', color: '#fff', marginTop: 12 }}>
        <Lock large />
      </span>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="title title--26" style={{ margin: 0 }}>Proteja o app</h1>
        <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>
          {desktop
            ? 'Com uma senha, o app pede para entrar ao abrir e depois de alguns minutos sem uso. Os dados já ficam criptografados neste computador.'
            : 'Com um PIN, o app pede para entrar ao abrir e depois de um tempo sem uso. Os dados já ficam criptografados neste aparelho.'}
        </span>
      </div>
      <div className="stack" style={{ marginTop: 'auto', gap: 4 }}>
        <button type="button" className="btn btn--cta" onClick={() => setFolha(true)}>{desktop ? 'Criar senha' : 'Criar PIN'}</button>
        <button type="button" className="btn" style={{ height: 44, fontSize: 15, color: 'var(--teal)' }} onClick={fim}>Agora não</button>
      </div>
      {folha && <SenhaApp desktop={desktop} onClose={() => setFolha(false)} onPronto={fim} />}
    </MScreen>
  );
}

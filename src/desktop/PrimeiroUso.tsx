import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { temEu, useStore } from '../data/store';
import { PARENTESCO, useFormPessoa } from '../data/formularios';
import { RestaurarBackup, SenhaApp } from '../ui/Backup';
import { Lock } from '../ui';
import { EntrarNaFamilia } from '../ui/Familia';
import { CartasBoasVindas } from '../mobile/Onboarding';
import { DCampo, DChips, DGrade, DSangue } from './Formulario';
import { CampoData } from '../ui/CampoData';
import { HOJE } from '../data/tempo';

// Primeiro uso no desktop: tela dividida. À esquerda o painel escuro com as cartas da M01;
// à direita boas-vindas ou o cadastro em 3 passos (você · alguém da casa · senha do app).
// Rotas: "/" (sem "souEu") ou "/boas-vindas" → boas-vindas; "/cadastro?passo=1|2|3" → passos.

export function DPrimeiroUso() {
  const { state, toast, fecharToast } = useStore();
  const loc = useLocation();
  const [params] = useSearchParams();
  const primeiroUso = !temEu(state);
  // Fora do DesktopShell não há a tela de bloqueio: bloqueado, volta para o início (que a mostra).
  if (state.bloqueado && !primeiroUso) return <Navigate to="/" replace />;

  let tela: ReactNode;
  if (loc.pathname === '/cadastro') {
    const passo = Number(params.get('passo') ?? 0);
    // Sem "souEu" só existe o passo 1; com ele, o passo 1 já foi feito.
    if (primeiroUso && passo !== 1) return <Navigate to="/cadastro?passo=1" replace />;
    if (!primeiroUso && passo === 1) return <Navigate to="/cadastro?passo=2" replace />;
    if (!primeiroUso && passo !== 2 && passo !== 3) return <Navigate to="/?abrir=pessoa" replace />;
    tela = passo === 3 ? <PassoSenha /> : <PassoPessoa key={passo} passo={passo} />;
  } else {
    if (primeiroUso && loc.pathname !== '/') return <Navigate to="/" replace />;
    tela = <BoasVindasD />;
  }

  return (
    <div className="pu">
      <aside className="pu__painel">
        <div className="pu__meio">
          <CartasBoasVindas escuro />
          <div className="stack" style={{ gap: 14 }}>
            <h1 className="pu__frase">A saúde da sua família, organizada num lugar só.</h1>
            <p className="pu__texto">Remédios com lembrete, consultas, exames e a carteirinha do plano, de cada pessoa da casa.</p>
          </div>
        </div>
        <div className="pu__rodape">
          <Lock />
          Tudo fica guardado neste aparelho
        </div>
      </aside>
      <main className="pu__lado">
        <div className="pu__conteudo">{tela}</div>
      </main>
      {toast && (
        <div className="toast toast--desk" role="status" key={toast.id}>
          <span>{toast.texto}</span>
          {toast.desfazer && <button type="button" onClick={() => { toast.desfazer!(); fecharToast(); }}>Desfazer</button>}
        </div>
      )}
    </div>
  );
}

function BoasVindasD() {
  const nav = useNavigate();
  const [folha, setFolha] = useState<null | 'restaurar' | 'familia'>(null);
  const passos: [string, string, string?][] = [
    ['1', 'Você'],
    ['2', 'Alguém da casa', '(opcional)'],
    ['3', 'Senha do app'],
  ];
  return (
    <>
      <div className="stack" style={{ gap: 10 }}>
        <span className="pu__rotulo">PRIMEIRO USO</span>
        <h2 className="pu__titulo">Vamos organizar a saúde da casa</h2>
      </div>
      <ol className="pu__passos">
        {passos.map(([n, nome, extra]) => (
          <li key={n}>
            <span className="pu__num">{n}</span>
            <span>{nome}{extra && <span className="pu__extra"> {extra}</span>}</span>
          </li>
        ))}
      </ol>
      <div className="pu__acoes">
        <button type="button" className="btn btn--ink btn--h48 pu__comecar" onClick={() => nav('/cadastro?passo=1')} autoFocus>Começar</button>
        <button type="button" className="btn btn--link btn--h40d" onClick={() => setFolha('familia')}>Entrar na família</button>
        <button type="button" className="btn btn--link btn--h40d" onClick={() => setFolha('restaurar')}>Restaurar um backup</button>
      </div>
      {folha === 'restaurar' && <RestaurarBackup desktop primeiroUso onClose={() => setFolha(null)} />}
      {folha === 'familia' && <EntrarNaFamilia desktop onClose={() => setFolha(null)} />}
    </>
  );
}

function Progresso({ passo }: { passo: number }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <span className="pu__rotulo">PASSO {passo} DE 3</span>
      <div className="progress-seg">{[1, 2, 3].map((i) => <span key={i} className={i <= passo ? 'is-on' : ''} />)}</div>
    </div>
  );
}

/** Passo 1 (você) e passo 2 (alguém da casa, opcional). */
function PassoPessoa({ passo }: { passo: number }) {
  const nav = useNavigate();
  const souEu = passo === 1;
  const proximo = () => nav(souEu ? '/cadastro?passo=2' : '/cadastro?passo=3', { replace: true });
  const f = useFormPessoa({ souEu, onSalvo: proximo });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (f.valido) f.salvar();
  };

  return (
    <form className="pu__form" onSubmit={enviar} noValidate>
      <Progresso passo={passo} />
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="pu__titulo">{souEu ? 'Vamos começar por você' : 'Quem vamos adicionar?'}</h2>
        <span className="pu__sub">Só o nome é obrigatório. O resto pode vir depois.</span>
      </div>
      <DGrade>
        <DCampo label={souEu ? 'Seu nome' : 'Nome'} span2>
          <input className="input input--desk" value={f.nome} onChange={(e) => f.setNome(e.target.value)} autoFocus autoComplete={souEu ? 'name' : 'off'} />
        </DCampo>
        <DCampo label="Data de nascimento" erro={f.erroData}>
          <CampoData className="input input--desk input--mono" valor={f.nasc} onChange={f.setNasc} max={HOJE} />
        </DCampo>
        {!souEu && (
          <DCampo label="Parentesco com você" grupo>
            <DChips opcoes={PARENTESCO} valor={f.par} onChange={f.setPar} />
          </DCampo>
        )}
        <DCampo label="Tipo sanguíneo" grupo>
          <DSangue valor={f.sangue} onChange={f.setSangue} />
        </DCampo>
      </DGrade>
      <div className="pu__rodape-form">
        <div>
          {!souEu && <button type="button" className="btn btn--link btn--h40d pu__link" onClick={proximo}>Pular por enquanto</button>}
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          {/* No passo 2 o passo 1 já foi salvo: não há "Voltar". */}
          {souEu && <button type="button" className="btn btn--outline btn--h40d" onClick={() => nav('/')}>Voltar</button>}
          <button type="submit" className="btn btn--ink btn--h40d" disabled={!f.valido}>Continuar</button>
        </div>
      </div>
    </form>
  );
}

/** Passo 3: senha do app. */
function PassoSenha() {
  const nav = useNavigate();
  const [folha, setFolha] = useState(false);
  const fim = () => nav('/', { replace: true });
  return (
    <div className="pu__form">
      <Progresso passo={3} />
      <span className="pu__selo"><Lock large /></span>
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="pu__titulo">Proteja o app</h2>
        <span className="pu__sub" style={{ lineHeight: 1.5 }}>
          Com uma senha, o app pede para entrar ao abrir e depois de alguns minutos sem uso. Os dados já ficam criptografados neste computador.
        </span>
      </div>
      <div className="pu__rodape-form">
        {/* Sem "Voltar": o passo 2 já foi salvo, voltar só cadastraria outra pessoa. */}
        <div />
        <div className="hstack" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline btn--h40d" onClick={fim}>Agora não</button>
          <button type="button" className="btn btn--ink btn--h40d" onClick={() => setFolha(true)} autoFocus>Criar senha</button>
        </div>
      </div>
      {folha && <SenhaApp desktop onClose={() => setFolha(false)} onPronto={fim} />}
    </div>
  );
}

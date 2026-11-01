import { useState, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { cx } from './index';

/** Folha inferior no celular; diálogo centralizado no desktop. */
export function Folha({ desktop, onClose, titulo, children, alerta }: { desktop?: boolean; onClose: () => void; titulo: string; children: ReactNode; alerta?: boolean }) {
  const role = alerta ? 'alertdialog' : 'dialog';
  if (desktop) {
    return (
      <div className="overlay overlay--fixed" onClick={onClose}>
        <div className="dialog" style={{ padding: 28, gap: 14 }} onClick={(e) => e.stopPropagation()} role={role} aria-label={titulo}>
          <span style={{ fontSize: 22, fontWeight: 600 }}>{titulo}</span>
          {children}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role={role} aria-label={titulo}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>{titulo}</span>
        {children}
      </div>
    </>
  );
}

const texto = { fontSize: 14, lineHeight: 1.45, color: 'var(--text-2)' } as const;
const erroStyle = { fontSize: 13, color: 'var(--danger)' } as const;

function Botoes({ desktop, children }: { desktop?: boolean; children: ReactNode }) {
  return desktop ? <div className="hstack" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>{children}</div> : <>{children}</>;
}

/** Define (ou troca) a senha do backup. Com `fazerBackup`, já faz o primeiro backup em seguida. */
export function SenhaBackup({ desktop, onClose, fazerBackup, troca }: { desktop?: boolean; onClose: () => void; fazerBackup?: boolean; troca?: boolean }) {
  const { api } = useStore();
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const salvar = async () => {
    if (senha.length < 6) return setErro('Use pelo menos 6 caracteres.');
    if (senha !== conf) return setErro('As duas senhas não são iguais.');
    setOcupado(true);
    const ok = await api.configurarBackup({ senha });
    if (ok && fazerBackup) await api.backupAgora();
    setOcupado(false);
    if (ok) onClose();
  };
  const btn = desktop ? 'btn--h40d' : 'btn--h50';
  return (
    <Folha desktop={desktop} onClose={onClose} titulo={troca ? 'Nova senha do backup' : 'Senha do backup'}>
      <span style={texto}>
        O backup é um arquivo criptografado. Sem essa senha ninguém consegue abrir, nem você. Guarde num lugar seguro.
        {troca && ' Os próximos backups usam a senha nova; os antigos continuam com a senha antiga.'}
      </span>
      <input className="input" type="password" placeholder="Senha (mínimo 6 caracteres)" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(''); }} autoFocus aria-label="Senha do backup" />
      <input className="input" type="password" placeholder="Repita a senha" value={conf} onChange={(e) => { setConf(e.target.value); setErro(''); }} aria-label="Repita a senha" onKeyDown={(e) => e.key === 'Enter' && salvar()} />
      {erro && <span style={erroStyle} role="alert">{erro}</span>}
      <Botoes desktop={desktop}>
        {desktop && <button type="button" className="btn btn--outline btn--h40d" onClick={onClose}>Cancelar</button>}
        <button type="button" className={cx('btn btn--ink', btn)} disabled={ocupado} onClick={salvar}>
          {ocupado ? 'Salvando…' : fazerBackup ? 'Salvar senha e fazer backup' : 'Salvar senha'}
        </button>
        {!desktop && <button type="button" className="btn btn--outline btn--h50" onClick={onClose}>Cancelar</button>}
      </Botoes>
    </Folha>
  );
}

/** Restaura um arquivo .fsaude: escolhe o arquivo, pede a senha e substitui os dados. */
export function RestaurarBackup({ desktop, onClose, primeiroUso }: { desktop?: boolean; onClose: () => void; primeiroUso?: boolean }) {
  const { api } = useStore();
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const escolher = async () => {
    setErro('');
    try {
      const a = await api.escolherArquivoBackup();
      if (a) setArquivo(a);
      else if (a === null && !arquivo) setErro('Nenhum arquivo escolhido.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };
  const restaurar = async () => {
    if (!arquivo) return;
    setOcupado(true);
    try {
      await api.restaurar(arquivo, senha);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  const nome = arquivo?.split(/[\\/]/).pop();
  const btn = desktop ? 'btn--h40d' : 'btn--h50';
  return (
    <Folha desktop={desktop} onClose={onClose} titulo="Restaurar um backup" alerta={!primeiroUso}>
      <span style={texto}>
        {primeiroUso
          ? 'Escolha o arquivo .fsaude e digite a senha usada quando ele foi criado.'
          : 'Os dados deste aparelho serão substituídos pelos do backup. Escolha o arquivo .fsaude e digite a senha dele.'}
      </span>
      <button type="button" className="btn btn--dashed" style={{ height: 52, borderRadius: 6, fontSize: 14, fontWeight: 500, color: arquivo ? 'var(--ink)' : undefined }} onClick={escolher}>
        {nome ?? 'Escolher arquivo'}
      </button>
      {arquivo && (
        <input className="input" type="password" placeholder="Senha do backup" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(''); }} autoFocus aria-label="Senha do backup" onKeyDown={(e) => e.key === 'Enter' && restaurar()} />
      )}
      {erro && <span style={erroStyle} role="alert">{erro}</span>}
      <Botoes desktop={desktop}>
        {desktop && <button type="button" className="btn btn--outline btn--h40d" onClick={onClose}>Cancelar</button>}
        <button type="button" className={cx('btn', primeiroUso ? 'btn--ink' : '', btn)} style={primeiroUso ? undefined : { background: 'var(--danger)', color: '#fff' }} disabled={!arquivo || !senha || ocupado} onClick={restaurar}>
          {ocupado ? 'Restaurando…' : primeiroUso ? 'Restaurar' : 'Substituir pelos dados do backup'}
        </button>
        {!desktop && <button type="button" className="btn btn--outline btn--h50" onClick={onClose}>Cancelar</button>}
      </Botoes>
    </Folha>
  );
}

/** Cria ou troca o PIN (celular, 6 dígitos) ou a senha (desktop) de desbloqueio. */
export function SenhaApp({ desktop, onClose, onPronto }: { desktop?: boolean; onClose: () => void; onPronto?: () => void }) {
  const { api, state } = useStore();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [erro, setErro] = useState('');
  const nomeCampo = desktop ? 'senha' : 'PIN';
  const valido = desktop ? a.length >= 4 : /^\d{6}$/.test(a);
  const salvar = async () => {
    if (!valido) return setErro(desktop ? 'Use pelo menos 4 caracteres.' : 'O PIN tem 6 números.');
    if (a !== b) return setErro(`Os dois ${desktop ? 'campos' : 'PINs'} não são iguais.`);
    try {
      await api.definirSenha(a);
      api.toast({ texto: desktop ? 'Senha salva' : 'PIN salvo' });
      onPronto?.();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };
  const campo = (v: string, set: (s: string) => void, ph: string, auto?: boolean) => (
    <input
      className={cx('input', !desktop && 'input--mono')}
      type="password"
      inputMode={desktop ? undefined : 'numeric'}
      maxLength={desktop ? undefined : 6}
      placeholder={ph}
      value={v}
      autoFocus={auto}
      aria-label={ph}
      onChange={(e) => { set(desktop ? e.target.value : e.target.value.replace(/\D/g, '')); setErro(''); }}
      onKeyDown={(e) => e.key === 'Enter' && salvar()}
    />
  );
  const btn = desktop ? 'btn--h40d' : 'btn--h50';
  return (
    <Folha desktop={desktop} onClose={onClose} titulo={state.temSenha ? `Trocar ${nomeCampo}` : `Criar ${nomeCampo}`}>
      <span style={texto}>O app pede {desktop ? 'a senha' : 'o PIN'} ao abrir e depois de um tempo sem uso.</span>
      {campo(a, setA, desktop ? 'Nova senha' : 'PIN de 6 números', true)}
      {campo(b, setB, desktop ? 'Repita a senha' : 'Repita o PIN')}
      {erro && <span style={erroStyle} role="alert">{erro}</span>}
      <Botoes desktop={desktop}>
        {desktop && <button type="button" className="btn btn--outline btn--h40d" onClick={onClose}>Cancelar</button>}
        <button type="button" className={cx('btn btn--ink', btn)} onClick={salvar}>Salvar</button>
        {!desktop && <button type="button" className="btn btn--outline btn--h50" onClick={onClose}>Cancelar</button>}
      </Botoes>
    </Folha>
  );
}

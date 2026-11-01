// Ponte entre o app e o armazenamento.
// No app instalado, tudo passa pelos comandos Rust (banco cifrado + backup .fsaude).
// No navegador, uma versão em memória (opcionalmente no localStorage) para desenvolvimento.

import { EM_TAURI } from './tempo';
import type { Lembrete } from './lembretes';

export interface Evento {
  id: string;
  em: string;              // ISO, hora em que aconteceu
  autor?: string;          // pessoa que fez a mudança
  aparelho?: string;       // aparelhoId de quem criou o evento
  hlc?: string;            // relógio lógico híbrido (src/data/hlc.ts); ordena o log
  tipo: string;
  dados: Record<string, unknown>;
}

export interface InfoBackup {
  pasta: string;
  freq: 'semanal' | 'manual';
  temSenha: boolean;
  ultimo?: string | null;  // ISO
  arquivo?: string | null;
  tamanho?: number | null; // bytes
}

export interface Inicio {
  eventos: Evento[];
  temSenha: boolean;
  backup: InfoBackup;
  erro?: string | null;
  versao: string;
}

export interface Persistencia {
  iniciar(): Promise<Inicio>;
  gravar(ev: Evento): Promise<void>;
  definirSenha(senha: string): Promise<void>;
  verificarSenha(senha: string): Promise<boolean>;
  backupConfigurar(o: { senha?: string; pasta?: string; freq?: 'semanal' | 'manual'; nome?: string }): Promise<InfoBackup>;
  backupAgora(): Promise<InfoBackup>;
  backupSeDevido(): Promise<InfoBackup | null>;
  backupRestaurar(caminho: string, senha: string): Promise<Evento[]>;
  escolherPasta(atual?: string): Promise<string | null>;
  escolherArquivoBackup(): Promise<string | null>;
  apagarTudo(): Promise<void>;
  /** Substitui os lembretes agendados no sistema (só em memória no Rust). */
  agendarLembretes(lista: Lembrete[]): Promise<void>;
}

// ── App instalado ───────────────────────────────────────────────────────────

function tauri(): Persistencia {
  const call = async <T,>(cmd: string, args?: Record<string, unknown>) => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  };
  const dialogo = () => import('@tauri-apps/plugin-dialog');
  return {
    iniciar: () => call<Inicio>('iniciar'),
    gravar: (evento) => call('gravar_evento', { evento }),
    definirSenha: (senha) => call('definir_senha', { senha }),
    verificarSenha: (senha) => call<boolean>('verificar_senha', { senha }),
    backupConfigurar: (o) => call<InfoBackup>('backup_configurar', o),
    backupAgora: () => call<InfoBackup>('backup_agora'),
    backupSeDevido: () => call<InfoBackup | null>('backup_se_devido'),
    backupRestaurar: (caminho, senha) => call<Evento[]>('backup_restaurar', { caminho, senha }),
    escolherPasta: async (atual) => {
      const r = await (await dialogo()).open({ directory: true, defaultPath: atual, title: 'Pasta dos backups' });
      return typeof r === 'string' ? r : null;
    },
    escolherArquivoBackup: async () => {
      const r = await (await dialogo()).open({ title: 'Escolha o backup', filters: [{ name: 'Backup do Prontuário de Casa', extensions: ['fsaude'] }] });
      return typeof r === 'string' ? r : null;
    },
    apagarTudo: () => call('apagar_tudo'),
    agendarLembretes: (lista) => call('agendar_lembretes', { lista }),
  };
}

// ── Navegador (desenvolvimento) ─────────────────────────────────────────────
// Sem criptografia: serve só para testar o fluxo. Nunca usado no app instalado.

function memoria(): Persistencia {
  const KEY = 'arquivo-dev';
  type Dev = { eventos: Evento[]; senha?: string; backup: InfoBackup; copia?: { eventos: Evento[]; senha: string } };
  const vazio = (): Dev => ({ eventos: [], backup: { pasta: 'Documentos / Arquivo da família', freq: 'semanal', temSenha: false } });
  const ler = (): Dev => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '') as Dev; } catch { return vazio(); }
  };
  let d = ler();
  const salvar = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* sem armazenamento */ } };
  const agora = async () => {
    if (!d.copia && !(d.backup.temSenha)) throw new Error('Defina uma senha para o backup primeiro.');
    d.copia = { eventos: [...d.eventos], senha: d.copia?.senha ?? '' };
    d.backup = { ...d.backup, ultimo: new Date().toISOString(), arquivo: 'familia-dev.fsaude', tamanho: JSON.stringify(d.eventos).length };
    salvar();
    return d.backup;
  };
  return {
    iniciar: async () => ({ eventos: d.eventos, temSenha: !!d.senha, backup: d.backup, versao: '0.3.0-dev' }),
    gravar: async (ev) => { if (!d.eventos.some((e) => e.id === ev.id)) d.eventos.push(ev); salvar(); },
    definirSenha: async (s) => { d.senha = s; salvar(); },
    verificarSenha: async (s) => !d.senha || d.senha === s,
    backupConfigurar: async (o) => {
      if (o.senha) d.copia = { eventos: d.copia?.eventos ?? [], senha: o.senha };
      d.backup = { ...d.backup, ...(o.pasta ? { pasta: o.pasta } : {}), ...(o.freq ? { freq: o.freq } : {}), temSenha: d.backup.temSenha || !!o.senha };
      salvar();
      return d.backup;
    },
    backupAgora: agora,
    backupSeDevido: async () => null,
    backupRestaurar: async (_c, senha) => {
      if (!d.copia) throw new Error('Nenhum backup encontrado.');
      if (senha !== d.copia.senha) throw new Error('Senha incorreta ou arquivo danificado.');
      d.eventos = [...d.copia.eventos];
      salvar();
      return d.eventos;
    },
    escolherPasta: async () => 'Documentos / Arquivo da família',
    escolherArquivoBackup: async () => (d.copia ? 'familia-dev.fsaude' : null),
    apagarTudo: async () => { const copia = d.copia; d = vazio(); d.copia = copia; salvar(); },
    agendarLembretes: async () => {},
  };
}

export const persistencia: Persistencia = EM_TAURI ? tauri() : memoria();

let contador = 0;
export function novoId() {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${Date.now().toString(36)}-${(contador++).toString(36)}-${r.slice(0, 8)}`;
}

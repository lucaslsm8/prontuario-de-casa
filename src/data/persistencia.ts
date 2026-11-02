// Ponte entre o app e o armazenamento.
// No app instalado, tudo passa pelos comandos Rust (banco cifrado + backup .fsaude).
// No navegador, uma versão em memória (opcionalmente no localStorage) para desenvolvimento.

import { EM_TAURI } from './tempo';
import type { Lembrete } from './lembretes';
import type { CursorEnvio, Identidade } from './log';

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
  /** null/ausente: aparelho que nunca guardou identidade (instalação nova ou versão antiga). */
  identidade?: Identidade | null;
}

export interface Persistencia {
  iniciar(): Promise<Inicio>;
  gravar(ev: Evento): Promise<void>;
  /** Guarda "quem sou eu" deste aparelho (kv cifrado, fora do log). */
  definirIdentidade(identidade: Identidade): Promise<void>;
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
  /** A família deste aparelho, ou null se ainda não entrou em nenhuma. */
  familiaInfo(): Promise<InfoFamilia | null>;
  /** Cria a família no repositório do GitHub com o token informado. */
  familiaCriar(repo: string, token: string): Promise<InfoFamilia>;
  /** Entra numa família pelo código de convite. */
  familiaEntrar(convite: string): Promise<InfoFamilia>;
  /** Sai da família neste aparelho. */
  familiaSair(): Promise<void>;
  /** Código de convite da família atual (antes, segue as trocas de chave: o convite sai na época mais nova). */
  familiaConvite(aparelho: string): Promise<string>;
  /** "Verificar de novo": confere no remoto se este aparelho ainda está fora da família. */
  familiaVerificar(aparelho: string): Promise<InfoFamilia>;
  /** Token novo do GitHub só neste aparelho (confere antes de guardar; a chave não muda). */
  familiaTrocarToken(token: string): Promise<InfoFamilia>;
  /** Remove outro aparelho: troca a chave da família e manda a nova (e o token novo, se veio) cifrada para cada um
   *  dos `destinatarios` (os que ficam e têm chave pública). Devolve a família na época nova. */
  familiaRemoverAparelho(aparelho: string, removido: string, destinatarios: { id: string; chave: string }[], token?: string): Promise<InfoFamilia>;
  /** Onde parou o envio (último evento que subiu) e os aparelhos já lidos. */
  syncCursor(): Promise<CursorEnvio>;
  /** Sobe o recorte montado por `eventosParaEnviar`; devolve quantos eventos subiram. */
  syncEnviar(aparelho: string, eventos: Evento[]): Promise<number>;
  /** Baixa os pacotes dos outros aparelhos; devolve quantos eventos chegaram. */
  syncReceber(aparelho: string): Promise<number>;
  /** Rede atual (id = hash do MAC do gateway / BSSID), ou null se indisponível. `pedir`: pede a permissão no Android. */
  redeAtual(pedir?: boolean): Promise<RedeCasa | null>;
  /** Redes de casa deste aparelho (kv cifrado, não sincroniza). */
  redesCasa(): Promise<RedeCasa[]>;
  redeCasaAdicionar(rede: RedeCasa): Promise<RedeCasa[]>;
  redeCasaRemover(id: string): Promise<RedeCasa[]>;
  /** Chave pública X25519 (hex) deste aparelho; o Rust cria o par na primeira chamada. Vazio no navegador. */
  chavePublicaAparelho(): Promise<string>;
}

/** `epoca`: época da chave da família (sobe a cada aparelho removido). `removido`: este aparelho foi removido. */
export interface InfoFamilia { familiaId: string; repo: string; epoca?: number; removido?: boolean }
export interface RedeCasa { id: string; nome: string }

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
    definirIdentidade: (identidade) => call('definir_identidade', { identidade }),
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
    familiaInfo: () => call<InfoFamilia | null>('familia_info'),
    familiaCriar: (repo, token) => call<InfoFamilia>('familia_criar', { repo, token }),
    familiaEntrar: (convite) => call<InfoFamilia>('familia_entrar', { convite }),
    familiaSair: () => call('familia_sair'),
    familiaConvite: (aparelho) => call<string>('familia_convite', { aparelho }),
    familiaVerificar: (aparelho) => call<InfoFamilia>('familia_verificar', { aparelho }),
    familiaTrocarToken: (token) => call<InfoFamilia>('familia_trocar_token', { token }),
    familiaRemoverAparelho: (aparelho, removido, destinatarios, token) => call<InfoFamilia>('familia_remover_aparelho', { aparelho, removido, destinatarios, token: token ?? null }),
    syncCursor: () => call<CursorEnvio>('sync_cursor'),
    syncEnviar: (aparelho, eventos) => call<number>('sync_enviar', { aparelho, eventos }),
    syncReceber: (aparelho) => call<number>('sync_receber', { aparelho }),
    redeAtual: (pedir) => call<RedeCasa | null>('rede_atual', { pedir: !!pedir }),
    redesCasa: () => call<RedeCasa[]>('redes_casa'),
    redeCasaAdicionar: ({ id, nome }) => call<RedeCasa[]>('rede_casa_adicionar', { id, nome }),
    redeCasaRemover: (id) => call<RedeCasa[]>('rede_casa_remover', { id }),
    chavePublicaAparelho: () => call<string>('chave_publica_aparelho'),
  };
}

// ── Navegador (desenvolvimento) ─────────────────────────────────────────────
// Sem criptografia: serve só para testar o fluxo. Nunca usado no app instalado.

function memoria(): Persistencia {
  const KEY = 'arquivo-dev';
  type Dev = { eventos: Evento[]; senha?: string; identidade?: Identidade; redes?: RedeCasa[]; backup: InfoBackup; copia?: { eventos: Evento[]; senha: string } };
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
    iniciar: async () => ({ eventos: d.eventos, temSenha: !!d.senha, backup: d.backup, versao: '0.4.0-dev', identidade: d.identidade ?? null }),
    gravar: async (ev) => { if (!d.eventos.some((e) => e.id === ev.id)) d.eventos.push(ev); salvar(); },
    definirIdentidade: async (i) => { d.identidade = i; salvar(); },
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
    familiaInfo: async () => null,
    familiaCriar: async () => { throw new Error('A família só funciona no app instalado.'); },
    familiaEntrar: async () => { throw new Error('A família só funciona no app instalado.'); },
    familiaSair: async () => {},
    familiaConvite: async () => { throw new Error('A família só funciona no app instalado.'); },
    familiaRemoverAparelho: async () => { throw new Error('A família só funciona no app instalado.'); },
    familiaVerificar: async () => { throw new Error('A família só funciona no app instalado.'); },
    familiaTrocarToken: async () => { throw new Error('A família só funciona no app instalado.'); },
    syncCursor: async () => ({ ultimoId: null, recebidos: [] }),
    syncEnviar: async () => 0,
    syncReceber: async () => 0,
    // Rede fictícia, para testar a tela e o "em casa" no navegador.
    redeAtual: async () => ({ id: '0'.repeat(64), nome: 'Rede (gateway a4:2b…)' }),
    redesCasa: async () => d.redes ?? [],
    redeCasaAdicionar: async (r) => { if (!(d.redes ?? []).some((x) => x.id === r.id)) d.redes = [...(d.redes ?? []), r]; salvar(); return d.redes ?? []; },
    redeCasaRemover: async (id) => { d.redes = (d.redes ?? []).filter((x) => x.id !== id); salvar(); return d.redes; },
    chavePublicaAparelho: async () => '',
  };
}

export const persistencia: Persistencia = EM_TAURI ? tauri() : memoria();

let contador = 0;
export function novoId() {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${Date.now().toString(36)}-${(contador++).toString(36)}-${r.slice(0, 8)}`;
}

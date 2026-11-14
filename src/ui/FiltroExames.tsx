// Controles do filtro de exames: pessoa, tipo, período (com datas) e ordem. A lógica está em `data/exames.ts`.
// Celular: dentro da folha "Filtrar" (`FolhaFiltroExames`). Computador: na coluna da lista (`desktop`).
import type { ReactNode } from 'react';
import { pessoa, useStore } from '../data/store';
import { quem } from '../data/format';
import { opcoesPessoas } from '../data/pets';
import { CATEGORIAS_EXAME } from '../data/formularios-puro';
import { FILTRO_EXAMES_PADRAO, ORDENS_EXAME, PERIODOS_EXAME, filtrosAtivos, type FiltroExames } from '../data/exames';
import { brParaISO, isoParaBR } from '../data/formularios-puro';
import { ChipGroup, Label } from './index';
import { Folha } from './Backup';
import { CampoData } from './CampoData';

export function CamposFiltroExames({ f, onChange, desktop }: { f: FiltroExames; onChange: (f: FiltroExames) => void; desktop?: boolean }) {
  const { state } = useStore();
  const set = (p: Partial<FiltroExames>) => onChange({ ...f, ...p });
  // Só as pessoas e os tipos que têm exame (no celular, já recortados pelo perfil aberto).
  const pessoas = opcoesPessoas(state.pessoas.filter((p) => state.exames.some((e) => e.pessoaId === p.id)), (p) => quem(p));
  const tipos = CATEGORIAS_EXAME.filter((c) => state.exames.some((e) => e.categoria === c));
  const tam = desktop ? 'xs' : 'sm';
  const grupo = (rotulo: string, filho: ReactNode) => (
    <div className="stack" style={{ gap: desktop ? 6 : 8 }}>
      {desktop ? <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{rotulo}</span> : <Label>{rotulo}</Label>}
      {filho}
    </div>
  );
  const data = (iso: string | undefined, rotulo: string, chave: 'de' | 'ate') => (
    <label className="stack" style={{ gap: 4, flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-2)' }}>
      {rotulo}
      <CampoData className={desktop ? 'input input--desk input--mono' : 'input input--mono'} rotulo={rotulo} valor={iso ? isoParaBR(iso) : ''} onChange={(br) => set({ [chave]: brParaISO(br) })} />
    </label>
  );
  return (
    <div className="stack" style={{ gap: desktop ? 12 : 18 }}>
      {pessoas.opcoes.length > 1 && grupo('Pessoa', (
        <ChipGroup gap6 tamanho={tam} opcoes={[{ id: 'todos', nome: 'Todos' }, ...pessoas.opcoes]} separarAntes={pessoas.separarAntes && pessoas.separarAntes + 1} valor={f.pessoa} onChange={(v) => set({ pessoa: v })} />
      ))}
      {tipos.length > 1 && grupo('Tipo de exame', (
        <ChipGroup gap6 tamanho={tam} opcoes={[{ id: 'todos', nome: 'Todos' }, ...tipos.map((c) => ({ id: c, nome: c }))]} valor={f.categoria} onChange={(v) => set({ categoria: v as FiltroExames['categoria'] })} />
      ))}
      {grupo('Período', (
        <>
          <ChipGroup gap6 tamanho={tam} opcoes={PERIODOS_EXAME} valor={f.periodo} onChange={(v) => set({ periodo: v })} />
          {f.periodo === 'entre' && <div className="hstack" style={{ gap: 8 }}>{data(f.de, 'De', 'de')}{data(f.ate, 'Até', 'ate')}</div>}
        </>
      ))}
      {grupo('Ordenar por', <ChipGroup gap6 tamanho={tam} opcoes={ORDENS_EXAME} valor={f.ordem} onChange={(v) => set({ ordem: v })} />)}
    </div>
  );
}

/** Resumo do que está filtrado, em uma linha ("Roberto · Imagem · Últimos 6 meses"). */
export function resumoFiltroExames(f: FiltroExames, nomePessoa: (id: string) => string): string {
  const partes: string[] = [];
  if (f.pessoa !== 'todos') partes.push(nomePessoa(f.pessoa));
  if (f.categoria !== 'todos') partes.push(f.categoria);
  if (f.periodo === 'entre') partes.push([f.de && `de ${isoParaBR(f.de)}`, f.ate && `até ${isoParaBR(f.ate)}`].filter(Boolean).join(' ') || 'Qualquer data');
  else if (f.periodo !== 'tudo') partes.push(PERIODOS_EXAME.find((p) => p.id === f.periodo)!.nome);
  if (f.ordem !== 'recentes') partes.push(ORDENS_EXAME.find((o) => o.id === f.ordem)!.nome);
  return partes.join(' · ');
}

/** Celular: botão "Filtrar", com quantos filtros estão ligados. */
export function BarraFiltroExames({ f, onAbrir }: { f: FiltroExames; onChange?: (f: FiltroExames) => void; onAbrir: () => void }) {
  const n = filtrosAtivos(f);
  return (
    <button type="button" className={n ? 'btn btn--soft btn--h40' : 'btn btn--outline btn--h40'} style={{ flexShrink: 0, padding: '0 14px', minHeight: 44 }} onClick={onAbrir} aria-label={n ? `Filtrar, ${n} ligados` : 'Filtrar'}>
      Filtrar{n ? ` · ${n}` : ''}
    </button>
  );
}

/** A linha "Roberto · Imagem · Últimos 6 meses   Limpar", quando há filtro ligado. */
export function ResumoFiltroExames({ f, onChange }: { f: FiltroExames; onChange: (f: FiltroExames) => void }) {
  const { state } = useStore();
  return (
    <span className="filtro-resumo">
      <span>{resumoFiltroExames(f, (id) => quem(pessoa(state, id)))}</span>
      <button type="button" onClick={() => onChange({ ...FILTRO_EXAMES_PADRAO, busca: f.busca })}>Limpar</button>
    </span>
  );
}

export function FolhaFiltroExames({ f, onChange, onClose, total }: { f: FiltroExames; onChange: (f: FiltroExames) => void; onClose: () => void; total: number }) {
  return (
    <Folha titulo="Filtrar exames" onClose={onClose}>
      <div style={{ maxHeight: '58vh', overflowY: 'auto' }}><CamposFiltroExames f={f} onChange={onChange} /></div>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" className="btn btn--outline btn--h50" style={{ padding: '0 16px' }} onClick={() => onChange({ ...FILTRO_EXAMES_PADRAO, busca: f.busca })}>Limpar</button>
        <button type="button" className="btn btn--ink btn--h50 btn--grow" onClick={onClose}>{total === 1 ? 'Ver 1 exame' : `Ver ${total} exames`}</button>
      </div>
    </Folha>
  );
}

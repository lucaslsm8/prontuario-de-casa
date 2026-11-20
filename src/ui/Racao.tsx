// Cartão "Ração" na página do pet: marca, porção, quanto dura o saco e "Abri um saco novo".
// A ração fica nos dados do pet (`DadosPet.racao`, evento editarPessoa). Lógica em src/data/racao.ts.
import { useState } from 'react';
import { HOJE } from '../data/tempo';
import { useStore } from '../data/store';
import { AVISO_RACAO_DIAS, diasDoSaco, fimDoSaco, textoPorcao } from '../data/racao';
import { lerQuantidade } from '../data/formularios-puro';
import { dataBR } from '../data/format';
import type { Pessoa, Racao } from '../data/types';
import { cx } from '.';

const num = (n?: number) => (n == null ? '' : String(n).replace('.', ','));

function Editar({ p, onFim, desktop }: { p: Pessoa; onFim: () => void; desktop?: boolean }) {
  const { api } = useStore();
  const r = p.pet?.racao;
  const [marca, setMarca] = useState(r?.marca ?? '');
  const [gramas, setGramas] = useState(num(r?.gramasDia));
  const [refeicoes, setRefeicoes] = useState(num(r?.refeicoes ?? 2));
  const [saco, setSaco] = useState(num(r?.sacoKg));
  const g = lerQuantidade(gramas);
  const ref = refeicoes.trim() ? Number(refeicoes) : undefined;
  const kg = saco.trim() ? lerQuantidade(saco) : undefined;
  const valido = !!marca.trim() && !!g && g > 0 && g <= 5000 && (ref == null || (Number.isInteger(ref) && ref >= 1 && ref <= 10)) && (!saco.trim() || (!!kg && kg > 0 && kg <= 100));
  const input = cx('input', desktop && 'input--desk');
  const salvar = () => {
    if (!valido) return;
    const nova: Racao = { marca: marca.trim(), gramasDia: g!, ...(ref ? { refeicoes: ref } : {}), ...(kg ? { sacoKg: kg } : {}), ...(r?.abertoEm ? { abertoEm: r.abertoEm } : kg ? { abertoEm: HOJE } : {}) };
    api.editarPessoa(p.id, { pet: { ...p.pet!, racao: nova } });
    api.toast({ texto: 'Ração salva' });
    onFim();
  };
  const campo = (rotulo: string, el: React.ReactNode) => <label className="stack" style={{ gap: 4, minWidth: 0 }}><span className="field__label">{rotulo}</span>{el}</label>;
  return (
    <form className="stack" style={{ gap: 10, padding: desktop ? '14px 18px' : '12px 16px' }} onSubmit={(e) => { e.preventDefault(); salvar(); }}>
      {campo('Marca e linha', <input className={input} value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Premier Adulto" />)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {campo('Gramas por dia', <input className={cx(input, 'input--mono')} inputMode="decimal" value={gramas} onChange={(e) => setGramas(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="300" />)}
        {campo('Refeições', <input className={cx(input, 'input--mono')} inputMode="numeric" value={refeicoes} onChange={(e) => setRefeicoes(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="2" />)}
        {campo('Saco (kg)', <input className={cx(input, 'input--mono')} inputMode="decimal" value={saco} onChange={(e) => setSaco(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="15" />)}
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className={cx('btn btn--teal', desktop ? 'btn--h36' : 'btn--h42')} disabled={!valido}>Salvar</button>
        <button type="button" className={cx('btn btn--outline', desktop ? 'btn--h36' : 'btn--h42')} onClick={onFim}>Cancelar</button>
        {r && <button type="button" className="btn btn--danger-link" style={{ marginLeft: 'auto', minHeight: 44 }} onClick={() => { api.editarPessoa(p.id, { pet: { ...p.pet!, racao: undefined } }); onFim(); }}>Tirar</button>}
      </div>
    </form>
  );
}

export function CartaoRacao({ p, desktop, podeEditar = true }: { p: Pessoa; desktop?: boolean; podeEditar?: boolean }) {
  const { api } = useStore();
  const [editando, setEditando] = useState(false);
  if (p.tipo !== 'pet') return null;
  const r = p.pet?.racao;
  const fim = r ? fimDoSaco(r, HOJE) : undefined;
  const acabando = !!fim && fim.faltam <= AVISO_RACAO_DIAS;
  const abrirSaco = () => { if (r) { api.editarPessoa(p.id, { pet: { ...p.pet!, racao: { ...r, abertoEm: HOJE } } }); api.toast({ texto: `Saco novo aberto: dura ${diasDoSaco(r)} dias` }); } };
  return (
    <div className="card" style={{ fontSize: 14, gap: 0 }}>
      <div className={cx('card-head', desktop && 'card-head--20')} style={desktop ? undefined : { padding: '12px 16px' }}>
        <span className="label">Ração</span>
        {podeEditar && !editando && <button type="button" className="btn--link" style={{ fontSize: 13, minHeight: 36 }} onClick={() => setEditando(true)}>{r ? 'Editar' : '+ Adicionar'}</button>}
      </div>
      {editando ? <Editar p={p} desktop={desktop} onFim={() => setEditando(false)} /> : r ? (
        <div className="stack" style={{ padding: desktop ? '12px 18px 16px' : '10px 16px 14px', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{r.marca}</span>
          <span className="muted">{textoPorcao(r)}</span>
          {fim && (
            <span style={{ color: acabando ? 'var(--warn-text)' : 'var(--text-2)', fontWeight: acabando ? 600 : 400 }}>
              {fim.faltam < 0 ? `O saco acabou em ${dataBR(fim.data)}` : fim.faltam === 0 ? 'O saco acaba hoje' : `O saco acaba em ${fim.faltam} ${fim.faltam === 1 ? 'dia' : 'dias'} (${dataBR(fim.data)})`}
            </span>
          )}
          {podeEditar && r.sacoKg && (
            <button type="button" className={cx('btn', desktop ? 'btn--outline btn--h36' : 'btn--soft btn--h42')} style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={abrirSaco}>Abri um saco novo</button>
          )}
        </div>
      ) : (
        <span className="muted" style={{ padding: desktop ? '12px 18px 16px' : '10px 16px 14px' }}>Marca, porção e tamanho do saco: o app avisa {AVISO_RACAO_DIAS} dias antes de acabar.</span>
      )}
    </div>
  );
}

// "Ler carteira de vacinação": foto da carteira do pet → OCR no aparelho → vacinas para conferir → registradas.
// A lógica de achar vacinas e datas no texto está em src/data/carteiraVacina.ts.
import { useEffect, useState } from 'react';
import { HOJE } from '../data/tempo';
import { useStore } from '../data/store';
import { textoDasImagens } from '../data/ocr';
import { POLIVALENTE, vacinasDaCarteira, type VacinaLida } from '../data/carteiraVacina';
import { brParaISO, isoParaBR } from '../data/formularios-puro';
import { SUGESTOES_VACINA } from '../data/pets';
import { novoId } from '../data/persistencia';
import type { Anexo, Pessoa, Vacina } from '../data/types';
import { useEscolherArquivos, Miniatura } from './Anexos';
import { CampoData } from './CampoData';
import { Bar, cx } from '.';

interface Linha { marcada: boolean; nome: string; data: string; proxima: string; lote?: string; trecho: string; jaRegistrada?: boolean }

const linhaDe = (v: VacinaLida): Linha => ({
  marcada: !v.jaRegistrada && !!v.data,
  nome: v.nome === POLIVALENTE ? '' : v.nome,
  data: v.data ? isoParaBR(v.data) : '',
  proxima: v.proxima ? isoParaBR(v.proxima) : '',
  lote: v.lote,
  trecho: v.trecho,
  jaRegistrada: v.jaRegistrada,
});

export function useLerCarteira(pet: Pessoa, onSalvo: () => void) {
  const { state, api } = useStore();
  const [fotos, setFotos] = useState<Anexo[]>([]);
  const [lendo, setLendo] = useState<number | null>(null);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [guardarFoto, setGuardarFoto] = useState(true);
  const escolher = useEscolherArquivos(pet.id, 'foto', (l) => setFotos((xs) => [...xs, ...l]), { soFotos: true });
  const camera = useEscolherArquivos(pet.id, 'foto', (l) => setFotos((xs) => [...xs, ...l]), { camera: true });

  // Cada foto nova é lida de novo junto com as outras (a carteira costuma ter várias páginas).
  useEffect(() => {
    if (!fotos.length) { setLinhas(null); return; }
    let vivo = true;
    setLendo(0);
    textoDasImagens(fotos.map((f) => async () => f.dados), (p) => { if (vivo) setLendo(p); })
      .then((textos) => {
        if (!vivo) return;
        const existentes = state.vacinas.filter((v) => v.pessoaId === pet.id);
        setLinhas(vacinasDaCarteira(textos.join('\n'), HOJE, existentes).map(linhaDe));
      })
      .catch(() => { if (vivo) { setLinhas([]); api.toast({ texto: 'Não foi possível ler a foto.' }); } })
      .finally(() => { if (vivo) setLendo(null); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos]);

  const mudar = (i: number, p: Partial<Linha>) => setLinhas((xs) => xs && xs.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const addLinha = () => setLinhas((xs) => [...(xs ?? []), { marcada: true, nome: '', data: '', proxima: '', trecho: '' }]);
  const marcadas = (linhas ?? []).filter((l) => l.marcada);
  const erro = (l: Linha) => {
    if (!l.nome.trim()) return 'Qual vacina?';
    const d = brParaISO(l.data);
    if (!d) return 'Data da aplicação';
    if (d > HOJE) return 'A aplicação não pode ser no futuro';
    if (l.proxima && (!brParaISO(l.proxima) || brParaISO(l.proxima)! <= d)) return 'Revacinação depois da aplicação';
    return undefined;
  };
  const valido = marcadas.length > 0 && marcadas.every((l) => !erro(l));

  const salvar = () => {
    if (!valido) return;
    for (const l of marcadas) {
      const v: Vacina = {
        id: `vac-${novoId()}`,
        pessoaId: pet.id,
        nome: l.nome.trim().replace(/\s+/g, ' '),
        data: brParaISO(l.data)!,
        ...(l.lote ? { lote: l.lote } : {}),
        ...(brParaISO(l.proxima) ? { proxima: brParaISO(l.proxima) } : {}),
      };
      api.addVacina(v);
    }
    if (guardarFoto && fotos.length) api.addAnexos(fotos.map((f) => ({ ...f, rotulo: 'Carteira de vacinação' })));
    api.toast({ texto: marcadas.length === 1 ? '1 vacina registrada' : `${marcadas.length} vacinas registradas` });
    onSalvo();
  };

  return { fotos, setFotos, lendo, linhas, mudar, addLinha, marcadas, erro, valido, salvar, guardarFoto, setGuardarFoto, escolher, camera };
}
export type LerCarteira = ReturnType<typeof useLerCarteira>;

/** O conteúdo da tela (celular) ou do diálogo (desktop). */
export function CorpoCarteira({ c, pet, desktop }: { c: LerCarteira; pet: Pessoa; desktop?: boolean }) {
  const input = cx('input', desktop && 'input--desk');
  const btn = cx('btn', desktop ? 'btn--outline btn--h40d' : 'btn--soft btn--h48');
  return (
    <div className="stack" style={{ gap: 14 }}>
      {c.escolher.elemento}{c.camera.elemento}
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>
        Fotografe as páginas da carteira de vacinação {pet.sexo === 'Feminino' ? 'da' : 'do'} {pet.curto}, com os selos e as datas bem visíveis.
        A leitura é feita no aparelho; nada é enviado. Confira cada vacina antes de adicionar: a letra à mão nem sempre sai.
      </p>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        {!desktop && <button type="button" className={btn} onClick={c.camera.abrir}>Tirar foto</button>}
        <button type="button" className={btn} onClick={c.escolher.abrir}>{c.fotos.length ? 'Mais uma página' : 'Escolher foto'}</button>
      </div>
      {c.fotos.length > 0 && (
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
          {c.fotos.map((f) => <Miniatura key={f.id} anexo={f} onRemover={() => c.setFotos(c.fotos.filter((x) => x.id !== f.id))} />)}
        </div>
      )}
      {c.lendo != null && (
        <div className="stack" style={{ gap: 6 }} role="status">
          <span style={{ fontSize: 14 }}>Lendo a carteira… {Math.round(c.lendo * 100)}%</span>
          <Bar pct={Math.max(4, Math.round(c.lendo * 100))} grossa />
        </div>
      )}
      {c.lendo == null && c.linhas && c.linhas.length === 0 && (
        <div className="card" style={{ padding: '12px 14px', fontSize: 14 }}>
          Não achei nenhuma vacina na foto. Tente outra foto, mais de perto e com boa luz, ou adicione à mão.
        </div>
      )}
      {c.lendo == null && c.linhas && (
        <div className="stack" style={{ gap: 10 }}>
          {c.linhas.map((l, i) => {
            const e = l.marcada ? c.erro(l) : undefined;
            return (
              <div key={i} className="card" style={{ padding: '12px 14px', gap: 10, opacity: l.marcada ? 1 : 0.6 }}>
                <label className="hstack" style={{ gap: 10, alignItems: 'center', minHeight: 32 }}>
                  <input type="checkbox" checked={l.marcada} onChange={(ev) => c.mudar(i, { marcada: ev.target.checked })} style={{ width: 20, height: 20 }} />
                  <span style={{ fontWeight: 600 }}>{l.nome || 'Vacina'}</span>
                  {l.jaRegistrada && <span className="muted" style={{ fontSize: 12 }}>já registrada</span>}
                </label>
                <div className="stack" style={{ gap: 8 }}>
                  <input className={input} list="sug-vacina-carteira" value={l.nome} onChange={(ev) => c.mudar(i, { nome: ev.target.value })} placeholder="Ex.: V10" aria-label="Vacina" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label className="stack" style={{ gap: 4, fontSize: 12, color: 'var(--text-2)' }}>Aplicada em
                      <CampoData className={cx(input, 'input--mono')} valor={l.data} onChange={(v) => c.mudar(i, { data: v })} max={HOJE} rotulo="Aplicada em" />
                    </label>
                    <label className="stack" style={{ gap: 4, fontSize: 12, color: 'var(--text-2)' }}>Revacinar em
                      <CampoData className={cx(input, 'input--mono')} valor={l.proxima} onChange={(v) => c.mudar(i, { proxima: v })} rotulo="Revacinar em" />
                    </label>
                  </div>
                  {l.lote && <span className="muted" style={{ fontSize: 12 }}>Lote <span className="mono">{l.lote}</span></span>}
                  {l.trecho && <span className="faint" style={{ fontSize: 12 }}>Lido: “{l.trecho}”</span>}
                  {e && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{e}</span>}
                </div>
              </div>
            );
          })}
          <datalist id="sug-vacina-carteira">{SUGESTOES_VACINA.map((s) => <option key={s} value={s} />)}</datalist>
          <button type="button" className="btn--link" style={{ alignSelf: 'flex-start', fontSize: 14, minHeight: 44 }} onClick={c.addLinha}>+ Adicionar outra vacina</button>
          {c.fotos.length > 0 && (
            <label className="hstack" style={{ gap: 10, alignItems: 'center', fontSize: 14, minHeight: 44 }}>
              <input type="checkbox" checked={c.guardarFoto} onChange={(ev) => c.setGuardarFoto(ev.target.checked)} style={{ width: 20, height: 20 }} />
              Guardar a foto da carteira nas fotos {pet.sexo === 'Feminino' ? 'da' : 'do'} {pet.curto}
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/** "Adicionar 3 vacinas". */
export const textoAdicionar = (n: number) => (n === 0 ? 'Adicionar vacinas' : n === 1 ? 'Adicionar 1 vacina' : `Adicionar ${n} vacinas`);

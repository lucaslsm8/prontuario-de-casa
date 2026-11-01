import { useStore } from '../data/store';
import { SUGESTOES_ALERGIA, SUGESTOES_CIRURGIA, SUGESTOES_CONDICAO, SUGESTOES_REACAO, SUGESTOES_VACINA } from '../data/sugestoes';

const LISTAS: [string, string[]][] = [
  ['sug-condicao', SUGESTOES_CONDICAO],
  ['sug-cirurgia', SUGESTOES_CIRURGIA],
  ['sug-vacina', SUGESTOES_VACINA],
  ['sug-alergia', SUGESTOES_ALERGIA],
  ['sug-reacao', SUGESTOES_REACAO],
];

/** Listas de sugestões (<datalist>) usadas pelos campos de alergia e condição com `list="sug-…"`. */
export function Sugestoes() {
  return (
    <>
      {LISTAS.map(([id, itens]) => (
        <datalist key={id} id={id}>
          {itens.map((x) => <option key={x} value={x} />)}
        </datalist>
      ))}
    </>
  );
}

/** Profissionais e locais já usados nas consultas (`list="sug-prof"` e `list="sug-local"`). */
export function SugestoesConsulta() {
  const { state } = useStore();
  const unicos = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x?.trim()))].sort();
  return (
    <>
      <datalist id="sug-prof">{unicos(state.consultas.map((c) => c.profissional)).map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="sug-local">{unicos(state.consultas.map((c) => c.local)).map((x) => <option key={x} value={x} />)}</datalist>
    </>
  );
}

import { useParams } from 'react-router-dom';
import { pessoa, podeVer, useStore } from '../data/store';
import { linhaDoTempo } from '../data/busca';
import { HOJE } from '../data/tempo';
import { TopNav } from '../ui';
import { BuscaMobile, LinhaDoTempo } from '../ui/Busca';
import { MScreen } from './Shell';

/** /busca — busca em tudo (celular). */
export function Busca() {
  return (
    <MScreen gap={14} tabs>
      <TopNav voltar="Início" voltarPara="/" />
      <h1 className="title" style={{ margin: 0 }}>Buscar</h1>
      <BuscaMobile />
    </MScreen>
  );
}

/** /pessoa/:id/historico — linha do tempo da pessoa (celular). */
export function HistoricoPessoa() {
  const { id = '' } = useParams();
  const { state } = useStore();
  const p = pessoa(state, id);
  if (!p) return null;
  return (
    <MScreen gap={14} tabs>
      <TopNav voltar={p.souEu ? 'Perfil' : p.curto} />
      <h1 className="title" style={{ margin: 0 }}>Histórico</h1>
      <LinhaDoTempo eventos={linhaDoTempo(state, id, (c) => podeVer(state, id, c), HOJE)} />
    </MScreen>
  );
}

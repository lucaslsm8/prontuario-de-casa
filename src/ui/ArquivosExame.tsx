// Arquivos do exame, em miniaturas pequenas: o pedido médico e o resultado (laudo, PDF, imagens).
// Tocar numa miniatura abre o visualizador em tela cheia; assim o resto da tela fica para os dados e os valores.
import type { Exame } from '../data/types';
import { GaleriaAnexos } from './Anexos';

export function ArquivosExame({ exame, podeEditar }: { exame: Exame; podeEditar: boolean }) {
  return (
    <div className="card arquivos-exame">
      <div className="arquivos-exame__parte">
        <span className="arquivos-exame__rotulo">Pedido do exame</span>
        <div className="anexos--mini"><GaleriaAnexos key={`${exame.id}-p`} donoId={exame.id} tipo="pedido" podeEditar={podeEditar} vazio="Sem pedido anexado." /></div>
      </div>
      <div className="arquivos-exame__parte">
        <span className="arquivos-exame__rotulo">Resultado</span>
        <div className="anexos--mini"><GaleriaAnexos key={`${exame.id}-r`} donoId={exame.id} tipo="exame" podeEditar={podeEditar} vazio="Sem resultado anexado." /></div>
      </div>
    </div>
  );
}
